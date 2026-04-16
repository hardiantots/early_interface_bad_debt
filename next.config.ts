import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  async rewrites() {
    const backendUrl = process.env.BACKEND_API_URL || "http://localhost:8000";
    return [
      {
        source: "/api/:path*",
        // Proxy to backend VM IP to avoid mixed content (HTTP over HTTPS) on Vercel
        destination: `${backendUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
