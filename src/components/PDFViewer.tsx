"use client";

import { useEffect, useState } from "react";

interface PDFViewerProps {
  path: string; // Path in Supabase bucket or public URL
  email?: string; // Optional for signed URL
  className?: string; // Added for Tailwind styling
}

interface SignedUrlResponse {
  signedUrl?: string;
  error?: string;
}

export default function PDFViewer({ path, email, className }: PDFViewerProps) {
  const [signedUrl, setSignedUrl] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (!path) {
      setError("Path is required");
      setLoading(false);
      return;
    }

    const fetchSignedUrl = async (): Promise<void> => {
      setLoading(true);
      setError("");

      try {
        if (email) {
          const params = new URLSearchParams({ path, email });
          const response = await fetch(`/api/signed-url?${params.toString()}`);
          const data: SignedUrlResponse = await response.json();

          if (data.error) setError(data.error);
          else if (data.signedUrl) setSignedUrl(data.signedUrl);
          else setError("Unexpected error fetching signed URL");
        } else {
          setSignedUrl(path);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    void fetchSignedUrl();
  }, [path, email]);

  if (loading)
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="mt-2 text-gray-500">Loading PDF...</span>
        </div>
      </div>
    );

  if (error)
    return (
      <div className="w-full h-full flex items-center justify-center">
        <span className="text-red-500">{error}</span>
      </div>
    );

  if (!signedUrl) return null;

  return (
    <div
      className={`w-full h-full flex items-center justify-center bg-gray-50 ${
        className || ""
      }`}
    >
      <embed
        src={`${signedUrl}#toolbar=1&navpanes=0&scrollbar=1`}
        type="application/pdf"
        className="w-full h-full"
      />
    </div>
  );
}
