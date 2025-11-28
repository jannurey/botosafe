// pages/api/candidates/vote-counts.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/configs/supabase";
import crypto from "crypto";

interface VoteCountsResponse {
  [candidateId: number]: number;
}

// Decrypt vote function (same as in results.ts)
function decryptVote(encryptedHex: string): string | null {
  try {
    const encrypted = Buffer.from(encryptedHex, "hex");
    if (encrypted.length < 28) return null; // IV (12) + tag (16) + at least 1 byte

    const iv = encrypted.subarray(0, 12);
    const tag = encrypted.subarray(12, 28);
    const ciphertext = encrypted.subarray(28);

    const keyBuffer = Buffer.from(process.env.AES_KEY!, "hex");
    const decipher = crypto.createDecipheriv("aes-256-gcm", keyBuffer, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  } catch {
    return null;
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<VoteCountsResponse | { error: string }>
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const { election_id } = req.query;

    if (!election_id) {
      return res.status(400).json({ error: "election_id is required" });
    }

    // Get all votes for this election
    const { data: votes, error: voteError } = await supabaseAdmin
      .from('votes')
      .select('encrypted_vote')
      .eq('election_id', parseInt(election_id as string));

    if (voteError) {
      console.error("Supabase vote query error:", voteError);
      return res.status(500).json({ error: "Database error" });
    }

    // Decrypt and count votes
    const voteCounts: Record<number, number> = {};

    if (votes) {
      for (const vote of votes) {
        const decrypted = decryptVote(vote.encrypted_vote);
        if (!decrypted) continue;

        try {
          // Vote data is stored as Record<string, number> (position_id -> candidate_id)
          const parsed = JSON.parse(decrypted) as Record<string, number>;
          
          // Each entry in the object is a vote for a candidate
          Object.values(parsed).forEach((candidateId) => {
            const cid = Number(candidateId);
            if (!isNaN(cid)) {
              voteCounts[cid] = (voteCounts[cid] || 0) + 1;
            }
          });
        } catch (e) {
          console.error("⚠️ Invalid decrypted vote JSON:", e);
        }
      }
    }

    return res.status(200).json(voteCounts);
  } catch (err: unknown) {
    console.error("❌ Vote Counts API Error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return res.status(500).json({ error: message });
  }
}

