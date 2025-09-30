export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth";
import { Client, Databases, Query } from "appwrite";

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



