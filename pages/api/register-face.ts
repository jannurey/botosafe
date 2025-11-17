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
