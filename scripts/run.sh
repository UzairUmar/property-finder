#!/bin/zsh
# Entry point for launchd. Keeps PATH explicit because launchd does not load shell profiles.
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
cd "$(dirname "$0")/.." || exit 1
mkdir -p logs
exec node node_modules/.bin/tsx src/jobs/scrape.ts "$@"
