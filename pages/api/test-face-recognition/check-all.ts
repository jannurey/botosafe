import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/configs/supabase";

// ------------------- UTILITY -------------------
function normalizeEmbedding(embedding: number[]): number[] {
  const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return embedding.map((val) => val / (norm || 1));
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  
  let dot = 0,
    normA = 0,
    normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  if (normA === 0 || normB === 0) return 0;
  
  const similarity = dot / (Math.sqrt(normA) * Math.sqrt(normB));
  return Math.max(-1, Math.min(1, similarity));
}

function toNumberArray(input: unknown): number[] {
  if (Array.isArray(input)) return input.map(Number);
  if (input instanceof Float32Array) return Array.from(input);
  throw new Error("Invalid embedding format");
}

const THRESHOLD = 0.85; // 85% similarity threshold for recognition

// ------------------- HANDLER -------------------
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { embedding } = req.body as {
      embedding: number[] | Float32Array;
    };

    if (!embedding) {
      return res.status(400).json({ message: "Missing embedding" });
    }

    const embeddingArray = toNumberArray(embedding);
    const normalized = normalizeEmbedding(embeddingArray);

    console.log("🧪 TEST: Checking face against all users in database...");
    console.log(`   Embedding dimensions: ${normalized.length}`);

    // Fetch ALL user faces from database
    const { data: allFaces, error: faceError } = await supabaseAdmin
      .from('user_faces')
      .select('user_id, face_embedding');

    if (faceError) {
      console.error("Database query error:", faceError);
      return res.status(500).json({ message: "Database error" });
    }

    if (!allFaces || allFaces.length === 0) {
      console.log("🧪 TEST: No faces found in database");
      return res.status(200).json({ 
        match: false, 
        message: "No faces registered in database",
        totalFacesChecked: 0,
        bestSimilarity: 0,
        threshold: THRESHOLD
      });
    }

    console.log(`🧪 TEST: Found ${allFaces.length} registered faces in database`);

    let bestMatch = {
      userId: 0,
      similarity: 0
    };

    // Check against all faces
    for (const faceData of allFaces) {
      try {
        const parsed = JSON.parse(faceData.face_embedding);
        const storedEmbeddings: number[][] = [];
        
        // Handle both single embedding and array of embeddings
        if (Array.isArray(parsed) && parsed.length > 0) {
          if (Array.isArray(parsed[0])) {
            // Array of embeddings
            storedEmbeddings.push(...parsed.map((e: number[]) => normalizeEmbedding(toNumberArray(e))));
          } else {
            // Single embedding
            storedEmbeddings.push(normalizeEmbedding(toNumberArray(parsed)));
          }
        }

        if (storedEmbeddings.length === 0) {
          console.log(`   ⏭️ Skipping user ${faceData.user_id} - no valid embeddings`);
          continue;
        }

        // Compare against all stored embeddings for this user
        let maxSimilarity = 0;
        for (const storedEmb of storedEmbeddings) {
          const sim = cosineSimilarity(normalized, storedEmb);
          if (sim > maxSimilarity) {
            maxSimilarity = sim;
          }
        }

        console.log(`   User ${faceData.user_id}: Best similarity = ${(maxSimilarity * 100).toFixed(2)}% (${storedEmbeddings.length} embeddings checked)`);

        // Track best match overall
        if (maxSimilarity > bestMatch.similarity) {
          bestMatch = {
            userId: faceData.user_id,
            similarity: maxSimilarity
          };
        }
      } catch (parseError) {
        console.error(`   Error parsing embedding for user ${faceData.user_id}:`, parseError);
        continue;
      }
    }

    console.log(`\n🧪 TEST RESULTS:`);
    console.log(`   Best match: User ${bestMatch.userId}`);
    console.log(`   Similarity: ${(bestMatch.similarity * 100).toFixed(2)}%`);
    console.log(`   Threshold: ${(THRESHOLD * 100).toFixed(2)}%`);
    console.log(`   Recognition: ${bestMatch.similarity >= THRESHOLD ? '✅ RECOGNIZED' : '❌ NOT RECOGNIZED'}\n`);

    // Check if best match meets threshold
    if (bestMatch.similarity >= THRESHOLD) {
      return res.status(200).json({
        match: true,
        userId: bestMatch.userId,
        bestSimilarity: bestMatch.similarity,
        threshold: THRESHOLD,
        totalFacesChecked: allFaces.length,
        message: `Face recognized as User ID ${bestMatch.userId}`
      });
    } else {
      return res.status(200).json({
        match: false,
        bestSimilarity: bestMatch.similarity,
        threshold: THRESHOLD,
        totalFacesChecked: allFaces.length,
        message: "Face not recognized - similarity below threshold"
      });
    }
  } catch (err) {
    console.error("❌ Test face recognition error:", err);
    return res.status(500).json({ 
      message: err instanceof Error ? err.message : "Server error" 
    });
  }
}
