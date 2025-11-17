// pages/api/login.ts
import type { NextApiRequest, NextApiResponse } from "next";
import bcrypt from "bcryptjs";
import { users, userOtps, userFaces } from "@/lib/supabaseClient";
import jwt from "jsonwebtoken";
import { supabaseAdmin } from "@/configs/supabase";
import { signUpWithEmail, signInWithEmail } from "@/lib/supabaseAuth";



interface LoginResponse {
  message: string;
  userId?: number;
  role?: string;
  otpRequired?: boolean;
  hasFace?: boolean;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<LoginResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  // Support both email and username (school_id) login
  const { username, email, password } = req.body as { 
    username?: string; 
    email?: string; 
    password?: string; 
  };
  
  // Use username if provided, otherwise fallback to email
  const loginIdentifier = username || email;
  
  if (!loginIdentifier || !password) {
    return res.status(400).json({ message: "Username/Email and password are required" });
  }

  try {
    // 🧑‍💼 Check if admin credentials match .env.local
    if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
      // For admin, we still use email
      if (loginIdentifier === process.env.ADMIN_EMAIL) {
        if (password !== process.env.ADMIN_PASSWORD) {
          return res.status(401).json({ message: "Invalid credentials" });
        }

        // For environment variable admin, set authToken directly
        const token = jwt.sign(
          { id: 0, email: loginIdentifier, role: "admin", mfa: true },
          process.env.JWT_SECRET!,
          { expiresIn: "7d" }
        );

        // Determine if we're in a secure context (HTTPS)
        const isSecure = req.headers['x-forwarded-proto'] === 'https' || 
                        (req.socket as unknown as { encrypted: boolean }).encrypted || 
                        process.env.NODE_ENV === 'production';

        const cookieHeader = [
          `authToken=${token}; Path=/; HttpOnly; SameSite=Lax${isSecure ? '; Secure' : ''}; Max-Age=${60 * 60 * 24 * 7}`,
        ];
        
        res.setHeader("Set-Cookie", cookieHeader);

        return res.status(200).json({
          message: "Admin login successful",
          userId: 0, // Admin from env
          role: "admin",
          otpRequired: false, // Admins don't need OTP
        });
      }
    }

    // 🧑‍🗳 Check database for user (by email or school_id)
    const { data: user, error: userError } = await users.getByEmailOrSchoolId(loginIdentifier);
    
    if (userError || !user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // 🔒 Verify password
    if (!user.password) {
      return res.status(500).json({ message: "User password not found" });
    }
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // ✅ Check approval + profile status (only for voters)
    if (user.role === "voter") {
      if (user.approval_status === "pending") {
        return res
          .status(403)
          .json({ message: "Account pending approval by admin" });
      }

      if (user.approval_status === "declined") {
        return res.status(403).json({ message: "Account declined by admin" });
      }

      if (user.profile_status === "inactive") {
        return res
          .status(403)
          .json({ message: "Account inactive. Please contact the admin." });
      }

      if (user.profile_status === "graduating") {
        return res.status(403).json({
          message:
            "Account marked as graduating. You are no longer eligible to vote.",
        });
      }
    }

    // 🚀 Successful login
    // Check if user has face registered to determine next step
    if (user.id === undefined) {
      return res.status(500).json({ message: "User ID not found" });
    }

    const { data: faceData, error: faceError } = await userFaces.getByUserId(user.id);
    // Handle the case where no face data exists (which is not an error condition)
    const hasFace = !faceError && faceData !== null;

    // Log the face check result for debugging
    console.log(`Face check for user ${user.id}: hasFace = ${hasFace}`);

    // For voters, require OTP verification
    const otpRequired = user.role === "voter";

    // If OTP is required, send OTP to user
    if (otpRequired) {
      // Generate and send OTP
      const crypto = await import('crypto');
      const otp = crypto.randomInt(100000, 999999).toString();
      
      // Save OTP with 5-min expiry
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      if (user.id === undefined) {
        return res.status(500).json({ message: "User ID not found for OTP" });
      }
      const { error: otpError } = await userOtps.upsert(user.id, otp, expiresAt);
      
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
      
      // Log the OTP generation for development debugging
      console.log("📤 Generated OTP for user:", user.email);
    }
    
    // DON'T set auth token cookie here - that should happen after OTP verification
    // Only set a temporary flag to indicate user has passed initial authentication
    const isSecure = req.headers['x-forwarded-proto'] === 'https' || 
                    (req.socket as any).encrypted || 
                    process.env.NODE_ENV === 'production';

    const cookieHeader = [
      `tempLogin=true; Path=/; HttpOnly; SameSite=Lax${isSecure ? '; Secure' : ''}; Max-Age=600`, // 10 min expiry
      `tempUserId=${user.id}; Path=/; HttpOnly; SameSite=Lax${isSecure ? '; Secure' : ''}; Max-Age=600`, // 10 min expiry
    ];
    
    res.setHeader("Set-Cookie", cookieHeader);
    
    return res.status(200).json({
      message: `${user.role === "admin" ? "Admin" : "User"} login successful`,
      userId: user.id,
      role: user.role,
      otpRequired, // Require OTP for voters
      hasFace, // Add this to inform frontend
    });
  } catch (error: unknown) {
    console.error("❌ Login Error:", error);
    const message =
      error instanceof Error ? error.message : "Internal Server Error";
    return res.status(500).json({ message });
  }
}
