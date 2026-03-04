'use client'

import { useState, useRef, useCallback } from 'react'

export interface BANAddress {
  label: string
  name: string
  housenumber?: string
  street?: string
  postcode: string
  city: string
  citycode: string
  context: string
  type: string
  lat: number
  lng: number
  score: number
}

/**
 * Hook for querying Base Adresse Nationale (BAN) — French national address API.
 * Uses https://api-adresse.data.gouv.fr/search
 */
export function useAddressSearch() {
  const [results, setResults] = useState<BANAddress[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  const search = useCallback((query: string) => {
    clearTimeout(timerRef.current)
    if (query.length < 3) {
      setResults([])
      return
    }

    timerRef.current = setTimeout(async () => {
      // Abort previous request
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setIsSearching(true)
      try {
        const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=6&autocomplete=1`
        const resp = await fetch(url, { signal: controller.signal })
        const data = await resp.json()

        const addresses: BANAddress[] = (data.features || []).map((f: any) => ({
          label: f.properties.label,
          name: f.properties.name,
          housenumber: f.properties.housenumber,
          street: f.properties.street,
          postcode: f.properties.postcode,
          city: f.properties.city,
          citycode: f.properties.citycode,
          context: f.properties.context,
          type: f.properties.type,
          lat: f.geometry.coordinates[1],
          lng: f.geometry.coordinates[0],
          score: f.properties.score,
        }))

        setResults(addresses)
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setResults([])
        }
      } finally {
        setIsSearching(false)
      }
    }, 300)
  }, [])

  const clear = useCallback(() => {
    setResults([])
    clearTimeout(timerRef.current)
  }, [])

  return { results, isSearching, search, clear }
}
