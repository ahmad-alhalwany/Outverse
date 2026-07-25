import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { LocaleProvider } from "@/components/LocaleProvider";
import AuthBootstrap from "@/components/AuthBootstrap";
import CookieConsent from "@/components/CookieConsent";
import SkipToMain from "@/components/SkipToMain";
import ConfirmDialogProvider from "@/components/ui/ConfirmDialogProvider";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const themeInitScript = `(function(){try{var t=localStorage.getItem('cosmory-theme');if(t==='light'){document.documentElement.classList.add('light');}}catch(e){}})();`;

const swRegisterScript = `if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){/* SW registration is best-effort */});});}`;

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#1A1A2E",
};

export const metadata: Metadata = {
  title: "Cosmory Dashboard",
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
              <CookieConsent />
            </ConfirmDialogProvider>
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
