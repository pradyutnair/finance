export type CategoryKey =
  | "Groceries"
  | "Restaurant"
  | "Transport"
  | "Travel"
  | "Shopping"
  | "Utilities"
  | "Entertainment"
  | "Health"
  | "Income"
  | "Miscellaneous"
  | "Uncategorized"

export const CATEGORIES: Record<CategoryKey, { color: string }> = {
  Groceries: { color: "#e5e7eb" },       // light gray
  Restaurant: { color: "#ef4444" },      // red
  Transport: { color: "#3b82f6" },       // blue
  Travel: { color: "#06b6d4" },          // cyan/teal
  Shopping: { color: "#a855f7" },        // purple
  Utilities: { color: "#40221a" },       // darker chocolate brown
  Entertainment: { color: "#ec4899" },   // pink
  Health: { color: "#22c55e" },          // green
  Income: { color: "#0d9488" },          // emerald/teal (different family than Health)
  Miscellaneous: { color: "#9333ea" },   // violet (darker purple, distinct from Shopping)
  Uncategorized: { color: "#6b7280" },   // neutral gray
}

export function getCategoryColor(category?: string): string {
  if (!category) return CATEGORIES["Uncategorized"].color
  return (CATEGORIES as any)[category]?.color || CATEGORIES["Uncategorized"].color
}

export const CATEGORY_OPTIONS: CategoryKey[] = Object.keys(CATEGORIES) as CategoryKey[]


