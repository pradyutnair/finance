export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { Client, Databases, Query, ID } from "appwrite";
import { requireAuthUser } from "@/lib/auth";
import { APPWRITE_CONFIG } from "@/lib/config";
import { handleApiError } from "@/lib/api-error-handler";
import type { AuthUser } from "@/lib/types";
import type { TransactionRule } from "@/lib/types/transaction-rules";

const TRANSACTION_RULES_COLLECTION = process.env.APPWRITE_TRANSACTION_RULES_COLLECTION_ID || "transactions_rules";

export async function GET(request: NextRequest) {
  try {
    const user = (await requireAuthUser(request)) as AuthUser;
    const userId = user.$id || user.id;
    if (!userId) {
      return NextResponse.json({ ok: false, error: "User ID not found" }, { status: 401 });
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
    const response = await databases.listDocuments(
      APPWRITE_CONFIG.databaseId,
      TRANSACTION_RULES_COLLECTION,
      [Query.equal("userId", userId), Query.orderDesc("$createdAt")]
    );

    const rules: TransactionRule[] = response.documents.map((doc: any) => {
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

    return NextResponse.json(rules);
  } catch (error: unknown) {
    return handleApiError(error, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = (await requireAuthUser(request)) as AuthUser;
    const userId = user.$id || user.id;
    if (!userId) {
      return NextResponse.json({ ok: false, error: "User ID not found" }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, enabled, priority, conditions, conditionLogic, actions } = body;

    if (!name || !conditions || !actions) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields: name, conditions, actions" },
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
    
    // Stringify arrays for Appwrite Tables storage
    let conditionsStr: string;
    let actionsStr: string;
    
    if (Array.isArray(conditions)) {
      conditionsStr = JSON.stringify(conditions);
    } else if (typeof conditions === 'string') {
      conditionsStr = conditions; // Already a string
    } else {
      return NextResponse.json(
        { ok: false, error: "Invalid conditions: must be an array or JSON string" },
        { status: 400 }
      );
    }
    
    if (Array.isArray(actions)) {
      actionsStr = JSON.stringify(actions);
    } else if (typeof actions === 'string') {
      actionsStr = actions; // Already a string
    } else {
      return NextResponse.json(
        { ok: false, error: "Invalid actions: must be an array or JSON string" },
        { status: 400 }
      );
    }
    
    const doc = await databases.createDocument(
      APPWRITE_CONFIG.databaseId,
      TRANSACTION_RULES_COLLECTION,
      ID.unique(),
      {
        userId,
        name,
        description: description || null,
        enabled: enabled ?? true,
        priority: priority ?? 0,
        conditions: conditionsStr,
        conditionLogic: conditionLogic || "AND",
        actions: actionsStr,
        matchCount: 0,
        createdDateTime: new Date().toISOString(),
      }
    );

    // Parse JSON strings back to arrays
    let parsedConditions = [];
    let parsedActions = [];
    
    if (typeof doc.conditions === 'string') {
      parsedConditions = JSON.parse(doc.conditions);
    } else if (Array.isArray(doc.conditions)) {
      parsedConditions = doc.conditions;
    }
    
    if (typeof doc.actions === 'string') {
      parsedActions = JSON.parse(doc.actions);
    } else if (Array.isArray(doc.actions)) {
      parsedActions = doc.actions;
    }
    
    const rule: TransactionRule = {
      id: doc.$id,
      userId: doc.userId,
      name: doc.name,
      description: doc.description,
      enabled: doc.enabled ?? true,
      priority: doc.priority ?? 0,
      conditions: parsedConditions,
      conditionLogic: doc.conditionLogic || "AND",
      actions: parsedActions,
      matchCount: doc.matchCount ?? 0,
      lastMatched: doc.lastMatched ? new Date(doc.lastMatched) : undefined,
      createdAt: doc.createdDateTime ? new Date(doc.createdDateTime) : new Date(doc.$createdAt),
      updatedAt: new Date(doc.$updatedAt),
    };

    return NextResponse.json(rule, { status: 201 });
  } catch (error: unknown) {
    return handleApiError(error, 500);
  }
}
