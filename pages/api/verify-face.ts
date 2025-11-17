import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/configs/supabase";
import jwt from "jsonwebtoken";
import * as faceapi from "@vladmandic/face-api";

interface FaceRow {
  id: number;
  user_id: number;
  face_embedding: string;
}

interface UserRow {
  id: number;
  fullname: string;
  email: string;
  role: string;
}

// ------------------- UTILITY -------------------
function normalizeEmbedding(embedding: number[]): number[] {
  const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return embedding.map((val) => val / (norm || 1));
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

function toNumberArray(input: unknown): number[] {
  if (Array.isArray(input)) return input.map(Number);
  if (input instanceof Float32Array) return Array.from(input);
  throw new Error("Invalid embedding format");
}

const THRESHOLD = 0.85;

// ------------------- HANDLER -------------------
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST")
    return res.status(405).json({ message: "Method not allowed" });

  try {
    const { userId, embedding, forVoting } = req.body as {
      userId: number;
      embedding: number[] | Float32Array;
      forVoting?: boolean;
    };

    if (!userId || !embedding)
      return res.status(400).json({ message: "Missing userId or embedding" });

    const embeddingArray = toNumberArray(embedding);
    const normalized = normalizeEmbedding(embeddingArray);

    const { data: faceRows, error: faceError } = await supabaseAdmin
      .from('user_faces')
      .select('user_id, face_embedding')
      .eq('user_id', userId);

    if (faceError) {
      console.error("Supabase query error:", faceError);
      return res.status(500).json({ message: "Database error" });
    }

    if (!faceRows || faceRows.length === 0) {
      return res
        .status(200)
        .json({ match: false, message: "No face registered" });
    }

    const storedEmbedding = toNumberArray(
      JSON.parse(faceRows[0].face_embedding)
    );
    const normalizedStored = normalizeEmbedding(storedEmbedding);
    const sim = cosineSimilarity(normalized, normalizedStored);
    
    // Log the similarity score for debugging
    console.log(`Face verification for user ${userId}: similarity = ${sim.toFixed(4)}, threshold = ${THRESHOLD}`);

    if (sim < THRESHOLD) {
      return res
        .status(200)
        .json({ 
          match: false, 
          message: "Face not recognized",
          bestScore: sim,
          threshold: THRESHOLD
        });
    }

    const { data: userRows, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, fullname, email, role')
      .eq('id', userId);

    if (userError) {
      console.error("Supabase query error:", userError);
      return res.status(500).json({ message: "Database error" });
    }

    if (!userRows || userRows.length === 0)
      return res.status(404).json({ message: "User not found" });
    const user = userRows[0];

    if (forVoting) {
      // 🔐 Issue short-lived vote token (valid for 5 min)
      const voteToken = jwt.sign(
        { id: user.id, electionId: req.body.electionId },
        process.env.JWT_SECRET!,
        { expiresIn: "5m" }
      );
      return res.status(200).json({
        match: true,
        user,
        voteToken,
        message: "Face verified for voting.",
        bestScore: sim,
        threshold: THRESHOLD
      });
    } else {
      // 🔐 Issue regular login token
      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role, mfa: true },
        process.env.JWT_SECRET!,
        { expiresIn: "1h" }
      );

      // Determine if we're in a secure context (HTTPS)
      const isSecure = req.headers['x-forwarded-proto'] === 'https' || 
                      (req.socket as any).encrypted || 
                      process.env.NODE_ENV === 'production';
      
      const cookieHeader = [
        `authToken=${token}; Path=/; HttpOnly; SameSite=Lax${isSecure ? '; Secure' : ''}; Max-Age=${60 * 60}`,
      ];
      
      // Also set a non-HttpOnly cookie for client-side access if needed
      // But for security, we'll rely on the temporary auth token approach
      
      res.setHeader("Set-Cookie", cookieHeader);

      return res
        .status(200)
        .json({ 
          match: true, 
          user, 
          message: "Face verified. User logged in.",
          bestScore: sim,
          threshold: THRESHOLD
        });
    }
  } catch (err) {
    console.error("❌ Face verify error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}