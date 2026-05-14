import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface Zone {
  id: string;
  name: string;
  cutoffTime: string | null;
  etaMinutes: number | null;
  isActive: boolean;
}

interface Location {
  id: string;
  isActive: boolean;
}

function nextCutoffDate(cutoffTime: string): Date {
  const [hh, mm] = cutoffTime.split(':').map(Number);
  const cutoff = new Date();
  cutoff.setHours(hh, mm, 0, 0);
  if (cutoff.getTime() <= Date.now()) {
    cutoff.setDate(cutoff.getDate() + 1);
  }
  return cutoff;
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return '0m';
  const totalMin = Math.floor(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m}m`;
  const s = Math.floor((ms % 60_000) / 1000);
  return `${m}m ${s}s`;
}

/**
 * Surfaces the next-day order cutoff to the customer.
 *
 * Picks the earliest `cutoffTime` across active delivery zones for the first
 * active location. Renders nothing if no zones have a cutoff configured.
 */
export default function CutoffBanner() {
  const { t } = useTranslation();
  const [cutoffTime, setCutoffTime] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    (async () => {
      try {
        const locRes = await fetch('/api/locations');
        const locJson = await locRes.json();
        const location: Location | undefined = locJson.data?.find((l: Location) => l.isActive) ?? locJson.data?.[0];
        if (!location) return;
        const zoneRes = await fetch(`/api/locations/${location.id}/delivery-zones`);
        const zoneJson = await zoneRes.json();
        const zones: Zone[] = (zoneJson.data ?? []).filter((z: Zone) => z.isActive && z.cutoffTime);
        if (zones.length === 0) return;
        const earliest = zones.map((z) => z.cutoffTime!).sort()[0];
        setCutoffTime(earliest);
      } catch {
        // ignore
      }
    })();
  }, []);

  useEffect(() => {
    if (!cutoffTime) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [cutoffTime]);

  if (!cutoffTime) return null;

  const cutoff = nextCutoffDate(cutoffTime);
  const remaining = cutoff.getTime() - now;
  const isLocked = remaining <= 0;

  return (
    <div className={`w-full ${isLocked ? 'bg-gray-800' : 'bg-primary-600'} text-white text-sm`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center justify-center gap-3 flex-wrap">
        {isLocked ? (
          <span>
            {t('cutoff.lockedToday', { defaultValue: "Today's cutoff has passed — orders for the next available slot open soon." })}
          </span>
        ) : (
          <>
            <span className="font-medium">
              {t('cutoff.headline', { defaultValue: "Order tomorrow's lunch by {{time}}", time: cutoffTime })}
            </span>
            <span className="hidden sm:inline opacity-80">·</span>
            <span className="font-mono tabular-nums">
              {t('cutoff.remaining', { defaultValue: '{{remaining}} left', remaining: formatRemaining(remaining) })}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
