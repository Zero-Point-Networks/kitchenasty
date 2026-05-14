/**
 * Compute the cutoff Date for an order scheduled to a given day.
 *
 * The cutoff is at (scheduledAt's date - 1 day) at `cutoffTime` (HH:MM) in
 * server-local time. Returning null means the zone has no cutoff configured
 * and orders are always accepted within the normal scheduling window.
 */
export function computeCutoff(scheduledAt: Date, cutoffTime: string | null): Date | null {
  if (!cutoffTime) return null;
  const [hh, mm] = cutoffTime.split(':').map(Number);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  const cutoff = new Date(scheduledAt);
  cutoff.setDate(cutoff.getDate() - 1);
  cutoff.setHours(hh, mm, 0, 0);
  return cutoff;
}

export function isAfterCutoff(now: Date, scheduledAt: Date, cutoffTime: string | null): boolean {
  const cutoff = computeCutoff(scheduledAt, cutoffTime);
  if (!cutoff) return false;
  return now.getTime() > cutoff.getTime();
}
