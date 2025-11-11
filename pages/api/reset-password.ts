// pages/api/reset-password.ts
import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { pool } from "@/configs/database";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST")
    return res.status(405).json({ message: "Method not allowed" });

  const { token, password, email } = req.body || {};
  if (!token || !password || !email)
    return res
      .status(400)
      .json({ message: "token, email and password are required" });

  try {
    const tokenHash = crypto
      .createHash("sha256")
      .update(String(token))
      .digest("hex");

    const [rows] = await pool.execute(
      `SELECT pr.id, pr.user_id, pr.expires_at, u.email FROM password_resets pr
       JOIN users u ON u.id = pr.user_id
       WHERE pr.token_hash = ? AND u.email = ?`,
      [tokenHash, email]
    );
    const matches = rows as any[];
    if (!matches.length) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    const row = matches[0];
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return res.status(400).json({ message: "Token has expired" });
    }

    // Hash the new password (match the hashing used elsewhere in your app)
    const hashedPassword = await bcrypt.hash(String(password), 10);

    await pool.execute(`UPDATE users SET password = ? WHERE id = ?`, [
      hashedPassword,
      row.user_id,
    ]);
    await pool.execute(`DELETE FROM password_resets WHERE user_id = ?`, [
      row.user_id,
    ]);

    return res.status(200).json({ message: "Password has been updated" });
  } catch (err) {
    console.error("reset-password error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}
