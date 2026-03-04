'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { apiClient } from '@/lib/api-client'

type PushPermission = 'default' | 'granted' | 'denied' | 'unsupported'

interface UsePushNotificationsReturn {
  /** Whether the browser supports push notifications */
  isSupported: boolean
  /** Current permission state */
  permission: PushPermission
  /** Whether the user is currently subscribed */
  isSubscribed: boolean
  /** Subscribe to push notifications */
  subscribe: () => Promise<boolean>
  /** Unsubscribe from push notifications */
  unsubscribe: () => Promise<boolean>
  /** Send a test push notification */
  sendTest: () => Promise<void>
  /** Loading state */
  isLoading: boolean
}

/**
 * Hook for managing Web Push Notifications (VAPID).
 * Handles subscription lifecycle: permission → subscribe → send/unsubscribe.
 */
export function usePushNotifications(): UsePushNotificationsReturn {
  const [isSupported, setIsSupported] = useState(false)
  const [permission, setPermission] = useState<PushPermission>('default')
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const vapidKeyRef = useRef<string | null>(null)

  // Check support & current state on mount
  useEffect(() => {
    const supported =
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window

    setIsSupported(supported)
    if (!supported) {
      setPermission('unsupported')
      return
    }

    setPermission(Notification.permission as PushPermission)

    // Check if already subscribed
    navigator.serviceWorker.ready.then(async (registration) => {
      const subscription = await registration.pushManager.getSubscription()
      setIsSubscribed(!!subscription)
    }).catch(() => {
      // SW not ready yet — will check again when user interacts
    })
  }, [])

  // Fetch VAPID public key from backend
  const getVapidKey = useCallback(async (): Promise<string | null> => {
    if (vapidKeyRef.current) return vapidKeyRef.current
    try {
      const data = await apiClient.get<{ public_key: string }>('/api/v1/push/vapid-key')
      vapidKeyRef.current = data.public_key
      return data.public_key
    } catch {
      console.warn('[Push] Failed to fetch VAPID key — push not configured on server')
      return null
    }
  }, [])

  // Convert VAPID key from base64url to Uint8Array
  const urlBase64ToUint8Array = useCallback((base64String: string): Uint8Array => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
  }, [])

  // Subscribe to push notifications
  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false
    setIsLoading(true)

    try {
      // 1. Request notification permission
      const result = await Notification.requestPermission()
      setPermission(result as PushPermission)
      if (result !== 'granted') {
        setIsLoading(false)
        return false
      }

      // 2. Get VAPID public key
      const vapidKey = await getVapidKey()
      if (!vapidKey) {
        console.warn('[Push] Server VAPID key not available')
        setIsLoading(false)
        return false
      }

      // 3. Get SW registration
      const registration = await navigator.serviceWorker.ready

      // 4. Subscribe via PushManager
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer,
      })

      // 5. Send subscription to backend
      const p256dh = btoa(
        String.fromCharCode(...Array.from(new Uint8Array(subscription.getKey('p256dh')!)))
      )
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')

      const auth = btoa(
        String.fromCharCode(...Array.from(new Uint8Array(subscription.getKey('auth')!)))
      )
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')

      await apiClient.post('/api/v1/push/subscribe', {
        endpoint: subscription.endpoint,
        keys: { p256dh, auth },
        user_agent: navigator.userAgent,
      })

      setIsSubscribed(true)
      setIsLoading(false)
      return true
    } catch (err) {
      console.error('[Push] Subscribe failed:', err)
      setIsLoading(false)
      return false
    }
  }, [isSupported, getVapidKey, urlBase64ToUint8Array])

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false
    setIsLoading(true)

    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

      if (subscription) {
        // Notify backend
        try {
          await apiClient.post('/api/v1/push/unsubscribe', {
            endpoint: subscription.endpoint,
          } as any)
        } catch {
          // Backend may not have this subscription — continue anyway
        }

        // Unsubscribe locally
        await subscription.unsubscribe()
      }

      setIsSubscribed(false)
      setIsLoading(false)
      return true
    } catch (err) {
      console.error('[Push] Unsubscribe failed:', err)
      setIsLoading(false)
      return false
    }
  }, [isSupported])

  // Send a test push
  const sendTest = useCallback(async () => {
    try {
      await apiClient.post('/api/v1/push/test')
    } catch (err) {
      console.error('[Push] Test push failed:', err)
    }
  }, [])

  return {
    isSupported,
    permission,
    isSubscribed,
    subscribe,
    unsubscribe,
    sendTest,
    isLoading,
  }
}
