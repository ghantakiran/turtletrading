'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface PopoverProps {
  children: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export interface PopoverTriggerProps {
  children: React.ReactNode
  asChild?: boolean
  onClick?: () => void
}

export interface PopoverContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  align?: 'start' | 'center' | 'end'
  side?: 'top' | 'right' | 'bottom' | 'left'
  sideOffset?: number
}

const Popover = React.forwardRef<HTMLDivElement, PopoverProps>(
  ({ children, open, onOpenChange }, ref) => {
    const [isOpen, setIsOpen] = React.useState(open || false)

    React.useEffect(() => {
      if (open !== undefined) {
        setIsOpen(open)
      }
    }, [open])

    const handleOpenChange = (newOpen: boolean) => {
      setIsOpen(newOpen)
      onOpenChange?.(newOpen)
    }

    return (
      <div ref={ref} className="relative inline-block">
        {React.Children.map(children, (child) => {
          if (React.isValidElement(child)) {
            return React.cloneElement(child, {
              isOpen,
              onOpenChange: handleOpenChange,
            } as any)
          }
          return child
        })}
      </div>
    )
  }
)
Popover.displayName = 'Popover'

const PopoverTrigger = React.forwardRef<HTMLElement, PopoverTriggerProps & any>(
  ({ children, asChild, onClick, isOpen, onOpenChange, ...props }, ref) => {
    const handleClick = () => {
      onClick?.()
      onOpenChange?.(!isOpen)
    }

    if (asChild) {
      return React.cloneElement(children as React.ReactElement, {
        ref,
        onClick: handleClick,
        ...props,
      })
    }

    return (
      <button ref={ref} onClick={handleClick} {...props}>
        {children}
      </button>
    )
  }
)
PopoverTrigger.displayName = 'PopoverTrigger'

const PopoverContent = React.forwardRef<HTMLDivElement, PopoverContentProps & any>(
  ({ className, children, align = 'center', side = 'bottom', sideOffset = 4, isOpen, ...props }, ref) => {
    if (!isOpen) return null

    const alignmentClasses = {
      start: 'left-0',
      center: 'left-1/2 transform -translate-x-1/2',
      end: 'right-0',
    }

    const sideClasses = {
      top: 'bottom-full mb-2',
      right: 'left-full ml-2',
      bottom: 'top-full mt-2',
      left: 'right-full mr-2',
    }

    return (
      <div
        ref={ref}
        className={cn(
          'absolute z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
          sideClasses[side],
          alignmentClasses[align],
          className
        )}
        style={{ marginTop: side === 'bottom' ? sideOffset : undefined }}
        {...props}
      >
        {children}
      </div>
    )
  }
)
PopoverContent.displayName = 'PopoverContent'

export { Popover, PopoverTrigger, PopoverContent }