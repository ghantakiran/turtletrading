import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/header";
import { Toaster } from "@/components/ui/sonner";
import { AppErrorBoundary } from "@/components/error-boundaries";
import { ConnectionMonitor } from "@/components/connection-monitor";
import { PerformanceMonitor } from "@/components/monitoring/PerformanceMonitor";
import { BottomNavigation } from "@/components/mobile/bottom-navigation";
import { OfflineProvider } from "@/components/offline/OfflineProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TurtleTrading - AI-Powered Trading Platform",
  description: "Advanced AI-powered stock market analysis platform with real-time data, LSTM predictions, and comprehensive technical indicators",
  keywords: "stock trading, AI analysis, machine learning, LSTM, technical indicators, portfolio management",
  manifest: "/manifest.json",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#3b82f6" },
    { media: "(prefers-color-scheme: dark)", color: "#3b82f6" },
  ],
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
    userScalable: true,
    viewportFit: "cover",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "TurtleTrading",
  },
  applicationName: "TurtleTrading",
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/icon-152x152.png", sizes: "152x152", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-background text-foreground`}
      >
        <AppErrorBoundary>
          <PerformanceMonitor />
          <ConnectionMonitor />
          <OfflineProvider>
            <div className="flex flex-col min-h-screen">
              <Header />
              <main className="flex-1 pb-20 md:pb-0">
                {children}
              </main>
              <BottomNavigation />
            </div>
          </OfflineProvider>
          <Toaster />
        </AppErrorBoundary>
      </body>
    </html>
  );
}
