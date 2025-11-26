import type { NextApiRequest, NextApiResponse } from "next";
import https from "https";
import http from "http";
import { URL } from "url";

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
    // Parse the URL to determine if it's HTTP or HTTPS
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;
    
    // Make a request to the Cloudinary URL
    const proxyReq = client.get(url, (proxyRes) => {
      // Set the response headers from the Cloudinary response
      res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
      
      // Pipe the Cloudinary response to our response
      proxyRes.pipe(res);
    });
    
    // Handle errors in the proxy request
    proxyReq.on('error', (error) => {
      console.error('Error proxying file:', error.message);
      res.status(500).json({ error: 'Failed to access file' });
    });
    
    // Handle client disconnect
    req.on('close', () => {
      proxyReq.destroy();
    });
  } catch (error: any) {
    console.error('Error proxying file:', error.message);
    res.status(500).json({ error: 'Failed to access file' });
  }
}