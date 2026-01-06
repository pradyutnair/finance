export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth";
import { Client, Databases, Query } from "appwrite";
import { APPWRITE_CONFIG, COLLECTIONS } from "@/lib/config";
import { handleApiError } from "@/lib/api-error-handler";
import type { AuthUser } from "@/lib/types";

type BalanceDoc = {
  accountId?: string;
  balanceAmount?: string | number;
  currency?: string;
  balanceType?: string;
  referenceDate?: string;
};

export async function GET(request: Request, { params }: { params: Promise<{ accountId: string }> }) {
  try {
    const user = await requireAuthUser(request) as AuthUser;
    const userId = user.$id || user.id;
    if (!userId) {
      return NextResponse.json({ ok: false, error: "User ID not found" }, { status: 401 });
    }
    
    const { accountId } = await params;

    const client = new Client()
      .setEndpoint(APPWRITE_CONFIG.endpoint)
      .setProject(APPWRITE_CONFIG.projectId);

    const apiKey = APPWRITE_CONFIG.apiKey;
    if (apiKey) {
      (client as { headers: Record<string, string> }).headers = { 
        ...(client as { headers: Record<string, string> }).headers, 
        "X-Appwrite-Key": apiKey 
      };
    } else {
      const auth = request.headers.get("authorization") || request.headers.get("Authorization");
      const token = auth?.startsWith("Bearer ") ? auth.slice(7) : undefined;
      if (token) {
        (client as { headers: Record<string, string> }).headers = { 
          ...(client as { headers: Record<string, string> }).headers, 
          "X-Appwrite-JWT": token 
        };
      }
    }

    const databases = new Databases(client);

    // Get latest balances for this account, preferring ClosingBooked then interimAvailable/expected
    const resp = await databases.listDocuments(
      APPWRITE_CONFIG.databaseId,
      COLLECTIONS.balances,
      [
        Query.equal("userId", userId),
        Query.equal("accountId", accountId),
        Query.orderDesc("referenceDate"),
        Query.limit(100)
      ]
    );

    const docs = resp.documents as BalanceDoc[];
    // Emulate previous payload shape used by the bank card
    const balances = docs.map((b) => ({
      balanceType: String(b.balanceType || "interimAvailable"),
      balanceAmount: {
        amount: String(b.balanceAmount ?? "0"),
        currency: String(b.currency || "EUR"),
      },
      referenceDate: String(b.referenceDate || ""),
    }));

    // Build payload: details can be minimal here; card only reads balances
    const payload = { details: { accountId }, balances: { balances } };
    return NextResponse.json(payload);
  } catch (error: unknown) {
    return handleApiError(error, 500);
  }
}



