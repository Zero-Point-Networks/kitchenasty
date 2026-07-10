import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function SettingsNotifications() {
  const token = localStorage.getItem('token') || '';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Defaults mirror the server's READY_NOTIFICATION_DEFAULTS
  const [readyEmailEnabled, setReadyEmailEnabled] = useState(true);
  const [readySmsEnabled, setReadySmsEnabled] = useState(false);
  const [readyPushEnabled, setReadyPushEnabled] = useState(true);

  useEffect(() => {
    fetch('/api/settings/notifications', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data) {
          const d = res.data;
          if (d.readyEmailEnabled !== undefined) setReadyEmailEnabled(d.readyEmailEnabled);
          if (d.readySmsEnabled !== undefined) setReadySmsEnabled(d.readySmsEnabled);
          if (d.readyPushEnabled !== undefined) setReadyPushEnabled(d.readyPushEnabled);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  async function handleSave() {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/settings/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ readyEmailEnabled, readySmsEnabled, readyPushEnabled }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess('Notification settings updated');
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
          <h1 className="text-2xl font-bold text-gray-900 mt-1">Notification Settings</h1>
        </div>
        <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{success}</div>}

      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <p className="text-sm text-gray-500">
          Channels used to tell a customer their pickup or dine-in order is ready for collection.
          Each channel only fires when the order has the matching contact details.
        </p>

        <label className="flex items-center gap-3">
          <input type="checkbox" checked={readyEmailEnabled} onChange={(e) => setReadyEmailEnabled(e.target.checked)} className="w-4 h-4 text-primary-600 rounded" />
          <span className="text-sm font-medium text-gray-700">Email — send the ready-for-collection email</span>
        </label>

        <label className="flex items-center gap-3">
          <input type="checkbox" checked={readySmsEnabled} onChange={(e) => setReadySmsEnabled(e.target.checked)} className="w-4 h-4 text-primary-600 rounded" />
          <span className="text-sm font-medium text-gray-700">SMS — text the customer (requires Twilio; per-message cost)</span>
        </label>

        <label className="flex items-center gap-3">
          <input type="checkbox" checked={readyPushEnabled} onChange={(e) => setReadyPushEnabled(e.target.checked)} className="w-4 h-4 text-primary-600 rounded" />
          <span className="text-sm font-medium text-gray-700">Push — notify mobile app customers</span>
        </label>
      </div>
    </div>
  );
}
