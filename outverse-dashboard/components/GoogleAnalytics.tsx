'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
const STORAGE_KEY = 'cosmory-cookie-consent';

function hasAnalyticsConsent(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'all';
  } catch {
    return false;
  }
}

/**
 * No-ops when NEXT_PUBLIC_GA_MEASUREMENT_ID is unset (matches the Turnstile
 * pattern), and only loads gtag.js once the cookie banner's "Accept all"
 * choice is on record — CookieConsent's own consent toggle had nothing
 * downstream gating on it before this.
 */
export default function GoogleAnalytics() {
  const [consented, setConsented] = useState(false);

  useEffect(() => {
    setConsented(hasAnalyticsConsent());
    const onUpdate = () => setConsented(hasAnalyticsConsent());
    window.addEventListener('cosmory:cookie-consent-updated', onUpdate);
    return () => window.removeEventListener('cosmory:cookie-consent-updated', onUpdate);
  }, []);

  if (!GA_ID || !consented) return null;
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
      <Script id="ga-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_ID}');`}
      </Script>
    </>
  );
}
