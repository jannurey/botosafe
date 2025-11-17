// pages/api/verify-otp.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/configs/supabase";
import jwt from "jsonwebtoken";

interface VerifyOtpSuccessResponse {
  message: string;
  token: string; // Add token to the response
  otpVerified: true;
  user: {
    id: number;
    fullname: string;
    email: string;
    role: string;
    hasFace: boolean;
  };
}

interface ErrorResponse {
  message: string;
}

interface OtpRow {
  id: number;
  user_id: number;
  otp: string;
  expires_at: string;
}

interface UserRow {
  id: number;
  fullname: string;
  email: string;
  role: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<VerifyOtpSuccessResponse | ErrorResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  // Get user ID from temporary login cookie instead of request body
  const tempUserId = req.cookies.tempUserId;
  const { otp } = req.body;
  
  if (!tempUserId || !otp) {
    return res.status(400).json({ message: "tempUserId and otp are required" });
  }

  try {
    const userId = parseInt(tempUserId);
    if (isNaN(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    // ✅ Verify OTP (Supabase version)
    const { data: otpRows, error: otpError } = await supabaseAdmin
      .from('user_otps')
      .select('*')
      .eq('user_id', userId)
      .eq('otp', otp)
      .gt('expires_at', new Date().toISOString())
      .limit(1);

    if (otpError) {
      console.error("Supabase query error:", otpError);
      return res.status(500).json({ message: "Database error" });
    }

    if (!otpRows || otpRows.length === 0) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    // ✅ Delete OTP after verification
    const { error: deleteError } = await supabaseAdmin
      .from('user_otps')
      .delete()
      .eq('user_id', userId);

    if (deleteError) {
      console.error("Supabase delete error:", deleteError);
      // Continue anyway since the OTP was already verified
    }

    // ✅ Get user info
    const { data: userRows, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, fullname, email, role')
      .eq('id', userId)
      .limit(1);

    if (userError) {
      console.error("Supabase query error:", userError);
      return res.status(500).json({ message: "Database error" });
    }

    if (!userRows || userRows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = userRows[0];

    // ✅ Check if user has a registered face
    const { data: faceRows, error: faceError } = await supabaseAdmin
      .from('user_faces')
      .select('id')
      .eq('user_id', userId)
      .limit(1);

    if (faceError) {
      console.error("Supabase query error:", faceError);
      return res.status(500).json({ message: "Database error" });
    }

    const hasFace = faceRows && faceRows.length > 0;
    
    // Log the face check result for debugging
    console.log(`Face check for user ${userId}: hasFace = ${hasFace}, faceRows.length = ${faceRows?.length || 0}`);

    // Always log OTP in development for testing purposes
    if (process.env.NODE_ENV !== "production") {
      console.log("📧 OTP for", user.email, ":", otp);
    }
    
    // Log the OTP verification for development debugging
    console.log("✅ OTP verified for user:", user.email);

    // Determine if we're in a secure context (HTTPS)
    const isSecure = req.headers['x-forwarded-proto'] === 'https' || 
                    (req.socket as any).encrypted || 
                    process.env.NODE_ENV === 'production';

    // Set appropriate cookies based on whether user has face registered
    let cookieHeader;
    if (hasFace) {
      // User already has face registered, set full authentication token
      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role, mfa: true },
        process.env.JWT_SECRET!,
        { expiresIn: "7d" }
      );
      
      cookieHeader = [
        `authToken=${token}; Path=/; HttpOnly; SameSite=Lax${isSecure ? '; Secure' : ''}; Max-Age=${60 * 60 * 24 * 7}`,
        `tempLogin=; Path=/; HttpOnly; Max-Age=0`,
        `tempUserId=; Path=/; HttpOnly; Max-Age=0`,
        `tempAuthToken=; Path=/; HttpOnly; Max-Age=0`
      ];
    } else {
      // User does not have face registered, set temporary token for face registration only
      const tempToken = jwt.sign(
        { id: user.id, email: user.email, role: user.role, temp: true },
        process.env.JWT_SECRET!,
        { expiresIn: "1h" } // Shorter expiry for temporary token
      );
      
      cookieHeader = [
        `tempAuthToken=${tempToken}; Path=/; HttpOnly; SameSite=Lax${isSecure ? '; Secure' : ''}; Max-Age=${60 * 60}`,
        `tempLogin=; Path=/; HttpOnly; Max-Age=0`,
        `tempUserId=; Path=/; HttpOnly; Max-Age=0`
      ];
    }

    res.setHeader("Set-Cookie", cookieHeader);

    return res.status(200).json({
      message: "OTP verified successfully",
      token: hasFace ? cookieHeader[0].split('=')[1].split(';')[0] : cookieHeader[0].split('=')[1].split(';')[0], // Return the token value
      otpVerified: true,
      user: {
        id: user.id,
        fullname: user.fullname,
        email: user.email,
        role: user.role,
        hasFace, // This is correctly included
      },
    });
  } catch (err: unknown) {
    console.error("❌ Verify OTP Error:", err);
    const message = err instanceof Error ? err.message : "Server error";
    return res.status(500).json({ message });
  }
}