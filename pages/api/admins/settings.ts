import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/configs/supabase";
import { parse } from "cookie";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET ?? "changeme";

type SettingsMap = Record<string, unknown>;

async function requireAdmin(req: NextApiRequest) {
  const cookies = parse(req.headers.cookie || "");
  const token = cookies.authToken;
  if (!token) throw new Error("Unauthorized");
  let payload: jwt.JwtPayload | string;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    throw new Error("Invalid token");
  }
  
  // Check if payload is not a string and has role property
  if (typeof payload === 'string' || payload.role !== "admin") {
    throw new Error("Forbidden");
  }
  return payload;
}

function validateDefaultSchoolYear(value: unknown) {
  if (typeof value !== "string") {
    throw new Error("default_school_year must be a string in format YYYY-YYYY");
  }
  const m = value.match(/^(\d{4})-(\d{4})$/);
  if (!m) {
    throw new Error(
      "default_school_year must match format YYYY-YYYY (e.g. 2025-2026)"
    );
  }
  const start = Number(m[1]);
  const end = Number(m[2]);
  if (end !== start + 1) {
    throw new Error(
      "default_school_year end year must equal start year + 1 (e.g. 2025-2026)"
    );
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SettingsMap | { message: string }>
) {
  try {
    // All routes require admin auth
    let actor: jwt.JwtPayload | string | null = null;
    try {
      actor = await requireAdmin(req);
    } catch (err: unknown) {
      const code = (err as Error).message === "Forbidden" ? 403 : 401;
      return res.status(code).json({ message: (err as Error).message });
    }

    if (req.method === "GET") {
      // fetch all settings
      const { data: rows, error } = await supabaseAdmin
        .from('settings')
        .select('k, v');

      if (error) {
        console.error("Supabase query error:", error);
        return res.status(500).json({ message: "Database error" });
      }

      const out: SettingsMap = {};
      for (const r of rows) {
        try {
          out[r.k] = JSON.parse(JSON.stringify(r.v));
        } catch {
          out[r.k] = r.v;
        }
      }
      return res.status(200).json(out);
    }

    if (req.method === "PUT" || req.method === "POST") {
      const body = req.body as SettingsMap | undefined;
      if (!body || typeof body !== "object") {
        return res.status(400).json({ message: "Invalid body" });
      }

      // Validate specific keys before saving
      if (Object.prototype.hasOwnProperty.call(body, "default_school_year")) {
        try {
          validateDefaultSchoolYear(body["default_school_year"]);
        } catch (err: unknown) {
          return res
            .status(400)
            .json({ message: (err as Error)?.message ?? "Invalid default_school_year" });
        }
      }

      // Upsert each provided key
      const keys = Object.keys(body);
      if (keys.length === 0) {
        return res.status(400).json({ message: "No settings provided" });
      }

      // Use transaction-like approach with Supabase
      try {
        for (const k of keys) {
          const v = JSON.stringify(body[k] ?? null);
          
          // Use upsert to handle both insert and update
          const { error: upsertError } = await supabaseAdmin
            .from('settings')
            .upsert({
              k: k,
              v: v,
              updated_by: actor?.id ?? null,
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'k'
            });
              
          if (upsertError) {
            throw upsertError;
          }
        }
      } catch (err) {
        console.error("Settings update error:", err);
        throw err;
      }

      return res.status(200).json({ message: "Settings saved" });
    }

    res.setHeader("Allow", ["GET", "PUT", "POST"]);
    return res.status(405).json({ message: "Method Not Allowed" });
  } catch (err: unknown) {
    console.error("api/admin/settings error:", err);
    const message =
      err instanceof Error ? err.message : "Internal Server Error";
    return res.status(500).json({ message });
  }
}