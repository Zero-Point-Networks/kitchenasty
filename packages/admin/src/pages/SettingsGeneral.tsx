import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';

const FALLBACK_TIMEZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Anchorage', 'Pacific/Honolulu', 'Europe/London', 'Europe/Berlin', 'Europe/Paris',
  'Europe/Rome', 'Europe/Madrid', 'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Kolkata',
  'Asia/Dubai', 'Australia/Sydney', 'Pacific/Auckland',
];

type SupportedValuesIntl = typeof Intl & {
  supportedValuesOf?: (key: 'timeZone') => string[];
};

interface GeneralSettingsData {
  contactEmail?: unknown;
  contactPhone?: unknown;
  timezone?: unknown;
  distanceUnit?: unknown;
  defaultCurrency?: unknown;
  currencySymbol?: unknown;
  currencyPosition?: unknown;
  googleMapsApiKey?: unknown;
}

interface GeneralSettingsResponse {
  success?: boolean;
  data?: GeneralSettingsData;
}

function isDistanceUnit(value: unknown): value is 'km' | 'mi' {
  return value === 'km' || value === 'mi';
}

function isCurrencyPosition(value: unknown): value is 'before' | 'after' {
  return value === 'before' || value === 'after';
}

function timezoneParts(timezone: string): [string, string] {
  const [region, ...rest] = timezone.split('/');
  return [region, rest.join('/')];
}

function compareTimezones(a: string, b: string): number {
  const [aRegion, aName] = timezoneParts(a);
  const [bRegion, bName] = timezoneParts(b);
  return compareAscii(aRegion, bRegion) || compareAscii(aName, bName) || compareAscii(a, b);
}

function compareAscii(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function getSupportedTimezones(): string[] {
  const supportedValuesOf = (Intl as SupportedValuesIntl).supportedValuesOf;
  if (typeof supportedValuesOf !== 'function') {
    return FALLBACK_TIMEZONES;
  }

  return supportedValuesOf.call(Intl, 'timeZone');
}

function buildTimezoneOptions(currentTimezone: string): string[] {
  return Array.from(new Set(['UTC', ...getSupportedTimezones(), currentTimezone]))
    .filter(Boolean)
    .sort(compareTimezones);
}

export default function SettingsGeneral() {
  const token = localStorage.getItem('token') || '';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [distanceUnit, setDistanceUnit] = useState<'km' | 'mi'>('km');
  const [defaultCurrency, setDefaultCurrency] = useState('USD');
  const [currencySymbol, setCurrencySymbol] = useState('$');
  const [currencyPosition, setCurrencyPosition] = useState<'before' | 'after'>('before');
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState('');
  const timezoneOptions = useMemo(() => buildTimezoneOptions(timezone), [timezone]);

  useEffect(() => {
    let active = true;

    async function loadGeneralSettings(): Promise<void> {
      try {
        const response = await fetch('/api/settings/general', { headers: { Authorization: `Bearer ${token}` } });
        const res = await response.json() as GeneralSettingsResponse;

        if (!active) return;

        if (res.success && res.data) {
          const d = res.data;
          if (typeof d.contactEmail === 'string') setContactEmail(d.contactEmail);
          if (typeof d.contactPhone === 'string') setContactPhone(d.contactPhone);
          if (typeof d.timezone === 'string') setTimezone(d.timezone);
          if (isDistanceUnit(d.distanceUnit)) setDistanceUnit(d.distanceUnit);
          if (typeof d.defaultCurrency === 'string') setDefaultCurrency(d.defaultCurrency);
          if (typeof d.currencySymbol === 'string') setCurrencySymbol(d.currencySymbol);
          if (isCurrencyPosition(d.currencyPosition)) setCurrencyPosition(d.currencyPosition);
          if (typeof d.googleMapsApiKey === 'string') setGoogleMapsApiKey(d.googleMapsApiKey);
        }
      } catch {
        if (active) setError('Failed to load general settings');
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadGeneralSettings();

    return () => {
      active = false;
    };
  }, [token]);

  async function handleSave() {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/settings/general', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ contactEmail, contactPhone, timezone, distanceUnit, defaultCurrency, currencySymbol, currencyPosition, googleMapsApiKey }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess('General settings updated');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(typeof data.error === 'string' ? data.error : 'Failed to save');
      }
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6 text-gray-500">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link to="/settings" className="text-sm text-primary-600 hover:text-primary-700">&larr; Back to Settings</Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">General Settings</h1>
        </div>
        <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{success}</div>}

      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
            <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contact Phone</label>
            <input type="text" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
          </div>
        </div>

        <div>
          <label htmlFor="timezone" className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
          <select id="timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
            {timezoneOptions.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Distance Unit</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="distanceUnit" value="km" checked={distanceUnit === 'km'} onChange={() => setDistanceUnit('km')} className="text-primary-600" />
              Kilometers (km)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="distanceUnit" value="mi" checked={distanceUnit === 'mi'} onChange={() => setDistanceUnit('mi')} className="text-primary-600" />
              Miles (mi)
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Default Currency</label>
            <input type="text" maxLength={3} value={defaultCurrency} onChange={(e) => setDefaultCurrency(e.target.value.toUpperCase())} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="USD" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Currency Symbol</label>
            <input type="text" maxLength={5} value={currencySymbol} onChange={(e) => setCurrencySymbol(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="$" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Currency Position</label>
            <div className="flex gap-4 mt-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="currencyPosition" value="before" checked={currencyPosition === 'before'} onChange={() => setCurrencyPosition('before')} className="text-primary-600" />
                Before ($10)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="currencyPosition" value="after" checked={currencyPosition === 'after'} onChange={() => setCurrencyPosition('after')} className="text-primary-600" />
                After (10$)
              </label>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Google Maps API Key</label>
          <input type="password" value={googleMapsApiKey} onChange={(e) => setGoogleMapsApiKey(e.target.value)} className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="Enter API key" />
        </div>
      </div>
    </div>
  );
}
