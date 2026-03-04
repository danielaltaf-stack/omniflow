'use client'

import { useMemo, useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MapPin, Filter, Eye, EyeOff, RotateCcw,
  X, Loader2, BarChart3,
} from 'lucide-react'
import { formatAmount } from '@/lib/format'
import type { RealEstateProperty } from '@/types/api'

/* ─── Constants ──────────────────────────────────────────── */
const FRANCE_CENTER: [number, number] = [46.6034, 2.3488]
const FRANCE_ZOOM = 6

const TYPE_LABELS: Record<string, string> = {
  apartment: 'Appartement', house: 'Maison', parking: 'Parking',
  commercial: 'Local commercial', land: 'Terrain', other: 'Autre',
}

const TYPE_COLORS: Record<string, string> = {
  apartment: '#3B82F6', house: '#22C55E', parking: '#6B7280',
  commercial: '#F97316', land: '#92400E', other: '#8B5CF6',
}

const TYPE_ICONS: Record<string, string> = {
  apartment: 'M3 3h18v18H3V3zm2 2v14h14V5H5zm2 2h4v4H7V7zm6 0h4v2h-4V7zm0 4h4v2h-4v-2zM7 13h4v2H7v-2z',
  house: 'M12 3L2 12h3v8h6v-6h2v6h6v-8h3L12 3zm0 3.19L18 12v7h-3v-6H9v6H6v-7l6-5.81z',
  parking: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3h3.5c1.66 0 3 1.34 3 3s-1.34 3-3 3H14v4h-2V5zm2 4h1.5c.55 0 1-.45 1-1s-.45-1-1-1H14v2z',
  commercial: 'M20 4H4v2h16V4zm1 10v-2l-1-5H4l-1 5v2h1v6h10v-6h4v6h2v-6h1zm-9 4H6v-4h6v4z',
  land: 'M14 6l-3.75 5 2.85 3.8-1.6 1.2C9.81 13.75 7 10 7 10l-6 8h22L14 6z',
  other: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z',
}

const CITY_COORDS: Record<string, [number, number]> = {
  'paris': [48.8566, 2.3522], 'lyon': [45.7578, 4.8320],
  'marseille': [43.2965, 5.3698], 'toulouse': [43.6047, 1.4442],
  'nice': [43.7102, 7.2620], 'nantes': [47.2184, -1.5536],
  'strasbourg': [48.5734, 7.7521], 'montpellier': [43.6108, 3.8767],
  'bordeaux': [44.8378, -0.5792], 'lille': [50.6292, 3.0573],
  'rennes': [48.1173, -1.6778], 'reims': [49.2583, 4.0317],
  'toulon': [43.1242, 5.928], 'grenoble': [45.1885, 5.7245],
  'dijon': [47.3220, 5.0415], 'angers': [47.4784, -0.5632],
  'tours': [47.3941, 0.6848], 'clermont-ferrand': [45.7772, 3.0870],
  'rouen': [49.4432, 1.0993], 'metz': [49.1193, 6.1757],
}

const DEPT_COORDS: Record<string, [number, number]> = {
  '75': [48.8566, 2.3522], '92': [48.8283, 2.2181], '93': [48.9137, 2.4830],
  '94': [48.7904, 2.4554], '91': [48.5243, 2.2125], '78': [48.8035, 2.1266],
  '95': [49.0335, 2.0616], '77': [48.5617, 2.8802],
  '13': [43.5297, 5.4474], '69': [45.7640, 4.8357], '31': [43.6047, 1.4442],
  '33': [44.8378, -0.5792], '06': [43.6961, 7.2719], '34': [43.6108, 3.8767],
  '44': [47.2184, -1.5536], '67': [48.5734, 7.7521], '59': [50.6292, 3.0573],
  '35': [48.1173, -1.6778], '38': [45.1885, 5.7245], '76': [49.4432, 1.0993],
}

