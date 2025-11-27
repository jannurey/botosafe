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
    const { id } = req.query;
    const adminId = Number(id);
    if (!adminId && adminId !== 0) {
      return res.status(400).json({ message: "Invalid id" });
    }

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

    if (typeof payload !== 'string' && payload.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (req.method === "GET") {
      if (adminId === 0) {
        return res.status(200).json({
          id: 0,
          fullname: process.env.ADMIN_FULLNAME ?? "Administrator",
          email: process.env.ADMIN_EMAIL ?? "admin@example.com",
          role: "admin",
          can_vote: 1,
          // env-backed admin won't have student fields; return nulls
          age: null,
          gender: null,
          course: null,
          year_level: null,
          school_id: null,
          approval_status: "approved",
        });
      }
      
      const { data: rows, error } = await supabaseAdmin
        .from('users')
        .select('id, fullname, email, role, can_vote, approval_status, user_status, age, gender, course, year_level, school_id, last_login_at, created_at')
        .eq('id', adminId)
        .limit(1);

      if (error) {
        console.error("Supabase query error:", error);
        return res.status(500).json({ message: "Database error" });
      }

      if (!rows || rows.length === 0) {
        return res.status(404).json({ message: "Not found" });
      }
      
      return res.status(200).json(rows[0]);
    }

    if (req.method === "PUT") {
      const {
        fullname,
        email,
        password,
        age,
        gender,
        course,
        year_level,
        school_id,
      } = req.body as {
        fullname?: string;
        email?: string;
        password?: string;
        age?: number | null;
        gender?: string | null;
        course?: string | null;
        year_level?: string | number | null;
        school_id?: string | null;
      };

      // Protect bootstrapped env admin (id === 0) from being edited via DB
      if (adminId === 0) {
        return res
          .status(403)
          .json({ message: "Cannot modify server env admin" });
      }

      if (!fullname || !email) {
        return res.status(400).json({ message: "fullname and email required" });
      }

      // check if target exists
      const { data: existingUsers, error: checkError } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('id', adminId)
        .limit(1);

      if (checkError) {
        console.error("Supabase query error:", checkError);
        return res.status(500).json({ message: "Database error" });
      }

      if (!existingUsers || existingUsers.length === 0) {
        return res.status(404).json({ message: "Not found" });
      }

      // Build update query based on whether password is provided
      const updateData: Record<string, unknown> = {
        fullname,
        email,
        age: typeof age === "number" ? age : null,
        gender: gender ?? null,
        course: course ?? null,
        year_level: year_level ?? null,
        school_id: school_id ?? null,
        updated_at: new Date().toISOString()
      };

      // If password is provided, hash it
      if (password) {
        updateData.password = await bcrypt.hash(password, 10);
      }

      const { error: updateError } = await supabaseAdmin
        .from('users')
        .update(updateData)
        .eq('id', adminId);

      if (updateError) {
        console.error("Supabase update error:", updateError);
        return res.status(500).json({ message: "Database error" });
      }

      return res.status(200).json({ message: "Updated" });
    }

    if (req.method === "PATCH") {
      // used to toggle can_vote or other partial updates (now supports approval_status too)
      const { can_vote, approval_status } = req.body as {
        can_vote?: number | boolean;
        approval_status?: string;
      };

      // Protect bootstrapped env admin (id === 0) from being modified via API
      if (adminId === 0) {
        return res
          .status(403)
          .json({ message: "Cannot modify server env admin" });
      }

      // If approval_status is provided and is 'approved', set approval_status and enable can_vote
      if (typeof approval_status !== "undefined") {
        if (approval_status === "approved") {
          const { error: updateError } = await supabaseAdmin
            .from('users')
            .update({ 
              approval_status: 'approved', 
              can_vote: 1, 
              updated_at: new Date().toISOString() 
            })
            .eq('id', adminId);

          if (updateError) {
            console.error("Supabase update error:", updateError);
            return res.status(500).json({ message: "Database error" });
          }

          return res.status(200).json({
            message: "User approved and can_vote enabled",
            approval_status: "approved",
            can_vote: 1,
          });
        } else {
          // allow setting other statuses (pending/declined) - keep can_vote in sync (declined => can_vote = 0)
          const status = String(approval_status);
          const canVoteVal = status === "approved" ? 1 : 0;
          
          const { error: updateError } = await supabaseAdmin
            .from('users')
            .update({ 
              approval_status: status, 
              can_vote: canVoteVal, 
              updated_at: new Date().toISOString() 
            })
            .eq('id', adminId);

          if (updateError) {
            console.error("Supabase update error:", updateError);
            return res.status(500).json({ message: "Database error" });
          }

          return res.status(200).json({
            message: "Approval status updated",
            approval_status: status,
            can_vote: canVoteVal,
          });
        }
      }

      if (typeof can_vote !== "undefined") {
        const flag = Number(can_vote) === 1 ? 1 : 0;
        
        const { error: updateError } = await supabaseAdmin
          .from('users')
          .update({ 
            can_vote: flag, 
            updated_at: new Date().toISOString() 
          })
          .eq('id', adminId);

        if (updateError) {
          console.error("Supabase update error:", updateError);
          return res.status(500).json({ message: "Database error" });
        }

        return res.status(200).json({ message: "Updated", can_vote: flag });
      }
    }

    res.setHeader("Allow", ["GET", "PUT", "PATCH"]);
    return res.status(405).json({ message: "Method Not Allowed" });
  } catch (err: unknown) {
    console.error("api/admins/[id] error:", err);
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return res.status(500).json({ message });
  }
}