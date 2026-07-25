'use client';

import { Analytics } from '@vercel/analytics/react';
import { initWebVitalsTracking } from '@/lib/webVitals';
import { useEffect } from 'react';

export default function WebVitalsTracker() {
  useEffect(() => {
    initWebVitalsTracking();
  }, []);

  return <Analytics />;
}