const TILE_LAYERS = {
  light: { name: 'Plan', url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', icon: '🗺️' },
  satellite: { name: 'Satellite', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', icon: '🛰️' },
  osm: { name: 'OSM', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', icon: '🌐' },
}

const POI_CATEGORIES: Record<string, { label: string; color: string; icon: string }> = {
  transport: { label: 'Transports', color: '#3B82F6', icon: '🚇' },
  education: { label: 'Éducation', color: '#8B5CF6', icon: '🏫' },
  health: { label: 'Santé', color: '#EF4444', icon: '🏥' },
  commerce: { label: 'Commerces', color: '#F97316', icon: '🛒' },
  parks: { label: 'Parcs', color: '#22C55E', icon: '🌳' },
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || ''

/* ─── Helpers ────────────────────────────────────────────── */
function getCoordsForProperty(p: RealEstateProperty): [number, number] | null {
  if (p.latitude && p.longitude) return [p.latitude, p.longitude]
  const city = p.city?.toLowerCase().trim()
  if (city) {
    if (CITY_COORDS[city]) return CITY_COORDS[city]!
    for (const [name, coords] of Object.entries(CITY_COORDS)) {
      if (city.includes(name) || name.includes(city)) return coords
    }
  }
  if (p.postal_code) {
    const dept = p.postal_code.slice(0, 2)
    if (DEPT_COORDS[dept]) return DEPT_COORDS[dept]!
  }
  return null
}

function yieldColor(grossYield: number, hasRent: boolean): string {
  if (!hasRent) return '#6B7280'
  if (grossYield > 6) return '#22C55E'
  if (grossYield >= 3) return '#EAB308'
  return '#EF4444'
}

function markerSize(valueCentimes: number): number {
  const euros = valueCentimes / 100
  const min = 26, max = 44, minVal = 50000, maxVal = 2000000
  return Math.round(min + (max - min) * Math.min(1, Math.max(0, (euros - minVal) / (maxVal - minVal))))
}

function dvfHeatColor(priceM2: number): string {
  if (priceM2 < 3000) return '#3B82F6'
  if (priceM2 < 5000) return '#F97316'
  if (priceM2 < 8000) return '#EF4444'
  return '#DC2626'
}

function createSvgMarkerHtml(type: string, size: number, yieldCol: string, isSelected: boolean): string {
  const color = TYPE_COLORS[type] || TYPE_COLORS.other
  const path = TYPE_ICONS[type] || TYPE_ICONS.other
  const iconSize = Math.round(size * 0.45)
  const selectedRing = isSelected
    ? `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 1}" fill="none" stroke="#F59E0B" stroke-width="3" stroke-dasharray="4 2"><animate attributeName="stroke-dashoffset" values="0;12" dur="1s" repeatCount="indefinite"/></circle>`
    : ''
  return `<svg width="${size}" height="${size + 8}" viewBox="0 0 ${size} ${size + 8}" xmlns="http://www.w3.org/2000/svg">
    ${selectedRing}
    <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 4}" fill="${color}" opacity="0.9"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 2}" fill="none" stroke="${yieldCol}" stroke-width="2.5" opacity="0.85"/>
    <svg x="${(size - iconSize) / 2}" y="${(size - iconSize) / 2}" width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" fill="white">
      <path d="${path}"/>
    </svg>
    <polygon points="${size / 2 - 4},${size - 2} ${size / 2},${size + 6} ${size / 2 + 4},${size - 2}" fill="${color}" opacity="0.9"/>
  </svg>`
}

/* ─── Filter state ───────────────────────────────────────── */
interface Filters {
  types: Set<string>
  minValue: number
  maxValue: number
  minYield: number
  minSurface: number
  citySearch: string
}

const DEFAULT_FILTERS: Filters = {
  types: new Set(['apartment', 'house', 'parking', 'commercial', 'land', 'other']),
  minValue: 0, maxValue: 5000000,
  minYield: 0, minSurface: 0, citySearch: '',
}

/* ─── Props ──────────────────────────────────────────────── */
interface Props {
  properties: RealEstateProperty[]
  onPropertyClick?: (property: RealEstateProperty) => void
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export default function FrancePropertyMap({ properties, onPropertyClick }: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  const leafletRef = useRef<{
    map: any; L: any; clusterGroup: any; tileLayer: any; dvfLayer: any; poiLayer: any
  } | null>(null)

  const [mapReady, setMapReady] = useState(false)
  const [activeTile, setActiveTile] = useState<keyof typeof TILE_LAYERS>('light')
  const [showFilters, setShowFilters] = useState(false)
  const [showDvf, setShowDvf] = useState(false)
  const [showPoi, setShowPoi] = useState(false)
  const [poiCategories, setPoiCategories] = useState<Set<string>>(new Set(Object.keys(POI_CATEGORIES)))
  const [filters, setFilters] = useState<Filters>({ ...DEFAULT_FILTERS, types: new Set(DEFAULT_FILTERS.types) })
  // F1.6: Debounce filter changes — map only re-renders after 300ms of inactivity
  const [debouncedFilters, setDebouncedFilters] = useState<Filters>(filters)
  const filterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (filterTimerRef.current) clearTimeout(filterTimerRef.current)
    filterTimerRef.current = setTimeout(() => setDebouncedFilters(filters), 300)
    return () => { if (filterTimerRef.current) clearTimeout(filterTimerRef.current) }
  }, [filters])
  const [comparisonA, setComparisonA] = useState<RealEstateProperty | null>(null)
  const [comparisonB, setComparisonB] = useState<RealEstateProperty | null>(null)
  const [dvfData, setDvfData] = useState<Map<string, any>>(new Map())
  const [poiData, setPoiData] = useState<any[]>([])
  const [loadingPoi, setLoadingPoi] = useState(false)
  const [loadingDvf, setLoadingDvf] = useState(false)

  /* ─── Filter properties (debounced — F1.6) ──────────────── */
  const filtered = useMemo(() => {
    return properties.filter(p => {
      if (!debouncedFilters.types.has(p.property_type)) return false
      const val = p.current_value / 100
      if (val < debouncedFilters.minValue || val > debouncedFilters.maxValue) return false
      if (p.gross_yield_pct < debouncedFilters.minYield) return false
      if (debouncedFilters.minSurface > 0 && p.surface_m2 && p.surface_m2 < debouncedFilters.minSurface) return false
      if (debouncedFilters.citySearch && (!p.city || !p.city.toLowerCase().includes(debouncedFilters.citySearch.toLowerCase()))) return false
      return true
    })
  }, [properties, debouncedFilters])

  const propertyMarkers = useMemo(() => {
    return filtered
      .map(p => ({ property: p, coords: getCoordsForProperty(p) }))
      .filter((m): m is { property: RealEstateProperty; coords: [number, number] } => m.coords !== null)
  }, [filtered])

  /* ─── Analytics ────────────────────────────────────────── */
  const analytics = useMemo(() => {
    const vis = filtered
    const total = vis.reduce((s, p) => s + p.current_value, 0)
    const totalCashflow = vis.reduce((s, p) => s + p.net_monthly_cashflow, 0)
    const weighted = vis.reduce((s, p) => s + p.gross_yield_pct * p.current_value, 0)
    const avgYield = total > 0 ? weighted / total : 0
    const byType: Record<string, number> = {}
    vis.forEach(p => { byType[p.property_type] = (byType[p.property_type] || 0) + 1 })
    return { totalValue: total, totalCashflow, avgYield, byType, count: vis.length, total: properties.length }
  }, [filtered, properties.length])

  /* ─── Comparison handler ───────────────────────────────── */
  const handleMarkerClick = useCallback((p: RealEstateProperty, shiftKey: boolean) => {
    if (shiftKey) {
      if (!comparisonA) setComparisonA(p)
      else if (!comparisonB && comparisonA.id !== p.id) setComparisonB(p)
      else { setComparisonA(p); setComparisonB(null) }
    }
  }, [comparisonA, comparisonB])

  /* ─── Initialize Leaflet ───────────────────────────────── */
  useEffect(() => {
    if (!mapRef.current || leafletRef.current) return

    const loadCss = (url: string) => {
      if (!document.querySelector(`link[href="${url}"]`)) {
        const link = document.createElement('link')
        link.rel = 'stylesheet'; link.href = url
        document.head.appendChild(link)
      }
    }
    loadCss('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css')
    loadCss('https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css')
    loadCss('https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css')

    const loadScript = (url: string): Promise<void> => {
      return new Promise((resolve) => {
        if (document.querySelector(`script[src="${url}"]`)) { resolve(); return }
        const s = document.createElement('script')
        s.src = url; s.onload = () => resolve()
        document.head.appendChild(s)
      })
    }

    import('leaflet').then(async (L) => {
      const Leaf = (L as any).default || L

      delete (Leaf.Icon.Default.prototype as any)._getIconUrl
      Leaf.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      await loadScript('https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js')

      setTimeout(() => {
        if (!mapRef.current || leafletRef.current) return

        const map = Leaf.map(mapRef.current, {
          center: FRANCE_CENTER, zoom: FRANCE_ZOOM,
          scrollWheelZoom: true, zoomControl: true,
          preferCanvas: true,  // F1.6: Canvas renderer — 5x faster for 100+ markers
        })

        const tileLayer = Leaf.tileLayer(TILE_LAYERS.light.url, {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
          maxZoom: 19,
          keepBuffer: 4,  // F1.6: preload adjacent tiles
          updateWhenZooming: false,  // F1.6: no redraw during zoom animation
        }).addTo(map)

        const MCG = (Leaf as any).markerClusterGroup || (Leaf as any).MarkerClusterGroup
        const clusterGroup = MCG
          ? MCG({
            maxClusterRadius: 50,
            showCoverageOnHover: true,
            spiderfyOnMaxZoom: true,
            animateAddingMarkers: true,
            iconCreateFunction: (cluster: any) => {
              const count = cluster.getChildCount()
              let cls = 'marker-cluster-small'
              if (count >= 10) cls = 'marker-cluster-medium'
              if (count >= 25) cls = 'marker-cluster-large'
              return Leaf.divIcon({
                html: `<div><span>${count}</span></div>`,
                className: `marker-cluster ${cls}`,
                iconSize: Leaf.point(40, 40),
              })
            },
          })
          : Leaf.layerGroup()
        clusterGroup.addTo(map)

        const dvfLayer = Leaf.layerGroup().addTo(map)
        const poiLayer = Leaf.layerGroup().addTo(map)

        leafletRef.current = { map, L: Leaf, clusterGroup, tileLayer, dvfLayer, poiLayer }
        setMapReady(true)
      }, 150)
    })

    return () => {
      if (leafletRef.current) {
        leafletRef.current.map.remove()
        leafletRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ─── Update markers ───────────────────────────────────── */
  useEffect(() => {
    if (!mapReady || !leafletRef.current) return
    const { map, L, clusterGroup } = leafletRef.current

    clusterGroup.clearLayers()

    propertyMarkers.forEach(({ property: p, coords }) => {
      const size = markerSize(p.current_value)
      const yc = yieldColor(p.gross_yield_pct, p.monthly_rent > 0)
      const isSelected = comparisonA?.id === p.id || comparisonB?.id === p.id
      const html = createSvgMarkerHtml(p.property_type, size, yc, isSelected)

      const icon = L.divIcon({
        html, className: 'omni-marker',
        iconSize: [size, size + 8],
        iconAnchor: [size / 2, size + 8],
        popupAnchor: [0, -size],
      })

      const marker = L.marker(coords, { icon })
      marker.bindTooltip(
        `${p.label} — ${(p.current_value / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}${p.gross_yield_pct > 0 ? ` — ${p.gross_yield_pct.toFixed(1)}%` : ''}`,
        { direction: 'top', offset: [0, -size / 2] },
      )

      const dvfInfo = p.postal_code ? dvfData.get(p.postal_code) : null
      const dvfHtml = dvfInfo?.median_price_m2
        ? `<div style="margin-top:6px;padding-top:6px;border-top:1px solid #e5e7eb">
            <p style="font-size:10px;color:#6B7280">DVF ${p.postal_code}</p>
            <p style="font-weight:600;font-size:12px">${dvfInfo.median_price_m2.toLocaleString('fr-FR')}€/m² <span style="color:#6B7280;font-weight:400">(${dvfInfo.nb_transactions} ventes)</span></p>
           </div>` : ''

      const popup = `
        <div style="min-width:220px;max-width:280px;font-family:system-ui,sans-serif">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
            <div style="width:8px;height:8px;border-radius:50%;background:${TYPE_COLORS[p.property_type] || '#8B5CF6'}"></div>
            <h4 style="font-weight:700;font-size:13px;margin:0">${p.label}</h4>
          </div>
          <div style="font-size:11px;color:#666">
            <p style="margin:2px 0">${TYPE_LABELS[p.property_type] || p.property_type}${p.surface_m2 ? ` · ${p.surface_m2} m²` : ''}</p>
            ${p.city ? `<p style="margin:2px 0">${p.postal_code || ''} ${p.city}</p>` : ''}
            <p style="font-weight:600;font-size:14px;margin:6px 0 2px;color:#111">${(p.current_value / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}</p>
            ${p.capital_gain !== 0 ? `<p style="color:${p.capital_gain >= 0 ? '#16a34a' : '#dc2626'};margin:2px 0;font-weight:500">${p.capital_gain > 0 ? '+' : ''}${(p.capital_gain / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })} plus-value</p>` : ''}
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-top:6px">
              ${p.monthly_rent > 0 ? `<div><span style="color:#888;font-size:10px">Loyer</span><br/><span style="color:#16a34a;font-weight:500">${(p.monthly_rent / 100).toLocaleString('fr-FR')}€/mois</span></div>` : ''}
              ${p.gross_yield_pct > 0 ? `<div><span style="color:#888;font-size:10px">Rend. brut</span><br/><span style="font-weight:500">${p.gross_yield_pct.toFixed(2)}%</span></div>` : ''}
              ${p.net_net_yield_pct !== undefined && p.net_net_yield_pct !== 0 ? `<div><span style="color:#888;font-size:10px">Rend. net-net</span><br/><span style="font-weight:500;color:${p.net_net_yield_pct >= 0 ? '#16a34a' : '#dc2626'}">${p.net_net_yield_pct.toFixed(2)}%</span></div>` : ''}
              ${p.net_monthly_cashflow !== 0 ? `<div><span style="color:#888;font-size:10px">Cash-flow</span><br/><span style="font-weight:500;color:${p.net_monthly_cashflow >= 0 ? '#16a34a' : '#dc2626'}">${(p.net_monthly_cashflow / 100).toLocaleString('fr-FR')}€</span></div>` : ''}
            </div>
            ${dvfHtml}
          </div>
          ${onPropertyClick ? '<button class="omni-map-detail-btn" style="margin-top:8px;font-size:11px;color:#3b82f6;background:none;border:none;padding:2px 0;cursor:pointer;font-weight:500">Modifier ce bien →</button>' : ''}
        </div>
      `
      marker.bindPopup(popup, { maxWidth: 300 })

      marker.on('click', (e: any) => {
        handleMarkerClick(p, e?.originalEvent?.shiftKey || false)
      })
      if (onPropertyClick) {
        marker.on('popupopen', () => {
          setTimeout(() => {
            const btn = document.querySelector('.omni-map-detail-btn')
            if (btn) btn.addEventListener('click', () => onPropertyClick(p))
          }, 50)
        })
      }

      clusterGroup.addLayer(marker)
    })

    if (propertyMarkers.length > 0) {
      const bounds = L.latLngBounds(propertyMarkers.map((m: any) => m.coords))
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 })
    }
  }, [mapReady, propertyMarkers, comparisonA, comparisonB, dvfData, onPropertyClick, handleMarkerClick])

  /* ─── Tile layer switch ────────────────────────────────── */
  useEffect(() => {
    if (!leafletRef.current) return
    const { map, L, tileLayer: oldTile } = leafletRef.current
    map.removeLayer(oldTile)
    const newTile = L.tileLayer(TILE_LAYERS[activeTile].url, {
      attribution: '&copy; OSM', maxZoom: 19,
    }).addTo(map)
    leafletRef.current.tileLayer = newTile
  }, [activeTile])

  /* ─── DVF heatmap layer ────────────────────────────────── */
  useEffect(() => {
    if (!leafletRef.current) return
    const { dvfLayer, L } = leafletRef.current
    dvfLayer.clearLayers()
    if (!showDvf) return

    propertyMarkers.forEach(({ property: p, coords }) => {
      const info = p.postal_code ? dvfData.get(p.postal_code) : null
      if (info?.median_price_m2) {
        L.circle(coords, {
          radius: 800,
          color: dvfHeatColor(info.median_price_m2),
          fillColor: dvfHeatColor(info.median_price_m2),
          fillOpacity: 0.18, weight: 1, opacity: 0.4,
        }).bindTooltip(`${p.postal_code} — ${info.median_price_m2.toLocaleString('fr-FR')}€/m² (${info.nb_transactions} ventes)`)
          .addTo(dvfLayer)
      }
    })
  }, [showDvf, dvfData, propertyMarkers])

  /* ─── POI layer ────────────────────────────────────────── */
  useEffect(() => {
    if (!leafletRef.current) return
    const { poiLayer, L } = leafletRef.current
    poiLayer.clearLayers()
    if (!showPoi || !poiData.length) return

    poiData.forEach((poi: any) => {
      if (!poiCategories.has(poi.category)) return
      const cfg = POI_CATEGORIES[poi.category]
      if (!cfg) return
      L.circleMarker([poi.lat, poi.lng], {
        radius: 5, color: cfg.color, fillColor: cfg.color,
        fillOpacity: 0.7, weight: 1,
      }).bindTooltip(`${cfg.icon} ${poi.name || poi.type}`)
        .addTo(poiLayer)
    })
  }, [showPoi, poiData, poiCategories])

  /* ─── Fetch DVF data for visible postal codes ──────────── */
  const fetchDvfData = useCallback(async () => {
    const postalCodes = Array.from(new Set(filtered.filter(p => p.postal_code).map(p => p.postal_code!)))
    if (postalCodes.length === 0) return
    setLoadingDvf(true)
    const newData = new Map(dvfData)
    for (const pc of postalCodes) {
      if (newData.has(pc)) continue
      try {
        const res = await fetch(`${API_BASE}/api/v1/realestate/dvf-heatmap?postal_code=${pc}`)
        if (res.ok) newData.set(pc, await res.json())
      } catch { /* ignore */ }
    }
    setDvfData(newData)
    setLoadingDvf(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered])

  useEffect(() => {
    if (showDvf) fetchDvfData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDvf])

  /* ─── Fetch POI for first property with coords ─────────── */
  const fetchPoiData = useCallback(async () => {
    const first = propertyMarkers[0]
    if (!first) return
    setLoadingPoi(true)
    try {
      const res = await fetch(`${API_BASE}/api/v1/realestate/poi?lat=${first.coords[0]}&lng=${first.coords[1]}&radius=1000`)
      if (res.ok) {
        const data = await res.json()
        setPoiData(data.pois || [])
      }
    } catch { /* ignore */ }
    setLoadingPoi(false)
  }, [propertyMarkers])

  useEffect(() => {
    if (showPoi && poiData.length === 0) fetchPoiData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPoi])

  const resetFilters = () => setFilters({ ...DEFAULT_FILTERS, types: new Set(DEFAULT_FILTERS.types) })

  const propertiesOnMap = propertyMarkers.length
  const propertiesNotMapped = filtered.length - propertiesOnMap

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-3 text-xs text-foreground-tertiary mr-auto">
          <span className="flex items-center gap-1">
            <MapPin size={12} className="text-brand" />
            <strong className="text-foreground">{propertiesOnMap}</strong> bien{propertiesOnMap !== 1 ? 's' : ''}
          </span>
          {propertiesNotMapped > 0 && <span>({propertiesNotMapped} sans coords)</span>}
          {analytics.totalValue > 0 && <span>Total: <strong className="text-foreground">{formatAmount(analytics.totalValue)}</strong></span>}
        </div>

        {/* Tile selector */}
        <div className="flex items-center bg-surface-elevated rounded-omni-sm border border-border overflow-hidden">
          {(Object.keys(TILE_LAYERS) as (keyof typeof TILE_LAYERS)[]).map(key => (
            <button
              key={key}
              onClick={() => setActiveTile(key)}
              className={`px-2 py-1 text-xs transition-colors ${activeTile === key ? 'bg-brand text-white' : 'text-foreground-secondary hover:bg-surface'}`}
            >
              {TILE_LAYERS[key].icon} {TILE_LAYERS[key].name}
            </button>
          ))}
        </div>

        {/* Layer toggles */}
        <button
          onClick={() => setShowDvf(!showDvf)}
          className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-omni-sm border transition-colors ${showDvf ? 'bg-brand/10 border-brand text-brand' : 'border-border text-foreground-tertiary hover:bg-surface-elevated'}`}
        >
          {loadingDvf ? <Loader2 size={12} className="animate-spin" /> : showDvf ? <Eye size={12} /> : <EyeOff size={12} />}
          DVF
        </button>

        <button
          onClick={() => setShowPoi(!showPoi)}
          className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-omni-sm border transition-colors ${showPoi ? 'bg-brand/10 border-brand text-brand' : 'border-border text-foreground-tertiary hover:bg-surface-elevated'}`}
        >
          {loadingPoi ? <Loader2 size={12} className="animate-spin" /> : showPoi ? <Eye size={12} /> : <EyeOff size={12} />}
          POI
        </button>

        {/* POI category checkboxes */}
        {showPoi && (
          <div className="flex items-center gap-1">
            {Object.entries(POI_CATEGORIES).map(([key, cfg]) => (
              <button
                key={key}
                onClick={() => {
                  setPoiCategories(prev => {
                    const next = new Set(prev)
                    next.has(key) ? next.delete(key) : next.add(key)
                    return next
                  })
                }}
                className={`px-1.5 py-0.5 text-xs rounded border transition-colors ${poiCategories.has(key) ? 'border-brand/40 bg-brand/5' : 'border-border text-foreground-tertiary opacity-50'}`}
                title={cfg.label}
              >
                {cfg.icon}
              </button>
            ))}
          </div>
        )}

        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-omni-sm border transition-colors ${showFilters ? 'bg-brand/10 border-brand text-brand' : 'border-border text-foreground-tertiary hover:bg-surface-elevated'}`}
        >
          <Filter size={12} />
          Filtres
        </button>
      </div>

      {/* Map + Sidebar container */}
      <div className="relative flex gap-0">
        {/* Map */}
        <motion.div
          layout
          className="rounded-omni-lg border border-border overflow-hidden shadow-sm flex-1"
          style={{ height: 540 }}
        >
          <div ref={mapRef} style={{ height: '100%', width: '100%' }} />
          {/* Comparison hint */}
          {!comparisonA && properties.length >= 2 && (
            <div className="absolute bottom-3 left-3 z-[1000] bg-surface/90 backdrop-blur-sm text-xs text-foreground-tertiary px-2.5 py-1.5 rounded-omni-sm border border-border">
              <kbd className="px-1 py-0.5 bg-surface-elevated rounded text-[10px] mr-1">Shift</kbd>+clic pour comparer
            </div>
          )}
        </motion.div>

        {/* Filter Sidebar */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 300, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="overflow-hidden border border-border border-l-0 rounded-r-omni-lg bg-surface"
              style={{ height: 540 }}
            >
              <div className="w-[300px] h-full overflow-y-auto p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <Filter size={14} className="text-brand" /> Filtres
                  </h3>
                  <button onClick={resetFilters} className="text-xs text-foreground-tertiary hover:text-brand transition-colors flex items-center gap-1">
                    <RotateCcw size={10} /> Reset
                  </button>
                </div>

                {/* Type checkboxes */}
                <div>
                  <p className="text-xs font-medium text-foreground-secondary mb-2">Type de bien</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {Object.entries(TYPE_LABELS).map(([key, label]) => (
                      <label key={key} className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={filters.types.has(key)}
                          onChange={() => {
                            setFilters(f => {
                              const next = new Set(f.types)
                              next.has(key) ? next.delete(key) : next.add(key)
                              return { ...f, types: next }
                            })
                          }}
                          className="rounded text-brand w-3.5 h-3.5"
                        />
                        <span className="w-2 h-2 rounded-full" style={{ background: TYPE_COLORS[key] }} />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Value range */}
                <div>
                  <p className="text-xs font-medium text-foreground-secondary mb-1">Valeur (€)</p>
                  <div className="flex items-center gap-2">
                    <input type="number" placeholder="Min" value={filters.minValue || ''}
                      onChange={e => setFilters(f => ({ ...f, minValue: parseInt(e.target.value) || 0 }))}
                      className="w-full text-xs px-2 py-1.5 rounded border border-border bg-background" />
                    <span className="text-foreground-tertiary">—</span>
                    <input type="number" placeholder="Max" value={filters.maxValue === 5000000 ? '' : filters.maxValue}
                      onChange={e => setFilters(f => ({ ...f, maxValue: parseInt(e.target.value) || 5000000 }))}
                      className="w-full text-xs px-2 py-1.5 rounded border border-border bg-background" />
                  </div>
                </div>

                {/* Yield min */}
                <div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-foreground-secondary">Rendement brut min</p>
                    <span className="text-xs text-brand font-semibold tabular-nums">{filters.minYield}%</span>
                  </div>
                  <input type="range" min={0} max={15} step={0.5} value={filters.minYield}
                    onChange={e => setFilters(f => ({ ...f, minYield: parseFloat(e.target.value) }))}
                    className="w-full mt-1 accent-brand" />
                </div>

                {/* Surface min */}
                <div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-foreground-secondary">Surface min</p>
                    <span className="text-xs text-brand font-semibold tabular-nums">{filters.minSurface} m²</span>
                  </div>
                  <input type="range" min={0} max={500} step={5} value={filters.minSurface}
                    onChange={e => setFilters(f => ({ ...f, minSurface: parseInt(e.target.value) }))}
                    className="w-full mt-1 accent-brand" />
                </div>

                {/* City search */}
                <div>
                  <p className="text-xs font-medium text-foreground-secondary mb-1">Ville</p>
                  <input type="text" placeholder="Rechercher..." value={filters.citySearch}
                    onChange={e => setFilters(f => ({ ...f, citySearch: e.target.value }))}
                    className="w-full text-xs px-2 py-1.5 rounded border border-border bg-background" />
                </div>

                {/* Analytics */}
                <div className="pt-3 border-t border-border space-y-2">
                  <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <BarChart3 size={12} className="text-brand" /> Analytics
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-surface-elevated rounded p-2">
                      <p className="text-foreground-tertiary text-[10px]">Biens affichés</p>
                      <p className="font-bold text-foreground">{analytics.count} / {analytics.total}</p>
                    </div>
                    <div className="bg-surface-elevated rounded p-2">
                      <p className="text-foreground-tertiary text-[10px]">Valeur totale</p>
                      <p className="font-bold text-foreground tabular-nums">{formatAmount(analytics.totalValue)}</p>
                    </div>
                    <div className="bg-surface-elevated rounded p-2">
                      <p className="text-foreground-tertiary text-[10px]">Rend. moy. pondéré</p>
                      <p className="font-bold text-foreground tabular-nums">{analytics.avgYield.toFixed(2)}%</p>
                    </div>
                    <div className="bg-surface-elevated rounded p-2">
                      <p className="text-foreground-tertiary text-[10px]">Cash-flow net</p>
                      <p className={`font-bold tabular-nums ${analytics.totalCashflow >= 0 ? 'text-gain' : 'text-loss'}`}>
                        {formatAmount(analytics.totalCashflow)}/m
                      </p>
                    </div>
                  </div>

                  {/* Type breakdown bars */}
                  {Object.entries(analytics.byType).length > 0 && (
                    <div className="space-y-1 pt-1">
                      <p className="text-[10px] text-foreground-tertiary">Répartition</p>
                      {Object.entries(analytics.byType).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                        <div key={type} className="flex items-center gap-2 text-xs">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: TYPE_COLORS[type] }} />
                          <span className="text-foreground-secondary w-20 truncate">{TYPE_LABELS[type] || type}</span>
                          <div className="flex-1 bg-surface-elevated rounded-full h-1.5">
                            <div className="h-full rounded-full transition-all duration-300"
                              style={{ width: `${(count / analytics.count) * 100}%`, background: TYPE_COLORS[type] }} />
                          </div>
                          <span className="text-foreground-tertiary font-mono w-4 text-right">{count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Comparison panel */}
      <AnimatePresence>
        {comparisonA && (
          <motion.div
            initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
            className="rounded-omni-lg border border-border bg-surface p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground">
                {comparisonB ? 'Comparaison' : 'Mode comparaison — Shift+clic un 2ème bien'}
              </h3>
              <button onClick={() => { setComparisonA(null); setComparisonB(null) }} className="text-foreground-tertiary hover:text-foreground">
                <X size={16} />
              </button>
            </div>
            {comparisonB ? (
              <ComparisonTable a={comparisonA} b={comparisonB} />
            ) : (
              <p className="text-xs text-foreground-tertiary">
                <strong>{comparisonA.label}</strong> sélectionné. Shift+clic un autre marqueur.
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-foreground-tertiary">
        {Object.entries(TYPE_LABELS).map(([key, label]) => (
          <span key={key} className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: TYPE_COLORS[key] }} />
            {label}
          </span>
        ))}
        <span className="text-foreground-tertiary mx-1">|</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#22C55E]" /> &gt;6%</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#EAB308]" /> 3-6%</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#EF4444]" /> &lt;3%</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#6B7280]" /> sans loyer</span>
      </div>

      {/* Leaflet cluster style overrides */}
      <style jsx global>{`
        .omni-marker { background: transparent !important; border: none !important; }
        .marker-cluster { background: rgba(59,130,246,0.15); border-radius: 50%; }
        .marker-cluster div { background: rgba(59,130,246,0.85); color: white; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; margin: 4px; }
        .marker-cluster-medium { background: rgba(249,115,22,0.15); }
        .marker-cluster-medium div { background: rgba(249,115,22,0.85); }
        .marker-cluster-large { background: rgba(139,92,246,0.15); }
        .marker-cluster-large div { background: rgba(139,92,246,0.85); }
      `}</style>
    </div>
  )
}

/* ─── Comparison Table ───────────────────────────────────── */
function ComparisonTable({ a, b }: { a: RealEstateProperty; b: RealEstateProperty }) {
  const fmt = (v: number) => (v / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
  const deltaCentimes = (va: number, vb: number) => {
    const diff = va - vb
    if (diff === 0) return '='
    return `${diff > 0 ? '+' : ''}${(diff / 100).toLocaleString('fr-FR')}€`
  }
  const deltaPts = (va: number, vb: number) => {
    const diff = va - vb
    if (Math.abs(diff) < 0.01) return '='
    return `${diff > 0 ? '+' : ''}${diff.toFixed(2)} pts`
  }

  const m2a = a.surface_m2 && a.surface_m2 > 0 ? Math.round(a.current_value / 100 / a.surface_m2) : null
  const m2b = b.surface_m2 && b.surface_m2 > 0 ? Math.round(b.current_value / 100 / b.surface_m2) : null

  const rows: { label: string; va: string; vb: string; delta: string; positive: boolean }[] = [
    { label: 'Valeur', va: fmt(a.current_value), vb: fmt(b.current_value), delta: deltaCentimes(a.current_value, b.current_value), positive: a.current_value >= b.current_value },
    { label: 'Surface', va: a.surface_m2 ? `${a.surface_m2} m²` : '—', vb: b.surface_m2 ? `${b.surface_m2} m²` : '—', delta: a.surface_m2 && b.surface_m2 ? `${a.surface_m2 >= b.surface_m2 ? '+' : ''}${(a.surface_m2 - b.surface_m2).toFixed(0)} m²` : '—', positive: (a.surface_m2 || 0) >= (b.surface_m2 || 0) },
    { label: 'Prix/m²', va: m2a ? `${m2a.toLocaleString('fr-FR')}€` : '—', vb: m2b ? `${m2b.toLocaleString('fr-FR')}€` : '—', delta: m2a && m2b ? `${m2a <= m2b ? '-' : '+'}${Math.abs(m2a - m2b).toLocaleString('fr-FR')}€` : '—', positive: (m2a || Infinity) <= (m2b || Infinity) },
    { label: 'Loyer', va: `${fmt(a.monthly_rent)}/m`, vb: `${fmt(b.monthly_rent)}/m`, delta: deltaCentimes(a.monthly_rent, b.monthly_rent), positive: a.monthly_rent >= b.monthly_rent },
    { label: 'Rend. brut', va: `${a.gross_yield_pct.toFixed(2)}%`, vb: `${b.gross_yield_pct.toFixed(2)}%`, delta: deltaPts(a.gross_yield_pct, b.gross_yield_pct), positive: a.gross_yield_pct >= b.gross_yield_pct },
    { label: 'Rend. net-net', va: `${a.net_net_yield_pct.toFixed(2)}%`, vb: `${b.net_net_yield_pct.toFixed(2)}%`, delta: deltaPts(a.net_net_yield_pct, b.net_net_yield_pct), positive: a.net_net_yield_pct >= b.net_net_yield_pct },
    { label: 'Cash-flow', va: `${fmt(a.net_monthly_cashflow)}/m`, vb: `${fmt(b.net_monthly_cashflow)}/m`, delta: deltaCentimes(a.net_monthly_cashflow, b.net_monthly_cashflow), positive: a.net_monthly_cashflow >= b.net_monthly_cashflow },
  ]

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-1.5 text-foreground-tertiary font-medium w-28">Critère</th>
            <th className="text-right py-1.5 font-semibold text-foreground">{a.label}</th>
            <th className="text-right py-1.5 font-semibold text-foreground">{b.label}</th>
            <th className="text-right py-1.5 text-foreground-tertiary font-medium w-28">Delta</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.label} className="border-b border-border/50">
              <td className="py-1.5 text-foreground-secondary">{r.label}</td>
              <td className="py-1.5 text-right tabular-nums text-foreground">{r.va}</td>
              <td className="py-1.5 text-right tabular-nums text-foreground">{r.vb}</td>
              <td className={`py-1.5 text-right tabular-nums font-medium ${r.delta === '=' ? 'text-foreground-tertiary' : r.positive ? 'text-gain' : 'text-loss'}`}>{r.delta}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
