#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/adsb}"
BACKEND_SERVICE="${BACKEND_SERVICE:-adsb-backend}"

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is not installed."
  echo ""
  echo "Install Node.js/npm on Raspberry Pi OS or Debian with:"
  echo "  curl -fsSL https://deb.nodesource.com/setup_22.x -o nodesource_setup.sh"
  echo "  sudo -E bash nodesource_setup.sh"
  echo "  sudo apt install -y nodejs"
  echo ""
  echo "Then verify with:"
  echo "  node -v"
  echo "  npm -v"
  exit 1
fi

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
