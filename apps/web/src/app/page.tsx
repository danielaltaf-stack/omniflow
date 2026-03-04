'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth-store'
import { Logo } from '@/components/ui/logo'

export default function RootPage() {
  const router = useRouter()
  const { isAuthenticated } = useAuthStore()

  useEffect(() => {
    // Small delay so the user sees the brand splash briefly
    const timer = setTimeout(() => {
      router.replace(isAuthenticated ? '/dashboard' : '/login')
    }, 600)
    return () => clearTimeout(timer)
  }, [isAuthenticated, router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Logo size="lg" animated />
    </div>
  )
}
