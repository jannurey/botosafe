import type { NextApiRequest, NextApiResponse } from "next";
import { pool } from "@/configs/database";
import { RowDataPacket, ResultSetHeader } from "mysql2";
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
const JWT_SECRET = process.env.JWT_SECRET!;

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
    const { votes, voteToken }: VoteRequest = req.body;

    if (!voteToken) {
      res.status(401).json({ error: "Vote token required" });
      return;
    }
    if (!votes || Object.keys(votes).length === 0) {
      res.status(400).json({ error: "No votes submitted" });
      return;
    }

    // 🔐 Verify short-lived vote token
    const decodedRaw = jwt.verify(voteToken, JWT_SECRET);
    const decoded = decodedRaw as DecodedVoteToken;

    if (!decoded.id || !decoded.electionId) {
      res.status(401).json({ error: "Invalid vote token payload" });
      return;
    }

    const userId = decoded.id;
    const electionId = decoded.electionId;

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // ✅ Check election period
      const [electionRows] = await connection.query<RowDataPacket[]>(
        `SELECT start_time, end_time FROM elections WHERE id = ?`,
        [electionId]
      );
      if (electionRows.length === 0) {
        await connection.rollback();
        res.status(400).json({ error: "Invalid election" });
        return;
      }

      const now = new Date();
      const start = new Date(electionRows[0].start_time);
      const end = new Date(electionRows[0].end_time);
      if (now < start || now > end) {
        await connection.rollback();
        res
          .status(403)
          .json({ error: "Voting not allowed outside election period" });
        return;
      }

      // 🚫 Check if user already voted
      const [voteCheckRows] = await connection.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS count FROM votes WHERE user_id = ? AND election_id = ?`,
        [userId, electionId]
      );
      if ((voteCheckRows[0].count as number) > 0) {
        await connection.rollback();
        res
          .status(403)
          .json({ error: "User has already voted in this election" });
        return;
      }

      // 🧾 Fetch candidate info (join users to get fullname)
      const candidateIds = Object.values(votes);
      const [candidateRows] = await connection.query<RowDataPacket[]>(
        `SELECT c.id, u.fullname AS candidate, c.position_id
         FROM candidates c
         JOIN users u ON c.user_id = u.id
         WHERE c.id IN (?)`,
        [candidateIds]
      );

      const positionsMap = candidateRows.reduce((acc, row) => {
        acc[row.position_id as number] = row.position_id as number;
        return acc;
      }, {} as Record<number, number>);

      const candidatesMap = candidateRows.reduce((acc, row) => {
        acc[row.id as number] = row.candidate as string;
        return acc;
      }, {} as Record<number, string>);

      // 🗳️ Insert encrypted votes
      for (const [positionId, candidateId] of Object.entries(votes)) {
        const voteData = JSON.stringify({ positionId, candidateId });
        const encryptedVote = encryptVote(voteData);

        await connection.query<ResultSetHeader>(
          `INSERT INTO votes (user_id, election_id, encrypted_vote, cast_at)
           VALUES (?, ?, ?, NOW())`,
          [userId, electionId, encryptedVote]
        );
      }

      await connection.commit();

      // 🧾 Return receipt summary
      const receipt = Object.entries(votes).map(
        ([positionId, candidateId]) => ({
          position: positionsMap[parseInt(positionId)] || positionId,
          candidate: candidatesMap[Number(candidateId)] || "Unknown",
        })
      );

      res.status(201).json({
        message: "Votes submitted successfully",
        receipt,
      });
    } catch (error) {
      await connection.rollback();
      console.error("❌ Error submitting votes:", error);
      res.status(500).json({ error: "Failed to submit vote" });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("JWT/vote error:", error);
    res.status(401).json({ error: "Invalid or expired vote token" });
  }
}
