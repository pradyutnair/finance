export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth";
import { exchangePublicToken, getItem, getAccounts, getTransactions, HttpError } from "@/lib/plaid";
import { syncPlaidItemData } from "@/lib/plaid/mongo-ingestion";

export async function POST(request: Request) {
  try {
    // Require authenticated user
    let user: any;
    let userId: string;

    try {
      user = await requireAuthUser(request);

      if (!user) {
        // In development, allow bypassing auth for testing UI flow
        if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV || process.env.NODE_ENV === '') {
          console.log('⚠️ Development mode: bypassing auth for token exchange');
          const timestamp = Date.now();
          userId = `dev-user-${timestamp}`;
          user = { $id: userId, id: userId, email: `dev-${timestamp}@example.com` };
          console.log('🔧 Using dev user ID:', userId);
        } else {
          throw new Error('User not authenticated');
        }
      } else {
        userId = user.$id || user.id;
      }
    } catch (authError) {
      // In development, allow bypassing auth for testing UI flow
      if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV || process.env.NODE_ENV === '') {
        console.log('⚠️ Development mode: bypassing auth for token exchange');
        const timestamp = Date.now();
        userId = `dev-user-${timestamp}`;
        user = { $id: userId, id: userId, email: `dev-${timestamp}@example.com` };
        console.log('🔧 Using dev user ID:', userId);
      } else {
        throw authError;
      }
    }

    const json = await request.json().catch(() => ({}));
    const { publicToken } = json || {};

    if (!publicToken) {
      throw new HttpError("'publicToken' is required", 400);
    }

    // Exchange public token for access token
    const exchangeResponse = await exchangePublicToken(publicToken);
    const accessToken = exchangeResponse.access_token;
    const itemId = exchangeResponse.item_id;

    // Get item details to store connection info
    const itemResponse = await getItem(accessToken);

    // Get initial data (accounts and recent transactions)
    const [accountsResponse, transactionsResponse] = await Promise.all([
      getAccounts(accessToken),
      getTransactions(accessToken, {
        startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        count: 500,
      }),
    ]);

    // Store all data in MongoDB with encryption
    await syncPlaidItemData(
      userId,
      accessToken,
      itemResponse,
      accountsResponse,
      transactionsResponse
    );

    console.log('🔗 Successfully exchanged public token and synced initial data', {
      userId,
      itemId,
      institutionId: itemResponse.item.institution_id,
      accountsCount: accountsResponse.accounts.length,
      transactionsCount: transactionsResponse.transactions?.length || 0,
    });

    return NextResponse.json({
      success: true,
      itemId,
      institutionId: itemResponse.item.institution_id,
      // Note: Never return the access_token to the client
    }, { status: 200 });

  } catch (err: any) {
    console.error('Error exchanging Plaid public token:', err);
    if (err instanceof HttpError) {
      return NextResponse.json({ ok: false, error: err.message, details: err.details }, { status: err.status });
    }
    const status = err?.status || 500;
    const message = err?.message || "Internal Server Error";
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}