// pages/api/candidates/index.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/configs/supabase";
import formidable from "formidable";
import { parse } from "cookie";
import jwt from "jsonwebtoken";

interface Achievement {
  id?: number;
  title: string;
  type: string;
  created_at?: string;
}

interface Candidate {
  id: number;
  user_id: number;
  fullname: string;
  election_id: number;
  election_title: string;
  position_id: number;
  position_name: string;
  achievements: string; // JSON string before parsing
  photo_url?: string;
  partylist?: string;
  coc_file_url?: string;
  status: string;
  created_at: string;
}

interface CandidateResponse {
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

interface JwtPayload {
  id: number;
  role: string;
  [key: string]: string | number | boolean | object | null | undefined;
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
  users?: { fullname: string } | { fullname: string }[] | null;
  elections?: { title: string } | { title: string }[] | null;
  positions?: { name: string } | { name: string }[] | null;
  candidate_achievements?: Array<{
    id: number;
    title: string;
    type: string;
    created_at: string;
  }>;
}

// Utility function to verify admin role
async function verifyAdminRole(token: string): Promise<{isValid: boolean, role?: string}> {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    return { isValid: decoded.role === 'admin', role: decoded.role };
  } catch (error) {
    return { isValid: false };
  }
}

// Helper function to parse JSON body
function parseJsonBody(req: NextApiRequest): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch (parseError) {
        reject(parseError);
      }
    });
  });
}

