export type CategoryKey =
  | "Groceries"
  | "Restaurants"
  | "Education"
  | "Transport"
  | "Travel"
  | "Shopping"
  | "Utilities"
  | "Entertainment"
  | "Health"
  | "Income"
  | "Miscellaneous"
  | "Uncategorized"
  | "Bank Transfer"

export const CATEGORIES: Record<CategoryKey, { color: string }> = {
  Groceries: { color: "#c6cfc9" },         // silver (very light)
  Restaurants: { color: "#ef4444" },       // red
  Education: { color: "#8fc2db" },         // sky blue
  Transport: { color: "#fde68a" },         // light amber
  Travel: { color: "#3b82f6" },            // blue
  Shopping: { color: "#ac8fdb" },          // purple
  Utilities: { color: "#40221a" },         //  brown
  Entertainment: { color: "#c752bf" },     // pink
  Health: { color: "#52c7a6" },            // green
  Income: { color: "#20d462" },            // green
  Miscellaneous: { color: "#9ca3af" },     // gray
  Uncategorized: { color: "#4f5952" },     // dark gray
  'Bank Transfer': { color: "#585f96" },     // dark gray
}

export function getCategoryColor(category?: string): string {
  if (!category) return CATEGORIES["Uncategorized"].color
  return (CATEGORIES as any)[category]?.color || CATEGORIES["Uncategorized"].color
}

export const CATEGORY_OPTIONS: CategoryKey[] = Object.keys(CATEGORIES) as CategoryKey[]


