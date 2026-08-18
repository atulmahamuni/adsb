const express = require("express");

const app = express();

const PORT = 3000;

const DEFAULT_LAT = 47.43779305941157;
const DEFAULT_LON = -122.2944064159777;

const RADIUS_NM = 5;
const REFRESH_INTERVAL_MS = 15000;


// ------------------------------------------------------------
// Allow JSON request bodies
// ------------------------------------------------------------

app.use(express.json());


// ------------------------------------------------------------
// Current state
// ------------------------------------------------------------

let currentLocation = {
  lat: DEFAULT_LAT,
  lon: DEFAULT_LON,
};

let aircraft = [];
let lastUpdated = null;


// ------------------------------------------------------------
// Validate latitude / longitude
// ------------------------------------------------------------

function validateLatLon(lat, lon) {
  if (
    typeof lat !== "number" ||
    typeof lon !== "number" ||
    Number.isNaN(lat) ||
    Number.isNaN(lon) ||
    lat < -90 ||
    lat > 90 ||
    lon < -180 ||
    lon > 180
  ) {
    return false;
  }

  return true;
}


// ------------------------------------------------------------
// Geocode postal address to latitude / longitude
// ------------------------------------------------------------

async function geocodeAddress(addressText) {
  const rawAddress =
    typeof addressText === "string"
      ? addressText.trim()
      : "";

  if (!rawAddress) {
    throw new Error("Address text is required");
  }

  const encodedAddress =
    encodeURIComponent(rawAddress);

  const url =
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodedAddress}`;

  const response = await fetch(url, {
    headers: {
      "Accept-Language": "en",
      "User-Agent": "adsb1-server/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Geocoding failed: HTTP ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  const result = Array.isArray(data) ? data[0] : null;

  if (!result) {
    throw new Error("No GPS coordinates found for that address");
  }

  const lat = Number(result.lat);
  const lon = Number(result.lon);

  if (!validateLatLon(lat, lon)) {
    throw new Error("Address resolved to invalid GPS coordinates");
  }

  return {
    lat,
    lon,
    displayName: result.display_name || rawAddress,
  };
}


// ------------------------------------------------------------
// Get nearby aircraft from ADSB.lol
// ------------------------------------------------------------

async function getNearbyAircraft(lat, lon) {
  const url =
    `https://api.adsb.lol/v2/point/${lat}/${lon}/${RADIUS_NM}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `ADSB.lol failed: HTTP ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();

  return data.ac ?? [];
}


// ------------------------------------------------------------
// Get route from ADSBDB
// ------------------------------------------------------------

