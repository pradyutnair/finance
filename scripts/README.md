# Database Setup Scripts

This directory contains database setup scripts for the transaction rules system.

## Transaction Rules Indexes Setup

### Overview
The `setup-rules-indexes.js` script creates optimized database indexes to ensure fast performance for the transaction rules system.

### What it does
- Creates indexes on the `transaction_rules_dev` collection for fast user queries
- Creates indexes on the `transactions_dev` collection to improve rule matching performance
- Sets up compound indexes for the most common query patterns

### Running the script

```bash
# Using npm
npm run setup-rules-indexes

# Or directly with node
node scripts/setup-rules-indexes.js
```

### Required Environment Variables
Make sure these environment variables are set in your `.env.local` file:

```env
MONGODB_URI=mongodb://your-connection-string
MONGODB_DB=finance_dev
MONGODB_RULES_COLLECTION=transaction_rules_dev
MONGODB_TRANSACTIONS_COLLECTION=transactions_dev
```

### Indexes Created

#### Transaction Rules Collection (`transaction_rules_dev`)

1. **user_enabled_priority_idx**: `{ userId: 1, enabled: 1, priority: -1 }`
   - Optimizes queries for fetching user's enabled rules sorted by priority
   - Used by: Rules list display, rule engine

2. **user_created_at_idx**: `{ userId: 1, createdAt: -1 }`
   - Optimizes queries for fetching user's rules sorted by creation date
   - Used by: Rules list display

3. **user_idx**: `{ userId: 1 }`
   - Basic index for user-specific rule queries
   - Used by: All rule CRUD operations

4. **enabled_priority_idx**: `{ enabled: 1, priority: -1 }`
   - Optimizes queries for all enabled rules sorted by priority
   - Used by: Admin operations, bulk rule application

5. **last_matched_idx**: `{ lastMatched: -1 }`
   - Optimizes queries for recently used rules
   - Used by: Rule statistics, analytics

#### Transactions Collection (`transactions_dev`)

1. **user_booking_date_idx**: `{ userId: 1, bookingDate: -1 }`
   - Optimizes user transaction queries with date sorting
   - Used by: Transaction list, date-based filtering

2. **user_counterparty_idx**: `{ userId: 1, counterparty: 1 }`
   - Optimizes counterparty-based rule matching
   - Used by: Rule engine for payee-based rules

3. **user_description_idx**: `{ userId: 1, description: 1 }`
   - Optimizes description-based rule matching
   - Used by: Rule engine for description-based rules

4. **user_category_idx**: `{ userId: 1, category: 1 }`
   - Optimizes category-based rule matching
   - Used by: Rule engine for category-based rules

5. **user_amount_idx**: `{ userId: 1, amount: 1 }`
   - Optimizes amount-based rule matching
   - Used by: Rule engine for amount-based rules

6. **user_rule_fields_idx**: `{ userId: 1, counterparty: 1, description: 1, category: 1, amount: 1 }`
   - Compound index for optimal rule matching performance
   - Used by: Rule engine for comprehensive transaction analysis

### When to Run

- **Initial Setup**: Run once after deploying the transaction rules system
- **After Major Updates**: Run if you change the rule matching logic significantly
- **Performance Issues**: Run if you notice slow rule performance

### Performance Impact

These indexes will significantly improve:
- Rules list loading speed (from seconds to milliseconds)
- Rule matching performance during transaction processing
- Overall system responsiveness under heavy load

### Monitoring

After running the script, you can monitor the index usage in MongoDB:

```javascript
// Connect to your MongoDB instance
use finance_dev

// Check index usage stats
db.transaction_rules_dev.aggregate([{$indexStats: {}}])
db.transactions_dev.aggregate([{$indexStats: {}}])
```

### Troubleshooting

If you encounter issues:

1. **Connection Issues**: Ensure MongoDB is running and connection string is correct
2. **Permission Issues**: Ensure the database user has `createIndex` permissions
3. **Duplicate Indexes**: The script will handle existing indexes gracefully
4. **Performance**: Monitor database performance after adding indexes

### Rollback

If needed, you can drop the indexes:

```javascript
// Connect to MongoDB
use finance_dev

// Drop specific indexes
db.transaction_rules_dev.dropIndex("user_enabled_priority_idx")
db.transactions_dev.dropIndex("user_booking_date_idx")

// Or drop all custom indexes (keep _id_)
db.transaction_rules_dev.getIndexes().forEach(idx => {
  if (idx.name !== "_id_") {
    db.transaction_rules_dev.dropIndex(idx.name)
  }
})
```