#!/usr/bin/env bash
# scripts/registry.sh — local Verdaccio registry helpers for the spike.
# Usage: scripts/registry.sh start | stop | status
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG="$ROOT/verdaccio/config.yaml"
LOG="/tmp/verdaccio.log"
case "${1:-}" in
  start)
    if curl -s -o /dev/null http://localhost:4873/; then echo "already running"; exit 0; fi
    npx verdaccio@6.7.2 --config "$CONFIG" > "$LOG" 2>&1 &
    for i in $(seq 1 20); do curl -s -o /dev/null http://localhost:4873/ && { echo "started"; exit 0; }; sleep 1; done
    echo "failed to start; see $LOG"; exit 1 ;;
  stop)
    pkill -f "verdaccio --config $CONFIG" && echo "stopped" || echo "not running" ;;
  status)
    curl -s -o /dev/null -w "verdaccio:%{http_code}\n" http://localhost:4873/ || echo "down" ;;
  *) echo "usage: scripts/registry.sh start|stop|status"; exit 2 ;;
esac
