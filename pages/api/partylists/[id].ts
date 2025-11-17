import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/configs/supabase";

interface Partylist {
  id: number;
  election_id: number;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Partylist | { message: string }>
) {
  const { id } = req.query;

  if (!id || Array.isArray(id)) {
    return res.status(400).json({ message: "Invalid partylist ID" });
  }

  switch (req.method) {
    case "GET":
      return handleGet(Number(id), res);
    case "PUT":
      return handlePut(Number(id), req, res);
    case "DELETE":
      return handleDelete(Number(id), res);
    default:
      return res.status(405).json({ message: `Method ${req.method} not allowed` });
  }
}

// Get a specific partylist
async function handleGet(id: number, res: NextApiResponse<Partylist | { message: string }>) {
  try {
    const { data: rows, error } = await supabaseAdmin
      .from('partylists')
      .select('*')
      .eq('id', id);

    if (error) {
      console.error("Supabase query error:", error);
      return res.status(500).json({ message: "Database error" });
    }

    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: "Partylist not found" });
    }

    return res.status(200).json(rows[0]);
  } catch (error: unknown) {
    console.error("❌ Error fetching partylist:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ message });
  }
}

// Update a partylist
async function handlePut(
  id: number,
  req: NextApiRequest,
  res: NextApiResponse<Partylist | { message: string }>
) {
  const { name, description } = req.body;

  if (!name) {
    return res.status(400).json({ message: "Name is required" });
  }

  try {
    const { error: updateError } = await supabaseAdmin
      .from('partylists')
      .update({
        name: name,
        description: description || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (updateError) {
      console.error("Supabase update error:", updateError);
      return res.status(500).json({ message: "Database error" });
    }

    const { data: rows, error: selectError } = await supabaseAdmin
      .from('partylists')
      .select('*')
      .eq('id', id);

    if (selectError) {
      console.error("Supabase select error:", selectError);
      return res.status(500).json({ message: "Database error" });
    }

    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: "Partylist not found" });
    }

    return res.status(200).json(rows[0]);
  } catch (error: unknown) {
    console.error("❌ Error updating partylist:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ message });
  }
}

// Delete a partylist
async function handleDelete(id: number, res: NextApiResponse<{ message: string }>) {
  try {
    const { error } = await supabaseAdmin
      .from('partylists')
      .delete()
      .eq('id', id);

    if (error) {
      console.error("Supabase delete error:", error);
      return res.status(500).json({ message: "Database error" });
    }

    return res.status(200).json({ message: "Partylist deleted successfully" });
  } catch (error: unknown) {
    console.error("❌ Error deleting partylist:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ message });
  }
}