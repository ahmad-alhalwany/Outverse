/** Human-readable time until a bottle leaves the map. */
export function formatBottleTimeLeft(expiresAt: string | Date): string {
  const end = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;
  const ms = end.getTime() - Date.now();
  if (ms <= 0) return 'expiring soon';

  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

  if (hours >= 1) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  if (minutes >= 1) return `${minutes}m`;
  return 'under 1m';
}
