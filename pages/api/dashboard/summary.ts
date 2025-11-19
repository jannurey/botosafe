import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/configs/supabase";

interface Election {
  id: number;
  title: string;
  status: string;
  start_time: string;
  end_time: string;
  timeRemaining?: string | null;
}

interface CourseVotersRow {
  course: string;
  year_level: number;
  voters: number;
}

interface CourseTurnoutRow {
  course: string;
  year_level: number;
  turnout: number;
}

interface CourseTurnout {
  course: string;
  year_level: number;
  label: string;
  voters: number;
  turnout: number;
}

interface SummaryResponse {
  voters: number;
  candidates: number;
  voted: number;
  election: Election | null;
  courses: CourseTurnout[];
}

const ALLOWED_COURSES = [
  "BSCS",
  "ACT",
  "BSED English",
  "BSED Science",
  "BEED",
  "BSCrim",
  "BSSW",
];

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SummaryResponse | { error: string }>
): Promise<void> {
  try {
    // 🗳 Get latest election
    const { data: electionRows, error: electionError } = await supabaseAdmin
      .from('elections')
      .select('id, title, status, start_time, end_time')
      .in('status', ['upcoming', 'filing', 'ongoing', 'closed'])
      .order('start_time', { ascending: false })
      .limit(1);

    if (electionError) {
      console.error("Supabase election query error:", electionError);
      return res.status(500).json({ error: "Database error" });
    }

    const election = electionRows && electionRows.length > 0 ? electionRows[0] : null;

    // If no election exists, return default values
    if (!election || !election.id) {
      return res.status(200).json({
        voters: 0,
        candidates: 0,
        voted: 0,
        election: null,
        courses: [],
      });
    }

    // 👥 Total active and approved voters
    const { data: votersRows, error: votersError } = await supabaseAdmin
      .from('users')
      .select('id') // Changed from 'count' to 'id' to get actual records
      .eq('role', 'voter')
      .eq('approval_status', 'approved')
      .eq('user_status', 'active');

    if (votersError) {
      console.error("Supabase voters query error:", votersError);
      return res.status(500).json({ error: "Database error" });
    }

    // Count the actual number of voters
    const voters = votersRows ? votersRows.length : 0;

    // 👤 Total candidates in current election
    const { data: candidatesRows, error: candidatesError } = await supabaseAdmin
      .from('candidates')
      .select('id') // Changed from 'count' to 'id' to get actual records
      .eq('election_id', election.id);

    if (candidatesError) {
      console.error("Supabase candidates query error:", candidatesError);
      return res.status(500).json({ error: "Database error" });
    }

    // Count the actual number of candidates
    const candidates = candidatesRows ? candidatesRows.length : 0;

    // ✅ Total unique users who voted in this election
    const { data: votedRows, error: votedError } = await supabaseAdmin
      .from('votes')
      .select('user_id')
      .eq('election_id', election.id)
      .not('user_id', 'is', null);

    if (votedError) {
      console.error("Supabase voted query error:", votedError);
      return res.status(500).json({ error: "Database error" });
    }

    // Get unique user IDs who voted
    const uniqueVoters = new Set(votedRows?.map(row => row.user_id) || []);
    const voted = uniqueVoters.size;

    // 🎓 Registered voters per course/year
    const { data: votersByCourseRows, error: votersByCourseError } = await supabaseAdmin
      .from('users')
      .select('course, year_level')
      .eq('role', 'voter')
      .eq('approval_status', 'approved')
      .eq('user_status', 'active')
      .in('course', ALLOWED_COURSES);

    if (votersByCourseError) {
      console.error("Supabase voters by course query error:", votersByCourseError);
      return res.status(500).json({ error: "Database error" });
    }

    // Group voters by course and year_level
    const votersByCourseMap: Record<string, { course: string; year_level: number; voters: number }> = {};
    votersByCourseRows?.forEach(row => {
      const key = `${row.course}_${row.year_level}`;
      if (!votersByCourseMap[key]) {
        votersByCourseMap[key] = {
          course: row.course,
          year_level: row.year_level,
          voters: 0
        };
      }
      votersByCourseMap[key].voters++;
    });

    const votersByCourseFormatted = Object.values(votersByCourseMap);

    // 🎓 Actual turnout (voted users) per course/year - Fixed to count unique users
    const { data: votedUsersRows, error: votedUsersError } = await supabaseAdmin
      .from('votes')
      .select('user_id')
      .eq('election_id', election.id)
      .not('user_id', 'is', null);

    if (votedUsersError) {
      console.error("Supabase voted users query error:", votedUsersError);
      return res.status(500).json({ error: "Database error" });
    }

    // Get unique voted user IDs
    const votedUserIds = new Set(votedUsersRows?.map(row => row.user_id) || []);

    // Now get course/year info for voted users
    const { data: votedUsersInfo, error: votedUsersInfoError } = await supabaseAdmin
      .from('users')
      .select('course, year_level')
      .in('id', Array.from(votedUserIds))
      .in('course', ALLOWED_COURSES);

    if (votedUsersInfoError) {
      console.error("Supabase voted users info query error:", votedUsersInfoError);
      return res.status(500).json({ error: "Database error" });
    }

    // Group turnout by course and year_level
    const turnoutByCourseMap: Record<string, { course: string; year_level: number; turnout: number }> = {};
    votedUsersInfo?.forEach(row => {
      if (!row.course || !row.year_level) return;
      const key = `${row.course}_${row.year_level}`;
      if (!turnoutByCourseMap[key]) {
        turnoutByCourseMap[key] = {
          course: row.course,
          year_level: row.year_level,
          turnout: 0
        };
      }
      turnoutByCourseMap[key].turnout++;
    });

    const turnoutByCourseFormatted = Object.values(turnoutByCourseMap);

    // 🧩 Create a turnout map
    const turnoutMap = turnoutByCourseFormatted.reduce<Record<string, number>>(
      (acc, row) => {
        acc[`${row.course}_${row.year_level}`] = row.turnout;
        return acc;
      },
      {}
    );

    // 🧩 Combine voter + turnout data
    const courses: CourseTurnout[] = votersByCourseFormatted.map((row) => ({
      course: row.course,
      year_level: row.year_level,
      label: `${row.course} - Year ${row.year_level}`,
      voters: row.voters,
      turnout: turnoutMap[`${row.course}_${row.year_level}`] ?? 0,
    }));

    // ⏳ Compute remaining time
    let timeRemaining: string | null = null;
    const now = Date.now();
    const startMs = new Date(election.start_time).getTime();
    const endMs = new Date(election.end_time).getTime();

    if (now < startMs) {
      const diff = startMs - now;
      const hrs = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      timeRemaining = `Starts in ${hrs}h ${mins}m`;
    } else if (now < endMs) {
      const diff = endMs - now;
      const hrs = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      timeRemaining = `${hrs}h ${mins}m remaining`;
    } else {
      timeRemaining = "Ended";
    }

    // ✅ Final response
    return res.status(200).json({
      voters,
      candidates,
      voted,
      election: { ...election, timeRemaining },
      courses,
    });
  } catch (err: unknown) {
    console.error("❌ Error loading admin summary:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: message });
  }
}