import withBundleAnalyzer from '@next/bundle-analyzer'

const analyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // ── Production: standalone output for Docker (150MB vs 1GB) ──
  output: 'standalone',

  // ── Remove X-Powered-By header ───────────────────────────────
  poweredBy: false,

  // ── Compression (gzip built-in) ──────────────────────────────
  compress: true,

  // ── Tree-shaking optimizations ───────────────────────────────
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'framer-motion',
      'recharts',
    ],
  },

  // ── Image optimization ───────────────────────────────────────
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },

  webpack: (config, { isServer }) => {
    // Enable Web Workers in Next.js (asset/resource for .worker.ts files)
    if (!isServer) {
      // Workers are handled natively by webpack 5 via new Worker(new URL(...))
      // No extra loader needed — just ensure .ts worker files are transpiled
    }
    return config
  },

  // ── Security headers ─────────────────────────────────────────
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
      // Cache static assets aggressively
      {
        source: '/icons/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ]
  },

  // ── API proxy rewrites ───────────────────────────────────────
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/:path*`,
      },
    ]
  },
}

export default analyzer(nextConfig)
