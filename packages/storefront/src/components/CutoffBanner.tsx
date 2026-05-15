import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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

interface Remaining {
  h: number;
  m: number;
  s: number;
  totalMs: number;
}

function remaining(target: Date, now: number): Remaining {
  const ms = Math.max(0, target.getTime() - now);
  const totalSec = Math.floor(ms / 1000);
  return {
    h: Math.floor(totalSec / 3600),
    m: Math.floor((totalSec % 3600) / 60),
    s: totalSec % 60,
    totalMs: ms,
  };
}

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function dateLabel(d: Date): string {
  return `${WEEKDAYS[d.getDay()]} ${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]}`;
}

/**
 * "Tonight's Cutoff" banner — a railway-station departure board pinned to the
 * top of every page. Surfaces the *earliest* active zone cutoff so the
 * customer knows the urgency in one glance.
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
        // Earliest cutoff (latest *deadline urgency*) drives the banner.
        const earliest = zones.map((z) => z.cutoffTime!).sort()[0];
        setCutoffTime(earliest);
      } catch {
        // banner is best-effort — never blocks the page
      }
    })();
  }, []);

  useEffect(() => {
    if (!cutoffTime) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [cutoffTime]);

  const cutoff = useMemo(() => (cutoffTime ? nextCutoffDate(cutoffTime) : null), [cutoffTime, now]);
  const r = useMemo(() => (cutoff ? remaining(cutoff, now) : null), [cutoff, now]);

  if (!cutoffTime || !cutoff || !r) return null;

  const isLocked = r.totalMs <= 0;
  const cutoffDateStamp = dateLabel(cutoff);

  if (isLocked) {
    return (
      <div className="relative isolate w-full bg-ink text-paper">
        <div className="rule-strong absolute inset-x-0 top-0" style={{ background: '#7c5e3c' }} />
        <div className="rule-strong absolute inset-x-0 bottom-0" style={{ background: '#7c5e3c' }} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-center gap-4 text-paper">
          <span className="eyebrow eyebrow-mute text-paper/70">{t('editorial.bannerWindowClosed')}</span>
          <span className="font-display text-base sm:text-lg">{t('editorial.bannerLocked')}</span>
          <span className="eyebrow text-paper/60">{t('editorial.bannerReopens')}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative isolate w-full"
      style={{
        background:
          'linear-gradient(180deg, var(--paper-2) 0%, var(--paper-3) 100%)',
      }}
    >
      <div className="rule-strong absolute inset-x-0 top-0" />
      <div className="rule-strong absolute inset-x-0 bottom-0" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 sm:py-3">
        <div className="flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
          {/* Left: kicker + date — looks like a magazine slug line */}
          <div className="hidden sm:flex flex-col leading-tight">
            <span className="eyebrow">{t('editorial.bannerTonightsCutoff')}</span>
            <span className="font-mono-tabular text-[10px] tracking-[0.18em] text-ink-mute mt-0.5">
              {cutoffDateStamp}
            </span>
          </div>

          {/* Center: the clock — tabular mono, big, calm.
              Colon pulses gently once a second. */}
          <div className="flex items-baseline gap-3 sm:gap-5 mx-auto sm:mx-0">
            <div className="flex items-baseline">
              <span className="font-mono-tabular text-2xl sm:text-3xl font-medium text-ink leading-none">
                {cutoffTime.split(':')[0]}
              </span>
              <span className="font-mono-tabular text-2xl sm:text-3xl font-medium text-ink leading-none clock-colon">:</span>
              <span className="font-mono-tabular text-2xl sm:text-3xl font-medium text-ink leading-none">
                {cutoffTime.split(':')[1]}
              </span>
            </div>
            <span className="editorial-diamond text-tobacco hidden sm:inline-block" />
            <div className="flex items-baseline gap-1 font-mono-tabular text-xs sm:text-sm tracking-wide text-ink-soft">
              <CountUnit value={r.h} unit="H" />
              <span className="text-ink-mute">·</span>
              <CountUnit value={r.m} unit="M" />
              <span className="text-ink-mute">·</span>
              <CountUnit value={r.s} unit="S" />
              <span className="ml-1 text-[10px] uppercase tracking-eyebrow text-ink-mute">{t('editorial.bannerLeft')}</span>
            </div>
          </div>

          {/* Right: ghost CTA — a quiet door, not a shout */}
          <Link
            to="/menu"
            className="hidden sm:flex items-center gap-2 font-ui text-[11px] uppercase tracking-eyebrow text-ink hover:text-saffron transition-colors group"
          >
            {t('editorial.bannerOrderTomorrow')}
            <span className="inline-block transition-transform group-hover:translate-x-0.5">→</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

function CountUnit({ value, unit }: { value: number; unit: string }) {
  return (
    <span>
      <span className="font-medium text-ink">{String(value).padStart(2, '0')}</span>
      <span className="text-[9px] uppercase tracking-eyebrow text-ink-mute ml-0.5">{unit}</span>
    </span>
  );
}
