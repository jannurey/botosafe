import { NextApiRequest } from "next";
import { parse as parseCookie } from "cookie";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET ?? "changeme";

interface JwtPayload {
  id: number;
  email: string;
  role: string;
  mfa?: boolean;
  [key: string]: string | number | boolean | object | null | undefined;
}

export function getAuthUserFromRequest(req: NextApiRequest) {
  const cookies = parseCookie(req.headers.cookie || "");
  const token = cookies.authToken;
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}
