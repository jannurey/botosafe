import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/configs/supabase";
import crypto from "crypto";

interface ElectionRow {
  id: number;
  title: string;
  status: string;
  start_time: string;
  end_time: string;
}

interface CandidateRow {
  id: number;
  position_id: number;
  position_name: string;
  candidate_name: string;
}

interface VoteRow {
  encrypted_vote: string;
}

interface TurnoutRow {
  course: string;
  year_level: string;
  total_voters: number;
  voted: number;
}

interface ResultData {
  candidate_id: number;
  position_id: number;
  position_name: string;
  candidate_name: string;
  vote_count: number;
}

interface ResultsResponse {
  election: { id: number; title: string; status: string } | null;
  results: ResultData[];
  turnout: TurnoutRow[];
}

// ✅ Ensure AES_KEY exists and is properly typed
const AES_KEY: string = process.env.AES_KEY ?? "";

if (!AES_KEY) {
  throw new Error("❌ Missing AES_KEY in environment variables.");
}

// 🧩 AES Decryption Helper
function decryptVote(encryptedHex: string): string | null {
  try {
    const data = Buffer.from(encryptedHex, "hex");
    const iv = data.subarray(0, 12);
    const tag = data.subarray(12, 28);
    const text = data.subarray(28);

    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      Buffer.from(AES_KEY as string, "hex"),
      iv
    );
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(text), decipher.final()]);

    return decrypted.toString("utf8");
  } catch (err) {
    console.error("⚠️ Decryption failed:", err);
    return null;
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResultsResponse | { error: string }>
): Promise<void> {
  if (req.method !== "GET") {
    res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    return;
  }

  try {
    // 🔹 Get elections
    const { data: elections, error: electionError } = await supabaseAdmin
      .from('elections')
      .select('*')
      .order('start_time', { ascending: false });

    if (electionError) {
      console.error("Supabase election query error:", electionError);
      res.status(500).json({ error: "Database error" });
      return;
    }

    if (!elections || elections.length === 0) {
      res.status(200).json({ election: null, results: [], turnout: [] });
      return;
    }

    const now = new Date();

    // 🔹 Update election statuses dynamically
    for (const e of elections) {
      const start = new Date(e.start_time);
      const end = new Date(e.end_time);
      const status =
        now < start ? "upcoming" : now <= end ? "ongoing" : "closed";
      if (status !== e.status) {
        const { error: updateError } = await supabaseAdmin
          .from('elections')
          .update({ status: status })
          .eq('id', e.id);

        if (updateError) {
          console.error("Supabase update error:", updateError);
        } else {
          e.status = status;
        }
      }
    }

    // 🔹 Get latest relevant election
    const election =
      elections.find((e) => e.status === "ongoing") ||
      elections.find((e) => e.status === "closed");

    // If no election exists, return default values
    if (!election || !election.id) {
      res.status(200).json({ election: null, results: [], turnout: [] });
      return;
    }

    // 🔹 Fetch all candidates
    const { data: candidates, error: candidateError } = await supabaseAdmin
      .from('candidates')
      .select(`
        id,
        position_id,
        position:positions (
          name
        ),
        user:users (
          fullname
        )
      `)
      .eq('election_id', election.id);

    if (candidateError) {
      console.error("Supabase candidate query error:", candidateError);
      res.status(500).json({ error: "Database error" });
      return;
    }

    // 🔹 Fetch all encrypted votes
    const { data: votes, error: voteError } = await supabaseAdmin
      .from('votes')
      .select('encrypted_vote')
      .eq('election_id', election.id);

    if (voteError) {
      console.error("Supabase vote query error:", voteError);
      res.status(500).json({ error: "Database error" });
      return;
    }

    // 🔹 Decrypt & Count Votes
    const voteCounts: Record<number, number> = {};

    for (const vote of votes) {
      const decrypted = decryptVote(vote.encrypted_vote);
      if (!decrypted) continue;

      try {
        // Vote data is stored as Record<string, number> (position_id -> candidate_id)
        const parsed = JSON.parse(decrypted) as Record<string, number>;
        
        // Each entry in the object is a vote for a candidate
        Object.values(parsed).forEach((candidateId) => {
          const cid = Number(candidateId);
          if (!isNaN(cid)) {
            voteCounts[cid] = (voteCounts[cid] || 0) + 1;
          }
        });
      } catch (e) {
        console.error("⚠️ Invalid decrypted vote JSON:", e, "Decrypted:", decrypted);
      }
    }

    // 🔹 Merge with candidates
    const results: ResultData[] = candidates.map((c) => {
      // Handle both object and array responses from Supabase
      const positionData = Array.isArray(c.position) ? c.position[0] : c.position;
      const userData = Array.isArray(c.user) ? c.user[0] : c.user;
      
      return {
        candidate_id: c.id,
        position_id: c.position_id,
        position_name: positionData?.name || '',
        candidate_name: userData?.fullname || '',
        vote_count: voteCounts[c.id] || 0,
      };
    });

    // 🔹 Fetch turnout
    const { data: turnout, error: turnoutError } = await supabaseAdmin
      .from('users')
      .select(`
        course,
        year_level,
        votes (
          user_id
        )
      `)
      .eq('role', 'voter');

    if (turnoutError) {
      console.error("Supabase turnout query error:", turnoutError);
      res.status(500).json({ error: "Database error" });
      return;
    }

    // Process turnout data
    const turnoutMap: Record<string, TurnoutRow> = {};
    
    turnout.forEach(user => {
      // Skip users with null course or year_level
      if (!user.course || !user.year_level) {
        return;
      }
      
      const key = `${user.course}-${user.year_level}`;
      if (!turnoutMap[key]) {
        turnoutMap[key] = {
          course: user.course || '',
          year_level: user.year_level || '',
          total_voters: 0,
          voted: 0
        };
      }
      
      turnoutMap[key].total_voters++;
      
      // Check if user has voted in this election
      if (user.votes && Array.isArray(user.votes)) {
        if (user.votes.length > 0) {
          turnoutMap[key].voted++;
        }
      }
    });

    const turnoutArray = Object.values(turnoutMap);

    res.status(200).json({
      election: {
        id: election.id,
        title: election.title,
        status: election.status,
      },
      results,
      turnout: turnoutArray,
    });
  } catch (err) {
    console.error("❌ Error fetching results:", err);
    const message = err instanceof Error ? err.message : "Server error";
    res.status(500).json({ error: message });
  }
}