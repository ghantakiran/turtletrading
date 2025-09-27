'use client'

import { Badge } from '@/components/ui/badge'
import { Activity, ExternalLink, Server, Wifi } from 'lucide-react'
import Link from 'next/link'

export function AppFooter() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t border-border bg-card/30 backdrop-blur-sm mt-auto">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Left side - Brand and links */}
          <div className="flex flex-col md:flex-row items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Activity className="h-4 w-4 text-white" />
              </div>
              <span className="text-sm font-medium">TurtleTrading</span>
            </div>

            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <Link
                href="/docs"
                className="hover:text-foreground transition-colors flex items-center gap-1"
              >
                API Docs <ExternalLink className="h-3 w-3" />
              </Link>
              <Link
                href="/support"
                className="hover:text-foreground transition-colors"
              >
                Support
              </Link>
            </div>
          </div>

          {/* Center - System status */}
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="gap-2 text-xs">
              <Server className="h-3 w-3 text-green-500" />
              All Systems Operational
            </Badge>
            <Badge variant="outline" className="gap-2 text-xs">
              <Wifi className="h-3 w-3 text-green-500" />
              Market Data Live
            </Badge>
          </div>

          {/* Right side - Copyright */}
          <div className="text-xs text-muted-foreground">
            © {currentYear} TurtleTrading. All rights reserved.
          </div>
        </div>

        {/* Additional info */}
        <div className="mt-4 pt-4 border-t border-border/50 text-center">
          <p className="text-xs text-muted-foreground">
            Powered by AI • Real-time Market Data • Institutional-grade Analytics
          </p>
        </div>
      </div>
    </footer>
  )
}