// Disable Next.js body parser for POST requests - formidable handles it
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  // Candidates API called
  
  try {
    // Check for auth token in cookies for protected operations
    const cookies = parse(req.headers.cookie || "");
    const token = cookies.authToken || cookies.tempAuthToken;
    
    // Token check
    
    // 🟨 UPDATE STATUS - Only admins should be able to update status
    if (req.method === "PATCH") {
      // Handling PATCH request for candidate status update
      
      if (!token) {
        // No token provided for PATCH request
        res.status(401).json({ error: "Unauthorized: No token provided" });
        return;
      }
      
      const { isValid, role } = await verifyAdminRole(token);
      // Admin role verification
      
      if (!isValid) {
        res.status(403).json({ error: "Forbidden: Admin access required" });
        return;
      }
      
      // Parse JSON body for PATCH requests
      let jsonData;
      try {
        jsonData = await parseJsonBody(req);
        // Parsed JSON data
      } catch (parseError) {
        console.error("Error parsing JSON body", parseError);
        res.status(400).json({ error: "Invalid JSON in request body" });
        return;
      }
      
      const { id, status } = jsonData as { id: number; status: string };

      if (!id || !status) {
        // Missing required fields
        res.status(400).json({ error: "Missing required fields" });
        return;
      }

      // Validate status value
      const validStatuses = ['pending', 'approved', 'declined'];
      if (!validStatuses.includes(status)) {
        // Invalid status value
        res.status(400).json({ error: "Invalid status value" });
        return;
      }

      // Updating candidate status
      
      const { error: updateError } = await supabaseAdmin
        .from('candidates')
        .update({ status: status })
        .eq('id', id);

      if (updateError) {
        console.error("Supabase update error:", updateError);
        res.status(500).json({ error: "Database error" });
        return;
      }

      const { data: updatedRows, error: selectError } = await supabaseAdmin
        .from('candidates')
        .select('*')
        .eq('id', id);

      if (selectError) {
        console.error("Supabase select error:", selectError);
        res.status(500).json({ error: "Database error" });
        return;
      }

      if (!updatedRows || updatedRows.length === 0) {
        // Candidate not found
        res.status(404).json({ error: "Candidate not found" });
        return;
      }

      // Candidate status updated successfully
      res.status(200).json(updatedRows[0]);
      return;
    }

    // 🟥 DELETE CANDIDATE - Only admins should be able to delete candidates
    if (req.method === "DELETE") {
      if (!token) {
        res.status(401).json({ error: "Unauthorized: No token provided" });
        return;
      }
      
      const { isValid } = await verifyAdminRole(token);
      if (!isValid) {
        res.status(403).json({ error: "Forbidden: Admin access required" });
        return;
      }
      
      const { id } = req.query as { id: string };

      if (!id) {
        res.status(400).json({ error: "Missing candidate ID" });
        return;
      }

      // Delete candidate achievements first
      const { error: deleteAchievementsError } = await supabaseAdmin
        .from('candidate_achievements')
        .delete()
        .eq('candidate_id', id);

      if (deleteAchievementsError) {
        console.error("Supabase delete achievements error:", deleteAchievementsError);
        res.status(500).json({ error: "Database error" });
        return;
      }

      // Delete candidate
      const { error: deleteCandidateError } = await supabaseAdmin
        .from('candidates')
        .delete()
        .eq('id', id);

      if (deleteCandidateError) {
        console.error("Supabase delete candidate error:", deleteCandidateError);
        res.status(500).json({ error: "Database error" });
        return;
      }
      
      res.status(200).json({ message: "Candidate deleted successfully" });
      return;
    }

    // 🟩 GET ALL CANDIDATES
    if (req.method === "GET") {
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
          users!candidates_user_id_fkey (
            fullname
          ),
          elections!candidates_election_id_fkey (
            title
          ),
          positions!candidates_position_id_fkey (
            name
          ),
          candidate_achievements (
            id,
            title,
            type,
            created_at
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error("Supabase query error:", error);
        res.status(500).json({ error: "Database error" });
        return;
      }
      
      // Raw Supabase rows

      const candidates: CandidateResponse[] = rows.map((row: SupabaseCandidateRow) => {
        // Raw Supabase row
        
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
        const userData = Array.isArray(row.users) ? row.users[0] : row.users;
        const electionData = Array.isArray(row.elections) ? row.elections[0] : row.elections;
        const positionData = Array.isArray(row.positions) ? row.positions[0] : row.positions;
        
        const result = {
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
        
        // Transformed candidate
        return result;
      });

      res.status(200).json(candidates);
      return;
    }

    // 🟦 CREATE CANDIDATE
    if (req.method === "POST") {
      // Parse form data
      const form = formidable({ multiples: false });
      
      form.parse(req, async (formError, fields, _files) => {
        if (formError) {
          res.status(400).json({ error: "Failed to parse form data" });
          return;
        }

        // Extract fields from form data with proper type checking
        const electionIdField = Array.isArray(fields.election_id) ? fields.election_id[0] : fields.election_id;
        const election_id = electionIdField ? parseInt(electionIdField as string) : NaN;
        
        const positionIdField = Array.isArray(fields.position_id) ? fields.position_id[0] : fields.position_id;
        const position_id = positionIdField ? parseInt(positionIdField as string) : NaN;
        
        const partylist = Array.isArray(fields.partylist) ? fields.partylist[0] : fields.partylist || null;
        const photo_url = Array.isArray(fields.photo_url) ? fields.photo_url[0] : fields.photo_url || null;
        const coc_file_url = Array.isArray(fields.coc_file_url) ? fields.coc_file_url[0] : fields.coc_file_url || null;
        
        let achievements: Achievement[] = [];
        try {
          const achievementsStr = Array.isArray(fields.achievements) ? fields.achievements[0] : fields.achievements;
          if (achievementsStr) {
            achievements = JSON.parse(achievementsStr as string);
          }
        } catch {
          achievements = [];
        }

        // Get user_id from session
        const cookies = parse(req.headers.cookie || "");
        const token = cookies.authToken;

        if (!token) {
          res.status(401).json({ error: "Unauthorized" });
          return;
        }

        let user_id: number;
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
          user_id = decoded.id;
        } catch (jwtError) {
          res.status(401).json({ error: "Invalid token" });
          return;
        }

        if (!user_id || isNaN(election_id) || isNaN(position_id)) {
          res.status(400).json({ error: "Missing required fields" });
          return;
        }

        // Check if user already filed
        const { data: existing, error: checkError } = await supabaseAdmin
          .from('candidates')
          .select('id')
          .eq('user_id', user_id)
          .eq('election_id', election_id);

        if (checkError) {
          console.error("Supabase query error:", checkError);
          res.status(500).json({ error: "Database error" });
          return;
        }

        if (existing && existing.length > 0) {
          res.status(400).json({ error: "You already filed for this election." });
          return;
        }

        // Insert candidate
        const { data: insertResult, error: insertError } = await supabaseAdmin
          .from('candidates')
          .insert({
            user_id: user_id,
            election_id: election_id,
            position_id: position_id,
            photo_url: photo_url,
            partylist: partylist,
            coc_file_url: coc_file_url,
            status: 'pending',
            created_at: new Date().toISOString()
          })
          .select()
          .single();

        if (insertError) {
          console.error("Supabase insert error:", insertError);
          res.status(500).json({ error: "Database error" });
          return;
        }

        const candidateId = insertResult.id;

        // Insert achievements only if there are any
        if (achievements.length > 0) {
          const achievementData = achievements.map((a) => ({
            candidate_id: candidateId,
            title: a.title,
            type: a.type,
            created_at: new Date().toISOString()
          }));

          const { error: achievementsError } = await supabaseAdmin
            .from('candidate_achievements')
            .insert(achievementData);

          if (achievementsError) {
            console.error("Supabase insert achievements error:", achievementsError);
            res.status(500).json({ error: "Database error" });
            return;
          }
        }

        const { data: newCandidateRows, error: selectError } = await supabaseAdmin
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
            user:users (
              fullname
            ),
            election:elections (
              title
            ),
            position:positions (
              name
            )
          `)
          .eq('id', candidateId);

        if (selectError) {
          console.error("Supabase select error:", selectError);
          res.status(500).json({ error: "Database error" });
          return;
        }

        if (!newCandidateRows || newCandidateRows.length === 0) {
          res.status(500).json({ error: "Failed to retrieve created candidate" });
          return;
        }

        const candidate = newCandidateRows[0];
        const formattedCandidate = {
          id: candidate.id,
          user_id: candidate.user_id,
          fullname: Array.isArray(candidate.user) && candidate.user.length > 0 ? candidate.user[0].fullname : '',
          election_id: candidate.election_id,
          election_title: Array.isArray(candidate.election) && candidate.election.length > 0 ? candidate.election[0].title : '',
          position_id: candidate.position_id,
          position_name: Array.isArray(candidate.position) && candidate.position.length > 0 ? candidate.position[0].name : '',
          achievements: [],
          photo_url: candidate.photo_url || undefined,
          partylist: candidate.partylist || undefined,
          coc_file_url: candidate.coc_file_url || undefined,
          status: candidate.status,
          created_at: candidate.created_at
        };

        res.status(201).json(formattedCandidate);
      });
      return;
    }

    // Method not allowed
    res.setHeader("Allow", ["GET", "POST", "PATCH", "DELETE"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
    return;
  } catch (error) {
    console.error("API candidates error", error);
    res.status(500).json({ error: "Server error" });
  }
}