import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    domains: ["localhost", "botosafe.website"],
  },
  webpack: (config) => {
    config.ignoreWarnings = [{ module: /node_modules/ }];
    return config;
  },
};

export default nextConfig;
