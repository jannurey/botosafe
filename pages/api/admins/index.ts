import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/configs/supabase";
import bcrypt from "bcryptjs";
import { parse } from "cookie";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET ?? "changeme";

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

    let payload: jwt.JwtPayload | string;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (error) {
      // invalid token
      return res.status(401).json({ message: "Invalid token" });
    }

    // Check if payload is not a string and has role property
    if (typeof payload === 'string' || !payload.role) {
      return res.status(401).json({ message: "Invalid token" });
    }

    // require admin role to access these endpoints
    if (payload.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (req.method === "GET") {
      // list admins — include approval_status and other fields so UI can show correct badges
      const { data: rows, error } = await supabaseAdmin
        .from('users')
        .select('id, fullname, email, role, can_vote, approval_status, user_status, approved_at, last_login_at, created_at')
        .eq('role', 'admin')
        .order('created_at', { ascending: false });

      if (error) {
        console.error("Supabase query error:", error);
        return res.status(500).json({ message: "Database error" });
      }

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
      const { data: existingUsers, error: checkError } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', email)
        .limit(1);

      if (checkError) {
        console.error("Supabase query error:", checkError);
        return res.status(500).json({ message: "Database error" });
      }

      if (existingUsers && existingUsers.length > 0) {
        return res.status(409).json({ message: "Email already registered" });
      }

      const hashed = await bcrypt.hash(password, 10);
      const canVoteValue = can_vote ? 1 : 0;

      const { data: newUser, error: insertError } = await supabaseAdmin
        .from('users')
        .insert({
          fullname,
          email,
          password: hashed,
          role: 'admin',
          can_vote: canVoteValue,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (insertError) {
        console.error("Supabase insert error:", insertError);
        return res.status(500).json({ message: "Database error" });
      }

      return res.status(201).json({ 
        id: newUser.id, 
        fullname: newUser.fullname, 
        email: newUser.email 
      });
    }

    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ message: "Method Not Allowed" });
  } catch (err: unknown) {
    console.error("api/admins error:", err);
    const message =
      err instanceof Error ? err.message : "Internal Server Error";
    return res.status(500).json({ message });
  }
}