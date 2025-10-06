import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/header";
import { Toaster } from "@/components/ui/sonner";
import { AppErrorBoundary } from "@/components/error-boundaries";
import { ConnectionMonitor } from "@/components/connection-monitor";
import { PerformanceMonitor } from "@/components/monitoring/PerformanceMonitor";

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
          <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1">
              {children}
            </main>
          </div>
          <Toaster />
        </AppErrorBoundary>
      </body>
    </html>
  );
}
