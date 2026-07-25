import { onCLS, onFCP, onLCP, onTTFB, onINP, type Metric } from 'web-vitals';

export type WebVitalMetric = Metric & {
  timestamp: number;
  url: string;
  userAgent: string;
  connection?: string;
};

const ENDPOINT = '/api/analytics/web-vitals';

function sendToAnalytics(metric: WebVitalMetric) {
  if (typeof window === 'undefined') return;

  const body = JSON.stringify({
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    delta: metric.delta,
    id: metric.id,
    entries: metric.entries,
    timestamp: metric.timestamp,
    url: metric.url,
    userAgent: metric.userAgent,
    connection: metric.connection,
  });

  if (navigator.sendBeacon) {
    navigator.sendBeacon(ENDPOINT, body);
  } else {
    fetch(ENDPOINT, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
    }).catch(() => {});
  }
}

function getConnectionInfo(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const nav = navigator as Navigator & {
    connection?: {
      effectiveType?: string;
      downlink?: number;
      rtt?: number;
    };
  };
  if (!nav.connection) return undefined;
  return `${nav.connection.effectiveType || 'unknown'}-${nav.connection.downlink || 0}Mbps-${nav.connection.rtt || 0}ms`;
}

export function initWebVitalsTracking() {
  if (typeof window === 'undefined') return;

  const baseMetric = {
    timestamp: Date.now(),
    url: window.location.href,
    userAgent: navigator.userAgent,
    connection: getConnectionInfo(),
  };

  onCLS((metric) => sendToAnalytics({ ...metric, ...baseMetric }));
  onFCP((metric) => sendToAnalytics({ ...metric, ...baseMetric }));
  onLCP((metric) => sendToAnalytics({ ...metric, ...baseMetric }));
  onTTFB((metric) => sendToAnalytics({ ...metric, ...baseMetric }));
  onINP((metric) => sendToAnalytics({ ...metric, ...baseMetric }));
}

export function reportWebVitals(metric: Metric) {
  sendToAnalytics({ ...metric, ...baseMetric });
}

const baseMetric = {
  timestamp: Date.now(),
  url: typeof window !== 'undefined' ? window.location.href : '',
  userAgent: typeof window !== 'undefined' ? navigator.userAgent : '',
  connection: getConnectionInfo(),
};