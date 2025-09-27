'use client'

import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'

export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-96">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        className="w-12 h-12"
      >
        <Loader2 className="w-full h-full text-primary" />
      </motion.div>
    </div>
  )
}

export function LoadingCard() {
  return (
    <div className="h-24 bg-muted animate-pulse rounded-lg"></div>
  )
}

export function LoadingChart() {
  return (
    <div className="h-96 bg-muted animate-pulse rounded-lg"></div>
  )
}