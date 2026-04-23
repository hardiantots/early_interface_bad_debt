#!/usr/bin/env bash
# =============================================================================
# deploy.sh — One-command deploy script for Bad Debt Frontend on VM
#
# Usage:
#   bash deploy/deploy.sh            # Full deploy (pull + install + build + restart)
#   bash deploy/deploy.sh --build-only  # Build without restarting
#   bash deploy/deploy.sh --restart-only # Restart PM2 without rebuilding
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
APP_NAME="web_bad_debt"

cd "$PROJECT_DIR"
echo "▶ Working directory: $PROJECT_DIR"

# ── Parse flags ────────────────────────────────────────────────────────────
BUILD_ONLY=false
RESTART_ONLY=false
for arg in "$@"; do
  case $arg in
    --build-only)    BUILD_ONLY=true ;;
    --restart-only)  RESTART_ONLY=true ;;
  esac
done

# ── Step 1: Pull latest code ───────────────────────────────────────────────
if [ "$RESTART_ONLY" = false ]; then
  echo ""
  echo "📥 [1/4] Pulling latest code from origin..."
  git pull origin main
fi

# ── Step 2: Install dependencies ──────────────────────────────────────────
if [ "$RESTART_ONLY" = false ]; then
  echo ""
  echo "📦 [2/4] Installing dependencies..."
  npm ci --prefer-offline 2>/dev/null || npm install
fi

# ── Step 3: Build Next.js ─────────────────────────────────────────────────
if [ "$RESTART_ONLY" = false ]; then
  echo ""
  echo "🔨 [3/4] Building Next.js (production)..."
  # Ensure production env vars are set for the build
  export NODE_ENV=production
  export NEXT_PUBLIC_API_BASE=/api
  export BACKEND_API_URL=http://127.0.0.1:8001
  npm run build
fi

# ── Step 4: Restart / Start PM2 ───────────────────────────────────────────
echo ""
echo "🚀 [4/4] Restarting PM2 process..."
mkdir -p logs

if pm2 describe "$APP_NAME" > /dev/null 2>&1; then
  pm2 restart "$APP_NAME" --update-env
else
  echo "  → PM2 process not found. Starting fresh from ecosystem.config.cjs..."
  pm2 start ecosystem.config.cjs --env production
fi

pm2 save

# ── Done ──────────────────────────────────────────────────────────────────
echo ""
echo "✅ Deploy selesai!"
echo ""
pm2 list --no-color | grep -E "($APP_NAME|─|┼|┌|└)"
echo ""
echo "  Frontend : http://$(hostname -I | awk '{print $1}')"
echo "  Logs     : pm2 logs $APP_NAME"
