// Import the complete institution mapping
import { institutionIdMapping } from './institution-id-mapping'

export function getFormattedBankName(institutionId: string | undefined | null): string {
  // If no institution ID provided, return Unknown
  if (!institutionId || typeof institutionId !== 'string') {
    return "Unknown"
  }

  // Try to find the institution ID in the mapping
  const mappedName = institutionIdMapping[institutionId]

  // If found in mapping, return the mapped name
  if (mappedName) {
    return mappedName
  }

  // If not found in mapping, fall back to the original formatting logic
  const idx = institutionId.indexOf("_")
  const first = idx > -1 ? institutionId.slice(0, idx) : institutionId
  const lower = first.toLowerCase()
  const formatted = lower.length ? lower[0].toUpperCase() + lower.slice(1) : first
  
  // Remove standalone "Bank" word but keep it when part of compound words
  return formatted.replace(/\bBank\b/g, '').trim()
}

// Legacy export for backward compatibility
export function formatBankName(institutionId: string | undefined | null): string {
  return getFormattedBankName(institutionId)
}