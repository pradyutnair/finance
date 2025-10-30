import { NextRequest, NextResponse } from "next/server"
import { requireAuthUser } from "@/lib/auth"
import { getUserTransactionCache } from "@/lib/server/cache-service"
import { ObjectId } from "mongodb"
import type { TransactionRuleTestRequest, TransactionRuleTestResult } from "@/lib/types/transaction-rules"

/**
 * Get the value of a field from a transaction (client-side data structure)
 */
function getFieldValue(transaction: any, field: string): string | number {
  switch (field) {
    case "counterparty":
      return transaction.counterparty || ""
    case "description":
      return transaction.description || ""
    case "amount":
      return transaction.amount || 0
    case "bookingDate":
      return transaction.bookingDate || ""
    case "category":
      return transaction.category || ""
    default:
      return ""
  }
}

// POST /api/transaction-rules/test - Test a rule against transactions
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { rule, transactionIds }: TransactionRuleTestRequest = await request.json()

    // Validate rule structure
    if (!rule.name || !rule.conditions?.length || !rule.actions?.length) {
      return NextResponse.json(
        { error: "Invalid rule structure" },
        { status: 400 }
      )
    }

    // Get the user's decrypted transactions using the cache service
    const userId = (user as any).$id || (user as any).id

    // Import Appwrite if needed for the cache service
    const { Client, Databases } = await import("appwrite")
    const appwriteClient = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    const databases = new Databases(appwriteClient)

    // Get all transactions for the user (this handles encryption/decryption automatically)
    const allTransactions = await getUserTransactionCache(userId, databases, true) // true = fetch all time

    console.log("Testing rule against", allTransactions.length, "transactions")

    // Filter transactions if specific IDs are provided
    let transactionsToTest = allTransactions
    if (transactionIds && transactionIds.length > 0) {
      transactionsToTest = allTransactions.filter(tx =>
        transactionIds.includes(tx.$id)
      )
    }

    // Apply rule matching logic client-side (since we have decrypted data)
    const matchingTransactions = transactionsToTest.filter(transaction => {
      const conditionResults = rule.conditions.map(condition => {
        const fieldValue = getFieldValue(transaction, condition.field)
        const ruleValue = condition.value

        switch (condition.operator) {
          case "equals":
            return fieldValue === ruleValue
          case "notEquals":
            return fieldValue !== ruleValue
          case "contains":
            return typeof fieldValue === "string" &&
              (condition.caseSensitive
                ? fieldValue.includes(String(ruleValue))
                : fieldValue.toLowerCase().includes(String(ruleValue).toLowerCase()))
          case "notContains":
            return typeof fieldValue === "string" &&
              (condition.caseSensitive
                ? !fieldValue.includes(String(ruleValue))
                : !fieldValue.toLowerCase().includes(String(ruleValue).toLowerCase()))
          case "startsWith":
            return typeof fieldValue === "string" &&
              (condition.caseSensitive
                ? fieldValue.startsWith(String(ruleValue))
                : fieldValue.toLowerCase().startsWith(String(ruleValue).toLowerCase()))
          case "endsWith":
            return typeof fieldValue === "string" &&
              (condition.caseSensitive
                ? fieldValue.endsWith(String(ruleValue))
                : fieldValue.toLowerCase().endsWith(String(ruleValue).toLowerCase()))
          case "greaterThan":
            return Number(fieldValue) > Number(ruleValue)
          case "lessThan":
            return Number(fieldValue) < Number(ruleValue)
          case "greaterThanOrEqual":
            return Number(fieldValue) >= Number(ruleValue)
          case "lessThanOrEqual":
            return Number(fieldValue) <= Number(ruleValue)
          default:
            return false
        }
      })

      // Combine condition results based on logic
      if (rule.conditionLogic === "OR") {
        return conditionResults.some(result => result)
      } else {
        // Default to AND
        return conditionResults.every(result => result)
      }
    })

    console.log("Rule test result: Found", matchingTransactions.length, "matching transactions")

    const result: TransactionRuleTestResult = {
      matchingTransactions: matchingTransactions.map(tx => ({
        id: tx.$id || tx._id?.toString(),
        counterparty: tx.counterparty || "",
        description: tx.description || "",
        amount: parseFloat(tx.amount?.toString() || "0") || 0,
        bookingDate: tx.bookingDate || "",
        category: tx.category || "Uncategorized",
      })),
      totalMatched: matchingTransactions.length,
      sampleSize: transactionIds ? transactionIds.length : undefined,
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error testing transaction rule:", error)
    return NextResponse.json(
      { error: "Failed to test transaction rule" },
      { status: 500 }
    )
  }
}