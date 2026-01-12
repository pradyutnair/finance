export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { Client, Databases, Query } from "appwrite";
import { requireAuthUser } from "@/lib/auth";
import { APPWRITE_CONFIG } from "@/lib/config";
import { handleApiError } from "@/lib/api-error-handler";
import { getUserTransactionCache, filterTransactions } from "@/lib/server/cache-service";
import { matchesRule } from "@/lib/rule-engine";
import type { AuthUser } from "@/lib/types";
import type { TransactionRuleTestRequest, TransactionRuleTestResult } from "@/lib/types/transaction-rules";

const TRANSACTIONS_COLLECTION = process.env.APPWRITE_TRANSACTIONS_COLLECTION_ID || "transactions";

export async function POST(request: NextRequest) {
  try {
    const user = (await requireAuthUser(request)) as AuthUser;
    const userId = user.$id || user.id;
    if (!userId) {
      return NextResponse.json({ ok: false, error: "User ID not found" }, { status: 401 });
    }

    const body: TransactionRuleTestRequest = await request.json();
    const { rule, transactionIds } = body;

    if (!rule || !rule.conditions || !rule.actions) {
      return NextResponse.json(
        { ok: false, error: "Invalid rule: missing conditions or actions" },
        { status: 400 }
      );
    }

    const client = new Client()
      .setEndpoint(APPWRITE_CONFIG.endpoint)
      .setProject(APPWRITE_CONFIG.projectId);
    
    const apiKey = APPWRITE_CONFIG.apiKey;
    if (apiKey) {
      (client as { headers: Record<string, string> }).headers = { 
        ...(client as { headers: Record<string, string> }).headers, 
        'X-Appwrite-Key': apiKey 
      };
    } else {
      const auth = request.headers.get("authorization") || request.headers.get("Authorization");
      const token = auth?.startsWith("Bearer ") ? auth.slice(7) : undefined;
      if (token) {
        (client as { headers: Record<string, string> }).headers = { 
          ...(client as { headers: Record<string, string> }).headers, 
          'X-Appwrite-JWT': token 
        };
      }
    }

    const databases = new Databases(client);
    
    // Get transactions to test against
    let transactions: any[];
    if (transactionIds && transactionIds.length > 0) {
      // Test against specific transactions
      const docs = await Promise.all(
        transactionIds.map(id =>
          databases.getDocument(APPWRITE_CONFIG.databaseId, TRANSACTIONS_COLLECTION, id).catch(() => null)
        )
      );
      transactions = docs.filter(Boolean) as any[];
    } else {
      // Test against all user transactions
      const allTransactions = await getUserTransactionCache(userId, databases);
      transactions = allTransactions;
    }

    // Convert to rule engine format and test
    const matchingTransactions = transactions
      .map(t => ({
        id: t.transactionId || t.$id,
        counterparty: t.counterparty || "",
        description: t.description || "",
        amount: parseFloat(String(t.amount || 0)),
        bookingDate: t.bookingDate || t.valueDate || "",
        category: t.category || "",
        exclude: t.exclude || false,
      }))
      .filter(t => {
        const testRule = {
          ...rule,
          id: "test",
          userId,
          matchCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        return matchesRule(t, testRule);
      })
      .slice(0, 100); // Limit to 100 results

    const result: TransactionRuleTestResult = {
      matchingTransactions: matchingTransactions.map(t => ({
        id: t.id,
        counterparty: t.counterparty,
        description: t.description,
        amount: t.amount,
        bookingDate: t.bookingDate,
        category: t.category,
      })),
      totalMatched: matchingTransactions.length,
      sampleSize: transactions.length,
    };

    return NextResponse.json(result);
  } catch (error: unknown) {
    return handleApiError(error, 500);
  }
}
