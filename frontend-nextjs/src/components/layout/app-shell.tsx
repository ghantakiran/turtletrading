'use client'

import { useState, useEffect } from 'react'
import { User } from '@/lib/auth/actions'
import { AppHeader } from './app-header'
import { AppSidebar } from './app-sidebar'
import { AppFooter } from './app-footer'
import { cn } from '@/lib/utils'
import { useMediaQuery } from '@/hooks/use-media-query'

interface AppShellProps {
  children: React.ReactNode
  user: User
}

export function AppShell({ children, user }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const isMobile = useMediaQuery('(max-width: 768px)')

  // Close sidebar when switching to mobile
  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false)
    }
  }, [isMobile])

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <AppHeader
        user={user}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />

      <div className="flex min-h-[calc(100vh-4rem)]">
        {/* Sidebar */}
        <AppSidebar
          user={user}
          open={sidebarOpen}
          setOpen={setSidebarOpen}
          isMobile={isMobile}
        />

        {/* Mobile overlay */}
        {isMobile && sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main content */}
        <main className={cn(
          "flex-1 transition-all duration-300 ease-in-out",
          sidebarOpen && !isMobile ? "ml-64" : "",
          isMobile ? "ml-0" : ""
        )}>
          <div className="container mx-auto px-4 py-6 max-w-7xl">
            {children}
          </div>
        </main>
      </div>

      {/* Footer */}
      <AppFooter />
    </div>
  )
}