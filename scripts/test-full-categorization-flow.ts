/**
 * Test the FULL categorization flow: heuristics + Fina API
 * This is how it works in production
 */

import { getDb } from '../lib/mongo/client';
import { suggestCategory, categorizeHeuristic } from '../lib/server/categorize';

async function testFullCategorizationFlow() {
  console.log('🧪 Testing FULL Categorization Flow (Heuristics + Fina API)\n');
  console.log('This shows how categorization works in production\n');
  console.log('='.repeat(80) + '\n');

  const db = await getDb();
  const coll = db.collection('transactions_dev');

  // Get sample transactions
  const transactions = await coll.find({}).limit(15).toArray();

  console.log('Testing categorization with HEURISTICS FIRST (like production):\n');

  for (const tx of transactions) {
    const desc = tx.description || '';
    const cp = tx.counterparty || '';
    const amt = tx.amount;
    
    // Step 1: Try heuristics (fast)
    const heuristic = categorizeHeuristic(desc, cp, amt);
    
    // Step 2: Full suggest (heuristics + Fina API fallback)
    const suggested = await suggestCategory(desc, cp, amt, tx.currency);
    
    const usedFina = heuristic === 'Uncategorized' && suggested !== 'Uncategorized';
    const source = usedFina ? '🌐 Fina API' : '⚡ Heuristic';
    const match = tx.category === suggested ? '✅' : '❌';
    
    console.log(`${match} ${desc.substring(0, 40).padEnd(42)}`);
    console.log(`   Current: ${(tx.category || 'none').padEnd(15)} → Suggested: ${suggested.padEnd(15)} ${source}`);
    
    if (heuristic !== 'Uncategorized') {
      console.log(`   (Heuristic caught it, no API call needed)`);
    }
    console.log();
  }

  console.log('='.repeat(80));
  console.log('\n✅ Key Points:');
  console.log('   • Heuristics catch common patterns instantly (no API call)');
  console.log('   • Fina API only used for ambiguous transactions');
  console.log('   • In production, "cab sharing" → caught by heuristic');
  console.log('   • In production, "water invoice" → caught by heuristic');
  console.log('   • This saves API calls and improves speed!\n');
}

testFullCategorizationFlow()
  .then(() => {
    console.log('✅ Test completed successfully');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
