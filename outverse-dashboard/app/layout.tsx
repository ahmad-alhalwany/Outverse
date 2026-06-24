import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { LocaleProvider } from "@/components/LocaleProvider";
import AuthBootstrap from "@/components/AuthBootstrap";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const themeInitScript = `(function(){try{var t=localStorage.getItem('outverse-theme');if(t==='light'){document.documentElement.classList.add('light');}}catch(e){}})();`;

export const metadata: Metadata = {
  title: "Outverse Dashboard",
  description: "Your creative social space where ideas come to life",
  openGraph: {
    title: 'Outverse Dashboard',
    description: 'Your creative social space where ideas come to life',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Outverse Dashboard',
    description: 'Your creative social space where ideas come to life',
  },
  icons: {
    icon: [{ url: "/vercel.svg", type: "image/svg+xml" }],
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
      </head>
      <body className={`${inter.variable} antialiased`}>
        <ThemeProvider>
          <LocaleProvider>
            <AuthBootstrap />
            {children}
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
