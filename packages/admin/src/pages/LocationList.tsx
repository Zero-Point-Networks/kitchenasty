import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';

interface Location {
  id: string;
  name: string;
  slug: string;
  address: string;
  city: string;
  state: string | null;
  isActive: boolean;
  isBusy: boolean;
  busyMessage: string | null;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  _count: { deliveryZones: number; tables: number; orders: number };
}

interface LocationResponse {
  success: boolean;
  data: Location[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export default function LocationList() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingBusy, setTogglingBusy] = useState<string | null>(null);

  useEffect(() => {
    api.get<LocationResponse>('/locations')
      .then((res) => {
        setLocations(res.data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const toggleBusy = async (loc: Location) => {
    setTogglingBusy(loc.id);
    try {
      await api.patch(`/locations/${loc.id}`, { isBusy: !loc.isBusy });
      setLocations((prev) =>
        prev.map((l) => l.id === loc.id ? { ...l, isBusy: !l.isBusy } : l)
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setTogglingBusy(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-10 py-8 lg:py-10">
      <header className="mb-8">
        <div className="flex items-center gap-3">
          <span className="block h-px w-10 bg-saffron" />
          <span className="eyebrow text-saffron">Operations · Kitchens</span>
        </div>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <h1 className="font-display text-4xl text-ink leading-tight">Locations</h1>
          <Link
            to="/locations/new"
            className="group inline-flex items-center gap-2 bg-ink text-paper px-5 py-2.5 font-ui text-xs uppercase tracking-eyebrow hover:bg-saffron transition-colors"
          >
            Add Location
            <span className="transition-transform group-hover:translate-x-0.5">→</span>
          </Link>
        </div>
        <p className="font-editorial italic text-base text-ink-soft mt-2 max-w-xl">
          One kitchen per location. Configure operating hours, busy mode, and
          the delivery catchment from here.
        </p>
        <div className="rule-strong mt-6" />
      </header>

      {loading && (
        <p className="font-mono-tabular text-xs uppercase tracking-eyebrow text-ink-mute text-center py-16">
          Loading…
        </p>
      )}
      {error && (
        <div className="border border-saffron text-saffron-deep p-4 font-ui text-sm">
          {error}
        </div>
      )}

      {!loading && !error && locations.length === 0 && (
        <div className="border border-tobacco/40 bg-paper-50 p-12 text-center">
          <p className="font-editorial italic text-ink-mute mb-4">No locations yet.</p>
          <Link
            to="/locations/new"
            className="font-ui text-xs uppercase tracking-eyebrow text-saffron hover:text-saffron-deep"
          >
            Create your first location →
          </Link>
        </div>
      )}

      {!loading && locations.length > 0 && (
        <div className="border border-tobacco/40 bg-paper-50 overflow-hidden">
          <table className="w-full">
            <thead className="bg-paper-100 border-b border-tobacco/30">
              <tr>
                <Th>Name</Th>
                <Th>Address</Th>
                <Th>Services</Th>
                <Th>Status</Th>
                <Th>Stats</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {locations.map((loc) => (
                <tr key={loc.id} className="border-b border-tobacco/15 last:border-0 hover:bg-paper-100 transition-colors">
                  <td className="px-4 py-3.5">
                    <span className="font-display text-base text-ink leading-tight">{loc.name}</span>
                    <div className="font-mono-tabular text-[10px] uppercase tracking-wider text-ink-mute mt-0.5">
                      {loc.slug}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 font-editorial text-sm text-ink-soft">
                    {loc.address}, {loc.city}{loc.state ? `, ${loc.state}` : ''}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex gap-1.5 font-mono-tabular text-[10px] uppercase tracking-eyebrow">
                      {loc.deliveryEnabled && <span className="bg-bottle/10 text-bottle px-2 py-0.5">Delivery</span>}
                      {loc.pickupEnabled && <span className="bg-tobacco/15 text-tobacco px-2 py-0.5">Pickup</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span
                      className={`font-mono-tabular text-[10px] uppercase tracking-eyebrow px-2 py-1 ${
                        loc.isActive
                          ? 'bg-bottle/10 text-bottle'
                          : 'bg-saffron/15 text-saffron-deep'
                      }`}
                    >
                      {loc.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 font-mono-tabular text-xs text-ink-mute">
                    {loc._count.orders} ord · {loc._count.tables} tab · {loc._count.deliveryZones} zones
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <div className="inline-flex items-center gap-3 font-ui text-xs uppercase tracking-eyebrow">
                      <button
                        onClick={() => toggleBusy(loc)}
                        disabled={togglingBusy === loc.id}
                        className={`px-2 py-1 transition-colors disabled:opacity-50 ${
                          loc.isBusy
                            ? 'bg-saffron text-paper'
                            : 'bg-paper-200 text-ink hover:bg-ink hover:text-paper'
                        }`}
                        aria-label={`${loc.isBusy ? 'Turn off' : 'Turn on'} busy mode for ${loc.name}`}
                      >
                        {loc.isBusy ? 'Busy On' : 'Busy Off'}
                      </button>
                      <Link
                        to={`/locations/${loc.id}/delivery-zones`}
                        className="text-saffron hover:text-saffron-deep"
                        aria-label={`Delivery catchment for ${loc.name}`}
                      >
                        Catchment →
                      </Link>
                      <Link
                        to={`/locations/${loc.id}/tables`}
                        className="text-ink hover:text-saffron"
                        aria-label={`View tables for ${loc.name}`}
                      >
                        Tables
                      </Link>
                      <Link
                        to={`/locations/${loc.id}`}
                        className="text-ink hover:text-saffron"
                        aria-label={`Edit ${loc.name}`}
                      >
                        Edit
                      </Link>
                    </div>
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
