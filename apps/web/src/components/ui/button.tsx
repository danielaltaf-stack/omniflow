'use client'

import { forwardRef } from 'react'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

const variants = {
  primary:
    'bg-brand text-white hover:bg-brand-dark active:scale-[0.97] shadow-lg shadow-brand/20',
  secondary:
    'bg-surface text-foreground hover:bg-surface-hover active:scale-[0.97] border border-border',
  ghost:
    'bg-transparent text-foreground-secondary hover:bg-surface hover:text-foreground active:scale-[0.97]',
  danger:
    'bg-loss text-white hover:bg-loss/90 active:scale-[0.97] shadow-lg shadow-loss/20',
} as const

const sizes = {
  sm: 'h-8 px-3 text-sm rounded-omni-sm',
  md: 'h-10 px-5 text-sm rounded-omni',
  lg: 'h-12 px-6 text-base rounded-omni',
} as const

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants
  size?: keyof typeof sizes
  isLoading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 font-medium transition-all duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          'disabled:pointer-events-none disabled:opacity-50',
          variants[variant],
          sizes[size],
          className
        )}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'
