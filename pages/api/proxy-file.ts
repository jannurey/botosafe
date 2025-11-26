import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { url } = req.query;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL is required' });
  }

  // Validate that the URL is from our Cloudinary account
  if (!url.startsWith('https://res.cloudinary.com/')) {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  try {
    // Simply redirect to the Cloudinary URL - this avoids CORS issues
    // and lets Cloudinary handle the file serving
    res.redirect(302, url);
  } catch (error: any) {
    console.error('Error proxying file:', error.message);
    res.status(500).json({ error: 'Failed to access file' });
  }
}
