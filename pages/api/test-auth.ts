// pages/api/test-auth.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/configs/supabase";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Test Supabase Auth by getting the current session
    const { data: { session }, error } = await supabaseAdmin.auth.getSession();
    
    if (error) {
      console.error("Supabase Auth error:", error);
      return res.status(500).json({ 
        success: false, 
        error: error.message,
        message: "Failed to connect to Supabase Auth"
      });
    }
    
    return res.status(200).json({ 
      success: true, 
      message: "Supabase Auth is working correctly",
      hasSession: !!session
    });
  } catch (error: unknown) {
    console.error("Unexpected error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ 
      success: false, 
      error: message,
      message: "Unexpected error occurred"
    });
  }
}