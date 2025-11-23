// pages/api/forgot-password.ts
import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import transporter from "@/lib/nodemailer";
import { supabaseAdmin } from "@/configs/supabase";

// Simple in-memory rate limiting (in production, use Redis or similar)
const rateLimit = new Map<string, { count: number; lastRequest: number }>();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 3; // Max 3 requests per window

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST")
    return res.status(405).json({ message: "Method not allowed" });

  const { email } = req.body || {};
  if (!email || typeof email !== "string")
    return res.status(400).json({ message: "Email is required" });

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email))
    return res.status(400).json({ message: "Invalid email format" });

  // Rate limiting
  const clientIP = (req.headers["x-forwarded-for"] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    "unknown") as string;
  
  const key = `${clientIP}:${email}`;
  const now = Date.now();
  const requestData = rateLimit.get(key) || { count: 0, lastRequest: 0 };

  // Reset count if window has passed
  if (now - requestData.lastRequest > RATE_LIMIT_WINDOW) {
    requestData.count = 0;
  }

  // Check if limit exceeded
  if (requestData.count >= RATE_LIMIT_MAX) {
    return res.status(429).json({ 
      message: "Too many requests. Please try again later." 
    });
  }

  // Update rate limit data
  requestData.count += 1;
  requestData.lastRequest = now;
  rateLimit.set(key, requestData);

  try {
    const { data: users, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .eq('email', email);

    // Prevent user enumeration: always respond with success message.
    if (!users || users.length === 0) {
      return res.status(200).json({
        message: "Password reset link sent to your email",
      });
    }

    const user = users[0];

    // Create token & store only the hash
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

    // First, try to delete any existing reset tokens for this user
    await supabaseAdmin
      .from('password_resets')
      .delete()
      .eq('user_id', user.id);

    // Then insert the new reset token
    const { error: insertError } = await supabaseAdmin
      .from('password_resets')
      .insert({
        user_id: user.id,
        token_hash: tokenHash,
        expires_at: expiresAt.toISOString()
      });

    if (insertError) {
      console.error("Supabase insert error:", insertError);
      return res.status(500).json({ message: "Database error" });
    }

    // Build reset URL from headers (works behind proxies) or fallback to APP_URL
    const protoHeader =
      req.headers["x-forwarded-proto"] || req.headers["x-forwarded-protocol"];
    const proto = Array.isArray(protoHeader)
      ? protoHeader[0]
      : protoHeader ||
        (req.headers.referer
          ? new URL(String(req.headers.referer)).protocol.replace(":", "")
          : "http");
    const hostHeader = req.headers["x-forwarded-host"] || req.headers.host;
    const host = Array.isArray(hostHeader)
      ? hostHeader[0]
      : hostHeader || process.env.APP_URL || "localhost:3000";
    const baseUrl = process.env.APP_URL || `${proto}://${host}`;

    // IMPORTANT: put token in the path to match your dynamic route: /signin/login/reset-password/[token]
    const resetPath = `/signin/login/reset-password/${encodeURIComponent(
      token
    )}`;
    // Pass email as a query param
    const resetUrl = `${baseUrl}${resetPath}?email=${encodeURIComponent(
      user.email
    )}`;

    // Define sender - use EMAIL_FROM if available, otherwise fallback to EMAIL_USER
    const sender = process.env.EMAIL_FROM || process.env.EMAIL_USER;
    const senderName = process.env.APP_NAME || "BotoSafe";
    const fromAddress = senderName && sender 
      ? `"${senderName}" <${sender}>` 
      : sender || "no-reply@botosafe.com";

    // Send email using your lib/nodemailer transporter
    await transporter.sendMail({
      from: fromAddress,
      to: user.email,
      subject: "Password reset request",
      text: `You requested a password reset. Use the link below to reset your password:

${resetUrl}

If you did not request this, ignore this email.`,
      html: `<p>You requested a password reset. Click the link below to reset your password:</p>
             <p><a href="${resetUrl}">Reset my password</a></p>
             <p>If you did not request this, ignore this email.</p>`,
    });

    return res.status(200).json({
      message: "Password reset link sent to your email",
    });
  } catch (err) {
    console.error("forgot-password error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}