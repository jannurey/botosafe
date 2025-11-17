// pages/api/convert-temp-token.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/configs/supabase";
import jwt from "jsonwebtoken";

// Remove unused UserRow interface

interface JwtPayload {
  id: number;
  temp: boolean;
  [key: string]: string | number | boolean | object | null | undefined;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    // Get the temporary token from cookies
    const tempAuthToken = req.cookies.tempAuthToken;
    if (!tempAuthToken) {
      return res.status(401).json({ message: "No temporary token found" });
    }

    // Verify the temporary token
    const decoded = jwt.verify(tempAuthToken, process.env.JWT_SECRET!) as JwtPayload;
    if (!decoded || !decoded.temp) {
      return res.status(401).json({ message: "Invalid temporary token" });
    }

    const userId = decoded.id;

    // Get user info
    const { data: userRows, error } = await supabaseAdmin
      .from('users')
      .select('id, email, role')
      .eq('id', userId);

    if (error) {
      console.error("Supabase query error:", error);
      return res.status(500).json({ message: "Database error" });
    }

    if (!userRows || userRows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = userRows[0];

    // Generate full authentication token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, mfa: true },
      process.env.JWT_SECRET!,
      { expiresIn: "7d" }
    );

    // Determine if we're in a secure context (HTTPS)
    const isSecure = req.headers['x-forwarded-proto'] === 'https' || 
                    (req.socket && 'encrypted' in req.socket && req.socket.encrypted) || 
                    process.env.NODE_ENV === 'production';

    // Set auth token cookie and clear temp auth token
    const cookieHeader = [
      `authToken=${token}; Path=/; HttpOnly; SameSite=Lax${isSecure ? '; Secure' : ''}; Max-Age=${60 * 60 * 24 * 7}`,
      `tempAuthToken=; Path=/; HttpOnly; Max-Age=0`
    ];
    
    res.setHeader("Set-Cookie", cookieHeader);

    return res.status(200).json({
      message: "Token conversion successful",
      token,
    });
  } catch (error: unknown) {
    console.error("❌ Token conversion error:", error);
    const message = error instanceof Error ? error.message : "Server error";
    return res.status(500).json({ message });
  }
}