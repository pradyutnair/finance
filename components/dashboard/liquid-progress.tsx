"use client"

import React from "react"
import "./liquid-progress.css"

interface LiquidProgressProps {
  value: number
  className?: string
  gradientClass?: string
}

export function LiquidProgress({ value, className = "", gradientClass }: LiquidProgressProps) {
  return (
    <div className={`liquid-progress ${className}`}>
      <div
        className={`liquid-progress-bar ${gradientClass}`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
      <div className="liquid-progress-overlay" />
    </div>
  )
}