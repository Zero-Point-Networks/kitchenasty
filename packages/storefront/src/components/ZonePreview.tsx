import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Polygon, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface Address {
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  zip: string;
}

interface Zone {
  id: string;
  name: string;
  charge: number;
  minOrder: number;
  boundaries: [number, number][] | null;
  cutoffTime: string | null;
  etaMinutes: number | null;
  isActive: boolean;
}

interface Location {
  id: string;
  lat: number | null;
  lng: number | null;
  isActive: boolean;
}

interface Coords {
  lat: number;
  lng: number;
  display: string;
}

interface Props {
  address: Address;
  onLatLng?: (lat: number, lng: number) => void;
  onMatch?: (zone: Zone | null) => void;
}

type State =
  | { kind: 'idle' }
  | { kind: 'too-short' }
  | { kind: 'geocoding' }
  | { kind: 'geocode-failed' }
  | { kind: 'checking'; coords: Coords }
  | { kind: 'matched'; coords: Coords; zone: Zone; location: Location }
  | { kind: 'unmatched'; coords: Coords; location: Location };

/**
 * Address-aware delivery preview. Watches the checkout address fields, calls
 * Nominatim to geocode (debounced), then hits the public zone-check endpoint
 * to find the matching polygon. When matched, renders a "stamp" with the
 * zone's fee/ETA/cutoff and a mini OSM map showing the customer's pin
 * sitting inside the saffron-coloured polygon.
 *
 * Nominatim is free and key-less, with a soft 1 req/sec rate limit. Demo
 * usage is well within that.
 */
export default function ZonePreview({ address, onLatLng, onMatch }: Props) {
  const [state, setState] = useState<State>({ kind: 'idle' });
  const lastQueryRef = useRef('');
  // Keep the latest callbacks in a ref so changing them doesn't retrigger the
  // geocode/zone-check effect (which would abort the in-flight request and
  // strand the UI in 'checking').
  const cbRef = useRef({ onLatLng, onMatch });
  useEffect(() => {
    cbRef.current = { onLatLng, onMatch };
  }, [onLatLng, onMatch]);

  // Build a stable query key from the address fields.
  const query = useMemo(() => {
    const parts = [address.line1, address.city, address.zip, 'Germany']
      .map((p) => (p || '').trim())
      .filter(Boolean);
    return parts.join(', ');
  }, [address.line1, address.city, address.zip]);

  useEffect(() => {
    // Need at least street + city to bother geocoding.
    if (!address.line1.trim() || !address.city.trim()) {
      setState({ kind: 'too-short' });
      return;
    }

    if (query === lastQueryRef.current) return;
    lastQueryRef.current = query;

    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setState({ kind: 'geocoding' });
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
        const res = await fetch(url, {
          signal: ctrl.signal,
          headers: { Accept: 'application/json' },
        });
        const data = await res.json();
        if (!data.length) {
          setState({ kind: 'geocode-failed' });
          cbRef.current.onMatch?.(null);
          return;
        }
        const coords: Coords = {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
          display: data[0].display_name,
        };
        cbRef.current.onLatLng?.(coords.lat, coords.lng);
        setState({ kind: 'checking', coords });

        // Find the active location, then check the zone.
        const locRes = await fetch('/api/locations', { signal: ctrl.signal });
        const locJson = await locRes.json();
        const location: Location | undefined = locJson.data?.find((l: Location) => l.isActive) ?? locJson.data?.[0];
        if (!location) {
          setState({ kind: 'geocode-failed' });
          return;
        }

        const checkRes = await fetch(
          `/api/locations/${location.id}/delivery-zones/check?lat=${coords.lat}&lng=${coords.lng}`,
          { signal: ctrl.signal },
        );
        if (checkRes.status === 404) {
          setState({ kind: 'unmatched', coords, location });
          cbRef.current.onMatch?.(null);
          return;
        }
        const checkJson = await checkRes.json();
        if (checkJson.success && checkJson.data) {
          setState({ kind: 'matched', coords, zone: checkJson.data, location });
          cbRef.current.onMatch?.(checkJson.data);
        } else {
          setState({ kind: 'unmatched', coords, location });
          cbRef.current.onMatch?.(null);
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setState({ kind: 'geocode-failed' });
        }
      }
    }, 800);

    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query, address.line1, address.city]);

  if (state.kind === 'idle' || state.kind === 'too-short') {
    return (
      <div className="mt-4 border border-dashed border-tobacco/40 p-4 text-center">
        <p className="font-mono-tabular text-[10px] tracking-eyebrow uppercase text-ink-mute">
          Enter your street and city — we'll find your delivery zone.
        </p>
      </div>
    );
  }

  if (state.kind === 'geocoding' || state.kind === 'checking') {
    return (
      <div className="mt-4 border border-tobacco/40 bg-paper-100 p-4 text-center">
        <p className="font-mono-tabular text-[10px] tracking-eyebrow uppercase text-ink-mute animate-pulse">
          {state.kind === 'geocoding' ? 'Locating your address…' : 'Checking the catchment…'}
        </p>
      </div>
    );
  }

  if (state.kind === 'geocode-failed') {
    return (
      <div className="mt-4 border border-saffron/60 bg-paper-100 p-4">
        <p className="eyebrow text-saffron-deep">Address Not Found</p>
        <p className="font-editorial italic text-sm text-ink-soft mt-1">
          We couldn't pin that address. Try adding more detail — house number, postcode, or city.
        </p>
      </div>
    );
  }

  if (state.kind === 'unmatched') {
    return (
      <div className="mt-4">
        <ZoneMap
          coords={state.coords}
          location={state.location}
          zone={null}
          allZonesUrl={`/api/locations/${state.location.id}/delivery-zones`}
        />
        <div className="border border-ink bg-paper-100 p-4 mt-3">
          <p className="eyebrow text-ink">Outside Our Catchment</p>
          <p className="font-editorial italic text-sm text-ink-soft mt-1">
            We don't deliver to {state.coords.display.split(',').slice(0, 2).join(',')} yet. Reach out
            and we'll let you know when we expand.
          </p>
        </div>
      </div>
    );
  }

  if (state.kind === 'matched') {
    const { coords, zone, location } = state;
    return (
      <div className="mt-4">
        <ZoneMap
          coords={coords}
          location={location}
          zone={zone}
          allZonesUrl={`/api/locations/${location.id}/delivery-zones`}
        />
        <ZoneStamp zone={zone} />
      </div>
    );
  }

  return null;
}

