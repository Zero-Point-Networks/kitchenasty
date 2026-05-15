import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { apiClient } from '@/api/client';

interface Zone {
  id: string;
  isActive: boolean;
  cutoffTime: string | null;
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

export default function CutoffBanner() {
  const [cutoffTime, setCutoffTime] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    (async () => {
      try {
        const locRes = await apiClient<{ data: Location[] }>('/api/locations', { auth: false });
        const location = locRes.data?.find((l) => l.isActive) ?? locRes.data?.[0];
        if (!location) return;
        const zoneRes = await apiClient<{ data: Zone[] }>(`/api/locations/${location.id}/delivery-zones`, { auth: false });
        const zones = (zoneRes.data ?? []).filter((z) => z.isActive && z.cutoffTime);
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
  const bg = isLocked ? '#1f2937' : '#c2410c';

  return (
    <View style={{ backgroundColor: bg }} className="px-4 py-2">
      <Text className="text-white text-center text-sm">
        {isLocked
          ? "Today's cutoff has passed"
          : `Order tomorrow's lunch by ${cutoffTime} · ${formatRemaining(remaining)} left`}
      </Text>
    </View>
  );
}
