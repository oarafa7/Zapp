#!/usr/bin/env sh
set -eu

# Compatibility entrypoint for hosts that are configured to run ./start.sh.
# Railway normally uses `npm start` from railway.json, but this wrapper makes
# deployments resilient if the start command was manually set to start.sh.
if [ ! -f "dist/index.html" ]; then
  echo "dist/index.html not found; building Zapp frontend before start..."
  npm run build
fi

exec npm start
