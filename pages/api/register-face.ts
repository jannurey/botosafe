// pages/api/register-face.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { userFaces } from "@/lib/supabaseClient";
import jwt from "jsonwebtoken";

// ------------------- UTILITY -------------------
function normalizeEmbedding(embedding: number[] | Float32Array): number[] {
  const arr = Array.from(embedding);
  const norm = Math.sqrt(arr.reduce((sum, val) => sum + val * val, 0));
  return norm === 0 ? arr : arr.map((val) => val / norm);
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0,
    normA = 0,
    normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ------------------- HANDLER -------------------
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ message: string }>
): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ message: "Method not allowed" });
    return;
  }

  try {
    // Get user ID from temporary token instead of request body
    const tempAuthToken = req.cookies.tempAuthToken;
    if (!tempAuthToken) {
      res.status(401).json({ message: "No temporary token found" });
      return;
    }

    // Verify the temporary token
    const decoded = jwt.verify(tempAuthToken, process.env.JWT_SECRET!) as JwtPayload;
    if (!decoded || !decoded.temp) {
      res.status(401).json({ message: "Invalid temporary token" });
      return;
    }

    const userId = decoded.id;
    const { embedding } = req.body as {
      embedding: number[] | Float32Array;
    };

    if (!embedding) {
      res.status(400).json({ message: "Missing embedding" });
      return;
    }

    // Normalize the embedding
    const normalizedEmbedding = normalizeEmbedding(embedding);
    
    // ✅ CHECK FOR DUPLICATE FACES ACROSS ALL USERS
    // Fetch all existing face embeddings from database
    const { data: allFaces, error: fetchError } = await userFaces.getAll();
    
    if (fetchError) {
      console.error("Error fetching existing faces:", fetchError);
      res.status(500).json({ message: "Failed to verify face uniqueness" });
      return;
    }
    
    // Check if this face already exists for another user
    const SIMILARITY_THRESHOLD = 0.80; // 80% similarity threshold (stricter than before)
    
    if (allFaces && allFaces.length > 0) {
      for (const existingFace of allFaces) {
        // Skip checking against the current user's own face (if updating)
        if (existingFace.user_id === userId) {
          continue;
        }
        
        try {
          // Skip if no embedding data
          if (!existingFace.face_embedding) {
            continue;
          }
          
          // Parse the stored embedding
          const storedEmbedding = JSON.parse(existingFace.face_embedding);
          
          // Normalize the stored embedding to ensure consistent comparison
          const normalizedStored = normalizeEmbedding(storedEmbedding);
          
          // Calculate similarity between normalized embeddings
          const similarity = cosineSimilarity(normalizedEmbedding, normalizedStored);
          
          // If similarity exceeds threshold, reject registration
          if (similarity >= SIMILARITY_THRESHOLD) {
            console.log(`🚫 Duplicate face detected! Similarity: ${similarity.toFixed(4)} (${(similarity * 100).toFixed(2)}%) with user ${existingFace.user_id}`);
            res.status(409).json({ 
              message: "This face is already registered to another account. Each person can only have one account. Please contact support if you believe this is an error." 
            });
            return;
          }
        } catch (parseError) {
          console.error("Error parsing stored embedding:", parseError);
          // Continue checking other faces even if one fails to parse
          continue;
        }
      }
    }
    
    // Convert to JSON string for storage
    const embeddingJson = JSON.stringify(normalizedEmbedding);

    // Save face embedding to database
    const { data: faceData, error } = await userFaces.upsert(userId, embeddingJson);

    if (error) {
      console.error("Error saving face embedding:", error);
      res.status(500).json({ message: "Failed to register face" });
      return;
    }

    res.status(200).json({ message: "Face registered successfully" });
  } catch (err: unknown) {
    console.error("Face registration error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ message });
  }
}

interface JwtPayload {
  id: number;
  temp: boolean;
  [key: string]: string | number | boolean | object | null | undefined;
}
