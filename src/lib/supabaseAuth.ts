// src/lib/supabaseAuth.ts
import { supabaseAdmin } from "@/configs/supabase";

// Get the current user session
export async function getCurrentUser() {
  const { data: { session }, error } = await supabaseAdmin.auth.getSession();
  if (error || !session) {
    return null;
  }
  return session.user;
}

// Sign in with email and password
export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabaseAdmin.auth.signInWithPassword({
    email,
    password,
  });
  
  if (error) {
    throw new Error(error.message);
  }
  
  return data;
}

// Sign up with email and password
export async function signUpWithEmail(email: string, password: string, userData: Record<string, unknown>) {
  const { data, error } = await supabaseAdmin.auth.signUp({
    email,
    password,
    options: {
      data: userData,
    },
  });
  
  if (error) {
    throw new Error(error.message);
  }
  
  return data;
}

// Sign out
export async function signOut() {
  const { error } = await supabaseAdmin.auth.signOut();
  if (error) {
    throw new Error(error.message);
  }
}

// Get user by ID
export async function getUserById(id: string) {
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(id);
  if (error) {
    throw new Error(error.message);
  }
  return data.user;
}

// Update user metadata
export async function updateUserMetadata(userId: string, metadata: Record<string, unknown>) {
  const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    user_metadata: metadata,
  });
  
  if (error) {
    throw new Error(error.message);
  }
  
  return data.user;
}

// Create a new user (admin only)
export async function createUser(email: string, password: string, userData: Record<string, unknown>) {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    user_metadata: userData,
  });
  
  if (error) {
    throw new Error(error.message);
  }
  
  return data.user;
}

// Delete a user (admin only)
export async function deleteUser(userId: string) {
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) {
    throw new Error(error.message);
  }
}