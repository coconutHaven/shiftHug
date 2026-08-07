#!/bin/bash
# Double-click this file in Finder to start shiftHug (dev server + browser).
set -e
cd "$(dirname "$0")" || exit 1

if ! command -v node &>/dev/null; then
  osascript -e 'display dialog "Node.js was not found. Install Node.js from nodejs.org, then try again." buttons {"OK"} default button "OK" with icon stop' >/dev/null 2>&1 || true
  echo "Node.js is not installed or not in PATH."
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "Installing dependencies (first run)..."
  npm install --legacy-peer-deps
fi

echo ""
echo "Starting shiftHug..."
echo "  App: http://localhost:8080"
echo "  Stop: close this window or press Ctrl+C"
echo ""

# Open the app in your default browser after the dev server is up
(sleep 5 && open "http://localhost:8080" 2>/dev/null) &

npm run dev
