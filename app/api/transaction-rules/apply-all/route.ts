export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { Client, Databases, Query } from "appwrite";
import { requireAuthUser } from "@/lib/auth";
import { APPWRITE_CONFIG } from "@/lib/config";
import { handleApiError } from "@/lib/api-error-handler";
import { getUserTransactionCache, invalidateUserCache } from "@/lib/server/cache-service";
import { applyBestMatchingRule } from "@/lib/rule-engine";
import type { AuthUser } from "@/lib/types";
import type { RuleApplicationOptions, RuleApplicationResult } from "@/lib/types/transaction-rules";

const TRANSACTION_RULES_COLLECTION = process.env.APPWRITE_TRANSACTION_RULES_COLLECTION_ID || "transactions_rules";
const TRANSACTIONS_COLLECTION = process.env.APPWRITE_TRANSACTIONS_COLLECTION_ID || "transactions";

export async function POST(request: NextRequest) {
  try {
    const user = (await requireAuthUser(request)) as AuthUser;
    const userId = user.$id || user.id;
    if (!userId) {
      return NextResponse.json({ ok: false, error: "User ID not found" }, { status: 401 });
    }

    const options: RuleApplicationOptions = await request.json().catch(() => ({}));

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
    
    // Get all enabled rules
    const rulesResponse = await databases.listDocuments(
      APPWRITE_CONFIG.databaseId,
      TRANSACTION_RULES_COLLECTION,
      [
        Query.equal("userId", userId),
        Query.equal("enabled", true),
        Query.orderDesc("priority"),
      ]
    );

    const rules = rulesResponse.documents.map((doc: any) => {
      // Parse JSON strings back to arrays
      let conditions = [];
      let actions = [];
      
      if (typeof doc.conditions === 'string') {
        conditions = JSON.parse(doc.conditions);
      } else if (Array.isArray(doc.conditions)) {
        conditions = doc.conditions;
      }
      
      if (typeof doc.actions === 'string') {
        actions = JSON.parse(doc.actions);
      } else if (Array.isArray(doc.actions)) {
        actions = doc.actions;
      }
      
      return {
        id: doc.$id,
        userId: doc.userId,
        name: doc.name,
        description: doc.description,
        enabled: doc.enabled ?? true,
        priority: doc.priority ?? 0,
        conditions,
        conditionLogic: doc.conditionLogic || "AND",
        actions,
        matchCount: doc.matchCount ?? 0,
        lastMatched: doc.lastMatched ? new Date(doc.lastMatched) : undefined,
        createdAt: doc.createdDateTime ? new Date(doc.createdDateTime) : new Date(doc.$createdAt),
        updatedAt: new Date(doc.$updatedAt),
      };
    });

    if (rules.length === 0) {
      return NextResponse.json({
        modifiedTransactions: [],
        totalMatched: 0,
        totalModified: 0,
      });
    }

    // Get transactions
    const allTransactions = await getUserTransactionCache(userId, databases);
    let transactionsToProcess = allTransactions;
    
    if (options.limit) {
      transactionsToProcess = transactionsToProcess.slice(0, options.limit);
    }

    const modifiedIds: string[] = [];
    let totalMatched = 0;
    const errors: string[] = [];

    if (options.dryRun) {
      // Dry run - just count matches
      transactionsToProcess.forEach(t => {
        const transaction = {
          id: (t as any).transactionId || t.$id || '',
          counterparty: t.counterparty || "",
          description: t.description || "",
          amount: parseFloat(String(t.amount || 0)),
          bookingDate: t.bookingDate || t.valueDate || "",
          category: t.category || "",
          exclude: t.exclude || false,
        };
        
        const result = applyBestMatchingRule(transaction, rules);
        if (result.updated) {
          totalMatched++;
          modifiedIds.push(transaction.id);
        }
      });
    } else {
      // Actually apply the rules
      for (const t of transactionsToProcess) {
        const transaction = {
          id: (t as any).transactionId || t.$id || '',
          counterparty: t.counterparty || "",
          description: t.description || "",
          amount: parseFloat(String(t.amount || 0)),
          bookingDate: t.bookingDate || t.valueDate || "",
          category: t.category || "",
          exclude: t.exclude || false,
        };
        
        const result = applyBestMatchingRule(transaction, rules);
        if (result.updated && result.appliedRule) {
          totalMatched++;
          modifiedIds.push(transaction.id);
          
          try {
            const updates: any = {};
            if (result.transaction.category !== transaction.category) {
              updates.category = result.transaction.category;
            }
            if (result.transaction.exclude !== transaction.exclude) {
              updates.exclude = result.transaction.exclude;
            }
            if (result.transaction.description !== transaction.description) {
              updates.description = result.transaction.description;
            }
            if (result.transaction.counterparty !== transaction.counterparty) {
              updates.counterparty = result.transaction.counterparty;
            }
            
            if (Object.keys(updates).length > 0) {
              await databases.updateDocument(
                APPWRITE_CONFIG.databaseId,
                TRANSACTIONS_COLLECTION,
                transaction.id,
                updates
              );
            }

            // Update rule stats
            await databases.updateDocument(
              APPWRITE_CONFIG.databaseId,
              TRANSACTION_RULES_COLLECTION,
              result.appliedRule.id,
              {
                matchCount: (result.appliedRule.matchCount || 0) + 1,
                lastMatched: new Date().toISOString(),
              }
            );
          } catch (err) {
            errors.push(`Failed to update transaction ${transaction.id}: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      }
    }

    // Invalidate the user's transaction cache so next fetch gets fresh data
    if (totalMatched > 0) {
      invalidateUserCache(userId, 'transactions');
    }

    const result: RuleApplicationResult = {
      modifiedTransactions: modifiedIds,
      totalMatched,
      totalModified: modifiedIds.length,
      errors: errors.length > 0 ? errors : undefined,
    };

    return NextResponse.json(result);
  } catch (error: unknown) {
    return handleApiError(error, 500);
  }
}
