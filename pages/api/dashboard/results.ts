import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/configs/supabase";

interface ResultRow {
  position_id: number;
  position_name: string;
  candidate_name: string;
  vote_count: number;
}

interface PositionRow {
  id: number;
  name: string;
  candidates?: Array<{
    user?: Array<{
      fullname: string;
    }> | null;
    votes?: Array<{
      id: number;
    }> | null;
  }> | null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResultRow[] | { error: string }>
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    // First get the latest election that is ongoing or closed
    const { data: electionData, error: electionError } = await supabaseAdmin
      .from('elections')
      .select('id')
      .in('status', ['ongoing', 'closed'])
      .order('end_time', { ascending: false })
      .limit(1);

    if (electionError) {
      console.error("Supabase election query error:", electionError);
      return res.status(500).json({ error: "Database error" });
    }

    // If no election exists, return empty array
    if (!electionData || electionData.length === 0 || !electionData[0].id) {
      return res.status(404).json({ error: "No election found" });
    }

    const electionId = electionData[0].id;

    // Get results for the latest election
    const { data: rows, error: resultsError } = await supabaseAdmin
      .from('positions')
      .select(`
        id,
        name,
        candidates (
          user:users (
            fullname
          ),
          votes (
            id
          )
        )
      `)
      .eq('election_id', electionId);

    if (resultsError) {
      console.error("Supabase results query error:", resultsError);
      return res.status(500).json({ error: "Database error" });
    }

    // Transform the data to match the expected structure
    const results: ResultRow[] = [];
    rows.forEach((position: PositionRow) => {
      if (position.candidates && Array.isArray(position.candidates)) {
        position.candidates.forEach((candidate) => {
          // Skip candidates with null user data
          if (!candidate.user || !Array.isArray(candidate.user) || candidate.user.length === 0) {
            return;
          }
          
          const voteCount = candidate.votes ? candidate.votes.length : 0;
          results.push({
            position_id: position.id,
            position_name: position.name,
            candidate_name: candidate.user[0].fullname || '',
            vote_count: voteCount
          });
        });
      }
    });

    // Sort results by position_id and vote_count (descending)
    results.sort((a, b) => {
      if (a.position_id !== b.position_id) {
        return a.position_id - b.position_id;
      }
      return b.vote_count - a.vote_count;
    });

    res.status(200).json(results);
  } catch (error) {
    console.error("❌ Error fetching results:", error);
    res.status(500).json({ error: (error as Error).message });
  }
}