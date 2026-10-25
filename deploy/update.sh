#!/usr/bin/env bash
# Update the No Rules server from GitHub and restart it.
# Run as root on the production host: /opt/no-rules/update.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/no-rules/app}"
SERVICE="${SERVICE:-no-rules}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:8787/health}"
BUN="${BUN:-/usr/local/bin/bun}"

cd "$APP_DIR"
PREVIOUS="$(git rev-parse HEAD)"
echo "[update] current ${PREVIOUS}"

git fetch --prune origin
git pull --ff-only origin main

cd "$APP_DIR/server"
"$BUN" install --production --no-progress

systemctl restart "$SERVICE"

for _ in $(seq 1 20); do
  if curl -fsS --max-time 3 "$HEALTH_URL" >/dev/null 2>&1; then
    echo "[update] healthy at $(git -C "$APP_DIR" rev-parse --short HEAD)"
    exit 0
  fi
  sleep 1
done

echo "[update] health check failed, rolling back to ${PREVIOUS}" >&2
git -C "$APP_DIR" reset --hard "$PREVIOUS"
cd "$APP_DIR/server"
"$BUN" install --production --no-progress
systemctl restart "$SERVICE"
exit 1