function ZoneStamp({ zone }: { zone: Zone }) {
  return (
    <div className="mt-3 border-2 border-bottle bg-paper-50 p-5">
      <div className="flex items-center gap-3 mb-3">
        <span className="font-mono-tabular text-[10px] tracking-eyebrow uppercase text-bottle">
          ✓ Delivery Confirmed
        </span>
        <span className="block flex-1 h-px bg-bottle/30" />
        <span className="font-mono-tabular text-[10px] tracking-eyebrow uppercase text-ink-mute">
          Stamp
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Cell label="Zone" value={zone.name} accent />
        <Cell label="Fee" value={zone.charge === 0 ? 'Free' : `€${zone.charge.toFixed(2)}`} />
        <Cell label="Est. delivery" value={zone.etaMinutes ? `${zone.etaMinutes} min` : '—'} />
        <Cell label="Order by" value={zone.cutoffTime || '—'} mono />
      </div>

      {zone.minOrder > 0 && (
        <p className="font-editorial italic text-xs text-ink-soft mt-4">
          Minimum order for this zone: €{zone.minOrder.toFixed(2)}.
        </p>
      )}
    </div>
  );
}

function Cell({ label, value, accent, mono }: { label: string; value: string; accent?: boolean; mono?: boolean }) {
  return (
    <div>
      <span className="eyebrow">{label}</span>
      <p
        className={`mt-1 leading-tight ${
          mono ? 'font-mono-tabular text-lg' : 'font-display text-lg'
        } ${accent ? 'text-saffron' : 'text-ink'}`}
      >
        {value}
      </p>
    </div>
  );
}

interface ZoneMapProps {
  coords: Coords;
  location: Location;
  zone: Zone | null;
  allZonesUrl: string;
}

const ZONE_COLOURS = [
  { fill: '#c2410c', stroke: '#c2410c' },
  { fill: '#7c5e3c', stroke: '#7c5e3c' },
  { fill: '#1a1410', stroke: '#1a1410' },
];

function ZoneMap({ coords, location, zone, allZonesUrl }: ZoneMapProps) {
  const [zones, setZones] = useState<Zone[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(allZonesUrl);
        const json = await res.json();
        const list: Zone[] = (json.data ?? []).filter((z: Zone) => z.isActive && z.boundaries);
        // Outer-to-inner so saffron sits on top.
        list.sort((a, b) => polygonArea(b.boundaries) - polygonArea(a.boundaries));
        setZones(list);
      } catch {
        // map will still render with just the pin
      }
    })();
  }, [allZonesUrl]);

  const allPts = zones.flatMap((z) => z.boundaries || []);
  const bounds =
    allPts.length > 0
      ? L.latLngBounds([...allPts, [coords.lat, coords.lng]].map(([lat, lng]) => L.latLng(lat, lng)))
      : null;

  return (
    <div className="border border-tobacco/40" style={{ height: 280 }}>
      <MapContainer
        center={[coords.lat, coords.lng]}
        zoom={12}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap &copy; CARTO'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          subdomains={['a', 'b', 'c', 'd']}
          maxZoom={20}
        />

        {zones.map((z, i) => {
          if (!z.boundaries) return null;
          const isMatch = zone && z.id === zone.id;
          const c = ZONE_COLOURS[i % ZONE_COLOURS.length];
          return (
            <Polygon
              key={z.id}
              positions={z.boundaries as [number, number][]}
              pathOptions={{
                color: c.stroke,
                weight: isMatch ? 2.5 : 1,
                fillColor: c.fill,
                fillOpacity: isMatch ? 0.22 : 0.06,
              }}
            />
          );
        })}

        {/* Kitchen pin */}
        {location.lat != null && location.lng != null && (
          <CircleMarker
            center={[location.lat, location.lng]}
            radius={6}
            pathOptions={{ color: '#fbf7ee', weight: 2, fillColor: '#1a1410', fillOpacity: 1 }}
          >
            <Tooltip direction="right" offset={[8, 0]}>
              Moksha
            </Tooltip>
          </CircleMarker>
        )}

        {/* Customer pin — saffron */}
        <CircleMarker
          center={[coords.lat, coords.lng]}
          radius={9}
          pathOptions={{ color: '#fbf7ee', weight: 3, fillColor: '#c2410c', fillOpacity: 1 }}
        >
          <Tooltip permanent direction="top" offset={[0, -10]}>
            You
          </Tooltip>
        </CircleMarker>

        {bounds && <FitBounds bounds={bounds} />}
      </MapContainer>
    </div>
  );
}

function FitBounds({ bounds }: { bounds: L.LatLngBounds }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(bounds, { padding: [25, 25] });
  }, [map, bounds]);
  return null;
}

function polygonArea(polygon: [number, number][] | null): number {
  if (!polygon || polygon.length < 3) return 0;
  let area = 0;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    area += (polygon[i][1] + polygon[j][1]) * (polygon[i][0] - polygon[j][0]);
  }
  return Math.abs(area / 2);
}
