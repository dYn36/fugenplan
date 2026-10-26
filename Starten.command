#!/bin/zsh
set -eu
cd -- "${0:A:h}"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v npm >/dev/null 2>&1; then
  printf 'Node.js fehlt. Installiere Node.js 24 und starte diese Datei erneut.\n'
  read -r '?Zum Schließen Enter drücken.'
  exit 1
fi
if [[ ! -d node_modules ]]; then
  npm ci
fi
# Open an already running instance without starting a second server.
if command -v curl >/dev/null 2>&1 && [[ "$(curl --max-time 2 --silent http://127.0.0.1:5173/fugenplan.txt 2>/dev/null || true)" == 'fugenplan-local-v1' ]]; then
  open 'http://127.0.0.1:5173'
  exit 0
fi
printf 'Fugenplan startet. Lass dieses Fenster während der Nutzung geöffnet.\n'
npm start
