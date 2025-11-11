// pages/api/forgot-password.ts
import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import transporter from "@/lib/nodemailer";
import { pool } from "@/configs/database";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST")
    return res.status(405).json({ message: "Method not allowed" });

  const { email } = req.body || {};
  if (!email || typeof email !== "string")
    return res.status(400).json({ message: "Email is required" });

  try {
    const [rows] = await pool.execute(
      "SELECT id, email FROM users WHERE email = ?",
      [email]
    );
    const users = rows as any[];

    // Prevent user enumeration: always respond with success message.
    if (!users.length) {
      return res.status(200).json({
        message: "Password reset link sent to your email",
      });
    }

    const user = users[0];

    // Create token & store only the hash
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

    // Upsert into password_resets (user_id unique)
    await pool.execute(
      `INSERT INTO password_resets (user_id, token_hash, expires_at)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE token_hash = VALUES(token_hash), expires_at = VALUES(expires_at)`,
      [user.id, tokenHash, expiresAt]
    );

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

    // Send email using your lib/nodemailer transporter
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: user.email,
      subject: "Password reset request",
      text: `You requested a password reset. Use the link below to reset your password:\n\n${resetUrl}\n\nIf you did not request this, ignore this email.`,
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
