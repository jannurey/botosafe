import type { NextApiRequest, NextApiResponse } from "next";
import formidable, { Files, File } from "formidable";
import fs from "fs";
import path from "path";
import { v2 as cloudinary } from "cloudinary";

// Disable Next.js body parser — formidable handles it
export const config = {
  api: {
    bodyParser: false,
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

  const form = formidable({ multiples: false });

  form.parse(req, async (err, _fields, files) => {
    if (err) {
      console.error("❌ Form parse error:", err);
      res.status(500).json({ error: "Failed to parse upload" });
      return;
    }

    const uploadedFile = getUploadedFile(files);

    if (!uploadedFile) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    try {
      // If Cloudinary is configured, use it
      if (hasCloudinaryConfig) {
        const filePath = uploadedFile.filepath;
        const result = await cloudinary.uploader.upload(filePath, {
          folder: "botosafe/candidates",
          resource_type: "auto",
        });

        // Delete temporary file
        fs.unlinkSync(filePath);

        res.status(200).json({ url: result.secure_url });
      } else {
        // If Cloudinary is not configured, save locally
        const uploadDir = path.join(process.cwd(), "public", "uploads");
        
        // Create upload directory if it doesn't exist
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        
        // Generate unique filename
        const fileExtension = path.extname(uploadedFile.originalFilename || "");
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}${fileExtension}`;
        const newPath = path.join(uploadDir, fileName);
        
        // Move file from temp location to uploads directory
        fs.renameSync(uploadedFile.filepath, newPath);
        
        // Return URL relative to public directory
        const url = `/uploads/${fileName}`;
        res.status(200).json({ url });
      }
    } catch (uploadErr) {
      console.error("❌ Upload error:", uploadErr);
      res.status(500).json({ error: "Upload failed" });
    }
  });
}