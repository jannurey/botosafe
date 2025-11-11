import type { NextApiRequest, NextApiResponse } from "next";
import jwt from "jsonwebtoken";
import { serialize, parse } from "cookie";
import { pool } from "@/configs/database";
import { RowDataPacket } from "mysql2";

const JWT_SECRET = process.env.JWT_SECRET ?? "changeme";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ message: string }>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    const cookies = parse(req.headers.cookie || "");
    const sel = cookies.selection;
    if (!sel)
      return res.status(401).json({ message: "Selection token missing" });

    let payload: any;
    try {
      payload = jwt.verify(sel, JWT_SECRET);
    } catch (err) {
      return res
        .status(401)
        .json({ message: "Invalid or expired selection token" });
    }

    // Ensure payload proves OTP verification
    if (!payload?.otpVerified) {
      return res
        .status(403)
        .json({ message: "Selection token not authorized" });
    }

    // For safety, re-check user exists and is admin
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT id, role FROM users WHERE id = ? LIMIT 1",
      [payload.id]
    );
    if (rows.length === 0)
      return res.status(404).json({ message: "User not found" });

    const user = rows[0];
    if (user.role !== "admin") {
      // If not an admin in DB, forbid issuing admin auth
      return res.status(403).json({ message: "User is not an admin" });
    }

    // Issue final authToken for admin
    const authToken = jwt.sign(
      { id: user.id, role: "admin", mfa: true },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    const cookiesToSet = [
      serialize("authToken", authToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      }),
      // clear selection cookie
      serialize("selection", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      }),
    ];

    res.setHeader("Set-Cookie", cookiesToSet);

    return res.status(200).json({ message: "Admin authenticated" });
  } catch (err: unknown) {
    console.error("complete-admin error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}
