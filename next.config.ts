import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  async rewrites() {
    return [
      {
        source: '/api-backend/:path*',
        // Fallback to VM IP if API_BASE_URL is not set
        destination: `${process.env.API_BASE_URL || 'http://103.179.56.128:8000'}/:path*`
      }
    ]
  }
};

export default nextConfig;
