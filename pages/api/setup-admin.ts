// pages/api/setup-admin.ts
import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/configs/supabase";

interface UserRow {
  id: number;
  email: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ message: string }>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    const email = process.env.ADMIN_EMAIL;
    if (!email) {
      return res.status(400).json({ message: "Admin email not set" });
    }

    // 🔍 Check if admin exists
    const { data: check, error: checkError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', email)
      .limit(1);

    if (checkError) {
      console.error("Supabase query error:", checkError);
      return res.status(500).json({ message: "Database error" });
    }

    if (!check || check.length === 0) {
      // Insert default admin
      const { error: insertError } = await supabaseAdmin
        .from('users')
        .insert({
          fullname: "System Admin",
          email: email,
          password: "ENV_ADMIN",
          role: "admin"
        });

      if (insertError) {
        console.error("Supabase insert error:", insertError);
        return res.status(500).json({ message: "Database error" });
      }

      return res.status(200).json({ message: "Default admin inserted" });
    }

    return res.status(200).json({ message: "Admin already exists" });
  } catch (error) {
    console.error("Setup Admin Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
}