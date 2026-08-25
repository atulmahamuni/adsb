import { useEffect, useRef, useState } from "react";
import "./App.css";

const locationPresets = [
  { id: "ksea", label: "KSEA", city: "Seattle", lat: 47.4502, lon: -122.3088 },
  { id: "ksfo", label: "KSFO", city: "San Francisco", lat: 37.6216, lon: -122.3818 },
  { id: "kjfk", label: "KJFK", city: "New York", lat: 40.6413, lon: -73.7781 },
  { id: "kord", label: "KORD", city: "Chicago", lat: 41.9742, lon: -87.9073 },
  { id: "kden", label: "KDEN", city: "Denver", lat: 39.8561, lon: -104.6737 },
  { id: "kphx", label: "KPHX", city: "Phoenix", lat: 33.4351, lon: -112.0101 },
  { id: "home", label: "Home", city: "Sammamish", address: "251st Pl SE, Sammamish, WA" },
];

export default function App() {
  const [aircraft, setAircraft] = useState([]);
  const [metar, setMetar] = useState(null);
  const [index, setIndex] = useState(0);
  const [screen, setScreen] = useState("main");
  const [isChangingLocation, setIsChangingLocation] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState("ksea");
  const [radiusNm, setRadiusNm] = useState(15);
  const [isSavingRadius, setIsSavingRadius] = useState(false);
  const savedRadiusRef = useRef(15);

  async function loadAircraft() {
    try {
      const res = await fetch("/api/aircraft");
      const data = await res.json();

      setAircraft(data.aircraft || []);
      setMetar(data.metar || null);

      if (data.radiusNm) {
        setRadiusNm(data.radiusNm);
        savedRadiusRef.current = data.radiusNm;
      }

      if (data.location) {
        const locationMatch = locationPresets.find((option) => {
          if (option.address) {
            return data.location.lat === undefined || data.location.lon === undefined
              ? false
              : false;
          }

          return (
            Math.abs((data.location.lat ?? 0) - (option.lat ?? 0)) < 0.0001 &&
            Math.abs((data.location.lon ?? 0) - (option.lon ?? 0)) < 0.0001
          );
        });

        if (locationMatch) {
          setSelectedLocationId(locationMatch.id);
        }
      }
    } catch (err) {
      console.error("Failed to load aircraft:", err);
    }
  }

  async function applyLocationSelection(option) {
    try {
      setIsChangingLocation(true);

      const payload = option.address
        ? { address: option.address }
        : { lat: option.lat, lon: option.lon };

      const endpoint = option.address ? "/api/location/address" : "/api/location";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to update location");
      }

      setSelectedLocationId(option.id);
      await loadAircraft();
      setScreen("main");
    } catch (err) {
      console.error("Location update failed:", err);
    } finally {
      setIsChangingLocation(false);
    }
  }

  async function saveRadiusChange(newRadius) {
    if (newRadius === savedRadiusRef.current) {
      return;
    }

    try {
      setIsSavingRadius(true);
      const res = await fetch("/api/radius", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ radiusNm: newRadius }),
      });

      if (res.ok) {
        savedRadiusRef.current = newRadius;
        setRadiusNm(newRadius);
        await loadAircraft();
      }
    } catch (err) {
      console.error("Radius update failed:", err);
    } finally {
      setIsSavingRadius(false);
    }
  }

  useEffect(() => {
    loadAircraft();

    const refreshTimer = setInterval(loadAircraft, 15000);

    return () => clearInterval(refreshTimer);
  }, []);

  useEffect(() => {
    if (aircraft.length === 0) {
      return;
    }

    const rotateTimer = setInterval(() => {
      setIndex((prev) => (prev + 1) % aircraft.length);
    }, 5000);

    return () => clearInterval(rotateTimer);
  }, [aircraft]);

  if (screen === "locations") {
    return (
      <div className="preview">
        <div className="screen">
          <div className="matrix-overlay" />

          <div className="location-screen">
            <div className="location-header">
              <button
                className="nav-button"
                onClick={() => setScreen("main")}
                type="button"
              >
                ← Main
              </button>

              <div className="location-title">Locations</div>
            </div>

            <div className="radius-panel">
              <label className="setting-label" htmlFor="radius-slider">
                Detection Radius: {radiusNm} NM
              </label>

              <div className="radius-slider-wrap">
                <input
                  id="radius-slider"
                  type="range"
                  min="5"
                  max="50"
                  step="5"
                  value={radiusNm}
                  onChange={(e) => setRadiusNm(Number(e.target.value))}
                  onPointerUp={(e) => saveRadiusChange(Number(e.currentTarget.value))}
                  onKeyUp={(e) => saveRadiusChange(Number(e.currentTarget.value))}
                  onBlur={(e) => saveRadiusChange(Number(e.currentTarget.value))}
                  className="radius-slider"
                  aria-busy={isSavingRadius}
                />

                <div className="radius-ticks" aria-hidden="true">
                  {Array.from({ length: 10 }, (_, index) => (
                    <span key={index} />
                  ))}
                </div>
              </div>

              <div className="slider-labels">
                <span>5 NM</span>
                <span>50 NM</span>
              </div>
            </div>

            <div className="location-grid">
              {locationPresets.map((option) => {
                const isCurrent = selectedLocationId === option.id;

                return (
                  <button
                    key={option.id}
                    className={`location-card${isCurrent ? " is-current" : ""}`}
                    type="button"
                    disabled={isChangingLocation}
                    onClick={() => applyLocationSelection(option)}
                  >
                    <div className="location-card-top">
                      <div className="location-icon">{option.address ? "⌂" : "✈"}</div>
                      {isCurrent && <span className="location-current-indicator">●</span>}
                    </div>
                    <div className="location-name">{option.label}</div>
                    <div className="location-city">{option.city}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (aircraft.length === 0) {
    return (
      <div className="preview">
        <div className="screen">
          <div className="matrix-overlay" />

          <button
            className="gear-button"
            type="button"
            aria-label="Open settings"
            onClick={() => setScreen("locations")}
          >
            ⚙
          </button>

          <div className="loading">
            SCANNING...
          </div>
        </div>
      </div>
    );
  }

  const ac = aircraft[index % aircraft.length];

  const carrier = getCarrierInfo(ac.callsign);
  const metarText = metar && metar.rawText
    ? metar.rawText
    : "METAR UNAVAILABLE";

  return (
    <div className="preview">
      <div className="screen">
        <div className="matrix-overlay" />

        <button
          className="gear-button"
          type="button"
          aria-label="Open settings"
          onClick={() => setScreen("locations")}
        >
          ⚙
        </button>

        <div className="content">

          <div className="top-row">

            <div className="logo-panel">
              <img
                className="carrier-logo"
                src={carrier.logo}
                alt={carrier.name}
              />
            </div>

            <div className="identity">

              <div className="callsign">
                {ac.callsign}
              </div>

              <div className="carrier-name">
                {carrier.name}
              </div>

              <div className="route">
                {ac.from} → {ac.to}
              </div>

              <div className="type">
                {ac.type} &nbsp; {ac.registration}
              </div>

            </div>

          </div>

          {metar && (
            <div className="metar-strip" aria-live="polite">
              <div className="metar-track">
                <span>{metarText}</span>
                <span>{metarText}</span>
                <span>{metarText}</span>
              </div>
            </div>
          )}

          <div className="stats">

            <div>
              ALT: {formatAltitude(ac.altitude)}
            </div>

            <div>
              SPD: {formatSpeed(ac.speed)}
            </div>

            <div>
              TRK: {formatTrack(ac.track)}
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}


function formatTrack(track) {
  if (
    track === null ||
    track === undefined ||
    track === "-"
  ) {
    return "---";
  }

  return `${Math.round(Number(track))
    .toString()
    .padStart(3, "0")}°`;
}


function formatAltitude(altitude) {
  if (
    altitude === null ||
    altitude === undefined ||
    altitude === "-"
  ) {
    return "---";
  }

  if (typeof altitude === "number") {
    return `${altitude.toLocaleString()} ft`;
  }

  return `${altitude} ft`;
}


function formatSpeed(speed) {
  if (
    speed === null ||
    speed === undefined ||
    speed === "-"
  ) {
    return "---";
  }

  return `${Math.round(Number(speed))} kt`;
}


function getCarrierInfo(callsign = "") {
  const clean = callsign.trim().toUpperCase();

  const prefix = clean.slice(0, 3);

  const carriers = {

    UAL: {
      name: "UNITED",
      logo: "/logos/united.png",
    },

    DAL: {
      name: "DELTA",
      logo: "/logos/delta.webp",
    },

    SWA: {
      name: "SOUTHWEST",
      logo: "/logos/southwest.webp",
    },

    ASA: {
      name: "ALASKA",
      logo: "/logos/alaska.jpg",
    },
    AAL: {
      name: "AMERICAN",
      logo: "/logos/american.jpeg",
    },
    SKW: {
      name: "SKYWEST",
      logo: "/logos/skywest.webp",
    },
    BAW: {
      name: "BRITISH AIRWAYS",
      logo: "/logos/british.jpg",
    },

    THY: {
      name: "TURKISH",
      logo: "/logos/turkish.jpg",
    },

    AFR: {
      name: "AIR FRANCE",
      logo: "/logos/airfrance.jpg",
    },

    SIA: {
      name: "SINGAPORE",
      logo: "/logos/singapore.jpg",
    },

    DLH: {
      name: "LUFTHANSA",
      logo: "/logos/lufthansa.jpg",
    },

    JBU: {
      name: "JETBLUE",
      logo: "/logos/jetblue.jpg",
    },

    UAE: {
      name: "EMIRATES",
      logo: "/logos/emirates.jpg",
    },

    HAL: {
      name: "HAWAIIAN",
      logo: "/logos/hawaiian.jpg",
    },

    FFT: {
      name: "FRONTIER",
      logo: "/logos/frontier.png",
    },

  };

  return (
    carriers[prefix] || {
      name: "GENERAL AVIATION",
      logo: "/logos/generic-plane.png",
    }
  );
}
