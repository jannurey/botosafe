// pages/api/candidates/index.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { pool } from "@/configs/database";
import { RowDataPacket, ResultSetHeader } from "mysql2";

interface Achievement {
  id?: number;
  title: string;
  type: string;
  created_at?: string;
}

interface Candidate extends RowDataPacket {
  id: number;
  user_id: number;
  fullname: string;
  election_id: number;
  election_title: string;
  position_id: number;
  position_name: string;
  achievements: string; // JSON string before parsing
  photo_url?: string;
  partylist?: string;
  coc_file_url?: string;
  status: string;
  created_at: string;
}

interface CandidateResponse {
  id: number;
  user_id: number;
  fullname: string;
  election_id: number;
  election_title: string;
  position_id: number;
  position_name: string;
  achievements: Achievement[];
  photo_url?: string;
  partylist?: string;
  coc_file_url?: string;
  status: string;
  created_at: string;
}

interface PostCandidateBody {
  user_id: number;
  election_id: number;
  position_id: number;
  achievements?: Achievement[];
  photo_url?: string;
  partylist?: string;
  coc_file_url?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  try {
    // 🟩 GET ALL CANDIDATES
    if (req.method === "GET") {
      const [rows] = await pool.query<Candidate[]>(
        `SELECT 
           c.id,
           c.user_id,
           u.fullname,
           c.election_id,
           e.title AS election_title,
           c.position_id,
           p.name AS position_name,
           COALESCE(
             CONCAT(
               '[',
               GROUP_CONCAT(
                 CONCAT(
                   '{"id":', ca.id,
                   ',"title":"', IFNULL(ca.title, ''), '"',
                   ',"type":"', IFNULL(ca.type, ''), '"',
                   ',"created_at":"', IFNULL(ca.created_at, ''), '"}'
                 )
               ),
               ']'
             ),
             '[]'
           ) AS achievements,
           c.photo_url,
           c.partylist,
           c.coc_file_url,
           c.status,
           c.created_at
         FROM candidates c
         JOIN users u ON c.user_id = u.id
         JOIN elections e ON c.election_id = e.id
         JOIN positions p ON c.position_id = p.id
         LEFT JOIN candidate_achievements ca ON ca.candidate_id = c.id
         GROUP BY c.id, u.fullname, e.title, p.name
         ORDER BY c.created_at DESC`
      );

      const candidates: CandidateResponse[] = rows.map((row) => {
        let achievements: Achievement[] = [];
        try {
          achievements = JSON.parse(row.achievements || "[]");
        } catch {
          achievements = [];
        }
        return { ...row, achievements };
      });

      res.status(200).json(candidates);
      return;
    }

    // 🟦 CREATE CANDIDATE
    if (req.method === "POST") {
      const {
        user_id,
        election_id,
        position_id,
        achievements = [],
        photo_url,
        partylist,
        coc_file_url,
      } = req.body as PostCandidateBody;

      if (!user_id || !election_id || !position_id) {
        res.status(400).json({ error: "Missing required fields" });
        return;
      }

      // Check if user already filed
      const [existing] = await pool.query<RowDataPacket[]>(
        `SELECT id FROM candidates WHERE user_id = ? AND election_id = ?`,
        [user_id, election_id]
      );

      if (existing.length > 0) {
        res.status(400).json({ error: "You already filed for this election." });
        return;
      }

      // Insert candidate
      const [insertResult] = await pool.query<ResultSetHeader>(
        `INSERT INTO candidates 
           (user_id, election_id, position_id, photo_url, partylist, coc_file_url, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW())`,
        [user_id, election_id, position_id, photo_url, partylist, coc_file_url]
      );

      const candidateId = insertResult.insertId;

      // Insert achievements
      if (achievements.length > 0) {
        const values = achievements.map(() => `(?, ?, ?, NOW())`).join(",");
        const flatValues = achievements.flatMap((a) => [
          candidateId,
          a.title,
          a.type,
        ]);

        await pool.query<ResultSetHeader>(
          `INSERT INTO candidate_achievements (candidate_id, title, type, created_at)
           VALUES ${values}`,
          flatValues
        );
      }

      const [newCandidateRows] = await pool.query<Candidate[]>(
        `SELECT c.*, u.fullname, e.title AS election_title, p.name AS position_name
         FROM candidates c
         JOIN users u ON c.user_id = u.id
         JOIN elections e ON c.election_id = e.id
         JOIN positions p ON c.position_id = p.id
         WHERE c.id = ?`,
        [candidateId]
      );

      res.status(201).json(newCandidateRows[0]);
      return;
    }

    // 🟨 UPDATE STATUS
    if (req.method === "PATCH") {
      const { id, status } = req.body as { id: number; status: string };

      if (!id || !status) {
        res.status(400).json({ error: "Missing required fields" });
        return;
      }

      await pool.query<ResultSetHeader>(
        `UPDATE candidates SET status = ? WHERE id = ?`,
        [status, id]
      );

      const [updatedRows] = await pool.query<Candidate[]>(
        `SELECT * FROM candidates WHERE id = ?`,
        [id]
      );

      res.status(200).json(updatedRows[0]);
      return;
    }

    // 🟥 DELETE CANDIDATE
    if (req.method === "DELETE") {
      const { id } = req.query as { id: string };

      if (!id) {
        res.status(400).json({ error: "Missing candidate ID" });
        return;
      }

      await pool.query<ResultSetHeader>(
        `DELETE FROM candidate_achievements WHERE candidate_id = ?`,
        [id]
      );

      const [deleteResult] = await pool.query<ResultSetHeader>(
        `DELETE FROM candidates WHERE id = ?`,
        [id]
      );

      if (deleteResult.affectedRows === 0) {
        res.status(404).json({ error: "Candidate not found" });
        return;
      }
      res.status(200).json({ message: "Candidate deleted successfully" });
      return;
    }

    // Method not allowed
    res.setHeader("Allow", ["GET", "POST", "PATCH", "DELETE"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
    return;
  } catch (error) {
    console.error("API candidates error", error);
    res.status(500).json({ error: "Server error" });
  }
}
