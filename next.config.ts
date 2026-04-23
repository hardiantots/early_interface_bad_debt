import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,

  /**
   * Standalone output — bundles a minimal self-contained server into
   * .next/standalone/. On the VM, run with:
   *   node .next/standalone/server.js
   * (PM2 ecosystem.config.cjs is configured for this)
   */
  output: "standalone",

  /**
   * Server-side proxy: Next.js forwards /api/* to FastAPI.
   * BACKEND_API_URL is set in the PM2 ecosystem env (http://127.0.0.1:8000 on VM).
   * NEXT_PUBLIC_API_BASE is set to "/api" on VM so the browser hits this rewrite.
   */
  async rewrites() {
    const backendUrl = process.env.BACKEND_API_URL || "http://localhost:8000";
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
