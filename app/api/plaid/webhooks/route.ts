export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { HttpError } from "@/lib/plaid";

export async function POST(request: Request) {
  try {
    // Get the webhook verification headers
    const plaidVerificationHeader = request.headers.get('plaid-verification');

    if (!plaidVerificationHeader) {
      console.warn('🚨 Missing Plaid verification header');
      return NextResponse.json({ error: 'Missing verification header' }, { status: 400 });
    }

    const body = await request.json();
    const { webhook_type, webhook_code, item_id, error, new_transactions } = body;

    console.log('🪝 Received Plaid webhook:', {
      webhook_type,
      webhook_code,
      item_id,
      timestamp: new Date().toISOString(),
    });

    // Handle different webhook types
    switch (webhook_type) {
      case 'TRANSACTIONS':
        await handleTransactionsWebhook(webhook_code, item_id, new_transactions, body);
        break;

      case 'ITEM':
        await handleItemWebhook(webhook_code, item_id, error, body);
        break;

      case 'HISTORICAL_UPDATE':
        await handleHistoricalUpdateWebhook(webhook_code, item_id, body);
        break;

      case 'DEFAULT_UPDATE':
        await handleDefaultUpdateWebhook(webhook_code, item_id, body);
        break;

      default:
        console.log('🪝 Unhandled webhook type:', webhook_type);
    }

    return NextResponse.json({ status: 'received' });
  } catch (err: any) {
    console.error('❌ Error processing Plaid webhook:', err);
    if (err instanceof HttpError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
    }
    return NextResponse.json({ ok: false, error: 'Webhook processing failed' }, { status: 500 });
  }
}

async function handleTransactionsWebhook(
  webhookCode: string,
  itemId: string,
  newTransactions: any,
  body: any
) {
  console.log('💰 Processing transactions webhook:', { webhookCode, itemId });

  switch (webhookCode) {
    case 'SYNC_UPDATES_AVAILABLE':
    case 'INITIAL_UPDATE':
    case 'HISTORICAL_UPDATE':
      // In a real implementation, you would:
      // 1. Find the item in your database using itemId
      // 2. Use the stored access token to fetch new transactions
      // 3. Process and store the new transactions
      // 4. Update any frontend state or send notifications
      console.log('📊 New transactions available, triggering sync...');
      // await syncTransactionsForItem(itemId);
      break;

    case 'TRANSACTIONS_REMOVED':
      // Handle removed transactions
      console.log('🗑️ Transactions removed, cleaning up...');
      // await handleRemovedTransactions(body.removed_transactions);
      break;

    default:
      console.log('💰 Unknown transactions webhook code:', webhookCode);
  }
}

async function handleItemWebhook(
  webhookCode: string,
  itemId: string,
  error: any,
  body: any
) {
  console.log('🏦 Processing item webhook:', { webhookCode, itemId });

  switch (webhookCode) {
    case 'ERROR':
      console.error('❌ Item error:', error);
      // In a real implementation, you would:
      // 1. Update the item status in your database
      // 2. Notify the user about the connection issue
      // 3. Potentially disable automatic syncing
      // await updateItemStatus(itemId, 'error', error);
      break;

    case 'NEW_LOGINS_REQUIRED':
      console.log('🔐 Item requires re-authentication');
      // In a real implementation:
      // 1. Update item status to require re-authentication
      // 2. Notify user to reconnect their account
      // await updateItemStatus(itemId, 'login_required');
      break;

    case 'PENDING_EXPIRATION':
      console.log('⏰ Item access expiring soon');
      // Schedule renewal or notify user
      break;

    case 'USER_PERMISSION_REVOKED':
      console.log('🚫 User revoked access to item');
      // Handle user-initiated disconnection
      // await handleUserDisconnection(itemId);
      break;

    case 'WEBHOOK_UPDATE_ACKNOWLEDGED':
      console.log('✅ Webhook update acknowledged');
      break;

    default:
      console.log('🏦 Unknown item webhook code:', webhookCode);
  }
}

async function handleHistoricalUpdateWebhook(
  webhookCode: string,
  itemId: string,
  body: any
) {
  console.log('📚 Processing historical update webhook:', { webhookCode, itemId });

  // Handle historical data updates
  switch (webhookCode) {
    case 'HISTORICAL_UPDATE':
      console.log('📚 Historical update available');
      // Similar to transactions INITIAL_UPDATE, fetch and store historical data
      break;

    default:
      console.log('📚 Unknown historical update webhook code:', webhookCode);
  }
}

async function handleDefaultUpdateWebhook(
  webhookCode: string,
  itemId: string,
  body: any
) {
  console.log('🔄 Processing default update webhook:', { webhookCode, itemId });

  // Handle general updates
  switch (webhookCode) {
    case 'AUTH_UPDATE':
      console.log('🔐 Auth update available');
      // Update account information (names, types, etc.)
      break;

    case 'IDENTITY_UPDATE':
      console.log('👤 Identity update available');
      // Update account holder information
      break;

    case 'BALANCE_UPDATE':
      console.log('💳 Balance update available');
      // Update account balances
      break;

    case 'INVESTMENT_TRANSACTIONS_UPDATE':
      console.log('📈 Investment transactions update available');
      // Handle investment transaction updates
      break;

    case 'HOLDINGS_UPDATE':
      console.log('📊 Holdings update available');
      // Handle investment holdings updates
      break;

    case 'LIABILITIES_UPDATE':
      console.log('💰 Liabilities update available');
      // Handle loan and credit card liability updates
      break;

    default:
      console.log('🔄 Unknown default update webhook code:', webhookCode);
  }
}