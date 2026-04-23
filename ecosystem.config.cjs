/**
 * PM2 Process Manager configuration for Bad Debt Frontend (Next.js).
 *
 * Requires: next.config.ts output: "standalone"
 * After build, Next.js creates .next/standalone/server.js (self-contained server).
 *
 * First-time setup on VM:
 *   pm2 start ecosystem.config.cjs --env production
 *   pm2 save
 *   pm2 startup   # enable auto-start on reboot
 *
 * Update workflow:
 *   git pull && npm ci && npm run build && bash deploy/deploy.sh --restart-only
 */
module.exports = {
  apps: [
    {
      name: "web_bad_debt",
      cwd: __dirname,
      // Standalone mode: run the self-contained server bundle directly
      script: "node",
      args: ".next/standalone/server.js",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      kill_timeout: 5000,
      env_production: {
        NODE_ENV: "production",
        PORT: "3000",
        HOSTNAME: "127.0.0.1",
        // Next.js server-side proxy target (internal, same VM)
        BACKEND_API_URL: "http://127.0.0.1:8001",
        // Relative path — browser sends /api/* which Nginx forwards to Next.js,
        // which then proxies to FastAPI at BACKEND_API_URL
        NEXT_PUBLIC_API_BASE: "/api",
      },
      error_file: "./logs/pm2-error.log",
      out_file: "./logs/pm2-out.log",
      merge_logs: true,
      time: true,
    },
  ],
};
