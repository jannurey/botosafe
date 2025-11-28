// pages/api/generate-vote-token.ts
import type { NextApiRequest, NextApiResponse } from "next";
import jwt from "jsonwebtoken";

/**
 * SECURITY: This endpoint requires authentication and verifies that
 * the authenticated user matches the requested userId to prevent
 * unauthorized vote token generation.
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    // ✅ SECURITY: Require authentication via JWT token in cookies
    const token = req.cookies.authToken || req.cookies.token;
    if (!token) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // ✅ SECURITY: Verify the JWT token
    let decoded: { id: number; email?: string; role?: string };
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: number; email?: string; role?: string };
    } catch (err) {
      return res.status(401).json({ error: "Invalid or expired authentication token" });
    }

    const authenticatedUserId = decoded.id;

    // ✅ SECURITY: Get userId and electionId from request
    const { userId, electionId } = req.body;
    if (!userId || !electionId) {
      return res.status(400).json({ error: "Missing user or election ID" });
    }

    // ✅ SECURITY: Verify that authenticated user matches requested userId
    // This prevents users from generating vote tokens for other users
    if (authenticatedUserId !== Number(userId)) {
      console.warn(`⚠️ Security: User ${authenticatedUserId} attempted to generate vote token for user ${userId}`);
      return res.status(403).json({ error: "Unauthorized: Cannot generate vote token for another user" });
    }

    // ✅ SECURITY: Generate vote token only for authenticated user
    const voteToken = jwt.sign(
      { id: authenticatedUserId, electionId },
      process.env.JWT_SECRET!,
      { expiresIn: "5m" } // ⏳ short-lived token
    );

    return res.status(200).json({ voteToken });
  } catch (err) {
    console.error("Error generating vote token:", err);
    return res.status(500).json({ error: "Failed to generate vote token" });
  }
}
