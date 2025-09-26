export type CategoryKey =
  | "Food & Drink"
  | "Transport"
  | "Shopping"
  | "Bills"
  | "Entertainment"
  | "Health"
  | "Income"
  | "Savings"
  | "Uncategorized"

export const CATEGORIES: Record<CategoryKey, { color: string }> = {
  "Food & Drink": { color: "#f97316" },
  Transport: { color: "#3b82f6" },
  Shopping: { color: "#8b5cf6" },
  Bills: { color: "#ef4444" },
  Entertainment: { color: "#10b981" },
  Health: { color: "#f59e0b" },
  Income: { color: "#16a34a" },
  Savings: { color: "#22c55e" },
  Uncategorized: { color: "#6b7280" },
}

export function getCategoryColor(category?: string): string {
  if (!category) return CATEGORIES["Uncategorized"].color
  return (CATEGORIES as any)[category]?.color || CATEGORIES["Uncategorized"].color
}

export const CATEGORY_OPTIONS: CategoryKey[] = Object.keys(CATEGORIES) as CategoryKey[]


