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
    const { embedding, embeddings } = req.body as {
      embedding?: number[] | Float32Array;
      embeddings?: (number[] | Float32Array)[];
    };

    // Support both single embedding (legacy) and multiple embeddings (new multi-sample)
    const inputEmbeddings: (number[] | Float32Array)[] = [];
    
    if (embeddings && Array.isArray(embeddings) && embeddings.length > 0) {
      inputEmbeddings.push(...embeddings);
    } else if (embedding) {
      inputEmbeddings.push(embedding);
    }

    if (inputEmbeddings.length === 0) {
      res.status(400).json({ message: "Missing embedding or embeddings" });
      return;
    }

    // Normalize all embeddings
    const normalizedEmbeddings = inputEmbeddings.map(emb => normalizeEmbedding(emb));
    
    // ✅ CHECK FOR DUPLICATE FACES ACROSS ALL USERS
    // Fetch all existing face embeddings from database
    const { data: allFaces, error: fetchError } = await userFaces.getAll();
    
    if (fetchError) {
      console.error("Error fetching existing faces:", fetchError);
      res.status(500).json({ message: "Failed to verify face uniqueness" });
      return;
    }
    
    // Check if this face already exists for another user
    const SIMILARITY_THRESHOLD = 0.85; // 85% similarity threshold for consistency with verification
    
    if (allFaces && allFaces.length > 0) {
      for (const existingFace of allFaces) {
        // Skip checking against the current user's own face (if updating)
        if (existingFace.user_id === userId) {
          continue;
        }
        
        // Skip if this face has no embedding yet (new user who hasn't completed registration)
        if (!existingFace.face_embedding) {
          continue;
        }
        
        try {
          // Parse the stored embedding (could be single or array)
          const parsed = JSON.parse(existingFace.face_embedding);
          const storedEmbeddings: number[][] = [];
          
          // Handle both single embedding and array of embeddings
          if (Array.isArray(parsed) && parsed.length > 0) {
            if (Array.isArray(parsed[0])) {
              // Array of embeddings
              storedEmbeddings.push(...parsed.map((e: number[]) => normalizeEmbedding(e)));
            } else {
              // Single embedding
              storedEmbeddings.push(normalizeEmbedding(parsed));
            }
          }
          
          // Check similarity between any new embedding and any stored embedding
          for (const newEmb of normalizedEmbeddings) {
            for (const storedEmb of storedEmbeddings) {
              const similarity = cosineSimilarity(newEmb, storedEmb);
              
              // If similarity exceeds threshold, reject registration
              if (similarity >= SIMILARITY_THRESHOLD) {
                console.log(`🚫 Duplicate face detected! Similarity: ${similarity.toFixed(4)} (${(similarity * 100).toFixed(2)}%) with user ${existingFace.user_id}`);
                res.status(409).json({ 
                  message: "This face is already registered to another account. Each person can only have one account. Please contact support if you believe this is an error." 
                });
                return;
              }
            }
          }
        } catch (parseError) {
          console.error("Error parsing stored embedding:", parseError);
          // Continue checking other faces even if one fails to parse
          continue;
        }
      }
    }
    
    // Convert all embeddings to JSON string for storage
    const embeddingJson = JSON.stringify(normalizedEmbeddings);

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
