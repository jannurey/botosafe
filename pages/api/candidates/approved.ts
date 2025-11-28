// pages/api/candidates/approved.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/configs/supabase";

interface Achievement {
  id: number;
  title: string;
  type: string;
  created_at: string;
}

interface Candidate {
  id: number;
  user_id: number;
  fullname: string;
  election_id: number;
  election_title: string;
  position_id: number;
  position_name: string;
  achievements: string; // Raw string (JSON-like) from database
  photo_url?: string;
  partylist?: string;
  coc_file_url?: string;
  status: string;
  created_at: string;
}

interface ApprovedCandidate {
  id: number;
  user_id: number;
  fullname: string;
  election_id: number;
  election_title: string;
  position_id: number;
  position_name: string;
  achievements: Achievement[];
  photo_url?: string;
  partylist?: string;
  coc_file_url?: string;
  status: string;
  created_at: string;
}

interface ApprovedResponse {
  candidates: ApprovedCandidate[];
  groupedByPosition: Record<string, ApprovedCandidate[]>;
}

interface SupabaseCandidateRow {
  id: number;
  user_id: number;
  election_id: number;
  position_id: number;
  photo_url?: string;
  partylist?: string;
  coc_file_url?: string;
  status: string;
  created_at: string;
  user?: { fullname: string; approval_status: string; user_status: string } | Array<{ fullname: string; approval_status: string; user_status: string }> | null;
  election?: { title: string } | Array<{ title: string }> | null;
  position?: { name: string } | Array<{ name: string }> | null;
  candidate_achievements?: Array<{
    id: number;
    title: string;
    type: string;
    created_at: string;
  }>;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApprovedResponse | { error: string }>
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    // Fetch approved candidates with their achievements using Supabase
    const { data: rows, error } = await supabaseAdmin
      .from('candidates')
      .select(`
        id,
        user_id,
        election_id,
        position_id,
        photo_url,
        partylist,
        coc_file_url,
        status,
        created_at,
        user:users!inner (
          fullname,
          approval_status,
          user_status
        ),
        election:elections!inner (
          title
        ),
        position:positions!inner (
          name
        ),
        candidate_achievements (
          id,
          title,
          type,
          created_at
        )
      `)
      .eq('status', 'approved')
      .eq('user.approval_status', 'approved')
      .eq('user.user_status', 'active')
      .order('position_id', { ascending: true });

    if (error) {
      console.error("❌ Supabase Error:", error);
      return res.status(500).json({ error: "Database error" });
    }

    // Transform the data to match the expected structure
    const candidates: ApprovedCandidate[] = rows.map((row, index) => {
      // Format achievements array
      let achievements: Achievement[] = [];
      if (row.candidate_achievements && Array.isArray(row.candidate_achievements)) {
        achievements = row.candidate_achievements.map((ach) => ({
          id: ach.id,
          title: ach.title || '',
          type: ach.type || '',
          created_at: ach.created_at || ''
        }));
      }

      // Handle both object and array responses from Supabase
      // For foreign key relationships, Supabase can return either a single object or an array
      let userData = null;
      if (row.user) {
        if (Array.isArray(row.user)) {
          userData = row.user.length > 0 ? row.user[0] : null;
        } else if (typeof row.user === 'object') {
          userData = row.user;
        }
      }
      
      let electionData = null;
      if (row.election) {
        if (Array.isArray(row.election)) {
          electionData = row.election.length > 0 ? row.election[0] : null;
        } else if (typeof row.election === 'object') {
          electionData = row.election;
        }
      }
      
      let positionData = null;
      if (row.position) {
        if (Array.isArray(row.position)) {
          positionData = row.position.length > 0 ? row.position[0] : null;
        } else if (typeof row.position === 'object') {
          positionData = row.position;
        }
      }

      // Debug logging for first candidate
      if (index === 0) {
        console.log("🔍 Approved candidates - Processing first candidate:");
        console.log("  - row.user type:", typeof row.user, "value:", JSON.stringify(row.user));
        console.log("  - row.election type:", typeof row.election, "value:", JSON.stringify(row.election));
        console.log("  - row.position type:", typeof row.position, "value:", JSON.stringify(row.position));
        console.log("  - userData:", userData);
        console.log("  - electionData:", electionData);
        console.log("  - positionData:", positionData);
      }

      return {
        id: row.id,
        user_id: row.user_id,
        fullname: userData?.fullname || '',
        election_id: row.election_id,
        election_title: electionData?.title || '',
        position_id: row.position_id,
        position_name: positionData?.name || '',
        achievements: achievements,
        photo_url: row.photo_url || undefined,
        partylist: row.partylist || undefined,
        coc_file_url: row.coc_file_url || undefined,
        status: row.status,
        created_at: row.created_at
      };
    });

    // Sort by position_id and then by fullname (client-side sorting)
    candidates.sort((a, b) => {
      if (a.position_id !== b.position_id) {
        return a.position_id - b.position_id;
      }
      return a.fullname.localeCompare(b.fullname);
    });

    // ✅ Group candidates by position
    const groupedByPosition: Record<string, ApprovedCandidate[]> = {};
    for (const candidate of candidates) {
      if (!groupedByPosition[candidate.position_name]) {
        groupedByPosition[candidate.position_name] = [];
      }
      groupedByPosition[candidate.position_name].push(candidate);
    }

    return res.status(200).json({ candidates, groupedByPosition });
  } catch (error) {
    console.error("❌ API Error:", error);
    return res.status(500).json({ error: "Server error" });
  }
}