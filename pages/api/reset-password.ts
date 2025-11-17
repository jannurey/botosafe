// pages/api/reset-password.ts
import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/configs/supabase";

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

    // Get the password reset record with user info
    const { data: resetRows, error: resetError } = await supabaseAdmin
      .from('password_resets')
      .select(`
        id,
        user_id,
        expires_at,
        users (
          email
        )
      `)
      .eq('token_hash', tokenHash)
      .eq('users.email', email)
      .single();

    if (resetError || !resetRows) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    const row = resetRows;
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return res.status(400).json({ message: "Token has expired" });
    }

    // Hash the new password (match the hashing used elsewhere in your app)
    const hashedPassword = await bcrypt.hash(String(password), 10);

    // Update user's password
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ password: hashedPassword })
      .eq('id', row.user_id);

    if (updateError) {
      console.error("Supabase update error:", updateError);
      return res.status(500).json({ message: "Database error" });
    }

    // Delete the password reset token
    const { error: deleteError } = await supabaseAdmin
      .from('password_resets')
      .delete()
      .eq('user_id', row.user_id);

    if (deleteError) {
      console.error("Supabase delete error:", deleteError);
      // Continue anyway since the password was updated
    }

    return res.status(200).json({ message: "Password has been updated" });
  } catch (err) {
    console.error("reset-password error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}