// pages/api/admin/approveUser.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/configs/supabase";

interface ApproveRequestBody {
  userId: number;
  approve: boolean;
}

interface ApiResponse {
  message: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { userId, approve } = req.body as ApproveRequestBody;

  try {
    // ✅ Supabase query
    const { data, error } = await supabaseAdmin
      .from('users')
      .update({ is_approved: approve })
      .eq('id', userId)
      .select();

    if (error) {
      console.error("Supabase update error:", error);
      return res.status(500).json({ message: "Database error" });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    return res
      .status(200)
      .json({ message: approve ? "User approved" : "User declined" });
  } catch (err) {
    console.error("Approval Error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}