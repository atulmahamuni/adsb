import { useEffect, useState } from "react";
import "./App.css";

export default function App() {
  const [aircraft, setAircraft] = useState([]);
  const [index, setIndex] = useState(0);

  async function loadAircraft() {
    try {
      const res = await fetch("/api/aircraft");
      const data = await res.json();

      setAircraft(data.aircraft || []);
    } catch (err) {
      console.error("Failed to load aircraft:", err);
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

  if (aircraft.length === 0) {
    return (
      <div className="preview">
        <div className="screen">
          <div className="matrix-overlay" />

          <div className="loading">
            SCANNING...
          </div>
        </div>
      </div>
    );
  }

  const ac = aircraft[index % aircraft.length];

  const carrier = getCarrierInfo(ac.callsign);

  return (
    <div className="preview">
      <div className="screen">
        <div className="matrix-overlay" />

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