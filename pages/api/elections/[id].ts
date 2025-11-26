import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/configs/supabase";

interface Election {
  id: number;
  title: string;
  status: string;
  start_time: string;
  end_time: string;
  filing_start_time?: string | null;
  filing_end_time?: string | null;
}

function computeStatus(e: Election): string {
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
  res: NextApiResponse<Election | { error: string }>
) {
  const { id } = req.query;

  try {
    if (req.method === "GET") {
      const { data: rows, error } = await supabaseAdmin
        .from('elections')
        .select('*')
        .eq('id', id);

      if (error) {
        console.error("Supabase query error:", error);
        return res.status(500).json({ error: "Database error" });
      }

      if (!rows || rows.length === 0) {
        return res.status(404).json({ error: "Election not found" });
      }

      const election = rows[0];
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

      return res.status(200).json(election);
    }

    if (req.method === "PUT") {
      const {
        title,
        start_time,
        end_time,
        filing_start_time,
        filing_end_time,
      } = req.body as Partial<Election>;

      // Store times exactly as received from the frontend
      const formatTime = (time: string | null | undefined) => {
        if (!time) return null;
        
        // For datetime-local values (YYYY-MM-DDTHH:mm), convert to PostgreSQL format
        if (time.includes('T') && !time.includes('Z')) {
          // Simply replace T with space and add seconds
          // This ensures the exact time is stored without timezone conversion
          return time.replace('T', ' ') + ':00';
        }
        
        // For other formats, return as-is
        return time;
      };

      const { error: updateError } = await supabaseAdmin
        .from('elections')
        .update({
          title,
          start_time: formatTime(start_time),
          end_time: formatTime(end_time),
          filing_start_time: formatTime(filing_start_time),
          filing_end_time: formatTime(filing_end_time)
        })
        .eq('id', id);

      if (updateError) {
        console.error("Supabase update error:", updateError);
        return res.status(500).json({ error: "Database error" });
      }

      const { data: updatedRows, error: selectError } = await supabaseAdmin
        .from('elections')
        .select('*')
        .eq('id', id);

      if (selectError) {
        console.error("Supabase select error:", selectError);
        return res.status(500).json({ error: "Database error" });
      }

      if (!updatedRows || updatedRows.length === 0) {
        return res.status(404).json({ error: "Election not found" });
      }

      return res.status(200).json(updatedRows[0]);
    }

    if (req.method === "DELETE") {
      const { error } = await supabaseAdmin
        .from('elections')
        .delete()
        .eq('id', id);

      if (error) {
        console.error("Supabase delete error:", error);
        return res.status(500).json({ error: "Database error" });
      }

      return res.status(204).end();
    }

    res.setHeader("Allow", ["GET", "PUT", "DELETE"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (error: unknown) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: message });
  }
}