// pages/api/register-face.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { userFaces, settings } from "@/lib/supabaseClient";
import jwt from "jsonwebtoken";

// Simple in-memory cache to track last registered embeddings (for debugging only)
const lastRegisteredEmbeddings: { [userId: number]: string } = {};

interface JwtPayload {
  id: number;
  temp: boolean;
  [key: string]: string | number | boolean | object | null | undefined;
}

// ------------------- UTILITY -------------------
function normalizeEmbedding(embedding: number[] | Float32Array): number[] {
  const arr = Array.from(embedding);
  const norm = Math.sqrt(arr.reduce((sum, val) => sum + val * val, 0));
  return norm === 0 ? arr : arr.map((val) => val / norm);
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Calculate median of an array
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

// Debug function to print embedding values (for development only)
function debugPrintEmbedding(embedding: number[], label: string): void {
  if (process.env.NODE_ENV === 'development') {
    console.log(`${label} embedding (first 10 values): [${embedding.slice(0, 10).join(', ')}]`);
    console.log(`${label} embedding norm: ${Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0)).toFixed(4)}`);
  }
}

// ------------------- HANDLER -------------------
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ message: string }>
) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  try {
    const tempAuthToken = req.cookies.tempAuthToken;
    if (!tempAuthToken) return res.status(401).json({ message: "No temporary token found" });

    const decoded = jwt.verify(tempAuthToken, process.env.JWT_SECRET!) as JwtPayload;
    if (!decoded || !decoded.temp) return res.status(401).json({ message: "Invalid token" });

    const userId = decoded.id;
    const { embeddings } = req.body as { embeddings?: (number[] | Float32Array)[] };
    if (!embeddings || embeddings.length === 0) return res.status(400).json({ message: "Missing embeddings" });

    // Get face duplicate threshold from settings, default to 0.92 if not set
    let DUPLICATE_THRESHOLD = 0.92;
    
    try {
      const { data: thresholdSetting, error: thresholdError } = await settings.getByKey("face_duplicate_threshold");
      if (!thresholdError && thresholdSetting && thresholdSetting.v) {
        const parsedThreshold = parseFloat(thresholdSetting.v as string);
        if (!isNaN(parsedThreshold) && parsedThreshold > 0 && parsedThreshold <= 1) {
          DUPLICATE_THRESHOLD = parsedThreshold;
        }
      }
    } catch (e) {
      console.warn("Failed to fetch face duplicate threshold from settings, using default:", DUPLICATE_THRESHOLD);
    }

    // Normalize embeddings
    const newEmbeddings = embeddings.map(normalizeEmbedding);
    
    // Debug: Log embedding information for debugging
    console.log(`User ${userId} registering ${newEmbeddings.length} embeddings`);
    if (newEmbeddings.length > 0) {
      console.log(`First embedding sample: ${JSON.stringify(newEmbeddings[0]).substring(0, 100)}...`);
      debugPrintEmbedding(newEmbeddings[0], `User ${userId} new`);
    }
    
    // Log raw embeddings for debugging duplicate issue
    console.log(`Raw embeddings for user ${userId}:`, JSON.stringify(embeddings));
    
    // Check for duplicate embeddings in the received data
    const embeddingStrings = embeddings.map(emb => JSON.stringify(emb));
    const uniqueEmbeddings = new Set(embeddingStrings);
    if (uniqueEmbeddings.size !== embeddings.length) {
      console.warn(`⚠️ Warning: ${embeddings.length - uniqueEmbeddings.size} duplicate embeddings received for user ${userId}!`);
      // Log which embeddings are duplicates
      const seen = new Set();
      embeddingStrings.forEach((embStr, index) => {
        if (seen.has(embStr)) {
          console.warn(`  Duplicate embedding at index ${index}`);
        } else {
          seen.add(embStr);
        }
      });
    }
    
    // Filter out duplicate embeddings before processing
    const uniqueNewEmbeddings = Array.from(uniqueEmbeddings).map(str => JSON.parse(str));
    if (uniqueNewEmbeddings.length < 3) {
      return res.status(400).json({ 
        message: `Only ${uniqueNewEmbeddings.length} unique face samples provided. Minimum 3 required.` 
      });
    }

    // Use unique embeddings for further processing
    const processedEmbeddings = uniqueNewEmbeddings.length >= 3 ? uniqueNewEmbeddings : newEmbeddings;
    
    // Debug: Check if all embeddings are identical
    if (processedEmbeddings.length > 1) {
      let allIdentical = true;
      const firstEmb = JSON.stringify(processedEmbeddings[0]);
      for (let i = 1; i < processedEmbeddings.length; i++) {
        if (JSON.stringify(processedEmbeddings[i]) !== firstEmb) {
          allIdentical = false;
          break;
        }
      }
      if (allIdentical) {
        console.warn(`All embeddings are identical for user ${userId}. This may indicate an issue with face capture.`);
      }
    }
    
    // Debug: Check if any new embeddings are identical to stored embeddings
    console.log(`Checking for exact duplicate embeddings between new and stored embeddings`);

    // ---------------- DUPLICATE CHECK ----------------
    // CRITICAL FIX: Only check faces from OTHER users, not including the current user
    const { data: allFaces, error: fetchError } = await userFaces.getAll();
    if (fetchError) return res.status(500).json({ message: "Failed to fetch existing faces" });

    // Filter out the current user's face BEFORE checking for duplicates
    const otherUserFaces = allFaces?.filter(face => face.user_id !== userId) || [];
    
    // Debug: Log how many faces we're actually checking against
    console.log(`Checking against ${otherUserFaces.length} OTHER users' faces in database (excluding current user ${userId})`);
    if (allFaces) {
      console.log(`Total faces in database: ${allFaces.length}, Current user faces filtered out: ${allFaces.length - otherUserFaces.length}`);
      // Log user IDs being checked
      console.log(`User IDs being checked for duplicates:`, otherUserFaces.map(f => f.user_id));
      
      // Additional check: Make sure we're not comparing to the current user's own face
      const currentUserFaces = allFaces?.filter(face => face.user_id === userId) || [];
      if (currentUserFaces.length > 0) {
        console.warn(`⚠️ Warning: Found ${currentUserFaces.length} existing face records for current user ${userId}`);
        // This could indicate the user is trying to register again
      }
    }

    if (otherUserFaces.length > 0) {
      for (const existingFace of otherUserFaces) {
        // Additional safety check (should not be needed now, but keep for robustness)
        if (existingFace.user_id === userId) {
          console.warn(`UNEXPECTED: Found current user ${userId} face in filtered list - skipping`);
          continue;
        }
        
        console.log(`Comparing user ${userId} embeddings with user ${existingFace.user_id} embeddings`);
        
        if (!existingFace.face_embedding) continue;

        let storedEmbeddings: number[][] = [];
        try {
          const parsed = JSON.parse(existingFace.face_embedding);
          if (Array.isArray(parsed) && parsed.length > 0) {
            if (Array.isArray(parsed[0])) {
              storedEmbeddings = parsed.map(normalizeEmbedding);
            } else {
              storedEmbeddings = [normalizeEmbedding(parsed)];
            }
            
            // Debug: Print first stored embedding for comparison
            if (storedEmbeddings.length > 0 && process.env.NODE_ENV === 'development') {
              debugPrintEmbedding(storedEmbeddings[0], `User ${existingFace.user_id} stored`);
            }
          }
        } catch (e) {
          console.warn(`Failed to parse embeddings for user ${existingFace.user_id}:`, e);
          continue; // Skip invalid embeddings
        }

        // Compare all new embeddings to stored embeddings
        let maxSimilarity = 0;
        let identicalEmbeddingsFound = false;
        let similarityDetails: {newIndex: number, storedIndex: number, similarity: number}[] = [];
        let allSimilarities: number[] = [];
        
        for (let newIdx = 0; newIdx < processedEmbeddings.length; newIdx++) {
          const newEmb = processedEmbeddings[newIdx];
          const newEmbStr = JSON.stringify(newEmb);
          
          for (let storedIdx = 0; storedIdx < storedEmbeddings.length; storedIdx++) {
            const storedEmb = storedEmbeddings[storedIdx];
            const storedEmbStr = JSON.stringify(storedEmb);
            
            // Check if embeddings are identical
            if (newEmbStr === storedEmbStr) {
              identicalEmbeddingsFound = true;
              console.warn(`Identical embedding found between user ${userId} and user ${existingFace.user_id}`);
              console.warn(`Identical embedding values: ${newEmbStr.substring(0, 200)}...`);
            }
            
            const sim = cosineSimilarity(newEmb, storedEmb);
            similarityDetails.push({newIndex: newIdx, storedIndex: storedIdx, similarity: sim});
            allSimilarities.push(sim);
            
            if (sim > maxSimilarity) maxSimilarity = sim;
          }
        }
        
        // Calculate median similarity instead of using max similarity
        const medianSimilarity = median(allSimilarities);
        
        if (identicalEmbeddingsFound) {
          console.warn(`User ${userId} attempted to register face with identical embeddings to user ${existingFace.user_id}`);
        }
        
        // Log detailed similarity information
        console.log(`Detailed similarity analysis for user ${userId} vs user ${existingFace.user_id}:`);
        similarityDetails.forEach(detail => {
          console.log(`  New[${detail.newIndex}] vs Stored[${detail.storedIndex}]: ${detail.similarity.toFixed(4)}`);
        });
        
        // Log embedding statistics for debugging
        if (process.env.NODE_ENV === 'development') {
          console.log(`Embedding stats for comparison:`);
          console.log(`  New embedding length: ${processedEmbeddings.length}`);
          console.log(`  Stored embedding length: ${storedEmbeddings.length}`);
          console.log(`  Max similarity: ${maxSimilarity.toFixed(4)}`);
          console.log(`  Median similarity: ${medianSimilarity.toFixed(4)}`);
          console.log(`  Threshold: ${DUPLICATE_THRESHOLD}`);
        }
        
        if (medianSimilarity >= DUPLICATE_THRESHOLD) {
          // Log the similarity for debugging purposes
          console.log(`Face duplicate detected for user ${userId}: medianSimilarity=${medianSimilarity.toFixed(4)}, maxSimilarity=${maxSimilarity.toFixed(4)}, threshold=${DUPLICATE_THRESHOLD}`);
          
          return res.status(409).json({
            message: "This face is already registered to another account. If you believe this is an error, please contact an administrator."
          });
        }
      }
    } else {
      console.log(`No other users' faces found in database - this will be the first face registration or only current user has faces`);
    }

    // ---------------- SAVE NEW EMBEDDINGS ----------------
    const embeddingJson = JSON.stringify(processedEmbeddings);
    
    // Log the embeddings we're about to save
    console.log(`Saving ${processedEmbeddings.length} embeddings for user ${userId}`);
    processedEmbeddings.forEach((emb, index) => {
      console.log(`  Embedding ${index}: ${emb.slice(0, 5).join(', ')}...`);
    });
    
    // Debug: Check if these embeddings are identical to the last registered ones
    if (lastRegisteredEmbeddings[userId]) {
      if (lastRegisteredEmbeddings[userId] === embeddingJson) {
        console.warn(`⚠️ Warning: User ${userId} is registering identical embeddings as last time!`);
      } else {
        console.log(`_embeddings for user ${userId} are different from last registration`);
      }
    }
    
    // Store current embeddings for next comparison
    lastRegisteredEmbeddings[userId] = embeddingJson;
    
    const { error } = await userFaces.upsert(userId, embeddingJson);
    if (error) return res.status(500).json({ message: "Failed to save face" });

    console.log(`✅ Face successfully registered for user ${userId}`);
    return res.status(200).json({ message: "Face registered successfully" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error(`❌ Face registration error for user: ${message}`);
    return res.status(500).json({ message });
  }
}
