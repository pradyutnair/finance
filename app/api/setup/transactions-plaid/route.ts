export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { setupTransactionsPlaidCollection } from "@/lib/mongo/setup-transactions-plaid";

export async function POST() {
  try {
    console.log('🚀 Starting transactions_plaid collection setup...');

    await setupTransactionsPlaidCollection();

    return NextResponse.json({
      success: true,
      message: "transactions_plaid collection created successfully with proper schema and indexes"
    });

  } catch (error: any) {
    console.error('❌ Failed to setup transactions_plaid collection:', error);

    return NextResponse.json({
      success: false,
      error: error.message || "Failed to create transactions_plaid collection"
    }, { status: 500 });
  }
}