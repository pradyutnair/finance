import "server-only";
import { mapFinaCategory } from "@/lib/fina-category-mapping";
import type { CategoryKey } from "@/lib/categories";

const FINA_API_URL = "https://app.fina.money/api/resource/categorize";
const FINA_API_KEY = "fina-api-test"; // Public test key with 100 transaction limit per call
const FINA_API_MODEL = "v3"; // Using v3 (neural network with LLM) for best accuracy
const FINA_API_MAPPING = "false"; // We'll handle mapping ourselves to our categories

interface FinaTransactionV3 {
  name: string;
  merchant: string;
  amount: number;
}

interface FinaCategorizeOptions {
  /**
   * List of transactions to categorize.
   * Maximum 100 transactions per call due to API limits.
   */
  transactions: FinaTransactionV3[];
  
  /**
   * Optional partner ID for tracking API usage.
   */
  partnerId?: string;
}

/**
 * Calls the Fina API to categorize a batch of transactions.
 * 
 * @param options - Categorization options
 * @returns Array of Fina categories (fine-grained)
 * @throws Error if API call fails or input is invalid
 */
async function callFinaAPI(options: FinaCategorizeOptions): Promise<string[]> {
  const { transactions, partnerId } = options;

  if (!transactions || transactions.length === 0) {
    throw new Error("Transaction list cannot be empty");
  }

  if (transactions.length > 100) {
    throw new Error("Cannot process more than 100 transactions per call. Please batch your requests.");
  }

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    "x-api-key": FINA_API_KEY,
    "x-api-model": FINA_API_MODEL,
    "x-api-mapping": FINA_API_MAPPING,
  };

  if (partnerId) {
    headers["x-partner-id"] = partnerId;
  }

  const response = await fetch(FINA_API_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(transactions),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Fina API error (${response.status}): ${errorText}`);
  }

  const categories: string[] = await response.json();
  
  if (!Array.isArray(categories)) {
    throw new Error("Fina API returned invalid response format");
  }

  if (categories.length !== transactions.length) {
    throw new Error(
      `Fina API returned ${categories.length} categories for ${transactions.length} transactions`
    );
  }

  return categories;
}

/**
 * Categorizes a single transaction using the Fina API.
 * 
 * @param description - Transaction description
 * @param counterparty - Transaction counterparty/merchant name
 * @param amount - Transaction amount (negative for expenses, positive for income)
 * @returns Mapped category from our CategoryKey enum
 */
export async function categorizeWithFina(
  description?: string | null,
  counterparty?: string | null,
  amount?: string | number | null
): Promise<CategoryKey> {
  // V3 model uses name (description or counterparty) and merchant (counterparty or description)
  // Provide both fields for better accuracy
  const name = description || counterparty || "";
  const merchant = counterparty || "";
  const numAmount = typeof amount === "number" ? amount : parseFloat(String(amount || "0"));

  try {
    const finaCategories = await callFinaAPI({
      transactions: [{ name, merchant, amount: numAmount }],
    });

    const finaCategory = finaCategories[0];
    const mappedCategory = mapFinaCategory(finaCategory);
    
    return mappedCategory;
  } catch (error) {
    console.error("Error calling Fina API:", error);
    // Fallback to Uncategorized on error
    return "Uncategorized";
  }
}

/**
 * Categorizes multiple transactions using the Fina API with automatic batching.
 * Handles splitting requests into batches of 100 transactions (API limit).
 * 
 * @param transactions - Array of transaction objects
 * @returns Array of mapped categories
 */
export async function categorizeMultipleWithFina(
  transactions: Array<{
    description?: string | null;
    counterparty?: string | null;
    amount?: string | number | null;
  }>
): Promise<CategoryKey[]> {
  if (transactions.length === 0) {
    return [];
  }

  const results: CategoryKey[] = [];
  const batchSize = 100;

  // Process in batches of 100
  for (let i = 0; i < transactions.length; i += batchSize) {
    const batch = transactions.slice(i, i + batchSize);
    
    const finaTransactions: FinaTransactionV3[] = batch.map((tx) => ({
      name: tx.description || tx.counterparty || "",
      merchant: tx.counterparty || "",
      amount: typeof tx.amount === "number" 
        ? tx.amount 
        : parseFloat(String(tx.amount || "0")),
    }));

    try {
      const finaCategories = await callFinaAPI({
        transactions: finaTransactions,
      });

      const mappedCategories = finaCategories.map(mapFinaCategory);
      results.push(...mappedCategories);
    } catch (error) {
      console.error(`Error categorizing batch starting at index ${i}:`, error);
      // Fill with Uncategorized for failed batch
      results.push(...batch.map(() => "Uncategorized" as CategoryKey));
    }
  }

  return results;
}
