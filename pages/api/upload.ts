import type { NextApiRequest, NextApiResponse } from "next";
import formidable, { Files, File } from "formidable";
import fs from "fs";
import path from "path";
import { supabaseAdmin, SUPABASE_BUCKET, SUPABASE_URL } from "@/configs/supabase";

// Disable Next.js body parser — formidable handles it
export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
    // Increase size limit for file uploads (10MB)
    sizeLimit: '10mb',
  },
};

interface UploadResponse {
  url?: string;
  error?: string;
}

function getUploadedFile(files: Files): File | undefined {
  const fileField = files.file;
  if (!fileField) return undefined;

  if (Array.isArray(fileField)) {
    return fileField[0];
  }

  return fileField;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UploadResponse>
): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const form = formidable({ 
    multiples: false,
    maxFileSize: 10 * 1024 * 1024, // 10MB max file size
    keepExtensions: true,
  });

  form.parse(req, async (err, _fields, files) => {
    if (err) {
      console.error("❌ Form parse error:", err);
      // Provide more specific error message
      if (err.message?.includes('maxFileSize')) {
        res.status(413).json({ error: "File too large. Maximum size is 10MB" });
      } else {
        res.status(500).json({ error: `Failed to parse upload: ${err.message}` });
      }
      return;
    }

    const uploadedFile = getUploadedFile(files);

    if (!uploadedFile) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    try {
      // Check if Supabase is configured
      const hasSupabaseConfig = process.env.SUPABASE_URL && 
                                process.env.SUPABASE_SERVICE_ROLE_KEY;
      
      if (hasSupabaseConfig) {
        // Use Supabase Storage for serverless environments
        const fileExtension = path.extname(uploadedFile.originalFilename || "");
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}${fileExtension}`;
        const filePath = `candidates/${fileName}`;
        
        // Read file buffer
        const fileBuffer = fs.readFileSync(uploadedFile.filepath);
        
        // Determine content type
        const ext = fileExtension.toLowerCase();
        const mimeTypes: Record<string, string> = {
          '.pdf': 'application/pdf',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.png': 'image/png',
          '.gif': 'image/gif',
        };
        const contentType = mimeTypes[ext] || 'application/octet-stream';
        
        // Upload to Supabase Storage
        const { data, error } = await supabaseAdmin.storage
          .from(SUPABASE_BUCKET)
          .upload(filePath, fileBuffer, {
            contentType,
            upsert: false,
          });
        
        if (error) {
          throw new Error(`Supabase upload failed: ${error.message}`);
        }
        
        // Delete temporary file
        try {
          fs.unlinkSync(uploadedFile.filepath);
        } catch (unlinkErr) {
          console.warn("⚠️ Failed to delete temp file:", unlinkErr);
        }
        
        // Return public URL (bucket must be public)
        // If you want to use a private bucket, uncomment the signed URL code below
        const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${filePath}`;
        res.status(200).json({ url: publicUrl });
        
        // Alternative: For private buckets, use signed URLs (uncomment below)
        // const { data: signedData, error: signedError } = await supabaseAdmin.storage
        //   .from(SUPABASE_BUCKET)
        //   .createSignedUrl(filePath, 3600); // URL valid for 1 hour
        // if (signedError) {
        //   throw new Error(`Failed to create signed URL: ${signedError.message}`);
        // }
        // res.status(200).json({ url: signedData.signedUrl });
      } else {
        // Fallback to local storage for development (if filesystem is writable)
        const uploadDir = path.join(process.cwd(), "public", "uploads", "candidates");
        
        // Create upload directory if it doesn't exist
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        
        // Generate unique filename with original extension
        const fileExtension = path.extname(uploadedFile.originalFilename || "");
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}${fileExtension}`;
        const newPath = path.join(uploadDir, fileName);
        
        // Copy file from temp location to uploads directory
        const fileBuffer = fs.readFileSync(uploadedFile.filepath);
        fs.writeFileSync(newPath, fileBuffer);
        
        // Delete temporary file
        try {
          fs.unlinkSync(uploadedFile.filepath);
        } catch (unlinkErr) {
          console.warn("⚠️ Failed to delete temp file:", unlinkErr);
        }
        
        // Return URL relative to public directory
        const url = `/uploads/candidates/${fileName}`;
        res.status(200).json({ url });
      }
    } catch (uploadErr) {
      console.error("❌ Upload error:", uploadErr);
      const errorMessage = uploadErr instanceof Error ? uploadErr.message : "Upload failed";
      res.status(500).json({ error: `Upload failed: ${errorMessage}` });
    }
  });
}