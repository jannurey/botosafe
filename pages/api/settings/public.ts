// pages/api/settings/public.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { settings } from "@/lib/supabaseClient";

/**
 * Public settings endpoint.
 * Returns only safe keys that the public site or client UI may read.
 * Do NOT expose secrets via this endpoint (SMTP passwords, API keys, etc).
 */

const SAFE_KEYS = [
  "default_school_year",
  "site_timezone",
  "allow_registration",
];

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", ["GET"]);
      return res.status(405).json({ message: "Method Not Allowed" });
    }

    const { data: rows, error } = await settings.getByKeys(SAFE_KEYS);
    
    if (error) {
      console.error("Error fetching settings:", error);
      return res.status(500).json({ message: "Internal server error" });
    }

    const out: Record<string, unknown> = {};
    if (rows) {
      for (const r of rows) {
        // Skip rows without a key
        if (!r.k) continue;
          
        try {
          out[r.k] = JSON.parse(JSON.stringify(r.v));
        } catch {
          out[r.k] = r.v;
        }
      }
    }

    // Ensure defaults if missing
    if (!Object.prototype.hasOwnProperty.call(out, "allow_registration")) {
      out.allow_registration = false;
    }
    if (!Object.prototype.hasOwnProperty.call(out, "site_timezone")) {
      out.site_timezone = "UTC";
    }
    if (!Object.prototype.hasOwnProperty.call(out, "default_school_year")) {
      out.default_school_year = new Date().getFullYear().toString();
    }

    return res.status(200).json(out);
  } catch (err: unknown) {
    console.error("Settings API error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
}