#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/adsb}"
BACKEND_PORT="${BACKEND_PORT:-3000}"
FRONTEND_HOST="${FRONTEND_HOST:-0.0.0.0}"
FRONTEND_PORT="${FRONTEND_PORT:-4173}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:${FRONTEND_PORT}}"
CHROMIUM_BIN="${CHROMIUM_BIN:-}"

if ! command -v node >/dev/null 2>&1; then
  echo "node is not installed."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is not installed."
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is not installed."
  exit 1
fi

if [ ! -d "${APP_DIR}/backend" ] || [ ! -d "${APP_DIR}/frontend" ]; then
  echo "Could not find backend/ and frontend/ under ${APP_DIR}"
  exit 1
fi

find_chromium() {
  if [ -n "${CHROMIUM_BIN}" ]; then
    echo "${CHROMIUM_BIN}"
    return
  fi

  if command -v chromium-browser >/dev/null 2>&1; then
    command -v chromium-browser
    return
  fi

  if command -v chromium >/dev/null 2>&1; then
    command -v chromium
    return
  fi

  echo ""
}

cleanup() {
  echo ""
  echo "Stopping ADSB kiosk session..."

  if [ -n "${CHROMIUM_PID:-}" ] && kill -0 "${CHROMIUM_PID}" >/dev/null 2>&1; then
    kill "${CHROMIUM_PID}" >/dev/null 2>&1 || true
  fi

  if [ -n "${FRONTEND_PID:-}" ] && kill -0 "${FRONTEND_PID}" >/dev/null 2>&1; then
    kill "${FRONTEND_PID}" >/dev/null 2>&1 || true
  fi

  if [ -n "${BACKEND_PID:-}" ] && kill -0 "${BACKEND_PID}" >/dev/null 2>&1; then
    kill "${BACKEND_PID}" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT INT TERM

echo "Starting backend on port ${BACKEND_PORT}..."
cd "${APP_DIR}/backend"
ALLOW_APP_SHUTDOWN=true node server.js &
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

echo "Starting frontend on http://${FRONTEND_HOST}:${FRONTEND_PORT}..."
cd "${APP_DIR}/frontend"
npm run preview -- --host "${FRONTEND_HOST}" --port "${FRONTEND_PORT}" &
FRONTEND_PID="$!"

echo "Waiting for frontend..."
for attempt in {1..30}; do
  if curl -fsS "${FRONTEND_URL}" >/dev/null 2>&1; then
    echo "Frontend is ready."
    break
  fi

  if ! kill -0 "${FRONTEND_PID}" >/dev/null 2>&1; then
    echo "Frontend exited before it became ready."
    exit 1
  fi

  if [ "${attempt}" -eq 30 ]; then
    echo "Frontend did not become ready in time."
    exit 1
  fi

  sleep 1
done

CHROMIUM_PATH="$(find_chromium)"

if [ -z "${CHROMIUM_PATH}" ]; then
  echo "Chromium was not found. Open this URL manually:"
  echo "  ${FRONTEND_URL}"
else
  echo "Starting Chromium kiosk at ${FRONTEND_URL}..."
  "${CHROMIUM_PATH}" \
    --kiosk \
    --noerrdialogs \
    --disable-infobars \
    --disable-session-crashed-bubble \
    "${FRONTEND_URL}" &
  CHROMIUM_PID="$!"
fi

echo "ADSB kiosk is running."
echo "Use the Stop Session button in settings, or press Ctrl+C here."

while kill -0 "${BACKEND_PID}" >/dev/null 2>&1; do
  sleep 1
done

echo "Backend stopped."
