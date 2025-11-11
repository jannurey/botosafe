import { NextApiRequest } from "next";
import { parse as parseCookie } from "cookie";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET ?? "changeme";

export function getAuthUserFromRequest(req: NextApiRequest) {
  const cookies = parseCookie(req.headers.cookie || "");
  const token = cookies.authToken;
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET) as any;
  } catch {
    return null;
  }
}
