import { supabaseAdmin } from "@/configs/supabase";

/**
 * Script to compare face embeddings between two specific users
 * Usage: npx ts-node scripts/compare-faces.ts <user1_id> <user2_id>
 */

async function compareFaces(user1Id: number, user2Id: number) {
  try {
    console.log(`🔍 Comparing faces for User ${user1Id} and User ${user2Id}...`);
    
    // Fetch face embeddings for both users
    const { data: faceRows, error } = await supabaseAdmin
      .from('user_faces')
      .select('user_id, face_embedding')
      .in('user_id', [user1Id, user2Id]);
      
    if (error) {
      console.error("❌ Database error:", error);
      process.exit(1);
    }
    
    if (!faceRows || faceRows.length === 0) {
      console.log("❌ No face embeddings found for these users");
      process.exit(1);
    }
    
    if (faceRows.length !== 2) {
      console.log(`❌ Expected 2 users, found ${faceRows.length}`);
      process.exit(1);
    }
    
    // Find embeddings for each user
    const user1Row = faceRows.find(row => row.user_id === user1Id);
    const user2Row = faceRows.find(row => row.user_id === user2Id);
    
    if (!user1Row || !user2Row) {
      console.log("❌ Could not find embeddings for both users");
      process.exit(1);
    }
    
    // Parse embeddings
    const parsed1 = JSON.parse(user1Row.face_embedding);
    const parsed2 = JSON.parse(user2Row.face_embedding);
    
    // Extract embeddings
    let embeddings1: number[][] = [];
    let embeddings2: number[][] = [];
    
    // Process user 1 embeddings
    if (Array.isArray(parsed1) && parsed1.length > 0) {
      if (Array.isArray(parsed1[0])) {
        embeddings1 = parsed1.map(emb => normalizeEmbedding(emb as number[]));
      } else {
        embeddings1 = [normalizeEmbedding(parsed1)];
      }
    }
    
    // Process user 2 embeddings
    if (Array.isArray(parsed2) && parsed2.length > 0) {
      if (Array.isArray(parsed2[0])) {
        embeddings2 = parsed2.map(emb => normalizeEmbedding(emb as number[]));
      } else {
        embeddings2 = [normalizeEmbedding(parsed2)];
      }
    }
    
    console.log(`User ${user1Id}: ${embeddings1.length} embeddings`);
    console.log(`User ${user2Id}: ${embeddings2.length} embeddings`);
    
    // Calculate all pairwise similarities
    console.log("\n📊 Similarity Matrix:");
    console.log("     ", embeddings2.map((_, i) => `Emb${i}`).join("  "));
    
    for (let i = 0; i < embeddings1.length; i++) {
      const row: string[] = [];
      for (let j = 0; j < embeddings2.length; j++) {
        const similarity = cosineSimilarity(embeddings1[i], embeddings2[j]);
        row.push(similarity.toFixed(4));
      }
      console.log(`Emb${i}  ${row.join("  ")}`);
    }
    
    // Find maximum similarity
    let maxSimilarity = 0;
    for (const emb1 of embeddings1) {
      for (const emb2 of embeddings2) {
        const similarity = cosineSimilarity(emb1, emb2);
        if (similarity > maxSimilarity) {
          maxSimilarity = similarity;
        }
      }
    }
    
    console.log(`\n📈 Maximum similarity: ${maxSimilarity.toFixed(4)}`);
    
    // Compare against thresholds
    const thresholds = [0.85, 0.90, 0.92, 0.95];
    console.log("\n🎯 Threshold Analysis:");
    for (const threshold of thresholds) {
      const match = maxSimilarity >= threshold;
      console.log(`  ${threshold.toFixed(2)}: ${match ? 'MATCH' : 'NO MATCH'}`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Unexpected error:", error);
    process.exit(1);
  }
}

// Utility functions
function normalizeEmbedding(embedding: number[]): number[] {
  const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return norm === 0 ? embedding : embedding.map((val) => val / norm);
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

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length !== 2) {
  console.log("Usage: npx ts-node scripts/compare-faces.ts <user1_id> <user2_id>");
  process.exit(1);
}

const user1Id = parseInt(args[0], 10);
const user2Id = parseInt(args[1], 10);

if (isNaN(user1Id) || isNaN(user2Id)) {
  console.log("❌ Invalid user IDs provided");
  process.exit(1);
}

compareFaces(user1Id, user2Id);