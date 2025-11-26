import type { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import path from "path";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { file } = req.query;

  if (!file || typeof file !== "string") {
    return res.status(400).json({ error: "File parameter is required" });
  }

  // Security check: prevent directory traversal
  if (file.includes("..") || file.startsWith("/")) {
    return res.status(400).json({ error: "Invalid file path" });
  }

  // Construct file path
  const filePath = path.join(process.cwd(), "public", "uploads", "candidates", file);

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File not found" });
  }

  // Get file stats
  const stat = fs.statSync(filePath);
  
  // Set appropriate content type based on file extension
  const ext = path.extname(file).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
  };
  
  const contentType = mimeTypes[ext] || 'application/octet-stream';
  
  // Set headers for PDF viewing
  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Length", stat.size);
  
  // For PDF files, ensure they can be viewed in browser
  if (ext === '.pdf') {
    res.setHeader("Content-Disposition", "inline"); // This ensures PDFs open in browser instead of downloading
  }
  
  // Stream the file
  const readStream = fs.createReadStream(filePath);
  readStream.pipe(res);
}