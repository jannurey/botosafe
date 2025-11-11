// pages/api/login.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { pool } from "@/configs/database";
import bcrypt from "bcryptjs";
import { RowDataPacket } from "mysql2";

interface UserRow extends RowDataPacket {
  id: number;
  fullname: string;
  email: string;
  password: string;
  role: "admin" | "voter";
  approval_status: "approved" | "pending" | "declined";
  profile_status: "active" | "inactive" | "graduating";
  created_at: string;
  updated_at?: string | null;
}

interface LoginResponse {
  message: string;
  userId?: number;
  role?: "admin" | "voter";
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<LoginResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  try {
    // 🧑‍💼 Check if admin credentials match .env.local
    if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
      if (email === process.env.ADMIN_EMAIL) {
        if (password !== process.env.ADMIN_PASSWORD) {
          return res.status(401).json({ message: "Invalid credentials" });
        }

        return res.status(200).json({
          message: "Admin login successful",
          userId: 0, // Admin from env
          role: "admin",
        });
      }
    }

    // 🧑‍🗳 Check database for user
    const [rows] = await pool.query<UserRow[]>(
      "SELECT * FROM users WHERE email = ? LIMIT 1",
      [email]
    );
    if (rows.length === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = rows[0];

    // 🔒 Verify password
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // ✅ Check approval + profile status (only for voters)
    if (user.role === "voter") {
      if (user.approval_status === "pending") {
        return res
          .status(403)
          .json({ message: "Account pending approval by admin" });
      }

      if (user.approval_status === "declined") {
        return res.status(403).json({ message: "Account declined by admin" });
      }

      if (user.profile_status === "inactive") {
        return res
          .status(403)
          .json({ message: "Account inactive. Please contact the admin." });
      }

      if (user.profile_status === "graduating") {
        return res.status(403).json({
          message:
            "Account marked as graduating. You are no longer eligible to vote.",
        });
      }
    }

    // 🚀 Successful login
    return res.status(200).json({
      message: `${user.role === "admin" ? "Admin" : "User"} login successful`,
      userId: user.id,
      role: user.role,
    });
  } catch (error: unknown) {
    console.error("❌ Login Error:", error);
    const message =
      error instanceof Error ? error.message : "Internal Server Error";
    return res.status(500).json({ message });
  }
}
