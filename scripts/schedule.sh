#!/bin/zsh
# Usage: scripts/schedule.sh install | uninstall | status | run-now
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LABEL="com.uzairumar.property-finder"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
DOMAIN="gui/$(id -u)"

case "$1" in
  install)
    mkdir -p "$HOME/Library/LaunchAgents" "$ROOT/logs"
    sed "s|__ROOT__|$ROOT|g" "$ROOT/launchd/$LABEL.plist.template" > "$PLIST"
    launchctl bootout "$DOMAIN" "$PLIST" 2>/dev/null || true
    launchctl bootstrap "$DOMAIN" "$PLIST"
    echo "Installed. Runs every 12h. Logs: $ROOT/logs/launchd.log"
    ;;
  uninstall)
    launchctl bootout "$DOMAIN" "$PLIST" 2>/dev/null || true
    rm -f "$PLIST"
    echo "Uninstalled."
    ;;
  status)
    launchctl print "$DOMAIN/$LABEL" 2>/dev/null | grep -E "state|last exit|runs|interval" || echo "Not installed."
    ;;
  run-now)
    launchctl kickstart "$DOMAIN/$LABEL"
    echo "Triggered. Tail logs with: tail -f $ROOT/logs/launchd.log"
    ;;
  *)
    echo "Usage: $0 install | uninstall | status | run-now"; exit 1
    ;;
esac
