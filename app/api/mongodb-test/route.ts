/**
 * MongoDB Test Route - Shows how simple it is
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export async function GET() {
  try {
    const db = await getDb();

    // Insert test transaction with encryption
    const testDoc = {
      userId: 'demo-user',
      amount: 100.50,
      currency: 'USD',
      bookingDate: '2025-10-02',
      description: 'Amazon purchase', // AUTO ENCRYPTED!
      counterparty: 'Amazon.com', // AUTO ENCRYPTED!
      createdAt: new Date(),
    };

    await db.collection('transactions').insertOne(testDoc);

    // Query (auto decrypts)
    const transactions = await db
      .collection('transactions')
      .find({ userId: 'demo-user' })
      .limit(10)
      .toArray();

    // Query encrypted field directly
    const searchResults = await db
      .collection('transactions')
      .find({ description: 'Amazon purchase' }) // Works on encrypted field!
      .toArray();

    return NextResponse.json({
      ok: true,
      message: 'MongoDB Queryable Encryption working!',
      inserted: testDoc,
      allTransactions: transactions.length,
      searchResults: searchResults.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
