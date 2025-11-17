import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/configs/supabase";

interface Voter {
  id: number;
  fullname: string;
  email: string;
  role: string;
  is_verified: boolean;
  created_at: string;
  updated_at?: string | null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Voter[] | { message: string }>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { data: rows, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .order('id', { ascending: true });

    if (error) {
      console.error("Supabase query error:", error);
      return res.status(500).json({ message: "Database error" });
    }

    return res.status(200).json(rows || []);
  } catch (err: unknown) {
    console.error("Error fetching voters:", err);
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return res.status(500).json({ message });
  }
}