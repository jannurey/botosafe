// pages/api/vote.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { votes } from "@/lib/supabaseClient";
import jwt, { JwtPayload } from "jsonwebtoken";
import crypto from "crypto";

interface VoteRequest {
  votes: Record<string, number>; // position_id -> candidate_id
  voteToken: string;
}

interface DecodedVoteToken extends JwtPayload {
  id: number;
  electionId: number;
}

// ✅ Required environment variables
const AES_KEY = process.env.AES_KEY!;

// ✅ Encrypt a vote using AES-256-GCM
function encryptVote(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const keyBuffer = Buffer.from(AES_KEY, "hex");
  const cipher = crypto.createCipheriv("aes-256-gcm", keyBuffer, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("hex");
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
    return;
  }

  try {
    const { votes: voteData, voteToken }: VoteRequest = req.body;

    if (!voteToken) {
      res.status(400).json({ error: "Missing vote token" });
      return;
    }

    // ✅ Verify vote token
    let decoded: DecodedVoteToken;
    try {
      decoded = jwt.verify(voteToken, process.env.JWT_SECRET!) as DecodedVoteToken;
    } catch (err) {
      res.status(401).json({ error: "Invalid or expired vote token" });
      return;
    }

    const { id: userId, electionId } = decoded;

    // ✅ Check if user already voted
    const hasVoted = await votes.hasVoted(userId, electionId);
    if (hasVoted) {
      res.status(400).json({ error: "User already voted" });
      return;
    }

    // ✅ Encrypt vote data
    const plaintext = JSON.stringify(voteData);
    const encryptedVote = encryptVote(plaintext);

    // ✅ Save vote to database
    const { data: vote, error } = await votes.create({
      user_id: userId,
      election_id: electionId,
      encrypted_vote: encryptedVote,
    });

    if (error) {
      console.error("Error saving vote:", error);
      res.status(500).json({ error: "Failed to save vote" });
      return;
    }

    res.status(200).json({ message: "Vote recorded successfully" });
  } catch (err: unknown) {
    console.error("❌ Vote API Error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: message });
  }
}