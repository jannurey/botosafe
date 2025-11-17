import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/configs/supabase";
import jwt from "jsonwebtoken";
import * as faceapi from "@vladmandic/face-api";
import { logFaceVerificationEvent } from "@/lib/faceEvents";

/**
 * Improved face verification API.
 */

/* ---------- Types ---------- */
interface FaceRow {
  user_id: number;
  face_embedding: string; // JSON string stored in DB
}

interface UserRow {
  id: number;
  fullname: string;
  email: string;
  role: string;
}

/* ---------- Helpers (strictly typed) ---------- */
function toNumberArray(input: unknown): number[] {
  if (Array.isArray(input)) {
    return (input as unknown[]).map((v) => Number(v));
  }
  if (input instanceof Float32Array) {
    return Array.from(input);
  }
  throw new Error("Invalid embedding format");
}

function normalizeEmbedding(embedding: number[]): number[] {
  const norm =
    Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0)) || 1;
  return embedding.map((val) => val / norm);
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return -1;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return -1;
  return dot / denom;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((x, y) => x - y);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/* ---------- Config ---------- */
const THRESHOLD_MATCH = 0.85;

/* ---------- Handler ---------- */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const body = req.body as {
      userId?: number;
      embedding?: number[] | Float32Array;
      samples?: (number[] | Float32Array)[];
      forVoting?: boolean;
      electionId?: string | number;
      debug?: boolean;
    };

    const userId = Number(body.userId || 0);
    if (!userId) {
      return res.status(400).json({ message: "Missing userId" });
    }

    const sourceLabel = "vote";

    const incomingSamples: number[][] = [];

    if (Array.isArray(body.samples) && body.samples.length > 0) {
      for (const s of body.samples) {
        try {
          const arr = toNumberArray(s);
          incomingSamples.push(normalizeEmbedding(arr));
        } catch {
          // skip invalid sample
        }
      }
    } else if (body.embedding !== undefined) {
      try {
        const arr = toNumberArray(body.embedding);
        incomingSamples.push(normalizeEmbedding(arr));
      } catch {
        // invalid single embedding
      }
    }

    if (incomingSamples.length === 0) {
      return res
        .status(400)
        .json({ message: "No valid embedding samples provided" });
    }

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

    const storedEmbeddings: number[][] = [];
    for (const row of faceRows) {
      try {
        const parsed = JSON.parse(row.face_embedding);
        if (
          Array.isArray(parsed) &&
          parsed.length > 0 &&
          Array.isArray(parsed[0])
        ) {
          for (const e of parsed as unknown[]) {
            try {
              const arr = toNumberArray(e);
              storedEmbeddings.push(normalizeEmbedding(arr));
            } catch {
              // skip invalid
            }
          }
        } else if (Array.isArray(parsed)) {
          try {
            const arr = toNumberArray(parsed);
            storedEmbeddings.push(normalizeEmbedding(arr));
          } catch {
            // skip
          }
        }
      } catch {
        // if parsing fails, skip this row
      }
    }

    if (storedEmbeddings.length === 0) {
      return res
        .status(200)
        .json({ match: false, message: "No valid stored embeddings" });
    }

    const allScores: number[] = [];
    for (const sample of incomingSamples) {
      for (const stored of storedEmbeddings) {
        const sim = cosineSimilarity(sample, stored);
        allScores.push(sim);
      }
    }

    const bestScore = allScores.length > 0 ? Math.max(...allScores) : -1;
    const medianScore = median(allScores);
    const averageScore =
      allScores.length > 0
        ? allScores.reduce((a, b) => a + b, 0) / allScores.length
        : -1;

    const isMatch = bestScore >= THRESHOLD_MATCH;

    // Log event before responding
    await logFaceVerificationEvent({
      req,
      userId,
      electionId: body?.electionId ?? null,
      decisionMatch: isMatch,
      bestScore,
      medianScore,
      threshold: THRESHOLD_MATCH,
      attemptLabel: "genuine",
      source: sourceLabel,
    });

    if (!isMatch) {
      return res.status(200).json({
        match: false,
        message: "Face not recognized",
        bestScore,
        medianScore,
        averageScore,
        threshold: THRESHOLD_MATCH,
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

    if (!userRows || userRows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = userRows[0];

    if (body.forVoting) {
      const voteToken = jwt.sign(
        { id: user.id, electionId: body.electionId ?? null },
        process.env.JWT_SECRET ?? "unknown",
        { expiresIn: "5m" }
      );
      return res.status(200).json({
        match: true,
        user,
        voteToken,
        message: "Face verified for voting.",
        bestScore,
        medianScore,
      });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, mfa: true },
      process.env.JWT_SECRET ?? "unknown",
      { expiresIn: "1h" }
    );

    // Determine if we're in a secure context (HTTPS)
    const isSecure = req.headers['x-forwarded-proto'] === 'https' || 
                    (req.socket as any).encrypted || 
                    process.env.NODE_ENV === 'production';

    const cookieHeader = [
      `authToken=${token}; Path=/; HttpOnly; SameSite=Lax${isSecure ? '; Secure' : ''}; Max-Age=${60 * 60}`,
    ];
    
    res.setHeader("Set-Cookie", cookieHeader);

    return res.status(200).json({
      match: true,
      user,
      message: "Face verified. User logged in.",
      bestScore,
      medianScore,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("❌ Face verify error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}