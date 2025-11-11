import type { NextApiRequest, NextApiResponse } from "next";
import { pool } from "@/configs/database";
import bcrypt from "bcryptjs";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import { parse } from "cookie";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET ?? "changeme";

interface UserRow extends RowDataPacket {
  id: number;
  fullname: string;
  email: string;
  role: "admin" | "voter";
  approval_status: "approved" | "pending" | "declined" | null;
  user_status: "active" | "inactive" | null;
  approved_at?: string | null;
  last_login_at?: string | null;
  created_at?: string | null;
  can_vote?: number | null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // authenticate admin user via authToken cookie
    const cookies = parse(req.headers.cookie || "");
    const token = cookies.authToken;

    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    let payload: any;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      // invalid token
      return res.status(401).json({ message: "Invalid token" });
    }

    // require admin role to access these endpoints
    if (payload.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (req.method === "GET") {
      // list admins — include approval_status and other fields so UI can show correct badges
      const [rows] = await pool.query<UserRow[]>(
        `SELECT id, fullname, email, role, can_vote, approval_status, user_status, approved_at, last_login_at, created_at
         FROM users
         WHERE role = 'admin'
         ORDER BY created_at DESC`
      );

      return res.status(200).json(rows);
    }

    if (req.method === "POST") {
      // create admin
      const { fullname, email, password, can_vote } = req.body as {
        fullname?: string;
        email?: string;
        password?: string;
        can_vote?: boolean | number;
      };

      if (!fullname || !email || !password) {
        return res
          .status(400)
          .json({ message: "fullname, email and password required" });
      }

      // check duplicate
      const [exists] = await pool.query<RowDataPacket[]>(
        "SELECT id FROM users WHERE email = ? LIMIT 1",
        [email]
      );
      if (exists.length > 0) {
        return res.status(409).json({ message: "Email already registered" });
      }

      const hashed = await bcrypt.hash(password, 10);
      const canVoteValue = can_vote ? 1 : 0;

      const [result] = await pool.query<ResultSetHeader>(
        "INSERT INTO users (fullname, email, password, role, can_vote, created_at) VALUES (?, ?, ?, 'admin', ?, NOW())",
        [fullname, email, hashed, canVoteValue]
      );

      return res.status(201).json({ id: result.insertId, fullname, email });
    }

    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ message: "Method Not Allowed" });
  } catch (err: unknown) {
    // eslint-disable-next-line no-console
    console.error("api/admins error:", err);
    const message =
      err instanceof Error ? err.message : "Internal Server Error";
    return res.status(500).json({ message });
  }
}
