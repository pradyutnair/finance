import 'dotenv/config';
import { getDb, getMongoDbName } from '../../lib/mongo/client';

async function transformFinancialData() {
  console.log('🔄 Transforming Financial Data:');
  console.log('- Income values will be multiplied by 3x');
  console.log('- Expense values will be divided by 100 (reduced)');
  console.log(`Database: ${getMongoDbName()}`);

  // Add a 5-second delay to give user time to cancel
  console.log('⏰ Starting in 5 seconds... Press Ctrl+C to cancel');
  await new Promise(resolve => setTimeout(resolve, 5000));

  try {
    const db = await getDb();
    const transactionsCollection = db.collection('transactions_dev');

    // Get all transactions
    const transactions = await transactionsCollection.find({}).toArray();
    console.log(`\\n📊 Found ${transactions.length} transactions to process`);

    if (transactions.length === 0) {
      console.log('❌ No transactions found to transform');
      process.exit(0);
    }

    let incomeCount = 0;
    let expenseCount = 0;
    let updatePromises = [];

    // Process each transaction
    for (const transaction of transactions) {
      const { _id, amount, userId, description } = transaction;

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
      } else {
        // Expense (negative amount) - divide by 100
        newAmount = numericAmount / 100;
        operation = '÷100 expense';
        expenseCount++;
      }

      // Convert back to string with 2 decimal places
      const newAmountString = newAmount.toFixed(2);

      console.log(`🔄 ${operation}: ${amount} → ${newAmountString} | ${description || 'No description'} | User: ${userId}`);

      // Prepare update promise
      updatePromises.push(
        transactionsCollection.updateOne(
          { _id },
          { $set: { amount: newAmountString, transformed: true, transformDate: new Date() } }
        )
      );
    }

    // Execute all updates in parallel
    console.log('\\n💾 Updating transactions in database...');
    const results = await Promise.all(updatePromises);

    // Count successful updates
    const successCount = results.filter(result => result.modifiedCount > 0).length;

    console.log('\\n📈 Transformation Summary:');
    console.log(`✅ Successfully updated: ${successCount} transactions`);
    console.log(`📊 Income transformed: ${incomeCount} transactions (3x multiplier)`);
    console.log(`💸 Expenses transformed: ${expenseCount} transactions (÷100 divider)`);
    console.log(`❌ Failed updates: ${results.length - successCount} transactions`);

    console.log('\\n🎉 Financial data transformation completed successfully!');

  } catch (error) {
    console.error('❌ Error transforming financial data:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Add confirmation prompt
async function confirmAndTransform() {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const answer = await new Promise<string>((resolve) => {
    rl.question('This will transform ALL financial data. Type "TRANSFORM" to confirm: ', resolve);
  });

  rl.close();

  if (answer === 'TRANSFORM') {
    await transformFinancialData();
  } else {
    console.log('❌ Operation cancelled.');
    process.exit(0);
  }
}

// Run the script
confirmAndTransform().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});