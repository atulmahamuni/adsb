#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/adsb}"
BACKEND_SERVICE="${BACKEND_SERVICE:-adsb-backend}"

echo "Updating ADSB app in ${APP_DIR}"

cd "${APP_DIR}"

echo "Pulling latest code..."
git pull --ff-only

echo "Installing backend dependencies..."
cd "${APP_DIR}/backend"
npm install

echo "Installing frontend dependencies..."
cd "${APP_DIR}/frontend"
npm install

echo "Building frontend..."
npm run build

echo "Restarting backend service..."
if systemctl list-unit-files "${BACKEND_SERVICE}.service" >/dev/null 2>&1; then
  sudo systemctl restart "${BACKEND_SERVICE}"
else
  echo "Warning: ${BACKEND_SERVICE}.service was not found. Start the backend manually with:"
  echo "  cd ${APP_DIR}/backend && node server.js"
fi

echo "Reloading NGINX..."
if systemctl list-unit-files nginx.service >/dev/null 2>&1; then
  sudo nginx -t
  sudo systemctl reload nginx
else
  echo "Warning: nginx.service was not found."
fi

echo "Done."
