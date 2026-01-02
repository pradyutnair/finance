export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth";
import { Client, Databases, Query } from "appwrite";
import { getDb } from "@/lib/mongo/client";
import { encryptQueryable } from "@/lib/mongo/explicit-encryption";

type BalanceDoc = {
  accountId?: string;
  balanceAmount?: string | number;
  currency?: string;
  balanceType?: string;
  referenceDate?: string;
};

const DATABASE_ID = (process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || "68d42ac20031b27284c9") as string;
const BALANCES_COLLECTION_ID = process.env.APPWRITE_BALANCES_COLLECTION_ID || "balances_dev";

export async function GET(request: Request, { params }: { params: Promise<{ accountId: string }> }) {
  try {
    const user: any = await requireAuthUser(request);
    const userId = user.$id || user.id;
    const { accountId } = await params;

    if (process.env.DATA_BACKEND === 'mongodb') {
      try {
        const db = await getDb();
        
        console.log(`[API] Fetching balances for accountId: ${accountId}, userId: ${userId}`);
        
        // Encrypt accountId for querying encrypted field
        // With bypassAutoEncryption: true, we must manually encrypt query parameters
        let encryptedAccountId;
        try {
          console.log('[API] Encrypting accountId for query...');
          encryptedAccountId = await encryptQueryable(accountId);
          console.log('[API] AccountId encrypted successfully');
        } catch (encryptError: any) {
          console.warn('[API] Failed to encrypt accountId, trying plaintext query:', encryptError.message);
          // If encryption fails, try querying with plaintext (won't work if data is encrypted)
          // This is a fallback for when KMS isn't configured
          encryptedAccountId = accountId;
        }
        
        const docs = await db
          .collection('balances_dev')
          .find({ userId, accountId: encryptedAccountId })
          .sort({ referenceDate: -1 })
          .limit(100)
          .toArray();

        console.log(`[API] Found ${docs.length} balances`);

        // Data fields are automatically decrypted by the MongoDB driver on read
        const balances = docs.map((b: any) => ({
          balanceType: String(b.balanceType || "interimAvailable"),
          balanceAmount: {
            amount: String(b.balanceAmount ?? "0"),
            currency: String(b.currency || "EUR"),
          },
          referenceDate: String(b.referenceDate || ""),
        }));

        const payload = { details: { accountId }, balances: { balances } };
        return NextResponse.json(payload);
      } catch (mongoError: any) {
        console.error('[API] MongoDB error fetching account balances:', mongoError);
        console.error('[API] Error details:', {
          message: mongoError?.message,
          stack: mongoError?.stack,
          code: mongoError?.code,
          name: mongoError?.name,
          userId,
          accountId,
        });
        return NextResponse.json({ 
          ok: false, 
          error: 'Failed to fetch account balances from MongoDB',
          details: process.env.NODE_ENV === 'development' ? mongoError?.message : 'Internal server error'
        }, { status: 500 });
      }
    }

    const client = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT as string)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID as string);

    const apiKey = process.env.APPWRITE_API_KEY as string | undefined;
    if (apiKey) {
      (client as any).headers = { ...(client as any).headers, "X-Appwrite-Key": apiKey };
    } else {
      const auth = (request.headers.get("authorization") || request.headers.get("Authorization")) ?? undefined;
      const token = auth?.startsWith("Bearer ") ? auth.slice(7) : undefined;
      if (token) (client as any).headers = { ...(client as any).headers, "X-Appwrite-JWT": token };
    }

    const databases = new Databases(client);

    // Get latest balances for this account, preferring ClosingBooked then interimAvailable/expected
    const resp = await databases.listDocuments(
      DATABASE_ID,
      BALANCES_COLLECTION_ID,
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
  } catch (err: any) {
    const status = err?.status || 500;
    const message = err?.message || "Internal Server Error";
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}



