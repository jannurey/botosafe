// pages/api/admin/approveUser.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { pool } from "@/configs/database";
import { ResultSetHeader } from "mysql2"; // ✅ Strict type

interface ApproveRequestBody {
  userId: number;
  approve: boolean;
}

interface ApiResponse {
  message: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { userId, approve } = req.body as ApproveRequestBody;

  try {
    // ✅ MySQL query with proper typing
    const [result] = await pool.query<ResultSetHeader>(
      "UPDATE users SET is_approved = ? WHERE id = ?",
      [approve, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    return res
      .status(200)
      .json({ message: approve ? "User approved" : "User declined" });
  } catch (err) {
    console.error("Approval Error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}
