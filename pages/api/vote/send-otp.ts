// pages/api/vote/send-otp.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/configs/supabase";
import crypto from "crypto";
import transporter from "@/lib/nodemailer";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ message?: string; error?: string }>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Get authenticated user from cookies
    const token = req.cookies.authToken || req.cookies.token;
    if (!token) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Verify JWT token
    const jwt = await import("jsonwebtoken");
    let decoded: { id: number; email?: string };
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: number; email?: string };
    } catch (err) {
      return res.status(401).json({ error: "Invalid or expired authentication token" });
    }

    const userId = decoded.id;

    // Get user info to send OTP to their email
    const { data: userRows, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, email, fullname')
      .eq('id', userId)
      .limit(1);

    if (userError || !userRows || userRows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = userRows[0];

    // Generate OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes

    // Save OTP to database
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

    // Send OTP email
    try {
      await transporter.sendMail({
        from: `"BotoSafe" <${process.env.EMAIL_USER}>`,
        to: user.email,
        subject: "Your Vote Verification OTP Code",
        text: `Hello ${user.fullname},\n\nYour OTP code for vote verification is ${otp}. It will expire in 5 minutes.\n\nPlease enter this code to confirm your vote.`,
        html: `<p>Hello ${user.fullname},</p><p>Your OTP code for vote verification is <b>${otp}</b>. It will expire in 5 minutes.</p><p>Please enter this code to confirm your vote.</p>`,
      });
    } catch (emailError: any) {
      console.error("❌ Email Send Error:", emailError);
      // Log OTP to console as fallback
      console.log("📧 OTP for", user.email, ":", otp);
    }

    // Always log OTP in development for testing purposes
    if (process.env.NODE_ENV !== "production") {
      console.log("📧 Vote OTP for", user.email, ":", otp);
    }

    return res.status(200).json({ message: "OTP sent successfully to your email" });
  } catch (err: unknown) {
    console.error("❌ Send Vote OTP Error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return res.status(500).json({ error: message });
  }
}

