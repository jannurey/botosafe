import type { NextApiRequest } from "next";
import { supabaseAdmin } from "@/configs/supabase";

type AttemptLabel = "genuine" | "impostor" | "unknown";
type EventSource = "login" | "vote" | "enroll" | "other";

// Normalize and extract a client IP from headers/socket.
// Returns a plain IPv4 or IPv6 literal (no brackets/ports/zone ids), or null.
function getClientIp(req: NextApiRequest): string | null {
  const xff = (req.headers["x-forwarded-for"] as string) || "";
  // Use leftmost address from XFF (adjust if your proxy chain requires last hop)
  let ip = xff.split(",")[0].trim() || (req.socket as { remoteAddress?: string })?.remoteAddress || "";
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
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('id', id)
    .limit(1)
    .single();
  
  return !error && !!data;
}

async function electionExists(id: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('elections')
    .select('id')
    .eq('id', id)
    .limit(1)
    .single();
  
  return !error && !!data;
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
      opts.attemptLabel && allowedAttempt[opts.attemptLabel as keyof typeof allowedAttempt]
        ? opts.attemptLabel
        : "genuine";
    const source: EventSource =
      opts.source && allowedSource[opts.source as keyof typeof allowedSource]
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

    // Insert the face verification event
    const { error: insertError } = await supabaseAdmin
      .from('face_verification_events')
      .insert({
        user_id: parseInt(userIdStr),
        election_id: electionIdStr ? parseInt(electionIdStr) : null,
        decision_match: opts.decisionMatch,
        best_score: opts.bestScore ?? null,
        median_score: opts.medianScore ?? null,
        threshold: opts.threshold ?? null,
        attempt_label: attemptLabel,
        source: source,
        client_ip: ip,
        user_agent: userAgent
      });

    if (insertError) {
      console.error("Supabase insert error:", insertError);
      return;
    }
  } catch (e: unknown) {
    // Handle FK race (parent deleted after exists-check) or other FK violations
    // Swallow: logging must not affect main flow
    // eslint-disable-next-line no-console
    console.warn(
      "Failed to log face_verification_event:",
      e instanceof Error ? e.message : String(e)
    );
    return;
  }
}