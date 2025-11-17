import type { NextApiRequest } from "next";
import { parse as parseCookie } from "cookie";
import * as jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET ?? "changeme";

interface JwtPayload {
  id: number;
  role?: string;
  preAuth?: boolean;
  otpVerified?: boolean;
  [key: string]: string | number | boolean | object | null | undefined;
}

/**
 * Read and validate preAuth JWT from cookies.
 * Returns { id, role, otpVerified } or null.
 */
export function getPreAuthFromRequest(
  req: NextApiRequest
): { id: number; role?: string; otpVerified?: boolean } | null {
  const cookies = parseCookie(req.headers.cookie || "");
  const token = cookies.preAuth;
  if (!token) return null;
  try {
    // cast secret so TypeScript selects correct overload
    const payload = jwt.verify(
      token,
      JWT_SECRET as unknown as jwt.Secret
    ) as JwtPayload;
    if (payload && payload.preAuth && payload.id) {
      return {
        id: Number(payload.id),
        role: payload.role,
        otpVerified: !!payload.otpVerified,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Create a preAuth token. Cast the secret to jwt.Secret so TypeScript picks the right overload.
 */
export function createPreAuthToken(
  userId: number,
  role?: string,
  otpVerified = false,
  expiresIn = "10m"
): string {
  // explicitly cast options to jwt.SignOptions and secret to jwt.Secret
  return jwt.sign(
    { id: userId, role, preAuth: true, otpVerified },
    JWT_SECRET as unknown as jwt.Secret,
    { expiresIn } as jwt.SignOptions
  );
}
