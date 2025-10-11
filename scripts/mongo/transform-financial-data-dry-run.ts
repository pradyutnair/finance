import 'dotenv/config';
import { getDb, getMongoDbName } from '../../lib/mongo/client';

async function dryRunFinancialDataTransform() {
  console.log('🔍 DRY RUN - Financial Data Transformation:');
  console.log('- This will show what changes WOULD be made without modifying data');
  console.log('- Income values will be multiplied by 3x');
  console.log('- Expense values will be divided by 100 (reduced)');
  console.log(`Database: ${getMongoDbName()}`);

  try {
    const db = await getDb();
    const transactionsCollection = db.collection('transactions_dev');

    // Get all transactions
    const transactions = await transactionsCollection.find({}).toArray();
    console.log(`\\n📊 Found ${transactions.length} transactions to analyze`);

    if (transactions.length === 0) {
      console.log('❌ No transactions found to analyze');
      return;
    }

    let incomeCount = 0;
    let expenseCount = 0;
    let totalIncomeIncrease = 0;
    let totalExpenseReduction = 0;

    console.log('\\n📋 Sample Transformations (first 10):');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Process each transaction for analysis
    for (let i = 0; i < transactions.length; i++) {
      const transaction = transactions[i];
      const { _id, amount, userId, description, bookingDate } = transaction;

      if (!amount || typeof amount !== 'string') {
        console.log(`⚠️  Skipping transaction ${_id} - invalid amount: ${amount}`);
        continue;
      }

      // Parse the amount as a decimal number
      const numericAmount = parseFloat(amount);

      if (isNaN(numericAmount)) {
        console.log(`⚠️  Skipping transaction ${_id} - cannot parse amount: ${amount}`);
        continue;
      }

      let newAmount: number;
      let operation: string;

      if (numericAmount >= 0) {
        // Income (positive amount) - multiply by 3
        newAmount = numericAmount * 3;
        operation = '3x income';
        incomeCount++;
        totalIncomeIncrease += newAmount - numericAmount;
      } else {
        // Expense (negative amount) - divide by 100
        newAmount = numericAmount / 100;
        operation = '÷100 expense';
        expenseCount++;
        totalExpenseReduction += Math.abs(newAmount - numericAmount);
      }

      // Convert back to string with 2 decimal places
      const newAmountString = newAmount.toFixed(2);

      // Show only first 10 transactions in detail
      if (i < 10) {
        console.log(`🔄 ${operation.padEnd(12)}: ${amount.padStart(10)} → ${newAmountString.padStart(10)} | ${(description || 'No description').substring(0, 30).padEnd(30)} | User: ${userId?.substring(0, 8) || 'unknown'} | Date: ${bookingDate || 'unknown'}`);
      }
    }

    if (transactions.length > 10) {
      console.log(`... and ${transactions.length - 10} more transactions`);
    }

    console.log('\\n📈 Dry Run Summary:');
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📊 Total transactions analyzed: ${transactions.length}`);
    console.log(`💰 Income transactions: ${incomeCount} (will be 3x larger)`);
    console.log(`💸 Expense transactions: ${expenseCount} (will be 100x smaller)`);
    console.log(`📈 Total income increase: €${totalIncomeIncrease.toFixed(2)}`);
    console.log(`📉 Total expense reduction: €${totalExpenseReduction.toFixed(2)}`);

    console.log('\\n✅ DRY RUN COMPLETED - No data was modified');
    console.log('💡 To run the actual transformation, use: npx tsx scripts/mongo/transform-financial-data.ts');

  } catch (error) {
    console.error('❌ Error during dry run:', error);
    process.exit(1);
  }
}

// Run the dry run
dryRunFinancialDataTransform().catch((error) => {
  console.error('❌ Dry run failed:', error);
  process.exit(1);
});