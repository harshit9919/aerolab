#!/bin/sh
set -eu
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  AEROLAB_NODE_BIN="$(pwd)/../.tools/node-v22.20.0-darwin-arm64/bin"
  if [ ! -x "$AEROLAB_NODE_BIN/node" ]; then
    echo 'Install Node.js 22 or newer, then run npm ci and npm run dev.' >&2
    exit 1
  fi
  export PATH="$AEROLAB_NODE_BIN:$PATH"
fi
if [ ! -d node_modules ]; then npm ci; fi
exec npm run dev -- "$@"
