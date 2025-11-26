// pages/api/change-password.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/configs/supabase";
import bcrypt from "bcryptjs";
import { parse } from "cookie";
import jwt from "jsonwebtoken";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    // Parse cookies to get temp user ID
    const cookies = parse(req.headers.cookie || "");
    const tempUserId = cookies.tempUserId;
    const mustChangePassword = cookies.mustChangePassword;

    // Check if user is in password change flow
    if (!tempUserId || !mustChangePassword) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const userId = parseInt(tempUserId);
    if (isNaN(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const { password } = req.body as { password?: string };

    if (!password) {
      return res.status(400).json({ message: "Password is required" });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters long" });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update user's password and clear the must_change_password flag
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ 
        password: hashedPassword,
        must_change_password: false
      })
      .eq('id', userId);

    if (updateError) {
      console.error("Supabase update error:", updateError);
      return res.status(500).json({ message: "Database error" });
    }

    // Get user info for continuing authentication flow
    const { data: userRows, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, fullname, email, role')
      .eq('id', userId)
      .limit(1);

    if (userError || !userRows || userRows.length === 0) {
      console.error("Supabase query error:", userError);
      return res.status(500).json({ message: "Database error" });
    }

    const user = userRows[0];

    // Check if user has a registered face
    const { data: faceRows, error: faceError } = await supabaseAdmin
      .from('user_faces')
      .select('id')
      .eq('user_id', userId)
      .limit(1);

    const hasFace = !faceError && faceRows && faceRows.length > 0;

    // For voters, require OTP verification
    const otpRequired = user.role === "voter";

    // If OTP is required, send OTP to user
    if (otpRequired) {
      // Generate and send OTP
      const crypto = await import('crypto');
      const otp = crypto.randomInt(100000, 999999).toString();
      
      // Save OTP with 5-min expiry
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      const { error: otpError } = await supabaseAdmin
        .from('user_otps')
        .upsert({ 
          user_id: user.id, 
          otp: otp, 
          expires_at: expiresAt 
        }, {
          onConflict: 'user_id'
        });
      
      if (otpError) {
        console.error("❌ OTP Save Error:", otpError);
        return res.status(500).json({ message: "Failed to generate OTP" });
      }
      
      // Send OTP email or log in development
      try {
        const transporter = (await import('@/lib/nodemailer')).default;
        await transporter.sendMail({
          from: `"BotoSafe" <${process.env.EMAIL_USER}>`,
          to: user.email,
          subject: "Your OTP Code",
          text: `Hello ${user.fullname},\n\nYour OTP code is ${otp}. It will expire in 5 minutes.`,
          html: `<p>Hello ${user.fullname},</p><p>Your OTP code is <b>${otp}</b>. It will expire in 5 minutes.</p>`,
        });
      } catch (emailError: unknown) {
        console.error("❌ Email Send Error:", emailError);
        // Log OTP to console as fallback
        console.log("📧 OTP for", user.email, ":", otp);
      }
      
      // Always log OTP in development for testing purposes
      if (process.env.NODE_ENV !== "production") {
        console.log("📧 OTP for", user.email, ":", otp);
      }
    }
    
    // Clear the temporary cookies and set appropriate authentication cookies
    const isSecure = req.headers['x-forwarded-proto'] === 'https' || 
                    (req.socket as any).encrypted || 
                    process.env.NODE_ENV === 'production';

    let cookieHeader;
    if (!otpRequired) {
      // For admins or users who don't need OTP, set full authentication token
      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role, mfa: true },
        process.env.JWT_SECRET!,
        { expiresIn: "7d" }
      );
      
      cookieHeader = [
        `authToken=${token}; Path=/; HttpOnly; SameSite=Lax${isSecure ? '; Secure' : ''}; Max-Age=${60 * 60 * 24 * 7}`,
        `tempUserId=; Path=/; HttpOnly; Max-Age=0`,
        `mustChangePassword=; Path=/; HttpOnly; Max-Age=0`
      ];
    } else {
      // For voters who need OTP, set temporary login flag
      cookieHeader = [
        `tempLogin=true; Path=/; HttpOnly; SameSite=Lax${isSecure ? '; Secure' : ''}; Max-Age=600`, // 10 min expiry
        `tempUserId=${user.id}; Path=/; HttpOnly; SameSite=Lax${isSecure ? '; Secure' : ''}; Max-Age=600`, // 10 min expiry
        `mustChangePassword=; Path=/; HttpOnly; Max-Age=0`
      ];
    }
    
    res.setHeader("Set-Cookie", cookieHeader);

    return res.status(200).json({ 
      message: "Password changed successfully",
      userId: user.id,
      username: user.email, // Add username to response
      role: user.role,
      otpRequired,
      hasFace
    });
  } catch (err) {
    console.error("change-password error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}