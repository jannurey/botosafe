import type { NextApiRequest, NextApiResponse } from "next";
import formidable, { Files, File } from "formidable";
import fs from "fs";
import path from "path";
import { v2 as cloudinary } from "cloudinary";

// Disable Next.js body parser — formidable handles it
export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
    // Increase size limit for file uploads (10MB)
    sizeLimit: '10mb',
  },
};

// Check if Cloudinary is configured
const hasCloudinaryConfig = process.env.CLOUDINARY_CLOUD_NAME && 
                           process.env.CLOUDINARY_API_KEY && 
                           process.env.CLOUDINARY_API_SECRET;

// Configure Cloudinary only if env vars are set
if (hasCloudinaryConfig) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
    api_key: process.env.CLOUDINARY_API_KEY!,
    api_secret: process.env.CLOUDINARY_API_SECRET!,
  });
}

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
      // Always save files locally instead of using Cloudinary
      // This ensures we can properly serve PDFs for viewing in browser
      const uploadDir = path.join(process.cwd(), "public", "uploads", "candidates");
      
      // Create upload directory if it doesn't exist
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      // Generate unique filename with original extension
      const fileExtension = path.extname(uploadedFile.originalFilename || "");
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}${fileExtension}`;
      const newPath = path.join(uploadDir, fileName);
      
      // Copy file from temp location to uploads directory (instead of renaming)
      // This avoids cross-device link issues on Windows
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
    } catch (uploadErr) {
      console.error("❌ Upload error:", uploadErr);
      const errorMessage = uploadErr instanceof Error ? uploadErr.message : "Upload failed";
      res.status(500).json({ error: `Upload failed: ${errorMessage}` });
    }
  });
}