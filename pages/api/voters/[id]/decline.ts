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
    // First check if user exists
    const { data: checkData, error: checkError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('id', id)
      .limit(1);

    if (checkError) {
      console.error("Supabase query error:", checkError);
      return res.status(500).json({ message: "Database error" });
    }

    if (!checkData || checkData.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    // Delete the user
    const { error: deleteError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error("Supabase delete error:", deleteError);
      return res.status(500).json({ message: "Database error" });
    }

    return res.status(200).json({ message: "User declined and deleted" });
  } catch (err: unknown) {
    console.error("Decline failed:", err);
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return res.status(500).json({ message });
  }
}