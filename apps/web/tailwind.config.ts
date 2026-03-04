import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ── Background ──────────────────────────────
        background: {
          DEFAULT: 'var(--bg-primary)',
          secondary: 'var(--bg-secondary)',
          tertiary: 'var(--bg-tertiary)',
          elevated: 'var(--bg-elevated)',
        },
        surface: {
          DEFAULT: 'var(--surface)',
          hover: 'var(--surface-hover)',
        },
        border: {
          DEFAULT: 'var(--border)',
          active: 'var(--border-active)',
        },
        // ── Text ────────────────────────────────────
        foreground: {
          DEFAULT: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary: 'var(--text-tertiary)',
          disabled: 'var(--text-disabled)',
        },
        // ── Brand ───────────────────────────────────
        brand: {
          DEFAULT: '#6C5CE7',
          light: '#A29BFE',
          dark: '#4A3AB5',
        },
        // ── Semantic ────────────────────────────────
        gain: {
          DEFAULT: '#00D68F',
          bg: 'rgba(0, 214, 143, 0.1)',
        },
        loss: {
          DEFAULT: '#FF4757',
          bg: 'rgba(255, 71, 87, 0.1)',
        },
        warning: {
          DEFAULT: '#FECA57',
          bg: 'rgba(254, 202, 87, 0.1)',
        },
        info: {
          DEFAULT: '#54A0FF',
          bg: 'rgba(84, 160, 255, 0.1)',
        },
        // ── Finance categories ──────────────────────
        'cat-bank': '#54A0FF',
        'cat-crypto': '#FF9F43',
        'cat-stocks': '#6C5CE7',
        'cat-realestate': '#00D68F',
        'cat-debts': '#FF4757',
      },
      fontFamily: {
        sans: ['var(--font-inter)', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem', { lineHeight: '1.5rem' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
        '5xl': ['3rem', { lineHeight: '1' }],
      },
      borderRadius: {
        'omni': '12px',
        'omni-sm': '8px',
        'omni-lg': '16px',
      },
      animation: {
        'shimmer': 'shimmer 1.5s ease-in-out infinite',
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'shake': 'shake 0.3s ease-in-out',
        'spin-slow': 'spin 2s linear infinite',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-6px)' },
          '50%': { transform: 'translateX(6px)' },
          '75%': { transform: 'translateX(-6px)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
    },
  },
  plugins: [],
}

export default config
