import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/configs/supabase";

interface User {
  id: number;
  fullname: string;
  email: string;
  school_id?: string | null;
  age?: number | null;
  year_level?: number | null;
  user_status?: string | null;
  approval_status?: string | null;
  gender?: string | null;
  course?: string | null;
}

interface ApiResponse {
  message?: string;
  user?: User;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  const {
    query: { id },
    method,
  } = req;

  if (!id || Array.isArray(id)) {
    return res.status(400).json({ error: "Invalid user ID" });
  }

  try {
    switch (method) {
      case "GET": {
        const { data: rows, error } = await supabaseAdmin
          .from('users')
          .select(`
            id, 
            fullname, 
            email, 
            school_id, 
            age, 
            year_level, 
            user_status, 
            approval_status, 
            gender, 
            course
          `)
          .eq('id', id)
          .limit(1);

        if (error) {
          console.error("Supabase query error:", error);
          return res.status(500).json({ error: "Database error" });
        }

        if (!rows || rows.length === 0) {
          return res.status(404).json({ error: "User not found" });
        }

        return res.status(200).json({ user: rows[0] });
      }

      case "PUT": {
        const fields = req.body;

        const keys = Object.keys(fields);
        if (keys.length === 0)
          return res.status(400).json({ error: "No fields provided" });

        // Add updated_at field
        fields.updated_at = new Date().toISOString();

        const { data: updateData, error: updateError } = await supabaseAdmin
          .from('users')
          .update(fields)
          .eq('id', id)
          .select();

        if (updateError) {
          console.error("Supabase update error:", updateError);
          return res.status(500).json({ error: "Database error" });
        }

        if (!updateData || updateData.length === 0) {
          return res
            .status(404)
            .json({ error: "User not found or not updated" });
        }

        const { data: rows, error: selectError } = await supabaseAdmin
          .from('users')
          .select(`
            id, 
            fullname, 
            email, 
            school_id, 
            age, 
            year_level, 
            user_status, 
            approval_status, 
            gender, 
            course
          `)
          .eq('id', id)
          .limit(1);

        if (selectError) {
          console.error("Supabase query error:", selectError);
          return res.status(500).json({ error: "Database error" });
        }

        if (!rows || rows.length === 0) {
          return res.status(404).json({ error: "User not found after update" });
        }

        return res.status(200).json({
          message: "User updated successfully",
          user: rows[0],
        });
      }

      default:
        res.setHeader("Allow", ["GET", "PUT"]);
        return res.status(405).end(`Method ${method} Not Allowed`);
    }
  } catch (err: unknown) {
    console.error("Error in /api/users/[id]:", err);
    const message =
      err instanceof Error ? err.message : "Internal Server Error";
    return res.status(500).json({ error: message });
  }
}