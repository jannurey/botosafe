import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/configs/supabase";
import bcrypt from "bcryptjs";

interface UserRow {
  id: number;
  fullname: string;
  email: string;
  role: string;
  approval_status: string;
  user_status: string;
  is_verified: boolean;
  created_at: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const {
    fullname,
    age,
    gender,
    course,
    year_level,
    school_id,
    email,
    password,
  } = req.body;

  if (
    !fullname ||
    !age ||
    !gender ||
    !course ||
    !year_level ||
    !school_id ||
    !email ||
    !password
  ) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    // Check if email already exists
    const { data: existingEmailUsers, error: emailCheckError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .limit(1);

    if (emailCheckError) {
      console.error("Supabase query error:", emailCheckError);
      return res.status(500).json({ message: "Database error" });
    }

    if (existingEmailUsers && existingEmailUsers.length > 0) {
      return res.status(400).json({ message: "Email already exists" });
    }

    // Check if school_id already exists
    const { data: existingSchoolIdUsers, error: schoolIdCheckError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('school_id', school_id)
      .limit(1);

    if (schoolIdCheckError) {
      console.error("Supabase query error:", schoolIdCheckError);
      return res.status(500).json({ message: "Database error" });
    }

    if (existingSchoolIdUsers && existingSchoolIdUsers.length > 0) {
      return res.status(400).json({ message: "School ID already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new user
    const { data: newUser, error: insertError } = await supabaseAdmin
      .from('users')
      .insert({
        fullname,
        age,
        gender,
        course,
        year_level,
        school_id,
        email,
        password: hashedPassword,
        role: "voter",
        approval_status: "pending", // waiting for admin approval
        user_status: "active", // default activity status
        is_verified: false,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      console.error("Supabase insert error:", insertError);
      return res.status(500).json({ message: "Database error" });
    }

    return res.status(201).json({
      message: "Account created successfully. Awaiting admin approval.",
      user: {
        id: newUser.id,
        fullname: newUser.fullname,
        email: newUser.email,
        role: newUser.role,
        approval_status: newUser.approval_status,
        user_status: newUser.user_status,
        is_verified: newUser.is_verified,
        created_at: newUser.created_at
      },
    });
  } catch (error: unknown) {
    console.error("❌ Error creating account:", error);
    const message =
      error instanceof Error ? error.message : "Internal Server Error";
    return res.status(500).json({ message });
  }
}