import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/configs/supabase";
import jwt from "jsonwebtoken";
import { parse } from "cookie";

const JWT_SECRET = process.env.JWT_SECRET ?? "changeme";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ message: string }>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    const cookies = parse(req.headers.cookie || "");
    const sel = cookies.selection;
    if (!sel)
      return res.status(401).json({ message: "Selection token missing" });

    let payload: any;
    try {
      payload = jwt.verify(sel, JWT_SECRET);
    } catch (err) {
      return res
        .status(401)
        .json({ message: "Invalid or expired selection token" });
    }

    if (!payload?.otpVerified) {
      return res
        .status(403)
        .json({ message: "Selection token not authorized" });
    }

    // Re-check user exists
    const { data: rows, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, role')
      .eq('id', payload.id)
      .limit(1);

    if (userError) {
      console.error("Supabase query error:", userError);
      return res.status(500).json({ message: "Database error" });
    }

    if (!rows || rows.length === 0)
      return res.status(404).json({ message: "User not found" });

    const user = rows[0];

    // Issue preAuth token (short-lived) so face-scan/register pages can complete verification
    const preAuth = jwt.sign(
      { id: user.id, role: user.role, preAuth: true, otpVerified: true },
      JWT_SECRET,
      { expiresIn: "10m" }
    );

    const cookiesToSet = [
      `preAuth=${preAuth}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 10}`,
      // clear selection cookie
      `selection=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
    ];

    res.setHeader("Set-Cookie", cookiesToSet);

    return res.status(200).json({ message: "Pre-auth issued for voter" });
  } catch (err: unknown) {
    console.error("preauth-voter error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}