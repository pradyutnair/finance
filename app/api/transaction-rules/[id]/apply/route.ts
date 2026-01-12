export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { Client, Databases } from "appwrite";
import { requireAuthUser } from "@/lib/auth";
import { APPWRITE_CONFIG } from "@/lib/config";
import { handleApiError } from "@/lib/api-error-handler";
import { getUserTransactionCache, invalidateUserCache } from "@/lib/server/cache-service";
import { applyBestMatchingRule } from "@/lib/rule-engine";
import type { AuthUser } from "@/lib/types";
import type { RuleApplicationOptions, RuleApplicationResult } from "@/lib/types/transaction-rules";

const TRANSACTION_RULES_COLLECTION = process.env.APPWRITE_TRANSACTION_RULES_COLLECTION_ID || "transactions_rules";
const TRANSACTIONS_COLLECTION = process.env.APPWRITE_TRANSACTIONS_COLLECTION_ID || "transactions";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = (await requireAuthUser(request)) as AuthUser;
    const userId = user.$id || user.id;
    if (!userId) {
      return NextResponse.json({ ok: false, error: "User ID not found" }, { status: 401 });
    }

    const { id } = await params;
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
    
    // Get the rule
    const ruleDoc = await databases.getDocument(
      APPWRITE_CONFIG.databaseId,
      TRANSACTION_RULES_COLLECTION,
      id
    );
    
    if (ruleDoc.userId !== userId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
    }

    // Parse JSON strings back to arrays
    let conditions = [];
    let actions = [];
    
    if (typeof ruleDoc.conditions === 'string') {
      conditions = JSON.parse(ruleDoc.conditions);
    } else if (Array.isArray(ruleDoc.conditions)) {
      conditions = ruleDoc.conditions;
    }
    
    if (typeof ruleDoc.actions === 'string') {
      actions = JSON.parse(ruleDoc.actions);
    } else if (Array.isArray(ruleDoc.actions)) {
      actions = ruleDoc.actions;
    }
    
    const rule = {
      id: ruleDoc.$id,
      userId: ruleDoc.userId,
      name: ruleDoc.name,
      description: ruleDoc.description,
      enabled: ruleDoc.enabled ?? true,
      priority: ruleDoc.priority ?? 0,
      conditions,
      conditionLogic: ruleDoc.conditionLogic || "AND",
      actions,
      matchCount: ruleDoc.matchCount ?? 0,
      lastMatched: ruleDoc.lastMatched ? new Date(ruleDoc.lastMatched) : undefined,
      createdAt: ruleDoc.createdDateTime ? new Date(ruleDoc.createdDateTime) : new Date(ruleDoc.$createdAt),
      updatedAt: new Date(ruleDoc.$updatedAt),
    };

    if (!rule.enabled) {
      return NextResponse.json(
        { ok: false, error: "Rule is disabled" },
        { status: 400 }
      );
    }

    // Get transactions
    const allTransactions = await getUserTransactionCache(userId, databases);
    let transactionsToProcess = allTransactions;
    
    if (options.limit) {
      transactionsToProcess = transactionsToProcess.slice(0, options.limit);
    }

    const modifiedIds: string[] = [];
    let totalMatched = 0;

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
        
        const result = applyBestMatchingRule(transaction, [rule]);
        if (result.updated && result.appliedRule?.id === rule.id) {
          totalMatched++;
          modifiedIds.push(transaction.id);
        }
      });
    } else {
      // Actually apply the rule
      const errors: string[] = [];
      
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
        
        const result = applyBestMatchingRule(transaction, [rule]);
        if (result.updated && result.appliedRule?.id === rule.id) {
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
          } catch (err) {
            errors.push(`Failed to update transaction ${transaction.id}: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      }

      // Update rule stats
      if (totalMatched > 0) {
        await databases.updateDocument(
          APPWRITE_CONFIG.databaseId,
          TRANSACTION_RULES_COLLECTION,
          id,
          {
            matchCount: (rule.matchCount || 0) + totalMatched,
            lastMatched: new Date().toISOString(),
          }
        );

        // Invalidate the user's transaction cache so next fetch gets fresh data
        invalidateUserCache(userId, 'transactions');
      }

      const result: RuleApplicationResult = {
        modifiedTransactions: modifiedIds,
        totalMatched,
        totalModified: modifiedIds.length,
        errors: errors.length > 0 ? errors : undefined,
      };

      return NextResponse.json(result);
    }

    const result: RuleApplicationResult = {
      modifiedTransactions: modifiedIds,
      totalMatched,
      totalModified: modifiedIds.length,
    };

    return NextResponse.json(result);
  } catch (error: unknown) {
    return handleApiError(error, 500);
  }
}
