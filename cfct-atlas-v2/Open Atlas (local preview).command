#!/bin/bash
# CFCT Atlas v2 — local preview. The atlas is a website; double-clicking
# index.html (file://) shows a blank page. This serves the folder over HTTP.
cd "$(dirname "$0")" || exit 1
PORT=8000
while lsof -ti:$PORT >/dev/null 2>&1; do PORT=$((PORT+1)); done
URL="http://127.0.0.1:$PORT/index.html"
echo "Serving the CFCT Atlas at $URL"
echo "Leave this window open; close it (Ctrl-C) to stop."
( sleep 1; open "$URL" ) &
exec python3 -m http.server "$PORT"
