import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { LocaleProvider } from "@/components/LocaleProvider";
import AuthBootstrap from "@/components/AuthBootstrap";
import CookieConsent from "@/components/CookieConsent";
import SkipToMain from "@/components/SkipToMain";
import ConfirmDialogProvider from "@/components/ui/ConfirmDialogProvider";
import GoogleAnalytics from "@/components/GoogleAnalytics";
import Link from "next/link";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const themeInitScript = `(function(){try{var t=localStorage.getItem('cosmory-theme');if(t==='light'){document.documentElement.classList.add('light');}}catch(e){}})();`;

const swRegisterScript = `if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){/* SW registration is best-effort */});});}`;

// Almost every page fires an API request on mount (feed, sidebar, etc.) —
// without a preconnect hint, that first request pays DNS + TCP + TLS setup
// cost on the critical path. PageSpeed's "Network dependency tree" insight
// flagged this specifically.
const apiOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_API_URL || '').origin;
  } catch {
    return null;
  }
})();

// Basic Organization/WebSite structured data so search engines have a
// factual identity to attach to the site (Foresight audit flagged the
// total absence of schema markup). No SearchAction here — /search is
// disallowed in robots.ts, and Google requires that page to be
// crawlable for the sitelinks searchbox feature to apply.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://outverse-six.vercel.app';
const structuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      name: 'Cosmory',
      url: siteUrl,
      logo: `${siteUrl}/cosmory-icon.svg`,
    },
    {
      '@type': 'WebSite',
      name: 'Cosmory',
      url: siteUrl,
    },
  ],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#1A1A2E",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Cosmory",
    template: "%s | Cosmory",
  },
  description: "Your creative social space where ideas come to life",
  manifest: "/manifest.json",
  applicationName: "Cosmory",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Cosmory",
  },
  formatDetection: { telephone: false },
  openGraph: {
    title: 'Cosmory Dashboard',
    description: 'Your creative social space where ideas come to life',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Cosmory Dashboard',
    description: 'Your creative social space where ideas come to life',
  },
  icons: {
    icon: [
      { url: "/cosmory-icon.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {apiOrigin && (
          <>
            <link rel="preconnect" href={apiOrigin} />
            <link rel="dns-prefetch" href={apiOrigin} />
          </>
        )}
        <script
          id="structured-data"
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <script
          id="theme-init"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />
        <script
          id="sw-register"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: swRegisterScript }}
        />
      </head>
      <body className={`${inter.variable} antialiased`}>
        <ThemeProvider>
          <LocaleProvider>
            <ConfirmDialogProvider>
              <SkipToMain />
              <AuthBootstrap />
              {children}
              {/* Site-wide contentinfo landmark — no page had one before
                  (a11y audit flagged it as a Level A issue). <footer> at the
                  end of body implies role=contentinfo natively; kept small
                  and unobtrusive so it doesn't compete with full-bleed pages
                  like Reels — it just sits below their fixed viewport. */}
              <footer className="border-t border-white/5 px-4 py-3 text-center text-[11px] text-text-secondary">
                <span>&copy; {new Date().getFullYear()} Cosmory</span>
                <span className="mx-2">&middot;</span>
                <Link href="/privacy" className="hover:underline">Privacy</Link>
                <span className="mx-2">&middot;</span>
                <Link href="/terms" className="hover:underline">Terms</Link>
              </footer>
              <CookieConsent />
              <GoogleAnalytics />
            </ConfirmDialogProvider>
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
