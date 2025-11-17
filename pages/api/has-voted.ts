// pages/api/has-voted.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { votes } from "@/lib/supabaseClient";

interface HasVotedResponse {
  hasVoted: boolean;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<HasVotedResponse | { error: string }>
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { userId, electionId } = req.query;

  if (
    !userId ||
    !electionId ||
    Array.isArray(userId) ||
    Array.isArray(electionId)
  ) {
    return res
      .status(400)
      .json({ error: "Invalid or missing userId or electionId" });
  }

  try {
    const hasVoted = await votes.hasVoted(Number(userId), Number(electionId));

    return res.status(200).json({ hasVoted });
  } catch (error) {
    console.error("Error checking vote status:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}