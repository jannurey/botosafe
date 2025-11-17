import bcrypt from "bcryptjs";
import { users } from "@/lib/supabaseClient";

// Remove unused UserRow interface
// interface UserRow {
//   id: number;
//   email: string;
//   fullname: string;
//   password: string;
//   role: "admin" | "voter";
//   is_verified: boolean;
// }

export async function ensureAdminExists() {
  try {
    const email = process.env.ADMIN_EMAIL!;
    const plainPassword = process.env.ADMIN_PASSWORD!;
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    // Check if admin already exists
    const { data: existingUser, error: checkError } = await users.getByEmailOrSchoolId(email);
    
    if (checkError && checkError.message !== 'JSON object requested, multiple (or no) rows returned') {
      console.error("❌ Error checking admin existence:", checkError);
      return;
    }

    if (!existingUser) {
      // Create admin user
      const { data: newUser, error: createError } = await users.create({
        fullname: "Default Admin",
        password: hashedPassword,
        email: email,
        role: "admin",
        school_id: "0000",
        approval_status: "approved",
        user_status: "active",
        created_at: new Date().toISOString()
      });

      if (createError) {
        console.error("❌ Error creating admin:", createError);
        return;
      }

      console.log("✅ Admin created successfully");
    } else {
      console.log("ℹ️ Admin already exists, skipping insert");
    }
  } catch (error) {
    console.error("❌ Error ensuring admin exists:", error);
  }
}

// 🔹 New helper: check if email is admin
export async function isAdminEmail(email: string): Promise<boolean> {
  if (!email) return false;
  
  const { data: user, error } = await users.getByEmailOrSchoolId(email);
  
  if (error) {
    console.error("Error checking admin email:", error);
    return false;
  }
  
  return !!user && user.role === "admin";
}