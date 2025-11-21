// pages/api/register-face.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { userFaces } from "@/lib/supabaseClient";
import jwt from "jsonwebtoken";

// ------------------- UTILITY -------------------
function normalizeEmbedding(embedding: number[] | Float32Array): number[] {
  const arr = Array.from(embedding);
  const norm = Math.sqrt(arr.reduce((sum, val) => sum + val * val, 0));
  return norm === 0 ? arr : arr.map((val) => val / norm);
}

function cosineSimilarity(a: number[], b: number[]): number {
  // Ensure both vectors have the same length
  if (a.length !== b.length) {
    console.error(`Vector length mismatch: ${a.length} vs ${b.length}`);
    return 0;
  }
  
  let dot = 0,
    normA = 0,
    normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  // Handle edge cases
  if (normA === 0 || normB === 0) {
    return 0;
  }
  
  const similarity = dot / (Math.sqrt(normA) * Math.sqrt(normB));
  
  // Ensure similarity is within valid range [-1, 1]
  return Math.max(-1, Math.min(1, similarity));
}

// ------------------- HANDLER -------------------
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ message: string }>
): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ message: "Method not allowed" });
    return;
  }

  try {
    // Get user ID from temporary token instead of request body
    const tempAuthToken = req.cookies.tempAuthToken;
    if (!tempAuthToken) {
      res.status(401).json({ message: "No temporary token found" });
      return;
    }

    // Verify the temporary token
    const decoded = jwt.verify(tempAuthToken, process.env.JWT_SECRET!) as JwtPayload;
    if (!decoded || !decoded.temp) {
      res.status(401).json({ message: "Invalid temporary token" });
      return;
    }

    const userId = decoded.id;
    const { embedding, embeddings } = req.body as {
      embedding?: number[] | Float32Array;
      embeddings?: (number[] | Float32Array)[];
    };

    // Support both single embedding (legacy) and multiple embeddings (new multi-sample)
    const inputEmbeddings: (number[] | Float32Array)[] = [];
    
    if (embeddings && Array.isArray(embeddings) && embeddings.length > 0) {
      inputEmbeddings.push(...embeddings);
    } else if (embedding) {
      inputEmbeddings.push(embedding);
    }

    if (inputEmbeddings.length === 0) {
      res.status(400).json({ message: "Missing embedding or embeddings" });
      return;
    }

    // Log a warning but allow registration with fewer embeddings
    if (inputEmbeddings.length < 3) {
      console.warn(`⚠️ Only ${inputEmbeddings.length} embeddings provided. For better duplicate detection, consider providing more samples.`);
    }
    
    // Validate embedding dimensions but allow registration with warnings
    for (const emb of inputEmbeddings) {
      const arr = Array.from(emb);
      if (arr.length !== 128) { // Face recognition embeddings should be 128-dimensional
        console.warn(`⚠️ Invalid embedding dimensions: ${arr.length}. Expected 128-dimensional vectors.`);
      }
    }

    // Normalize all embeddings
    const normalizedEmbeddings = inputEmbeddings.map(emb => normalizeEmbedding(emb));
    
    // Log the number of embeddings for debugging
    console.log(`📊 Processing ${normalizedEmbeddings.length} embeddings for user ${userId}`);
    
    // ✅ CHECK FOR DUPLICATE FACES ACROSS ALL USERS
    // Fetch all existing face embeddings from database
    const { data: allFaces, error: fetchError } = await userFaces.getAll();
    
    if (fetchError) {
      console.error("Error fetching existing faces:", fetchError);
      res.status(500).json({ message: "Failed to verify face uniqueness" });
      return;
    }
    
    // If no faces exist in the database, this is the first user - no need to check for duplicates
    if (!allFaces || allFaces.length === 0) {
      console.log("🆕 First user registration - no existing faces to compare against");
    }
    
    // Check if this face already exists for another user
    // Use appropriate thresholds based on project specifications
    const DUPLICATE_BLOCK_THRESHOLD = 0.85;  // High threshold - block if ≥85%
    const WARNING_THRESHOLD = 0.75; // Medium threshold - log warning if ≥75%
    const MIN_QUALITY_THRESHOLD = 0.65; // Low threshold - check embeddings with minimum quality
    
    if (allFaces && allFaces.length > 0) {
      console.log(`🔍 Checking against ${allFaces.length} existing faces for duplicate detection`);
      for (const existingFace of allFaces) {
        // Skip checking against the current user's own face (if updating)
        if (existingFace.user_id === userId) {
          console.log(`⏭️ Skipping comparison against user's own face (ID: ${userId})`);
          continue;
        }
        
        // Skip if this face has no embedding yet (new user who hasn't completed registration)
        if (!existingFace.face_embedding) {
          continue;
        }
        
        // Skip if the face embedding is invalid
        try {
          const parsed = JSON.parse(existingFace.face_embedding);
          if (!parsed || (Array.isArray(parsed) && parsed.length === 0)) {
            continue;
          }
        } catch (e) {
          // Skip invalid embeddings
          continue;
        }
        
        try {
          // Parse the stored embedding (could be single or array)
          const parsed = JSON.parse(existingFace.face_embedding);
          const storedEmbeddings: number[][] = [];
          
          // Handle both single embedding and array of embeddings
          if (Array.isArray(parsed) && parsed.length > 0) {
            if (Array.isArray(parsed[0])) {
              // Array of embeddings
              storedEmbeddings.push(...parsed.map((e: number[]) => normalizeEmbedding(e)));
            } else {
              // Single embedding
              storedEmbeddings.push(normalizeEmbedding(parsed));
            }
          }
          
          // Skip comparison if stored embeddings are insufficient
          if (storedEmbeddings.length === 0) {
            console.warn(`⚠️ No valid embeddings found for user ${existingFace.user_id}. Skipping duplicate check.`);
            continue;
          }
          
          // Check similarity between new and stored embeddings
          // Use average of best matches to reduce false positives from outliers
          let maxSimilarity = 0;
          let totalSimilarity = 0;
          let validComparisons = 0;
          let matchCount = 0;
          
          // Debug: Log embedding info
          console.log(`🔍 Comparing user ${userId} against user ${existingFace.user_id}`);
          console.log(`   New embeddings count: ${normalizedEmbeddings.length}`);
          console.log(`   Stored embeddings count: ${storedEmbeddings.length}`);
          
          for (const newEmb of normalizedEmbeddings) {
            for (const storedEmb of storedEmbeddings) {
              // Debug: Log vector info
              console.log(`   Comparing vectors of length ${newEmb.length} vs ${storedEmb.length}`);
              
              const similarity = cosineSimilarity(newEmb, storedEmb);
              
              // Debug: Log similarity
              console.log(`   Similarity: ${similarity.toFixed(4)}`);
              
              // Track the highest similarity found
              if (similarity > maxSimilarity) {
                maxSimilarity = similarity;
              }
              
              // Add to total for average calculation
              totalSimilarity += similarity;
              validComparisons++;
              
              // If we get a perfect match (1.0), this might indicate we're comparing the same data
              if (similarity === 1.0 && newEmb.length === storedEmb.length) {
                // Check if the vectors are actually identical
                let identical = true;
                for (let i = 0; i < newEmb.length; i++) {
                  if (newEmb[i] !== storedEmb[i]) {
                    identical = false;
                    break;
                  }
                }
                
                if (identical) {
                  console.warn(`⚠️ Identical embeddings detected! This might indicate a data issue.`);
                  console.warn(`   User ${userId} embedding appears to be identical to user ${existingFace.user_id} embedding`);
                }
              }
              
              // Count how many comparisons show high similarity
              if (similarity >= WARNING_THRESHOLD) {
                matchCount++;
              }
            }
          }
          
          // Calculate average similarity
          const averageSimilarity = validComparisons > 0 ? totalSimilarity / validComparisons : 0;
          
          // Count how many individual comparisons exceed the blocking threshold
          const highConfidenceMatches = matchCount; // Already counted matches >= WARNING_THRESHOLD
          const veryHighMatches = validComparisons > 0 ? 
            normalizedEmbeddings.reduce((count, newEmb) => 
              count + storedEmbeddings.filter(storedEmb => 
                cosineSimilarity(newEmb, storedEmb) >= DUPLICATE_BLOCK_THRESHOLD
              ).length
            , 0) : 0;
          
          // Improved duplicate detection logic:
          // Block if we have strong evidence it's the same person
          const hasSufficientData = normalizedEmbeddings.length >= 3 && storedEmbeddings.length >= 3;
          
          // Strict blocking: Very high max similarity with high average
          if (maxSimilarity >= DUPLICATE_BLOCK_THRESHOLD && averageSimilarity >= 0.70 && hasSufficientData) {
            console.log(`🚫 BLOCKED: Duplicate face detected! Max: ${maxSimilarity.toFixed(4)} (${(maxSimilarity * 100).toFixed(2)}%), Avg: ${averageSimilarity.toFixed(4)} (${(averageSimilarity * 100).toFixed(2)}%) with user ${existingFace.user_id}`);
            console.log(`   High confidence matches (≥${DUPLICATE_BLOCK_THRESHOLD}): ${veryHighMatches}/${validComparisons}`);
            res.status(409).json({ 
              message: "This face is already registered to another account. Each person can only have one account. Please contact support if you believe this is an error." 
            });
            return;
          }
          
          // Medium blocking: Multiple very high similarity matches
          if (veryHighMatches >= 3 && averageSimilarity >= 0.65) {
            console.log(`🚫 BLOCKED: Multiple high-confidence matches! ${veryHighMatches} matches ≥${DUPLICATE_BLOCK_THRESHOLD}, Avg: ${averageSimilarity.toFixed(4)} with user ${existingFace.user_id}`);
            res.status(409).json({ 
              message: "This face is already registered to another account. Each person can only have one account." 
            });
            return;
          }
          
          // Conservative blocking: Extremely high max similarity even with less data
          if (maxSimilarity >= 0.90 && averageSimilarity >= 0.70) {
            console.log(`🚫 BLOCKED: Extremely high similarity! Max: ${maxSimilarity.toFixed(4)} (${(maxSimilarity * 100).toFixed(2)}%), Avg: ${averageSimilarity.toFixed(4)} with user ${existingFace.user_id}`);
            res.status(409).json({ 
              message: "This face is already registered to another account." 
            });
            return;
          }
          
          // Log warnings for high similarity that doesn't meet blocking criteria
          if (maxSimilarity >= WARNING_THRESHOLD) {
            // Single match above warning threshold - log and allow
            console.log(`⚠️ WARNING: Medium similarity detected but allowing: ${maxSimilarity.toFixed(4)} (${(maxSimilarity * 100).toFixed(2)}%) with user ${existingFace.user_id}`);
          } else if (maxSimilarity >= MIN_QUALITY_THRESHOLD) {
            // Low similarity - normal, just log for monitoring
            console.log(`ℹ️ Low similarity: ${maxSimilarity.toFixed(4)} (${(maxSimilarity * 100).toFixed(2)}%) with user ${existingFace.user_id} - Allowing registration`);
          } else {
            // Very low similarity - normal variation
            console.log(`✅ Very low similarity: ${maxSimilarity.toFixed(4)} (${(maxSimilarity * 100).toFixed(2)}%) with user ${existingFace.user_id} - Allowing registration`);
          }
        } catch (parseError) {
          console.error(`Error parsing stored embedding for user ${existingFace.user_id}:`, parseError);
          // Continue checking other faces even if one fails to parse
          continue;
        }
      }
    }
    
    // Convert all embeddings to JSON string for storage
    const embeddingJson = JSON.stringify(normalizedEmbeddings);

    // Save face embedding to database
    const { data: faceData, error } = await userFaces.upsert(userId, embeddingJson);

    if (error) {
      console.error("Error saving face embedding:", error);
      res.status(500).json({ message: "Failed to register face" });
      return;
    }

    res.status(200).json({ message: "Face registered successfully" });
  } catch (err: unknown) {
    console.error("Face registration error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ message });
  }
}

interface JwtPayload {
  id: number;
  temp: boolean;
  [key: string]: string | number | boolean | object | null | undefined;
}
