import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/configs/supabase";

interface Position {
  id: number;
  election_id: number;
  name: string;
  election_title?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Position | Position[] | { error: string }>
) {
  try {
    if (req.method === "GET") {
      const { data: rows, error } = await supabaseAdmin
        .from('positions')
        .select(`
          *,
          election:elections (
            title
          )
        `)
        .order('id', { ascending: false });

      if (error) {
        console.error("Supabase query error:", error);
        return res.status(500).json({ error: "Database error" });
      }

      // Format the response to match the expected structure
      const formattedRows = rows.map(row => ({
        id: row.id,
        election_id: row.election_id,
        name: row.name,
        election_title: row.election && row.election.length > 0 ? row.election[0].title : undefined
      }));

      return res.status(200).json(formattedRows);
    }

    if (req.method === "POST") {
      const { election_id, name } = req.body;

      // Insert into Supabase
      const { data: insertResult, error: insertError } = await supabaseAdmin
        .from('positions')
        .insert({
          election_id: election_id,
          name: name
        })
        .select()
        .single();

      if (insertError) {
        console.error("Supabase insert error:", insertError);
        return res.status(500).json({ error: "Database error" });
      }

      // Fetch the newly created record with election title
      const { data: rows, error: selectError } = await supabaseAdmin
        .from('positions')
        .select(`
          *,
          election:elections (
            title
          )
        `)
        .eq('id', insertResult.id);

      if (selectError) {
        console.error("Supabase select error:", selectError);
        return res.status(500).json({ error: "Database error" });
      }

      if (!rows || rows.length === 0) {
        return res
          .status(500)
          .json({ error: "Failed to fetch created position" });
      }

      // Format the response to match the expected structure
      const formattedRow = {
        id: rows[0].id,
        election_id: rows[0].election_id,
        name: rows[0].name,
        election_title: rows[0].election && rows[0].election.length > 0 ? rows[0].election[0].title : undefined
      };

      return res.status(201).json(formattedRow);
    }

    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (error: unknown) {
    console.error("❌ Positions API error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: message });
  }
}