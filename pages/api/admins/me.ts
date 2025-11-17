import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/configs/supabase";
import { parse } from "cookie";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET ?? "changeme";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const cookies = parse(req.headers.cookie || "");
    const token = cookies.authToken;

    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    let payload: jwt.JwtPayload | string;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ message: "Invalid token" });
    }

    // Check if payload is not a string
    if (typeof payload === 'string') {
      return res.status(401).json({ message: "Invalid token" });
    }

    // admin backdoor: id 0 => return basic admin info from env if available
    if (payload.id === 0) {
      return res.status(200).json({
        id: 0,
        fullname: process.env.ADMIN_FULLNAME ?? "Administrator",
        email: process.env.ADMIN_EMAIL ?? "admin@example.com",
        role: "admin",
        can_vote: 1,
        approval_status: "approved",
        age: null,
        gender: null,
        course: null,
        year_level: null,
        school_id: null,
      });
    }

    const userId = payload.id;
    
    const { data: rows, error } = await supabaseAdmin
      .from('users')
      .select('id, fullname, email, role, can_vote, approval_status, user_status, approved_at, last_login_at, created_at, age, gender, course, year_level, school_id')
      .eq('id', userId)
      .limit(1);

    if (error) {
      console.error("Supabase query error:", error);
      return res.status(500).json({ message: "Database error" });
    }

    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = rows[0];
    return res.status(200).json(user);
  } catch (err: unknown) {
    console.error("api/admins/me error:", err);
    const message =
      err instanceof Error ? err.message : "Internal Server Error";
    return res.status(500).json({ message });
  }
}