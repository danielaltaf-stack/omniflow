'use client'

import { forwardRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { Eye, EyeOff } from 'lucide-react'

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  icon?: React.ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, icon, type, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false)
    const isPassword = type === 'password'
    const inputType = isPassword && showPassword ? 'text' : type

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label className="text-sm font-medium text-foreground-secondary">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground-tertiary">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            type={inputType}
            className={cn(
              'flex h-11 w-full rounded-omni border bg-surface px-4 text-sm text-foreground',
              'placeholder:text-foreground-tertiary',
              'transition-colors duration-150',
              'focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand',
              'disabled:cursor-not-allowed disabled:opacity-50',
              icon && 'pl-10',
              isPassword && 'pr-10',
              error
                ? 'border-loss focus:border-loss focus:ring-loss'
                : 'border-border hover:border-border-active',
              className
            )}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-tertiary hover:text-foreground-secondary transition-colors"
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
        {error && (
          <p className="text-xs text-loss animate-fade-in">{error}</p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'
