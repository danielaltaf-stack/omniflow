import { cn } from '@/lib/utils'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean
}

export function Card({ className, hover = false, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-omni-lg border border-border bg-background-tertiary p-5',
        'transition-all duration-200',
        hover &&
          'hover:-translate-y-0.5 hover:shadow-lg hover:shadow-brand/5 hover:border-border-active cursor-pointer',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
