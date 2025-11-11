// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "botosafe.website" },
      { protocol: "http", hostname: "localhost" },
    ],
  },

  webpack: (config) => {
    // 🧩 Ignore Node built-in modules (face-api.js tries to import them)
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      os: false,
      crypto: false,
      encoding: false,
    };

    config.externals.push({
      "@mediapipe/face_mesh": "commonjs @mediapipe/face_mesh",
      "@mediapipe/camera_utils": "commonjs @mediapipe/camera_utils",
    });

        return config;
      },
    };
    
    export default nextConfig;
