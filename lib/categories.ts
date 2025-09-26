export type CategoryKey =
  | "Groceries"
  | "Restaurant"
  | "Transport"
  | "Shopping"
  | "Utilities"
  | "Entertainment"
  | "Health"
  | "Income"
  | "Miscellaneous"
  | "Uncategorized"

export const CATEGORIES: Record<CategoryKey, { color: string }> = {
  Groceries: { color: "#f97316" },       // orange
  Restaurant: { color: "#e11d48" },      // rose/red
  Transport: { color: "#3b82f6" },       // blue
  Shopping: { color: "#8b5cf6" },        // purple
  Utilities: { color: "#ef4444" },       // red
  Entertainment: { color: "#10b981" },   // green
  Health: { color: "#f59e0b" },          // amber
  Income: { color: "#16a34a" },          // darker green
  Miscellaneous: { color: "#000080" },   // navy blue
  Uncategorized: { color: "#6b7280" },   // gray
}

export function getCategoryColor(category?: string): string {
  if (!category) return CATEGORIES["Uncategorized"].color
  return (CATEGORIES as any)[category]?.color || CATEGORIES["Uncategorized"].color
}

export const CATEGORY_OPTIONS: CategoryKey[] = Object.keys(CATEGORIES) as CategoryKey[]


