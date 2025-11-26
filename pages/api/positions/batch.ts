import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/configs/supabase";

interface Position {
  id: number;
  election_id: number;
  name: string;
  election_title?: string;
}

interface BatchCreateRequest {
  positions: {
    name: string;
    election_id: number;
  }[];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Position[] | { error: string }>
) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", ["POST"]);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    const { positions } = req.body as BatchCreateRequest;

    // Validate input
    if (!positions || !Array.isArray(positions) || positions.length === 0) {
      return res.status(400).json({ error: "Positions array is required and cannot be empty" });
    }

    // Validate each position
    for (const position of positions) {
      if (!position.name || !position.election_id) {
        return res.status(400).json({ error: "Each position must have a name and election_id" });
      }
    }

    // Insert all positions at once
    const { data: insertResults, error: insertError } = await supabaseAdmin
      .from('positions')
      .insert(positions)
      .select();

    if (insertError) {
      console.error("Supabase insert error:", insertError);
      return res.status(500).json({ error: "Database error while inserting positions" });
    }

    // Get the IDs of the inserted positions
    const insertedIds = insertResults.map((pos: any) => pos.id);

    // Fetch the newly created records with election titles
    const { data: rows, error: selectError } = await supabaseAdmin
      .from('positions')
      .select(`
        *,
        election:elections (
          title
        )
      `)
      .in('id', insertedIds);

    if (selectError) {
      console.error("Supabase select error:", selectError);
      return res.status(500).json({ error: "Database error while fetching created positions" });
    }

    if (!rows || rows.length === 0) {
      return res
        .status(500)
        .json({ error: "Failed to fetch created positions" });
    }

    // Format the response to match the expected structure
    const formattedRows = rows.map(row => ({
      id: row.id,
      election_id: row.election_id,
      name: row.name,
      election_title: row.election && row.election.length > 0 ? row.election[0].title : undefined
    }));

    return res.status(201).json(formattedRows);
  } catch (error: unknown) {
    console.error("❌ Batch Positions API error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: message });
  }
}