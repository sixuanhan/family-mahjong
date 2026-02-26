#!/usr/bin/env bash
# =============================================================================
# deploy.sh — Automated internet deployment (互联网联机部署)
#
# This script automates the full international deployment workflow:
#   1. Starts the backend server
#   2. Opens a Cloudflare Tunnel to expose the backend
#   3. Patches the tunnel URL into the frontend source
#   4. Builds the frontend
#   5. Deploys to Cloudflare Pages
#   6. Restores the original source file
#
# Prerequisites:
#   - pnpm, cloudflared, wrangler installed and on PATH
#   - Cloudflare account authenticated (run `wrangler login` once)
#
# Usage:
#   bash deploy.sh
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

HOOK_FILE="src/hooks/useGameConnection.ts"
BACKUP_FILE="${HOOK_FILE}.bak"

# Track background PIDs for cleanup
SERVER_PID=""
TUNNEL_PID=""

cleanup() {
  echo ""
  echo "🧹 Cleaning up..."

  # Restore original source file
  if [[ -f "$BACKUP_FILE" ]]; then
    mv "$BACKUP_FILE" "$HOOK_FILE"
    echo "   Restored original $HOOK_FILE"
  fi

  # Kill background processes
  if [[ -n "$SERVER_PID" ]]; then
    kill "$SERVER_PID" 2>/dev/null && echo "   Stopped backend server (PID $SERVER_PID)" || true
  fi
  if [[ -n "$TUNNEL_PID" ]]; then
    kill "$TUNNEL_PID" 2>/dev/null && echo "   Stopped cloudflared tunnel (PID $TUNNEL_PID)" || true
  fi
}

trap cleanup EXIT

# ─── Step 1: Start backend server ────────────────────────────────────────────
echo "🚀 Step 1: Starting backend server..."
(cd server && pnpm dev) &
SERVER_PID=$!
echo "   Backend server started (PID $SERVER_PID)"

# Give the server a moment to start
sleep 3

# Check that the server is still running
if ! kill -0 "$SERVER_PID" 2>/dev/null; then
  echo "❌ Backend server failed to start. Aborting."
  exit 1
fi

# ─── Step 2: Start Cloudflare Tunnel ─────────────────────────────────────────
echo "🌐 Step 2: Starting Cloudflare Tunnel..."

TUNNEL_LOG=$(mktemp)
cloudflared tunnel --url http://localhost:3000 >"$TUNNEL_LOG" 2>&1 &
TUNNEL_PID=$!

echo "   Waiting for tunnel URL..."

TUNNEL_URL=""
for i in $(seq 1 60); do
  # cloudflared prints the URL to stdout or stderr; grep with extended regex for portability
  TUNNEL_URL=$(grep -oE 'https://[a-zA-Z0-9-]+\.trycloudflare\.com' "$TUNNEL_LOG" | head -1 || true)
  if [[ -n "$TUNNEL_URL" ]]; then
    break
  fi
  sleep 1
done

rm -f "$TUNNEL_LOG"

if [[ -z "$TUNNEL_URL" ]]; then
  echo "❌ Failed to obtain tunnel URL after 60 seconds. Aborting."
  exit 1
fi

# Strip the https:// prefix for the source code constant
TUNNEL_HOST="${TUNNEL_URL#https://}"

echo "   Tunnel URL: $TUNNEL_URL"
echo "   Tunnel host: $TUNNEL_HOST"

# ─── Step 3: Patch tunnel URL into frontend source ───────────────────────────
echo "📝 Step 3: Patching tunnel URL into $HOOK_FILE..."

cp "$HOOK_FILE" "$BACKUP_FILE"

# Replace the tunnelUrl constant value
sed -i "s|const tunnelUrl = '.*';|const tunnelUrl = '${TUNNEL_HOST}';|" "$HOOK_FILE"

echo "   Patched tunnelUrl = '${TUNNEL_HOST}'"

# ─── Step 4: Build frontend ──────────────────────────────────────────────────
echo "🔨 Step 4: Building frontend..."
pnpm build
echo "   Build complete."

# ─── Step 5: Deploy to Cloudflare Pages ──────────────────────────────────────
echo "☁️  Step 5: Deploying to Cloudflare Pages..."
wrangler pages deploy dist --project-name=mahjong
echo "   Deploy complete!"

# ─── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo "============================================="
echo "✅ Deployment successful!"
echo ""
echo "Backend tunnel:  $TUNNEL_URL"
echo ""
echo "Share the Cloudflare Pages URL above with"
echo "your friends to play online! 🀄"
echo "============================================="
echo ""
echo "Press Ctrl+C to stop the server and tunnel."

# Keep the script alive so the server & tunnel stay running
wait
