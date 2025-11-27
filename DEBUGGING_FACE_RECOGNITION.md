# Face Recognition Debugging Guide

This document explains how to debug issues with the face recognition system, particularly false duplicate detections.

## Common Issues and Solutions

### 1. False Duplicate Detection (Most Common Issue)

**Problem**: Different users are being flagged as duplicates during face registration.

**Root Cause (original)**: The face duplicate threshold was set around 0.92, which caused many moderately similar faces (similarity ≈ 0.95) to be flagged as duplicates.

**Solution (updated)**: 
- Duplicate detection now uses a higher threshold (around 0.97–0.98 by default) so that only *very* similar faces are treated as duplicates.
- This reduces false positives where different users legitimately have high similarity scores (~0.95) while still catching truly matching faces.

## Debugging Tools

### 1. Database Embedding Inspector

View all face embeddings in the database:

```bash
npx ts-node scripts/debug-face-embeddings.ts
```

This script will:
- Show all face embeddings with basic statistics
- Display the first few values of each embedding
- Show embedding norms
- Calculate similarity scores between users

### 2. Direct Face Comparison

Compare embeddings between two specific users:

```bash
npx ts-node scripts/compare-faces.ts <user1_id> <user2_id>
```

This script will:
- Show a similarity matrix between all embeddings of both users
- Display the maximum similarity score
- Compare against multiple thresholds

## Threshold Guidelines

### Recommended Thresholds:
- **0.90**: Standard threshold for most applications
- **0.95**: Stricter threshold for high-security applications
- **0.97–0.98**: Very strict threshold (recommended default for duplicate detection in this project). At these values only *very* similar faces are considered duplicates, which reduces false positives when different users have similarity around 0.95.

### Industry Standards:
- Academic research typically uses thresholds between 0.6-0.8
- Commercial applications often use 0.8-0.85
- High-security applications may use 0.9+

## How to Verify Database Values

### 1. Check Current Threshold Setting

```sql
SELECT * FROM settings WHERE k = 'face_duplicate_threshold';
```

### 2. Inspect Raw Embeddings

```sql
SELECT user_id, face_embedding FROM user_faces;
```

### 3. Check Embedding Format

Embeddings are stored as JSON:
- Single embedding: `[0.1, 0.2, 0.3, ...]`
- Multiple embeddings: `[[0.1, 0.2, ...], [0.3, 0.4, ...], ...]`

## Manual Similarity Inspection

To manually calculate similarity between two embeddings:

1. Extract embeddings from the database
2. Ensure both embeddings are normalized
3. Calculate cosine similarity:

```javascript
function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
```

## Development Debugging

When running in development mode (`NODE_ENV=development`), the system will output additional debugging information:

- Embedding statistics
- Detailed similarity scores
- Embedding norms
- Comparison details

## Troubleshooting Checklist

1. **Check threshold setting**: Ensure it's set to an appropriate value for your data. For this project, 0.97–0.98 is a good default for duplicate detection to avoid flagging different users with ~0.95 similarity.
2. **Verify embedding normalization**: All embeddings should be L2 normalized
3. **Inspect raw embeddings**: Check if embeddings look reasonable
4. **Test similarity manually**: Use the comparison scripts
5. **Review preprocessing**: Ensure consistent face detection and alignment

## When to Adjust Thresholds

### Increase threshold (more strict) when:
- Getting too many false positives (different people matching)
- Security is more important than usability

### Decrease threshold (more lenient) when:
- Getting too many false negatives (same person not matching)
- Usability is more important than security

The exact setting depends on your deployment, but 0.97–0.98 works well for this project in practice.