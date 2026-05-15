import { useState, useEffect, FormEvent, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { MapContainer, TileLayer, Polygon, CircleMarker, Tooltip, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '../lib/api.js';

interface DeliveryZone {
  id: string;
  name: string;
  charge: number;
  minOrder: number;
  boundaries: [number, number][] | null;
  isActive: boolean;
  cutoffTime: string | null;
  etaMinutes: number | null;
}

interface LocationInfo {
  lat: number | null;
  lng: number | null;
  name?: string;
  city?: string;
}

/**
 * Delivery Zone editor — editorial-styled admin surface with a polygon map
 * preview, a slide-down form for new zones, and a tabular list of existing
 * zones. The map renders the polygons centred on the location's pin and
 * annotates each ring with its cutoff and ETA.
 */
export default function DeliveryZoneList() {
  const { locationId } = useParams<{ locationId: string }>();
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [location, setLocation] = useState<LocationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // New zone form
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [charge, setCharge] = useState('0');
  const [minOrder, setMinOrder] = useState('0');
  const [boundariesJson, setBoundariesJson] = useState('');
  const [cutoffTime, setCutoffTime] = useState('');
  const [etaMinutes, setEtaMinutes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!locationId) return;
    Promise.all([
      api.get<{ data: DeliveryZone[] }>(`/locations/${locationId}/delivery-zones`),
      api.get<{ data: LocationInfo }>(`/locations/${locationId}`),
    ])
      .then(([zonesRes, locRes]) => {
        setZones(zonesRes.data);
        setLocation(locRes.data);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [locationId]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      let boundaries = null;
      if (boundariesJson.trim()) {
        try {
          boundaries = JSON.parse(boundariesJson);
        } catch {
          setError('Invalid JSON for boundaries');
          setSaving(false);
          return;
        }
      }

      const res = await api.post<{ data: DeliveryZone }>(`/locations/${locationId}/delivery-zones`, {
        name,
        charge: parseFloat(charge) || 0,
        minOrder: parseFloat(minOrder) || 0,
        boundaries,
        cutoffTime: cutoffTime || null,
        etaMinutes: etaMinutes ? parseInt(etaMinutes, 10) : null,
      });

      setZones((prev) => [...prev, res.data]);
      setShowForm(false);
      setName('');
      setCharge('0');
      setMinOrder('0');
      setBoundariesJson('');
      setCutoffTime('');
      setEtaMinutes('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (zone: DeliveryZone) => {
    try {
      await api.patch(`/locations/${locationId}/delivery-zones/${zone.id}`, {
        isActive: !zone.isActive,
      });
      setZones((prev) =>
        prev.map((z) => z.id === zone.id ? { ...z, isActive: !z.isActive } : z)
      );
    } catch (err: any) {
      setError(err.message);
    }
  };

  const deleteZone = async (id: string) => {
    if (!confirm('Delete this delivery zone?')) return;
    try {
      await api.delete(`/locations/${locationId}/delivery-zones/${id}`);
      setZones((prev) => prev.filter((z) => z.id !== id));
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Sort by area ascending so the inner zone draws on top of the outer ones.
  const sortedZones = useMemo(
    () => [...zones].sort((a, b) => polygonArea(b.boundaries) - polygonArea(a.boundaries)),
    [zones],
  );

  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-10 py-8 lg:py-10">
      {/* Editorial header */}
      <header className="mb-8">
        <div className="flex items-center gap-3">
          <span className="block h-px w-10 bg-saffron" />
          <span className="eyebrow text-saffron">Operations · Catchment</span>
        </div>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <h1 className="font-display text-4xl text-ink leading-tight">Delivery Catchment</h1>
          <button
            onClick={() => setShowForm(!showForm)}
            className={`group inline-flex items-center gap-2 font-ui text-xs uppercase tracking-eyebrow px-5 py-2.5 transition-colors ${
              showForm
                ? 'border border-tobacco/40 text-ink hover:bg-paper-200'
                : 'bg-ink text-paper hover:bg-saffron'
            }`}
          >
            {showForm ? 'Cancel' : 'Add Zone'}
            {!showForm && <span className="transition-transform group-hover:translate-x-0.5">→</span>}
          </button>
        </div>
        <p className="font-editorial italic text-base text-ink-soft mt-2 max-w-xl">
          Each ring around Moksha is a delivery polygon — fee, minimum order,
          ETA, and the cutoff time before the kitchen locks tomorrow's count.
        </p>
        <div className="rule-strong mt-6" />
      </header>

      {error && <div className="border border-saffron text-saffron-deep p-4 mb-6 font-ui text-sm">{error}</div>}

      {/* Polygon map preview */}
      {location && location.lat != null && location.lng != null && sortedZones.length > 0 && (
        <PolygonMap location={location} zones={sortedZones} />
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="relative border border-ink bg-paper-50 p-6 lg:p-8 mb-10 space-y-6">
          <span className="absolute -top-2.5 left-5 bg-paper-50 px-2 eyebrow text-saffron">New Zone</span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <Field label="Zone Name" required>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Schwenningen Mitte"
                className="w-full bg-transparent border-0 border-b border-ink/30 focus:border-saffron outline-none px-0 py-2 font-ui text-sm placeholder:text-ink-mute"
              />
            </Field>
            <Field label="Delivery Charge (€)">
              <input
                type="number"
                step="0.01"
                min="0"
                value={charge}
                onChange={(e) => setCharge(e.target.value)}
                className="w-full bg-transparent border-0 border-b border-ink/30 focus:border-saffron outline-none px-0 py-2 font-mono-tabular text-sm"
              />
            </Field>
            <Field label="Min Order (€)">
              <input
                type="number"
                step="0.01"
                min="0"
                value={minOrder}
                onChange={(e) => setMinOrder(e.target.value)}
                className="w-full bg-transparent border-0 border-b border-ink/30 focus:border-saffron outline-none px-0 py-2 font-mono-tabular text-sm"
              />
            </Field>
            <Field label="Next-day cutoff (HH:MM)" hint="When the order book closes the night before delivery.">
              <input
                type="time"
                value={cutoffTime}
                onChange={(e) => setCutoffTime(e.target.value)}
                className="w-full bg-transparent border-0 border-b border-ink/30 focus:border-saffron outline-none px-0 py-2 font-mono-tabular text-sm"
              />
            </Field>
            <Field label="Estimated delivery (min)" hint="Shown to customers when their address matches this zone.">
              <input
                type="number"
                min="0"
                value={etaMinutes}
                onChange={(e) => setEtaMinutes(e.target.value)}
                placeholder="e.g., 25"
                className="w-full bg-transparent border-0 border-b border-ink/30 focus:border-saffron outline-none px-0 py-2 font-mono-tabular text-sm"
              />
            </Field>
          </div>
          <Field label="Boundaries — JSON polygon">
            <textarea
              value={boundariesJson}
              onChange={(e) => setBoundariesJson(e.target.value)}
              rows={4}
              placeholder='[[lat, lng], [lat, lng], ...]'
              className="w-full bg-paper-100 border border-tobacco/30 focus:border-saffron outline-none px-3 py-2 font-mono-tabular text-xs"
            />
          </Field>
          <button
            type="submit"
            disabled={saving}
            className="bg-ink text-paper px-6 py-3 font-ui text-xs uppercase tracking-eyebrow hover:bg-saffron transition-colors disabled:opacity-50"
          >
            {saving ? 'Creating…' : 'Create Zone'}
          </button>
        </form>
      )}

      {loading && (
        <div className="flex justify-center py-16 font-mono-tabular text-xs tracking-eyebrow uppercase text-ink-mute">
          Loading the catchment…
        </div>
      )}

      {!loading && zones.length === 0 && !showForm && (
        <div className="text-center py-16">
          <p className="font-editorial italic text-ink-mute">No delivery zones configured yet.</p>
        </div>
      )}

      {!loading && zones.length > 0 && (
        <div className="border border-tobacco/40 bg-paper-50 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-paper-100 border-b border-tobacco/30">
              <tr>
                <Th>Zone</Th>
                <Th align="right">Charge</Th>
                <Th align="right">Min Order</Th>
                <Th align="right">Cutoff</Th>
                <Th align="right">ETA</Th>
                <Th>Status</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {zones.map((zone) => (
                <tr key={zone.id} className="border-b border-tobacco/15 last:border-0 hover:bg-paper-100 transition-colors">
                  <td className="px-4 py-3.5">
                    <span className="font-display text-base text-ink leading-tight">{zone.name}</span>
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono-tabular text-ink">€{zone.charge.toFixed(2)}</td>
                  <td className="px-4 py-3.5 text-right font-mono-tabular text-ink">€{zone.minOrder.toFixed(2)}</td>
                  <td className="px-4 py-3.5 text-right font-mono-tabular text-saffron">{zone.cutoffTime || '—'}</td>
                  <td className="px-4 py-3.5 text-right font-mono-tabular text-ink">
                    {zone.etaMinutes ? `${zone.etaMinutes} min` : '—'}
                  </td>
                  <td className="px-4 py-3.5">
                    <button
                      onClick={() => toggleActive(zone)}
                      className={`font-mono-tabular text-[10px] uppercase tracking-eyebrow px-2 py-1 ${
                        zone.isActive
                          ? 'bg-bottle/10 text-bottle'
                          : 'bg-paper-200 text-ink-mute'
                      }`}
                      aria-label={`${zone.isActive ? 'Deactivate' : 'Activate'} zone ${zone.name}`}
                    >
                      {zone.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <button
                      onClick={() => deleteZone(zone.id)}
                      className="font-ui text-xs uppercase tracking-eyebrow text-saffron-deep hover:text-saffron"
                      aria-label={`Delete zone ${zone.name}`}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th className={`px-4 py-3 font-mono-tabular text-[10px] uppercase tracking-eyebrow text-ink-mute text-${align}`}>
      {children}
    </th>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block eyebrow mb-1">
        {label}
        {required && <span className="text-saffron ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="font-editorial italic text-xs text-ink-mute mt-1">{hint}</p>}
    </div>
  );
}

function polygonArea(polygon: [number, number][] | null): number {
  if (!polygon || polygon.length < 3) return 0;
  let area = 0;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    area += (polygon[i][1] + polygon[j][1]) * (polygon[i][0] - polygon[j][0]);
  }
  return Math.abs(area / 2);
}

interface MapProps {
  location: LocationInfo;
  zones: DeliveryZone[];
}

// Saffron / tobacco / ink for the three nested zones — same editorial palette.
const ZONE_COLOURS = [
  { fill: '#c2410c', stroke: '#c2410c' }, // saffron — inner, hottest
  { fill: '#7c5e3c', stroke: '#7c5e3c' }, // tobacco — middle
  { fill: '#1a1410', stroke: '#1a1410' }, // ink — outer, coolest
];

/**
 * Real OSM map for the delivery catchment — CartoDB Positron tiles give the
 * map a desaturated paper-feel that matches the editorial palette without
 * needing an API key. Each zone is drawn as a coloured polygon with a
 * permanent tooltip showing its name; the location is anchored with a
 * saffron circle marker.
 */
function PolygonMap({ location, zones }: MapProps) {
  const centre: [number, number] = [location.lat!, location.lng!];

  // Compute the bounding box of the outermost zone so we can frame nicely.
  const allPts = zones.flatMap((z) => z.boundaries || []);
  const bounds = allPts.length > 0
    ? L.latLngBounds(allPts.map(([lat, lng]) => L.latLng(lat, lng)))
    : null;

  return (
    <div className="mb-10 border border-tobacco/40 bg-paper-100 p-5 lg:p-7">
      <div className="flex items-baseline justify-between mb-5">
        <div>
          <span className="eyebrow">Catchment Map</span>
          <h2 className="font-display text-2xl text-ink mt-1 leading-tight">
            Moksha — Schwenningen
          </h2>
          <p className="font-editorial italic text-sm text-ink-soft mt-1 max-w-md">
            Click or hover a polygon to see its zone. The saffron pin is the kitchen.
          </p>
        </div>
        <div className="text-right">
          <span className="eyebrow eyebrow-mute">Pin</span>
          <p className="font-mono-tabular text-sm text-ink mt-1">
            {location.lat?.toFixed(4)}, {location.lng?.toFixed(4)}
          </p>
        </div>
      </div>

      <div className="relative" style={{ height: 520 }}>
        <MapContainer
          center={centre}
          zoom={12}
          scrollWheelZoom={false}
          style={{ height: '100%', width: '100%' }}
          className="border border-tobacco/30"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            subdomains={['a', 'b', 'c', 'd']}
            maxZoom={20}
          />

          {/* Zones drawn outer-to-inner so the saffron inner ring sits on top */}
          {zones.map((zone, i) => {
            if (!zone.boundaries) return null;
            const colour = ZONE_COLOURS[i % ZONE_COLOURS.length];
            return (
              <Polygon
                key={zone.id}
                positions={zone.boundaries as [number, number][]}
                pathOptions={{
                  color: colour.stroke,
                  weight: 1.5,
                  fillColor: colour.fill,
                  fillOpacity: 0.12,
                }}
              >
                <Tooltip
                  direction="top"
                  sticky
                  className="!bg-paper !border-tobacco !text-ink !font-mono-tabular !text-[10px] !uppercase !tracking-wider !shadow-none"
                >
                  <span style={{ color: colour.stroke }}>{zone.name}</span>
                  <span className="opacity-70">
                    {' · '}
                    {zone.cutoffTime || '—'} · €{zone.charge.toFixed(2)} · {zone.etaMinutes || '—'} min
                  </span>
                </Tooltip>
              </Polygon>
            );
          })}

          {/* Kitchen pin */}
          <CircleMarker
            center={centre}
            radius={9}
            pathOptions={{
              color: '#fbf7ee',
              weight: 3,
              fillColor: '#c2410c',
              fillOpacity: 1,
            }}
          >
            <Tooltip
              permanent
              direction="right"
              offset={[10, 0]}
              className="!bg-ink !text-paper !border-0 !font-display !text-base !shadow-none"
            >
              Moksha
            </Tooltip>
          </CircleMarker>

          {bounds && <FitBounds bounds={bounds} />}
        </MapContainer>
      </div>

      {/* Zone legend — colour key beneath the map */}
      <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
        {zones.map((zone, i) => {
          const colour = ZONE_COLOURS[i % ZONE_COLOURS.length];
          return (
            <div key={zone.id} className="flex items-center gap-3 border border-tobacco/30 bg-paper-50 px-3 py-2">
              <span
                className="block w-3 h-3 shrink-0"
                style={{ background: colour.fill, opacity: 0.55, border: `1.5px solid ${colour.stroke}` }}
              />
              <div className="min-w-0">
                <p className="font-display text-sm text-ink leading-tight truncate">{zone.name}</p>
                <p className="font-mono-tabular text-[10px] uppercase tracking-wider text-ink-mute">
                  {zone.cutoffTime || '—'} · €{zone.charge.toFixed(2)} · {zone.etaMinutes || '—'} min
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FitBounds({ bounds }: { bounds: L.LatLngBounds }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [map, bounds]);
  return null;
}
