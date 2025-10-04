'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Book, Rocket, Shield, AlertCircle, Database, Activity, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const navigation = [
  {
    title: 'Getting Started',
    items: [
      { title: 'Overview', href: '/docs', icon: Book },
      { title: 'Quick Start', href: '/docs/quick-start', icon: Rocket },
    ],
  },
  {
    title: 'API Reference',
    items: [
      { title: 'Authentication', href: '/docs/authentication', icon: Shield },
      { title: 'Error Handling', href: '/docs/errors', icon: AlertCircle },
      { title: 'Rate Limiting', href: '/docs/rate-limits', icon: Activity },
    ],
  },
  {
    title: 'Data Models',
    items: [
      { title: 'Schemas', href: '/docs/schemas', icon: Database },
    ],
  },
]

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="container flex h-16 items-center px-4">
          <Link href="/docs" className="flex items-center space-x-2">
            <Book className="h-6 w-6" />
            <span className="font-bold">TurtleTrading Docs</span>
          </Link>
          <div className="ml-auto flex items-center space-x-4">
            <Link
              href="/api/docs"
              target="_blank"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              API Reference
            </Link>
            <Link
              href="/dashboard"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </div>

      <div className="container flex-1 items-start md:grid md:grid-cols-[220px_minmax(0,1fr)] md:gap-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-10 px-4 py-6">
        {/* Sidebar Navigation */}
        <aside className="fixed top-20 z-30 -ml-2 hidden h-[calc(100vh-4rem)] w-full shrink-0 md:sticky md:block overflow-y-auto">
          <nav className="space-y-6">
            {navigation.map((section) => (
              <div key={section.title}>
                <h4 className="mb-2 rounded-md px-2 py-1 text-sm font-semibold">
                  {section.title}
                </h4>
                <div className="space-y-1">
                  {section.items.map((item) => {
                    const Icon = item.icon
                    const isActive = pathname === item.href

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                          isActive
                            ? "bg-accent text-accent-foreground font-medium"
                            : "text-muted-foreground"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {item.title}
                        {isActive && <ChevronRight className="ml-auto h-4 w-4" />}
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="relative py-6 lg:gap-10 lg:py-8 xl:grid xl:grid-cols-[1fr_300px]">
          <div className="mx-auto w-full min-w-0">
            {children}
          </div>

          {/* Table of Contents (for future enhancement) */}
          <div className="hidden text-sm xl:block">
            <div className="sticky top-20 -mt-10 max-h-[calc(var(--vh)-4rem)] overflow-y-auto pt-10">
              <div className="space-y-2">
                <p className="font-medium">On This Page</p>
                {/* TOC will be dynamically generated */}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
