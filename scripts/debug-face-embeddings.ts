import { supabaseAdmin } from "@/configs/supabase";

/**
 * Debug script to inspect face embeddings in the database
 * Usage: npx ts-node scripts/debug-face-embeddings.ts
 */

async function debugFaceEmbeddings() {
  try {
    console.log("🔍 Fetching all face embeddings from database...");
    
    // Fetch all face embeddings
    const { data: faceRows, error } = await supabaseAdmin
      .from('user_faces')
      .select('user_id, face_embedding, created_at');
      
    if (error) {
      console.error("❌ Database error:", error);
      process.exit(1);
    }
    
    if (!faceRows || faceRows.length === 0) {
      console.log("✅ No face embeddings found in database");
      process.exit(0);
    }
    
    console.log(`📊 Found ${faceRows.length} face embeddings:`);
    
    // Process each face embedding
    for (const row of faceRows) {
      try {
        const parsed = JSON.parse(row.face_embedding);
        console.log(`\n--- User ${row.user_id} ---`);
        console.log(`  Created: ${row.created_at}`);
        
        if (Array.isArray(parsed)) {
          if (parsed.length === 0) {
            console.log("  Embedding: Empty array");
          } else if (Array.isArray(parsed[0])) {
            // Array of embeddings
            console.log(`  Embedding: Array of ${parsed.length} embeddings`);
            for (let i = 0; i < parsed.length; i++) {
              const emb = parsed[i];
              console.log(`    Embedding ${i}: ${emb.length} dimensions`);
              if (emb.length > 0) {
                console.log(`      First 5 values: [${emb.slice(0, 5).join(', ')}]`);
                const norm = Math.sqrt(emb.reduce((sum: number, val: number) => sum + val * val, 0));
                console.log(`      Norm: ${norm.toFixed(4)}`);
              }
            }
          } else {
            // Single embedding
            console.log(`  Embedding: Single embedding with ${parsed.length} dimensions`);
            if (parsed.length > 0) {
              console.log(`    First 5 values: [${parsed.slice(0, 5).join(', ')}]`);
              const norm = Math.sqrt(parsed.reduce((sum: number, val: number) => sum + val * val, 0));
              console.log(`    Norm: ${norm.toFixed(4)}`);
            }
          }
        } else {
          console.log("  Embedding: Invalid format");
        }
      } catch (parseError) {
        console.log(`  Embedding: Parse error - ${parseError}`);
      }
    }
    
    // If we have multiple embeddings, calculate some similarity scores for debugging
    if (faceRows.length > 1) {
      console.log("\n🔄 Calculating similarity scores between users...");
      
      // Simple cosine similarity function
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
      
      // Normalize function
      function normalizeEmbedding(embedding: number[]): number[] {
        const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
        return norm === 0 ? embedding : embedding.map((val) => val / norm);
      }
      
      // Compare first embedding of each user
      for (let i = 0; i < Math.min(3, faceRows.length); i++) {
        for (let j = i + 1; j < Math.min(3, faceRows.length); j++) {
          try {
            const user1 = faceRows[i];
            const user2 = faceRows[j];
            
            const parsed1 = JSON.parse(user1.face_embedding);
            const parsed2 = JSON.parse(user2.face_embedding);
            
            // Get first embedding from each user
            let emb1: number[] = [];
            let emb2: number[] = [];
            
            if (Array.isArray(parsed1) && parsed1.length > 0) {
              if (Array.isArray(parsed1[0])) {
                emb1 = normalizeEmbedding(parsed1[0]);
              } else {
                emb1 = normalizeEmbedding(parsed1);
              }
            }
            
            if (Array.isArray(parsed2) && parsed2.length > 0) {
              if (Array.isArray(parsed2[0])) {
                emb2 = normalizeEmbedding(parsed2[0]);
              } else {
                emb2 = normalizeEmbedding(parsed2);
              }
            }
            
            if (emb1.length > 0 && emb2.length > 0 && emb1.length === emb2.length) {
              const similarity = cosineSimilarity(emb1, emb2);
              console.log(`  User ${user1.user_id} vs User ${user2.user_id}: ${similarity.toFixed(4)}`);
            }
          } catch (error) {
            console.log(`  Error comparing User ${faceRows[i].user_id} vs User ${faceRows[j].user_id}`);
          }
        }
      }
    }
    
    console.log("\n✅ Debug complete");
    process.exit(0);
  } catch (error) {
    console.error("❌ Unexpected error:", error);
    process.exit(1);
  }
}

debugFaceEmbeddings();