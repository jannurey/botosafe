// pages/api/send-otp.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/configs/supabase";
import transporter from "@/lib/nodemailer";
import crypto from "crypto";

interface UserRow {
  id: number;
  email: string; // We still need the email to send the OTP
  fullname: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ message?: string; error?: string }>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email } = req.body; // This can be either email or school_id
  if (!email) return res.status(400).json({ error: "Email/Username is required" });

  try {
    // 🔍 Check user existence by email or school_id
    const { data: userRows, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, email, fullname')
      .or(`email.eq.${email},school_id.eq.${email}`);

    if (userError) {
      console.error("Supabase query error:", userError);
      return res.status(500).json({ error: "Database error" });
    }

    if (!userRows || userRows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = userRows[0];
    const userId = user.id;
    const otp = crypto.randomInt(100000, 999999).toString();

    // ⏱️ Save OTP with 5-min expiry
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes from now
    
    // For upsert, we'll first try to update, and if no rows affected, insert
    const { error: upsertError } = await supabaseAdmin
      .from('user_otps')
      .upsert({
        user_id: userId,
        otp: otp,
        expires_at: expiresAt,
        created_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    if (upsertError) {
      console.error("Supabase upsert error:", upsertError);
      return res.status(500).json({ error: "Database error" });
    }

    // 📧 Send OTP email
    try {
      await transporter.sendMail({
        from: `"BotoSafe" <${process.env.EMAIL_USER}>`,
        to: user.email, // Always use the actual email for sending
        subject: "Your OTP Code",
        text: `Hello ${user.fullname},\n\nYour OTP code is ${otp}. It will expire in 5 minutes.`,
        html: `<p>Hello ${user.fullname},</p><p>Your OTP code is <b>${otp}</b>. It will expire in 5 minutes.</p>`,
      });
    } catch (emailError: any) {
      console.error("❌ Email Send Error:", emailError);
      // Log OTP to console as fallback
      console.log("📧 OTP for", user.email, ":", otp);
    }

    // Always log OTP in development for testing purposes
    if (process.env.NODE_ENV !== "production") {
      console.log("📧 OTP for", user.email, ":", otp);
    }
    
    // Log the OTP sending for development debugging
    console.log("📤 Sending OTP to user:", user.email);

    return res.status(200).json({ message: "OTP sent successfully" });
  } catch (err: unknown) {
    console.error("❌ Send OTP Error:", err);
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return res.status(500).json({ error: message });
  }
}