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
  res: NextApiResponse<Partylist[] | Partylist | { message: string }>
) {
  switch (req.method) {
    case "GET":
      return handleGet(req, res);
    case "POST":
      return handlePost(req, res);
    default:
      return res.status(405).json({ message: `Method ${req.method} not allowed` });
  }
}

// Get all partylists for an election
async function handleGet(req: NextApiRequest, res: NextApiResponse<Partylist[] | { message: string }>) {
  const { election_id } = req.query;
  
  if (!election_id) {
    return res.status(400).json({ message: "election_id is required" });
  }

  try {
    const { data: rows, error } = await supabaseAdmin
      .from('partylists')
      .select('*')
      .eq('election_id', election_id)
      .order('name', { ascending: true });
    
    if (error) {
      console.error("Supabase query error:", error);
      return res.status(500).json({ message: "Database error" });
    }
    
    return res.status(200).json(rows);
  } catch (error: unknown) {
    console.error("❌ Error fetching partylists:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ message });
  }
}

// Create a new partylist
async function handlePost(req: NextApiRequest, res: NextApiResponse<Partylist | { message: string }>) {
  const { election_id, name, description } = req.body;

  if (!election_id || !name) {
    return res.status(400).json({ message: "election_id and name are required" });
  }

  try {
    const { data: insertResult, error: insertError } = await supabaseAdmin
      .from('partylists')
      .insert({
        election_id: election_id,
        name: name,
        description: description || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      console.error("Supabase insert error:", insertError);
      return res.status(500).json({ message: "Database error" });
    }

    return res.status(201).json(insertResult);
  } catch (error: unknown) {
    console.error("❌ Error creating partylist:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ message });
  }
}