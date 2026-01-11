export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { Client, Databases } from "appwrite";
import { requireAuthUser } from "@/lib/auth";
import { APPWRITE_CONFIG } from "@/lib/config";
import { handleApiError } from "@/lib/api-error-handler";
import type { AuthUser } from "@/lib/types";
import type { TransactionRule } from "@/lib/types/transaction-rules";

const TRANSACTION_RULES_COLLECTION = process.env.APPWRITE_TRANSACTION_RULES_COLLECTION_ID || "transactions_rules";

export async function PATCH(
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
    const body = await request.json();

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
    
    // Verify ownership
    const existing = await databases.getDocument(
      APPWRITE_CONFIG.databaseId,
      TRANSACTION_RULES_COLLECTION,
      id
    );
    
    if (existing.userId !== userId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
    }

    const updates: any = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.enabled !== undefined) updates.enabled = body.enabled;
    if (body.priority !== undefined) updates.priority = body.priority;
    if (body.conditions !== undefined) {
      // Stringify array for Appwrite Tables storage
      updates.conditions = Array.isArray(body.conditions) ? JSON.stringify(body.conditions) : body.conditions;
    }
    if (body.conditionLogic !== undefined) updates.conditionLogic = body.conditionLogic;
    if (body.actions !== undefined) {
      // Stringify array for Appwrite Tables storage
      updates.actions = Array.isArray(body.actions) ? JSON.stringify(body.actions) : body.actions;
    }

    const doc = await databases.updateDocument(
      APPWRITE_CONFIG.databaseId,
      TRANSACTION_RULES_COLLECTION,
      id,
      updates
    );

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

    const rule: TransactionRule = {
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

    return NextResponse.json(rule);
  } catch (error: unknown) {
    return handleApiError(error, 500);
  }
}

export async function DELETE(
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
    
    // Verify ownership
    const existing = await databases.getDocument(
      APPWRITE_CONFIG.databaseId,
      TRANSACTION_RULES_COLLECTION,
      id
    );
    
    if (existing.userId !== userId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
    }

    await databases.deleteDocument(
      APPWRITE_CONFIG.databaseId,
      TRANSACTION_RULES_COLLECTION,
      id
    );

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return handleApiError(error, 500);
  }
}
