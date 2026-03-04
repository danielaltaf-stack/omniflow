'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuthStore } from '@/stores/auth-store'
import { Sidebar } from '@/components/layout/sidebar'
import { BottomNav } from '@/components/layout/bottom-nav'
import { NovaChatWidget } from '@/components/ai/nova-chat'
import { CommandPalette } from '@/components/ui/command-palette'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const { isAuthenticated } = useAuthStore()

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/login')
    }
  }, [isAuthenticated, router])

  if (!isAuthenticated) return null

  const isNovaPage = pathname === '/nova' || pathname?.startsWith('/nova/')

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop/Tablet sidebar */}
      <Sidebar />

      {/* Main content area */}
      <main className="flex-1 overflow-y-auto pb-16 lg:pb-0">
        {children}
      </main>

      {/* Mobile bottom navigation */}
      <BottomNav />

      {/* Nova AI floating chat widget — hidden on /nova page and on mobile */}
      {!isNovaPage && (
        <div className="hidden md:block">
          <NovaChatWidget />
        </div>
      )}

      {/* Command palette (Ctrl+K) */}
      <CommandPalette />
    </div>
  )
}
