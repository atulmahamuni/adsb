#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/adsb}"
BACKEND_PORT="${BACKEND_PORT:-3000}"
FRONTEND_HOST="${FRONTEND_HOST:-0.0.0.0}"
FRONTEND_PORT="${FRONTEND_PORT:-4173}"

if ! command -v node >/dev/null 2>&1; then
  echo "node is not installed."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is not installed."
  exit 1
fi

if [ ! -d "${APP_DIR}/backend" ] || [ ! -d "${APP_DIR}/frontend" ]; then
  echo "Could not find backend/ and frontend/ under ${APP_DIR}"
  exit 1
fi

cleanup() {
  if [ -n "${BACKEND_PID:-}" ] && kill -0 "${BACKEND_PID}" >/dev/null 2>&1; then
    echo ""
    echo "Stopping backend..."
    kill "${BACKEND_PID}" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT INT TERM

echo "Starting backend on port ${BACKEND_PORT}..."
cd "${APP_DIR}/backend"
node server.js &
BACKEND_PID="$!"

echo "Waiting for backend..."
for attempt in {1..30}; do
  if curl -fsS "http://127.0.0.1:${BACKEND_PORT}/api/aircraft" >/dev/null 2>&1; then
    echo "Backend is ready."
    break
  fi

  if ! kill -0 "${BACKEND_PID}" >/dev/null 2>&1; then
    echo "Backend exited before it became ready."
    exit 1
  fi

  if [ "${attempt}" -eq 30 ]; then
    echo "Backend did not become ready in time."
    exit 1
  fi

  sleep 1
done

echo "Starting frontend on http://${FRONTEND_HOST}:${FRONTEND_PORT}"
cd "${APP_DIR}/frontend"
npm run preview -- --host "${FRONTEND_HOST}" --port "${FRONTEND_PORT}"
