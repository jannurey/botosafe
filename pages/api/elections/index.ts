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
  res: NextApiResponse<Election | Election[] | { error: string }>
) {
  try {
    if (req.method === "GET") {
      const { data: rows, error } = await supabaseAdmin
        .from('elections')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error("Supabase query error:", error);
        return res.status(500).json({ error: "Database error" });
      }

      const elections = await Promise.all(
        rows.map(async (e) => {
          const newStatus = computeStatus(e);
          if (newStatus !== e.status) {
            const { error: updateError } = await supabaseAdmin
              .from('elections')
              .update({ status: newStatus })
              .eq('id', e.id);

            if (updateError) {
              console.error("Supabase update error:", updateError);
            } else {
              e.status = newStatus;
            }
          }
          return e;
        })
      );

      return res.status(200).json(elections);
    }

    if (req.method === "POST") {
      const {
        title,
        start_time,
        end_time,
        filing_start_time,
        filing_end_time,
      } = req.body;

      // Store times exactly as received from the frontend, normalizing common formats
      const formatTime = (time: string | null | undefined) => {
        if (!time) return null;

        // Handle datetime-local values (YYYY-MM-DDTHH:mm or YYYY-MM-DDTHH:mm:ss)
        if (time.includes("T") && !time.includes("Z")) {
          const [datePart, rawTimePart] = time.split("T");
          let timePart = rawTimePart;

          // If time has only HH:mm, append :00 seconds; if it already has seconds, keep as is
          if (/^\d{2}:\d{2}$/.test(timePart)) {
            timePart = `${timePart}:00`;
          }

          return `${datePart} ${timePart}`; // e.g. 2025-11-10 17:00:00
        }

        // For other formats (including already-correct timestamps), return as-is
        return time;
      };

      // Insert new election
      const { data: insertResult, error: insertError } = await supabaseAdmin
        .from('elections')
        .insert({
          title,
          start_time: formatTime(start_time),
          end_time: formatTime(end_time),
          filing_start_time: formatTime(filing_start_time),
          filing_end_time: formatTime(filing_end_time),
          status: "upcoming",
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (insertError) {
        console.error("Supabase insert error:", insertError);
        return res.status(500).json({ error: "Database error" });
      }

      const election = insertResult;
      const newStatus = computeStatus(election);

      if (newStatus !== election.status) {
        const { error: updateError } = await supabaseAdmin
          .from('elections')
          .update({ status: newStatus })
          .eq('id', election.id);

        if (updateError) {
          console.error("Supabase update error:", updateError);
          return res.status(500).json({ error: "Database error" });
        }
        election.status = newStatus;
      }

      return res.status(201).json(election);
    }

    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (error: unknown) {
    console.error("❌ Election API error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: message });
  }
}