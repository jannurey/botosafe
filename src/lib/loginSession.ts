import type { NextApiRequest } from "next";
import { parse as parseCookie } from "cookie";
import { getRedis } from "./redis";

const LOGIN_SESSION_PREFIX = "login_session:";
const LOGIN_SESSION_TTL_SECONDS = 60 * 10; // 10 minutes

export async function createLoginSessionData(
  sessionId: string,
  data: { userId: number; otpVerified?: boolean; createdAt?: number }
) {
  const redis = getRedis();
  if (!redis) return false;
  const key = LOGIN_SESSION_PREFIX + sessionId;
  const val = JSON.stringify(data);
  await redis.set(key, val, "EX", LOGIN_SESSION_TTL_SECONDS);
  return true;
}

export async function getLoginSessionData(sessionId: string | undefined) {
  if (!sessionId) return null;
  const redis = getRedis();
  if (!redis) return null;
  const raw = await redis.get(LOGIN_SESSION_PREFIX + sessionId);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as {
      userId: number;
      otpVerified?: boolean;
      createdAt?: number;
    };
  } catch {
    return null;
  }
}

export async function clearLoginSession(sessionId: string | undefined) {
  if (!sessionId) return;
  const redis = getRedis();
  if (!redis) return;
  await redis.del(LOGIN_SESSION_PREFIX + sessionId);
}

export async function getLoginSessionFromRequest(req: NextApiRequest) {
  const cookies = parseCookie(req.headers.cookie || "");
  const sessionId = cookies.loginSessionId;
  if (!sessionId) return null;
  return getLoginSessionData(sessionId);
}
