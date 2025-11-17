/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Increase memory limit for webpack
  webpack: (config, { isServer }) => {
    // Increase memory limit for memory-intensive operations
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };
    
    // For server-side builds, increase memory limits
    if (isServer) {
      config.optimization = {
        ...config.optimization,
        minimize: false, // Disable minification for server builds to reduce memory usage
      };
    }
    
    // Add memory optimizations
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
    };
    
    return config;
  },
  // Add memory usage optimizations
  experimental: {
    // Reduce memory usage during build
    optimizeCss: true,
    // Reduce memory usage for large dependencies
    largePageDataBytes: 256 * 1000, // 256KB
  },
  // Configure image optimization to reduce memory usage
  images: {
    domains: ['localhost', '127.0.0.1'],
  },
  // Environment variables for memory management
  env: {
    // TensorFlow.js memory management
    TFJS_BACKEND: 'webgl',
    // Limit concurrent requests to reduce memory usage
    NEXT_CONCURRENCY: '1',
  },
};

export default nextConfig;