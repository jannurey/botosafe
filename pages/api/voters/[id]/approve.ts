import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/configs/supabase";

interface ApiResponse {
  message: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  const { id } = req.query;

  if (req.method !== "PUT") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  if (!id || Array.isArray(id)) {
    return res.status(400).json({ message: "Invalid user ID" });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .update({ is_verified: true })
      .eq('id', id)
      .select();

    if (error) {
      console.error("Supabase update error:", error);
      return res.status(500).json({ message: "Database error" });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({ message: "User approved" });
  } catch (err: unknown) {
    console.error("Approve failed:", err);
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return res.status(500).json({ message });
  }
}