import type { NextApiRequest, NextApiResponse } from "next";
import { SUPABASE_BUCKET, SUPABASE_URL } from "@/configs/supabase";

interface SignedUrlResponse {
  signedUrl?: string;
  error?: string;
}

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<SignedUrlResponse>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { path } = req.query as { path?: string };
  if (!path) {
    return res.status(400).json({ error: "File path is required" });
  }

  try {
    // Public bucket URL
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${path}`;
    return res.status(200).json({ signedUrl: publicUrl });
  } catch (err: unknown) {
    console.error("Public URL handler error:", err);
    const message =
      err instanceof Error ? err.message : "Internal Server Error";
    return res.status(500).json({ error: message });
  }
}
