import { useEffect, useMemo, useRef } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

/**
 * Map of network access points.
 *
 * ── Why CircleMarker and not the default pin ────────────────────────────────
 *
 * Leaflet's default marker is a PNG loaded by URL, and bundlers famously break
 * that path — the well-known "markers are missing in production" bug, usually
 * patched by re-pointing `L.Icon.Default`. `CircleMarker` is drawn by Leaflet
 * itself, so there is no asset to lose, it takes theme tokens directly, and it
 * scales better than a pin when boxes cluster on one street.
 *
 * ── Colour carries capacity ─────────────────────────────────────────────────
 *
 * A technician looking at this map is asking "where can I connect someone?", so
 * fill answers that: green has room, amber is nearly full, red is full. Colour
 * is never the only signal — the popup states the numbers.
 */

const TAGUIG = [14.5176, 121.0509];

/** Fill by remaining capacity. Full is worth seeing at a glance. */
const capacityColor = (used, total) => {
  if (!total) return "var(--color-text-muted)";
  const free = total - used;
  if (free <= 0) return "var(--color-error)";
  if (free / total <= 0.2) return "var(--color-warning)";
  return "var(--color-success)";
};

/**
 * Fit the view to the markers whenever the set changes.
 *
 * A child component because `useMap` only works inside `MapContainer`, and
 * because `MapContainer`'s own props are read once at mount — passing a moving
 * `center` does nothing after the first render.
 */
const FitToMarkers = ({ points }) => {
  const map = useMap();
  const lastKey = useRef("");

  useEffect(() => {
    if (points.length === 0) return;

    // Refit only when the actual coordinates change, so panning around is not
    // yanked back on every unrelated re-render.
    const key = points.map((p) => `${p.lat},${p.lng}`).join("|");
    if (key === lastKey.current) return;
    lastKey.current = key;

    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 16);
      return;
    }

    map.fitBounds(
      points.map((p) => [p.lat, p.lng]),
      { padding: [40, 40], maxZoom: 17 },
    );
  }, [points, map]);

  return null;
};

/**
 * @param {Array} naps - rows from the NAPs endpoint; anything without usable
 *   coordinates is skipped rather than plotted at (0, 0) in the Gulf of Guinea.
 * @param {number} [height=460]
 * @param {(nap: Object) => void} [onSelect] - called when a popup's button is used
 */
const NetworkMap = ({ naps = [], height = 460, onSelect }) => {
  const points = useMemo(
    () =>
      naps
        .map((nap) => ({
          ...nap,
          lat: Number(nap.gpsLat),
          lng: Number(nap.gpsLng),
        }))
        .filter((nap) => Number.isFinite(nap.lat) && Number.isFinite(nap.lng)),
    [naps],
  );

  const skipped = naps.length - points.length;

  return (
    <div
      className="overflow-hidden relative"
      style={{
        border: "1px solid var(--color-line)",
        borderRadius: "var(--radius-card)",
      }}
    >
      <MapContainer
        center={points.length ? [points[0].lat, points[0].lng] : TAGUIG}
        zoom={points.length ? 15 : 12}
        scrollWheelZoom
        style={{ height, width: "100%", background: "var(--color-surface-sunken)" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />

        <FitToMarkers points={points} />

        {points.map((nap) => {
          const used = Number(nap.usedPorts) || 0;
          const total = Number(nap.totalPorts) || 0;
          const color = capacityColor(used, total);

          return (
            <CircleMarker
              key={nap.napId}
              center={[nap.lat, nap.lng]}
              radius={9}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: 0.75,
                weight: 2,
              }}
            >
              <Popup>
                <div style={{ minWidth: 180 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 2 }}>
                    {nap.label}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>
                    {nap.splitterLabel ? `Fed from ${nap.splitterLabel}` : "No splitter recorded"}
                  </div>
                  <div style={{ fontSize: 12.5, marginTop: 6 }}>
                    <strong>
                      {used} / {total}
                    </strong>{" "}
                    ports used
                    {total - used <= 0 ? " — full" : ""}
                  </div>
                  {nap.address && (
                    <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>{nap.address}</div>
                  )}
                  {onSelect && (
                    <button
                      type="button"
                      onClick={() => onSelect(nap)}
                      style={{
                        marginTop: 8,
                        fontSize: 12.5,
                        cursor: "pointer",
                        textDecoration: "underline",
                        background: "none",
                        border: "none",
                        padding: 0,
                      }}
                    >
                      Open details
                    </button>
                  )}
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* Legend and the skipped-rows notice sit outside the map pane so they
          are not swallowed by Leaflet's own z-index stack. */}
      <div
        className="flex items-center gap-4 flex-wrap px-4 py-2.5"
        style={{ borderTop: "1px solid var(--color-line)", background: "var(--color-surface)" }}
      >
        {[
          ["Has capacity", "var(--color-success)"],
          ["Nearly full", "var(--color-warning)"],
          ["Full", "var(--color-error)"],
        ].map(([label, color]) => (
          <span
            key={label}
            className="inline-flex items-center gap-1.5"
            style={{ fontSize: 12, color: "var(--color-text-muted)" }}
          >
            <span
              style={{ width: 8, height: 8, borderRadius: "50%", background: color }}
            />
            {label}
          </span>
        ))}

        {skipped > 0 && (
          <span className="ml-auto" style={{ fontSize: 12, color: "var(--color-warning)" }}>
            {skipped} NAP{skipped === 1 ? "" : "s"} not shown — no valid coordinates
          </span>
        )}
      </div>
    </div>
  );
};

export default NetworkMap;