async function getRoute(callsign) {
  if (!callsign) {
    return null;
  }

  const cleanCallsign = callsign.trim();

  if (!cleanCallsign) {
    return null;
  }

  const url =
    `https://api.adsbdb.com/v0/callsign/${encodeURIComponent(cleanCallsign)}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    return data?.response?.flightroute ?? null;

  } catch (error) {
    console.error(
      `Route lookup failed for ${cleanCallsign}:`,
      error.message
    );

    return null;
  }
}


// ------------------------------------------------------------
// Choose useful airport code
// ------------------------------------------------------------

function airportCode(airport) {
  if (!airport) {
    return "?";
  }

  return (
    airport.iata_code ||
    airport.icao_code ||
    "?"
  );
}


// ------------------------------------------------------------
// Refresh aircraft
// ------------------------------------------------------------

async function refreshAircraft() {
  const { lat, lon } = currentLocation;

  console.log(
    `Refreshing aircraft around ${lat}, ${lon}...`
  );

  let nearby =
    await getNearbyAircraft(
      lat,
      lon
    );

  nearby = nearby.filter(
    ac =>
      ac.flight &&
      ac.lat !== undefined &&
      ac.lon !== undefined &&
      ac.alt_baro !== "ground"
  );

  console.log(
    `Found ${nearby.length} aircraft after filtering`
  );

  const results = [];

  for (const ac of nearby) {

    const callsign =
      typeof ac.flight === "string"
        ? ac.flight.trim()
        : "";

    const route =
      callsign
        ? await getRoute(callsign)
        : null;

    results.push({

      callsign:
        callsign || "-",

      registration:
        ac.r || "-",

      type:
        ac.t || "-",

      altitude:
        ac.alt_baro ?? "-",

      speed:
        ac.gs ?? "-",

      track:
        ac.track ?? "-",

      lat:
        ac.lat,

      lon:
        ac.lon,

      from:
        airportCode(route?.origin),

      to:
        airportCode(route?.destination),

    });
  }

  aircraft = results;

  lastUpdated = new Date();

  console.log(
    `Updated ${aircraft.length} aircraft`
  );
}


// ============================================================
// API
// ============================================================


// ------------------------------------------------------------
// Get current aircraft
// ------------------------------------------------------------

app.get("/api/aircraft", (req, res) => {

  res.json({

    location: currentLocation,

    radiusNm: RADIUS_NM,

    lastUpdated,

    aircraft,

  });

});


// ------------------------------------------------------------
// Get one aircraft by index
// ------------------------------------------------------------

app.get("/api/aircraft/:index", (req, res) => {

  if (aircraft.length === 0) {
    return res.status(404).json({
      error: "No aircraft available",
    });
  }

  const index =
    Number(req.params.index) %
    aircraft.length;

  res.json(aircraft[index]);

});


// ------------------------------------------------------------
// Get current location
// ------------------------------------------------------------

app.get("/api/location", (req, res) => {

  res.json({
    lat: currentLocation.lat,
    lon: currentLocation.lon,
    radiusNm: RADIUS_NM,
  });

});


// ------------------------------------------------------------
// Set current location
// ------------------------------------------------------------

app.post("/api/location", async (req, res) => {

  const lat =
    Number(
      req.body.lat ??
      req.body.latitude
    );

  const lon =
    Number(
      req.body.lon ??
      req.body.longitude
    );


  if (!validateLatLon(lat, lon)) {

    return res.status(400).json({
      error: "Invalid latitude or longitude",

      expected: {
        lat: "number between -90 and 90",
        lon: "number between -180 and 180",
      },

      example: {
        lat: DEFAULT_LAT,
        lon: DEFAULT_LON,
      },
    });

  }


  currentLocation = {
    lat,
    lon,
  };


  console.log(
    `Location changed to ${lat}, ${lon}`
  );


  try {

    // Immediately reload aircraft at the new location.
    await refreshAircraft();

  } catch (error) {

    console.error(
      "Refresh after location change failed:",
      error.message
    );

    return res.status(502).json({

      error:
        "Location updated, but aircraft refresh failed",

      location:
        currentLocation,

      details:
        error.message,

    });

  }


  res.json({

    success: true,

    location:
      currentLocation,

    aircraftCount:
      aircraft.length,

    lastUpdated,

  });

});


// ------------------------------------------------------------
// Set current location from a postal address
// ------------------------------------------------------------

app.post("/api/location/address", async (req, res) => {

  const address =
    req.body.address ??
    req.body.postalAddress ??
    req.body.text;

  if (!address || !String(address).trim()) {
    return res.status(400).json({
      error: "Address text is required",
      example: {
        address: "1600 Amphitheatre Parkway, Mountain View, CA",
      },
    });
  }

  try {
    const geocodedLocation =
      await geocodeAddress(address);

    currentLocation = {
      lat: geocodedLocation.lat,
      lon: geocodedLocation.lon,
    };

    console.log(
      `Location changed via address to ${geocodedLocation.lat}, ${geocodedLocation.lon} for "${address}"`
    );

    await refreshAircraft();

    return res.json({
      success: true,
      address,
      geocoded: {
        displayName: geocodedLocation.displayName,
        lat: geocodedLocation.lat,
        lon: geocodedLocation.lon,
      },
      location: currentLocation,
      aircraftCount: aircraft.length,
      lastUpdated,
    });

  } catch (error) {
    console.error(
      "Address geocoding failed:",
      error.message
    );

    return res.status(400).json({
      error: "Unable to resolve the supplied address to GPS coordinates",
      details: error.message,
      received: String(address),
    });
  }

});


// ------------------------------------------------------------
// Reset back to default location
// ------------------------------------------------------------

app.post("/api/location/reset", async (req, res) => {

  currentLocation = {
    lat: DEFAULT_LAT,
    lon: DEFAULT_LON,
  };


  try {

    await refreshAircraft();

  } catch (error) {

    return res.status(502).json({

      error:
        "Default location restored, but aircraft refresh failed",

      location:
        currentLocation,

      details:
        error.message,

    });

  }


  res.json({

    success: true,

    location:
      currentLocation,

    aircraftCount:
      aircraft.length,

  });

});


// ============================================================
// Start server
// ============================================================

async function start() {

  await refreshAircraft();


  setInterval(() => {

    refreshAircraft()
      .catch(error => {

        console.error(
          "Refresh failed:",
          error.message
        );

      });

  }, REFRESH_INTERVAL_MS);


  app.listen(PORT, () => {

    console.log(
      `Aircraft server running at http://localhost:${PORT}`
    );

    console.log(
      `Current location: ${currentLocation.lat}, ${currentLocation.lon}`
    );

  });
}


start().catch(error => {

  console.error(
    "Startup error:",
    error.message
  );

  process.exit(1);

});