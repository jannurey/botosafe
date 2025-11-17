// pages/api/logout.ts
import type { NextApiRequest, NextApiResponse } from "next";

interface LogoutResponse {
  message?: string;
  error?: string;
}

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<LogoutResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const cookieHeader = [
    `authToken=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
  ];
  
  res.setHeader("Set-Cookie", cookieHeader);

  return res.status(200).json({ message: "Logged out successfully" });
}
