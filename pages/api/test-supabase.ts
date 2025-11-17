// pages/api/test-supabase.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/configs/supabase";
import { users } from "@/lib/supabaseClient";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Test Supabase connection by fetching a user count
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('count()', { count: 'exact' });
    
    if (error) {
      console.error("Supabase connection error:", error);
      return res.status(500).json({ 
        success: false, 
        error: error.message,
        message: "Failed to connect to Supabase database"
      });
    }
    
    // Test our custom client
    const { data: userData, error: userError } = await users.getByEmailOrSchoolId('test');
    
    if (userError && userError.message !== 'JSON object requested, multiple (or no) rows returned') {
      console.error("Custom client error:", userError);
      return res.status(500).json({ 
        success: false, 
        error: userError.message,
        message: "Failed to use custom Supabase client"
      });
    }
    
    return res.status(200).json({ 
      success: true, 
      message: "Supabase integration is working correctly",
      userCount: data?.length || 0
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