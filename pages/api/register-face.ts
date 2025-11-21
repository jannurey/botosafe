// pages/api/register-face.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { userFaces } from "@/lib/supabaseClient";
import jwt from "jsonwebtoken";

interface JwtPayload {
  id: number;
  temp: boolean;
  [key: string]: string | number | boolean | object | null | undefined;
}

// ------------------- UTILITY -------------------
function normalizeEmbedding(embedding: number[] | Float32Array): number[] {
  const arr = Array.from(embedding);
  const norm = Math.sqrt(arr.reduce((sum, val) => sum + val * val, 0));
  return norm === 0 ? arr : arr.map((val) => val / norm);
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ------------------- HANDLER -------------------
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ message: string }>
) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  try {
    const tempAuthToken = req.cookies.tempAuthToken;
    if (!tempAuthToken) return res.status(401).json({ message: "No temporary token found" });

    const decoded = jwt.verify(tempAuthToken, process.env.JWT_SECRET!) as JwtPayload;
    if (!decoded || !decoded.temp) return res.status(401).json({ message: "Invalid token" });

    const userId = decoded.id;
    const { embeddings } = req.body as { embeddings?: (number[] | Float32Array)[] };
    if (!embeddings || embeddings.length === 0) return res.status(400).json({ message: "Missing embeddings" });

    // Normalize embeddings
    const newEmbeddings = embeddings.map(normalizeEmbedding);

    // ---------------- DUPLICATE CHECK ----------------
    const { data: allFaces, error: fetchError } = await userFaces.getAll();
    if (fetchError) return res.status(500).json({ message: "Failed to fetch existing faces" });

    const DUPLICATE_THRESHOLD = 0.92; // Cosine similarity threshold for duplicates

    if (allFaces && allFaces.length > 0) {
      for (const existingFace of allFaces) {
        if (existingFace.user_id === userId) continue; // Skip own embeddings
        if (!existingFace.face_embedding) continue;

        let storedEmbeddings: number[][] = [];
        try {
          const parsed = JSON.parse(existingFace.face_embedding);
          if (Array.isArray(parsed) && parsed.length > 0) {
            if (Array.isArray(parsed[0])) {
              storedEmbeddings = parsed.map(normalizeEmbedding);
            } else {
              storedEmbeddings = [normalizeEmbedding(parsed)];
            }
          }
        } catch (e) {
          continue; // Skip invalid embeddings
        }

        // Compare all new embeddings to stored embeddings
        let maxSimilarity = 0;
        for (const newEmb of newEmbeddings) {
          for (const storedEmb of storedEmbeddings) {
            const sim = cosineSimilarity(newEmb, storedEmb);
            if (sim > maxSimilarity) maxSimilarity = sim;
          }
        }

        if (maxSimilarity >= DUPLICATE_THRESHOLD) {
          return res.status(409).json({
            message: "This face is already registered to another account."
          });
        }
      }
    }

    // ---------------- SAVE NEW EMBEDDINGS ----------------
    const embeddingJson = JSON.stringify(newEmbeddings);
    const { error } = await userFaces.upsert(userId, embeddingJson);
    if (error) return res.status(500).json({ message: "Failed to save face" });

    return res.status(200).json({ message: "Face registered successfully" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return res.status(500).json({ message });
  }
}
