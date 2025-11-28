// pages/api/vote/verify-otp.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/configs/supabase";
import jwt from "jsonwebtoken";

interface VerifyVoteOtpResponse {
  message?: string;
  error?: string;
  voteToken?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<VerifyVoteOtpResponse>
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
    let decoded: { id: number; email?: string };
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: number; email?: string };
    } catch (err) {
      return res.status(401).json({ error: "Invalid or expired authentication token" });
    }

    const userId = decoded.id;
    const { otp, electionId } = req.body;

    if (!otp) {
      return res.status(400).json({ error: "OTP is required" });
    }

    // Verify OTP
    const { data: otpRows, error: otpError } = await supabaseAdmin
      .from('user_otps')
      .select('*')
      .eq('user_id', userId)
      .eq('otp', otp)
      .gt('expires_at', new Date().toISOString())
      .limit(1);

    if (otpError) {
      console.error("Supabase query error:", otpError);
      return res.status(500).json({ error: "Database error" });
    }

    if (!otpRows || otpRows.length === 0) {
      return res.status(400).json({ error: "Invalid or expired OTP" });
    }

    // Delete OTP after verification
    await supabaseAdmin
      .from('user_otps')
      .delete()
      .eq('user_id', userId);

    // Generate vote token (short-lived, 5 minutes)
    const voteToken = jwt.sign(
      { id: userId, electionId: electionId || null },
      process.env.JWT_SECRET!,
      { expiresIn: "5m" }
    );

    // Always log OTP in development for testing purposes
    if (process.env.NODE_ENV !== "production") {
      console.log("✅ Vote OTP verified for user:", userId);
    }

    return res.status(200).json({
      message: "OTP verified successfully",
      voteToken
    });
  } catch (err: unknown) {
    console.error("❌ Verify Vote OTP Error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return res.status(500).json({ error: message });
  }
}

