# ADSB

A Raspberry Pi display app for nearby aircraft. The frontend is a Vite/React app, and the backend is an Express server that fetches aircraft, route, location, and METAR data.

## Project Structure

```text
backend/   Express API server
frontend/  Vite React frontend
```

## Local Development

Install backend dependencies:

```bash
cd backend
npm install
node server.js
```

In another terminal, run the frontend:

```bash
cd frontend
npm install
npm run dev
```

The Vite dev server proxies `/api` requests to the backend on `http://localhost:3000`.

## Frontend Build

```bash
cd frontend
npm run build
```

The production frontend is written to:

```text
frontend/dist
```

## Raspberry Pi Deployment

Recommended simple deployment:

- Clone this repo onto the Pi.
- Run the backend with `systemd`.
- Serve `frontend/dist` with NGINX.
- Update with `git pull`, rebuild the frontend, and restart the backend.

Example update flow:

```bash
cd /opt/adsb
git pull

cd backend
npm install

cd ../frontend
npm install
npm run build

sudo systemctl restart adsb-backend
sudo systemctl reload nginx
```

## API

The frontend uses these backend endpoints:

- `GET /api/aircraft`
- `GET /api/metar`
- `GET /api/location`
- `POST /api/location`
- `POST /api/location/address`
- `POST /api/location/reset`
- `POST /api/radius`

