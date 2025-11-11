import type { NextApiRequest } from "next";
import { pool } from "@/configs/database";

type AttemptLabel = "genuine" | "impostor" | "unknown";
type EventSource = "login" | "vote" | "enroll" | "other";

// Normalize and extract a client IP from headers/socket.
// Returns a plain IPv4 or IPv6 literal (no brackets/ports/zone ids), or null.
function getClientIp(req: NextApiRequest): string | null {
  const xff = (req.headers["x-forwarded-for"] as string) || "";
  // Use leftmost address from XFF (adjust if your proxy chain requires last hop)
  let ip = xff.split(",")[0].trim() || (req.socket as any)?.remoteAddress || "";
  if (!ip) return null;

  // Strip brackets for IPv6 like [::1] or [2001:db8::1]:1234
  if (ip.startsWith("[") && ip.includes("]")) {
    const end = ip.indexOf("]");
    ip = ip.slice(1, end);
  }

  // Strip port if present for IPv4 like 1.2.3.4:12345
  const lastColon = ip.lastIndexOf(":");
  if (ip.includes(".") && lastColon > -1 && ip.indexOf(":") === lastColon) {
    ip = ip.slice(0, lastColon);
  }

  // Strip IPv6 zone id (e.g., fe80::1%eth0)
  const zoneIdx = ip.indexOf("%");
  if (zoneIdx > -1) {
    ip = ip.slice(0, zoneIdx);
  }

  // Strip IPv6-mapped IPv4 prefix
  if (ip.startsWith("::ffff:")) ip = ip.slice(7);

  ip = ip.trim();
  return ip || null;
}

// Validate a DB id input and return a digits-only string or null.
// Using string avoids JS number precision issues with BIGINT UNSIGNED.
function toDbId(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const s = String(raw);
  return /^\d+$/.test(s) && s !== "0" ? s : null;
}

async function userExists(id: string): Promise<boolean> {
  const [rows] = await pool.query("SELECT 1 FROM users WHERE id = ? LIMIT 1", [
    id,
  ]);
  // @ts-ignore mysql2 RowDataPacket[]
  return Array.isArray(rows) && rows.length > 0;
}

async function electionExists(id: string): Promise<boolean> {
  const [rows] = await pool.query(
    "SELECT 1 FROM elections WHERE id = ? LIMIT 1",
    [id]
  );
  // @ts-ignore mysql2 RowDataPacket[]
  return Array.isArray(rows) && rows.length > 0;
}

export async function logFaceVerificationEvent(opts: {
  req: NextApiRequest;
  userId: number | string; // accept string to avoid precision loss
  decisionMatch: boolean;
  bestScore?: number | null;
  medianScore?: number | null;
  threshold?: number | null;
  attemptLabel?: AttemptLabel;
  source?: EventSource;
  electionId?: number | string | null;
}): Promise<void> {
  try {
    // IDs
    const userIdStr = toDbId(opts.userId);
    if (!userIdStr) return; // invalid user id; skip logging

    let electionIdStr = toDbId(opts.electionId ?? null);

    // Clamp enums at runtime
    const allowedAttempt: Record<AttemptLabel, true> = {
      genuine: true,
      impostor: true,
      unknown: true,
    };
    const allowedSource: Record<EventSource, true> = {
      login: true,
      vote: true,
      enroll: true,
      other: true,
    };
    const attemptLabel: AttemptLabel =
      opts.attemptLabel && (allowedAttempt as any)[opts.attemptLabel]
        ? opts.attemptLabel
        : "genuine";
    const source: EventSource =
      opts.source && (allowedSource as any)[opts.source]
        ? opts.source
        : "login";

    // Headers
    const uaHeader = (opts.req.headers["user-agent"] || null) as string | null;
    const userAgent =
      uaHeader && uaHeader.length > 255 ? uaHeader.slice(0, 255) : uaHeader;
    const ip = getClientIp(opts.req);

    // Proactively ensure parents exist to avoid FK noise
    if (!(await userExists(userIdStr))) return;
    if (electionIdStr && !(await electionExists(electionIdStr))) {
      electionIdStr = null; // FK-safe fallback
    }

    await pool.query(
      `
      INSERT INTO face_verification_events
        (user_id, election_id, decision_match, best_score, median_score, threshold, attempt_label, source, client_ip, user_agent)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, INET6_ATON(?), ?)
    `,
      [
        userIdStr,
        electionIdStr,
        opts.decisionMatch ? 1 : 0,
        opts.bestScore ?? null,
        opts.medianScore ?? null,
        opts.threshold ?? null,
        attemptLabel,
        source,
        ip,
        userAgent,
      ]
    );
  } catch (e: any) {
    // Handle FK race (parent deleted after exists-check) or other FK violations
    const errno = e?.errno ?? e?.code;
    if (
      errno === 1452 ||
      e?.code === "ER_NO_REFERENCED_ROW_2" ||
      e?.code === "ER_NO_REFERENCED_ROW"
    ) {
      // Swallow: logging must not affect main flow
      // eslint-disable-next-line no-console
      console.warn(
        "FK prevented logging face_verification_event:",
        e?.message ?? e
      );
      return;
    }

    // eslint-disable-next-line no-console
    console.error("Failed to log face_verification_event:", e);
  }
}
