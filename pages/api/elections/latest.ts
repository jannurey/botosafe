import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/configs/supabase";

interface Election {
  id: number;
  title: string;
  status: "upcoming" | "filing" | "ongoing" | "closed";
  start_time: string;
  end_time: string;
  filing_start_time?: string | null;
  filing_end_time?: string | null;
  created_at: string;
}

function computeStatus(e: Election): Election["status"] {
  const now = new Date();
  const filingStart = e.filing_start_time
    ? new Date(e.filing_start_time)
    : null;
  const filingEnd = e.filing_end_time ? new Date(e.filing_end_time) : null;
  const start = new Date(e.start_time);
  const end = new Date(e.end_time);

  if (filingStart && now >= filingStart && filingEnd && now <= filingEnd)
    return "filing";
  if (now >= start && now <= end) return "ongoing";
  if (now > end) return "closed";
  return "upcoming";
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Election | { message: string }>
) {
  if (req.method !== "GET") {
    return res
      .status(405)
      .json({ message: `Method ${req.method} not allowed` });
  }

  try {
    const { data: rows, error } = await supabaseAdmin
      .from('elections')
      .select('*')
      .order('start_time', { ascending: false });

    if (error) {
      console.error("Supabase query error:", error);
      return res.status(500).json({ message: "Database error" });
    }

    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: "No elections found" });
    }

    // Update statuses if needed
    for (const row of rows) {
      const newStatus = computeStatus(row);
      if (newStatus !== row.status) {
        const { error: updateError } = await supabaseAdmin
          .from('elections')
          .update({ status: newStatus })
          .eq('id', row.id);

        if (updateError) {
          console.error("Supabase update error:", updateError);
        } else {
          row.status = newStatus;
        }
      }
    }

    // Pick the most relevant election
    const election =
      rows.find((row) => row.status === "ongoing") ||
      rows.find((row) => row.status === "closed") ||
      rows[0];

    return res.status(200).json(election);
  } catch (error: unknown) {
    console.error("❌ Error fetching latest election:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ message });
  }
}