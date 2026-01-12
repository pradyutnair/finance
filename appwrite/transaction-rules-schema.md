# Transaction Rules Database Schema

## Collection: `transaction_rules_dev`

### Table Structure

| Attribute | Type | Required | Size | Default | Description |
|-----------|------|----------|------|---------|-------------|
| userId | string | ✓ | 255 | - | User ID who owns this rule |
| name | string | ✓ | 255 | - | Rule name |
| description | string | ❌ | 500 | null | Optional description |
| enabled | boolean | ✓ | - | true | Whether rule is active |
| priority | integer | ✓ | - | 0 | Priority (higher = applied first) |
| conditions | string | ✓ | 10000 | - | JSON array of conditions |
| conditionLogic | string | ❌ | 3 | "AND" | "AND" or "OR" |
| actions | string | ✓ | 10000 | - | JSON array of actions |
| matchCount | integer | ✓ | - | 0 | Number of times applied |
| lastMatched | datetime | ❌ | - | null | Last application timestamp |

### Built-in Fields (Appwrite)
- `$id` - Document ID
- `$createdAt` - Creation timestamp
- `$updatedAt` - Last update timestamp

### Data Types

#### Conditions (JSON string)
Array of condition objects:
```json
[
  {
    "field": "description",
    "operator": "contains",
    "value": "AMAZON",
    "caseSensitive": false
  }
]
```

**Field values**: `counterparty`, `description`, `amount`, `bookingDate`, `category`

**Operators**: `equals`, `contains`, `startsWith`, `endsWith`, `greaterThan`, `lessThan`, `greaterThanOrEqual`, `lessThanOrEqual`, `notEquals`, `notContains`

#### Actions (JSON string)
Array of action objects:
```json
[
  {
    "type": "setCategory",
    "value": "Shopping"
  }
]
```

**Action types**: `setCategory`, `setExclude`, `setDescription`, `setCounterparty`

### Indexes (Recommended)

1. **userId** - For querying user's rules
2. **enabled + priority** - For efficient rule application (composite index)

### Permissions

- **Read**: Users can only read their own rules
- **Write**: Users can only create/update/delete their own rules

### Environment Variable

Set `APPWRITE_TRANSACTION_RULES_COLLECTION_ID` to the collection ID, or it defaults to `transaction_rules_dev`.
