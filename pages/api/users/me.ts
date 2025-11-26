// pages/api/users/me.ts
import type { NextApiRequest, NextApiResponse } from "next";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { users } from "@/lib/supabaseClient";
import { User } from '@supabase/supabase-js';

interface UserRow {
  id: number;
  fullname: string;
  email: string;
  school_id?: string | null;
  age?: number | null;
  year_level?: number | null;
  user_status?: string | null;
  approval_status?: string | null;
  gender?: string | null;
  course?: string | null;
}

interface ApiResponse {
  message?: string;
  user?: UserRow;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  try {
    // Check for temporary login state first
    const tempLogin = req.headers['x-temp-login'];
    if (tempLogin === 'true') {
      // Handle temporary login for newly registered users
      const userId = req.headers['x-user-id'];
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { data: user, error: userError } = await users.getById(Number(userId));
      
      if (userError) {
        console.error("Error fetching user:", userError);
        return res.status(500).json({ message: "Error fetching user" });
      }
      
      if (!user || !user.id) {
        return res.status(404).json({ message: "User not found" });
      }

      return res.status(200).json({ user: user as UserRow });
    }

    // Extract token from cookies
    const token = req.cookies.authToken || req.cookies.token;
    if (!token) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: number; email: string; role: string };
    
    // Get user from Supabase
    const { data: user, error: userError } = await users.getById(decoded.id);
    
    if (userError) {
      console.error("Error fetching user:", userError);
      return res.status(500).json({ message: "Error fetching user" });
    }
    
    if (!user || !user.id) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({ user: user as UserRow });
  } catch (err: unknown) {
    console.error("Error fetching user:", err);
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return res.status(500).json({ message });
  }
}