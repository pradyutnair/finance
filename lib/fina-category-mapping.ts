import type { CategoryKey } from "./categories";

/**
 * Maps Fina API categories (130+ fine-grained categories) to our internal categories.
 * Based on Fina's category structure from their API documentation.
 */
export function mapFinaCategory(finaCategory: string): CategoryKey {
  const category = finaCategory.toLowerCase().trim();

  // Income categories
  if (
    category.startsWith("income.") ||
    category === "primary paycheck" ||
    category === "business income" ||
    category === "repayment from others" ||
    category === "other income"
  ) {
    return "Income";
  }

  // Bank Transfer categories
  if (
    category.startsWith("transfer_in.") ||
    category.startsWith("transfer_out.") ||
    category === "transfer" ||
    category === "credit card payment" ||
    category.startsWith("loan_payments.")
  ) {
    return "Bank Transfer";
  }

  // Groceries categories
  if (
    category === "food_and_drink.groceries" ||
    category === "groceries"
  ) {
    return "Groceries";
  }

  // Restaurants categories
  if (
    category === "food_and_drink.restaurant" ||
    category === "food_and_drink.fast_food" ||
    category === "food_and_drink.coffee" ||
    category === "food_and_drink.beer_wine_and_liquor" ||
    category === "food_and_drink.vending_machines" ||
    category === "food_and_drink.other_food_and_drink" ||
    category === "restaurants & other"
  ) {
    return "Restaurants";
  }

  // Education categories
  if (
    category === "general_services.education" ||
    category === "education"
  ) {
    return "Education";
  }

  // Transport categories
  if (
    category.startsWith("transportation.") ||
    category === "auto & transport" ||
    category === "vehicle & repairs" ||
    category === "gas" ||
    category === "other transportation"
  ) {
    return "Transport";
  }

  // Travel categories
  if (
    category.startsWith("travel.") ||
    category === "travel & vacation"
  ) {
    return "Travel";
  }

  // Shopping categories
  if (
    category.startsWith("general_merchandise.") ||
    category === "shopping" ||
    category === "clothing" ||
    category === "other shopping"
  ) {
    return "Shopping";
  }

  // Utilities categories
  if (
    category.startsWith("rent_and_utilities.") ||
    category === "bills & utilities" ||
    category === "home" ||
    category.startsWith("home.") ||
    category === "subscriptions"
  ) {
    return "Utilities";
  }

  // Entertainment categories
  if (
    category.startsWith("entertainment.") ||
    category === "entertainment & lifestyle"
  ) {
    return "Entertainment";
  }

  // Health categories
  if (
    category.startsWith("medical.") ||
    category === "health & wellness" ||
    category === "gym" ||
    category === "other health & wellness" ||
    category.startsWith("personal_care.") ||
    category === "family & pets"
  ) {
    return "Health";
  }

  // Bank fees -> Miscellaneous
  if (category.startsWith("bank_fees.")) {
    return "Miscellaneous";
  }

  // Government, taxes, insurance -> Miscellaneous
  if (
    category.startsWith("government_and_non_profit.") ||
    category.startsWith("insurance.") ||
    category === "taxes" ||
    category === "insurance" ||
    category === "gifts & donations" ||
    category === "loans & financial fees" ||
    category === "business & work"
  ) {
    return "Miscellaneous";
  }

  // General services -> Miscellaneous
  if (
    category.startsWith("general_services.") &&
    category !== "general_services.education"
  ) {
    return "Miscellaneous";
  }

  // Investment categories -> Miscellaneous
  if (
    category.startsWith("investment_") ||
    category === "investments"
  ) {
    return "Miscellaneous";
  }

  // Other expenses
  if (category === "other_expenses" || category === "other expenses") {
    return "Miscellaneous";
  }

  // Default to Uncategorized if no match
  return "Uncategorized";
}

/**
 * Batch map multiple Fina categories
 */
export function mapFinaCategories(finaCategories: string[]): CategoryKey[] {
  return finaCategories.map(mapFinaCategory);
}
