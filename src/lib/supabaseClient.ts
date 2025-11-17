// src/lib/supabaseClient.ts
import { supabaseAdmin } from "@/configs/supabase";
import { PostgrestBuilder } from '@supabase/postgrest-js';

// Define types for our data
interface UserData {
  id?: number;
  fullname?: string;
  email?: string;
  password?: string;
  role?: string;
  can_vote?: number;
  approval_status?: string;
  user_status?: string;
  school_id?: string;
  created_at?: string;
  approved_at?: string;
  last_login_at?: string;
  profile_status?: string;
}

interface UserOTPData {
  id?: number;
  user_id?: number;
  otp?: string;
  expires_at?: string;
  created_at?: string;
}

interface UserFaceData {
  id?: number;
  user_id?: number;
  face_embedding?: string;
  created_at?: string;
}

interface VoteData {
  id?: number;
  user_id?: number;
  election_id?: number;
  candidate_id?: number;
  position_id?: number;
  encrypted_vote?: string;
  created_at?: string;
}

interface SettingData {
  id?: number;
  k?: string;
  v?: string;
  created_at?: string;
}

interface PasswordResetData {
  id?: number;
  user_id?: number;
  token_hash?: string;
  expires_at?: string;
  created_at?: string;
}

// Helper function to handle Supabase responses
export async function handleSupabaseResponse<T>(builder: PostgrestBuilder<Record<string, unknown>, T[], boolean>): Promise<{ data: T[] | null; error: Error | null }> {
  try {
    const { data, error } = await builder;
    if (error) {
      console.error("Supabase error:", error);
      return { data: null, error: new Error(error.message) };
    }
    return { data: data || [], error: null };
  } catch (err) {
    console.error("Unexpected error:", err);
    return { data: null, error: err as Error };
  }
}

// Helper function for single row responses
export async function handleSupabaseSingleResponse<T>(builder: PostgrestBuilder<Record<string, unknown>, T, boolean>): Promise<{ data: T | null; error: Error | null }> {
  try {
    const { data, error } = await builder;
    if (error) {
      console.error("Supabase error:", error);
      return { data: null, error: new Error(error.message) };
    }
    return { data: data || null, error: null };
  } catch (err) {
    console.error("Unexpected error:", err);
    return { data: null, error: err as Error };
  }
}

// Helper function for delete operations
export async function handleSupabaseDeleteResponse(builder: PostgrestBuilder<Record<string, unknown>, null, boolean>): Promise<{ data: null; error: Error | null }> {
  try {
    const { error } = await builder;
    if (error) {
      console.error("Supabase error:", error);
      return { data: null, error: new Error(error.message) };
    }
    return { data: null, error: null };
  } catch (err) {
    console.error("Unexpected error:", err);
    return { data: null, error: err as Error };
  }
}

// Users table operations
export const users = {
  // Get user by email or school_id
  getByEmailOrSchoolId: async (identifier: string) => {
    const builder = supabaseAdmin
      .from('users')
      .select('*')
      .or(`email.eq.${identifier},school_id.eq.${identifier}`)
      .limit(1)
      .single();
    return handleSupabaseSingleResponse<UserData>(builder);
  },

  // Get user by ID
  getById: async (id: number) => {
    const builder = supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', id)
      .single();
    return handleSupabaseSingleResponse<UserData>(builder);
  },

  // Create user
  create: async (userData: Partial<UserData>) => {
    const builder = supabaseAdmin
      .from('users')
      .insert(userData)
      .select()
      .single();
    return handleSupabaseSingleResponse<UserData>(builder);
  },

  // Update user
  update: async (id: number, userData: Partial<UserData>) => {
    const builder = supabaseAdmin
      .from('users')
      .update(userData)
      .eq('id', id)
      .select()
      .single();
    return handleSupabaseSingleResponse<UserData>(builder);
  },

  // Check if user exists by email
  existsByEmail: async (email: string) => {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .limit(1);
      
    if (error) {
      console.error("Error checking user existence:", error);
      return false;
    }
    
    return data.length > 0;
  }
};

