import type { NextApiRequest, NextApiResponse } from "next";
import { pool } from "@/configs/database";
import { RowDataPacket } from "mysql2";

interface VoteRow extends RowDataPacket {
  id: number;
  cast_at: Date | string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    // Accept voteId=123 or voteIds=1,2,3
    const voteIdParam = req.query.voteId as string | undefined;
    const voteIdsParam =
      (req.query.voteIds as string | undefined) || voteIdParam;

    if (!voteIdsParam) {
      return res
        .status(400)
        .json({ error: "Missing voteId or voteIds query parameter" });
    }

    const ids = voteIdsParam
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n) && n > 0);

    if (ids.length === 0) {
      return res.status(400).json({ error: "No valid vote IDs provided" });
    }

    const [rows] = await pool.query<VoteRow[]>(
      `SELECT id, cast_at FROM votes WHERE id IN (?)`,
      [ids]
    );

    const includedCount = rows.length;
    const expectedCount = ids.length;
    const allIncluded = includedCount === expectedCount;

    let includedAtServerMs: number | null = null;
    if (rows.length > 0) {
      const maxCastAt = rows
        .map((r) => new Date(r.cast_at as any).getTime())
        .reduce((a, b) => Math.max(a, b), 0);
      includedAtServerMs = maxCastAt;
    }

    return res.status(200).json({
      included: allIncluded,
      included_count: includedCount,
      expected_count: expectedCount,
      included_at_server_ms: includedAtServerMs,
      found_ids: rows.map((r) => r.id),
    });
  } catch (err) {
    console.error("tally/contains error", err);
    return res.status(500).json({ error: "Server error" });
  }
}