// User OTPs table operations
export const userOtps = {
  // Upsert OTP for user
  upsert: async (userId: number, otp: string, expiresAt: string) => {
    // First try to update existing OTP for user
    const { data: updateData, error: updateError } = await supabaseAdmin
      .from('user_otps')
      .update({ 
        otp: otp, 
        expires_at: expiresAt 
      })
      .eq('user_id', userId)
      .select()
      .single();

    // If update succeeded, return the result
    if (!updateError && updateData) {
      return { data: updateData, error: null };
    }

    // If update failed because no record exists, insert a new one
    const builder = supabaseAdmin
      .from('user_otps')
      .insert({ 
        user_id: userId, 
        otp: otp, 
        expires_at: expiresAt 
      })
      .select()
      .single();
    return handleSupabaseSingleResponse<UserOTPData>(builder);
  },

  // Get OTP for user
  getByUserId: async (userId: number) => {
    const builder = supabaseAdmin
      .from('user_otps')
      .select('*')
      .eq('user_id', userId)
      .single();
    return handleSupabaseSingleResponse<UserOTPData>(builder);
  },

  // Delete OTP for user
  deleteByUserId: async (userId: number) => {
    const builder = supabaseAdmin
      .from('user_otps')
      .delete()
      .eq('user_id', userId);
    return handleSupabaseDeleteResponse(builder);
  }
};

// User faces table operations
export const userFaces = {
  // Get face embedding for user
  getByUserId: async (userId: number) => {
    const { data, error } = await supabaseAdmin
      .from('user_faces')
      .select('*')
      .eq('user_id', userId)
      .single();
      
    // If no data found, this is not an error - just return null data
    if (error && error.code === 'PGRST116') {
      return { data: null, error: null };
    }
    
    // For other errors, handle normally
    if (error) {
      console.error("Supabase error:", error);
      return { data: null, error: new Error(error.message) };
    }
    
    return { data: data || null, error: null };
  },

  // Create or update face embedding for user
  upsert: async (userId: number, faceEmbedding: string) => {
    // First try to update existing face embedding for user
    const { data: updateData, error: updateError } = await supabaseAdmin
      .from('user_faces')
      .update({ 
        face_embedding: faceEmbedding 
      })
      .eq('user_id', userId)
      .select()
      .single();

    // If update succeeded, return the result
    if (!updateError && updateData) {
      return { data: updateData, error: null };
    }

    // If update failed because no record exists, insert a new one
    const builder = supabaseAdmin
      .from('user_faces')
      .insert({ 
        user_id: userId, 
        face_embedding: faceEmbedding 
      })
      .select()
      .single();
    return handleSupabaseSingleResponse<UserFaceData>(builder);
  }
};

// Votes table operations
export const votes = {
  // Check if user has voted in election
  hasVoted: async (userId: number, electionId: number) => {
    const { data, error } = await supabaseAdmin
      .from('votes')
      .select('id')
      .eq('user_id', userId)
      .eq('election_id', electionId)
      .limit(1);
      
    if (error) {
      console.error("Error checking vote status:", error);
      return false;
    }
    
    return data.length > 0;
  },

  // Create vote
  create: async (voteData: Partial<VoteData>) => {
    const builder = supabaseAdmin
      .from('votes')
      .insert(voteData)
      .select()
      .single();
    return handleSupabaseSingleResponse<VoteData>(builder);
  }
};

// Settings table operations
export const settings = {
  // Get settings by keys
  getByKeys: async (keys: string[]) => {
    const builder = supabaseAdmin
      .from('settings')
      .select('*')
      .in('k', keys);
    return handleSupabaseResponse<SettingData>(builder);
  },

  // Get setting by key
  getByKey: async (key: string) => {
    const builder = supabaseAdmin
      .from('settings')
      .select('*')
      .eq('k', key)
      .single();
    return handleSupabaseSingleResponse<SettingData>(builder);
  }
};

// Password resets table operations
export const passwordResets = {
  // Create password reset
  create: async (resetData: Partial<PasswordResetData>) => {
    const builder = supabaseAdmin
      .from('password_resets')
      .insert(resetData)
      .select()
      .single();
    return handleSupabaseSingleResponse<PasswordResetData>(builder);
  },

  // Get password reset by token hash
  getByTokenHash: async (tokenHash: string) => {
    const builder = supabaseAdmin
      .from('password_resets')
      .select(`
        *,
        user:user_id (*)
      `)
      .eq('token_hash', tokenHash)
      .gt('expires_at', new Date().toISOString())
      .single();
    return handleSupabaseSingleResponse<PasswordResetData & { user: UserData }>(builder);
  },

  // Delete password reset
  deleteById: async (id: number) => {
    const builder = supabaseAdmin
      .from('password_resets')
      .delete()
      .eq('id', id);
    return handleSupabaseDeleteResponse(builder);
  }
};

export { supabaseAdmin };