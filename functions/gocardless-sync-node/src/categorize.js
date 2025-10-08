/**
 * Transaction Categorization
 */

const CATEGORY_OPTIONS = [
  'Groceries',
  'Restaurants',
  'Education',
  'Transport',
  'Travel',
  'Shopping',
  'Utilities',
  'Entertainment',
  'Health',
  'Income',
  'Miscellaneous',
  'Uncategorized',
  'Bank Transfer',
];

function toNumber(amount?: string | number | null): number {
  if (amount === null || amount === undefined) return 0;
  if (typeof amount === 'number') return amount;
  const n = parseFloat(amount);
  return isNaN(n) ? 0 : n;
}

export function categorizeHeuristic(description, counterparty, amount) {
  const text = `${counterparty || ''} ${description || ''}`.toLowerCase().trim();
  const value = toNumber(amount);

  const has = (keywords) => keywords.some(k => text.includes(k));

  if (has(['restaurant', 'cafe', 'coffee', 'mcdonald', 'starbucks'])) return 'Restaurants';
  if (has(['uber', 'taxi', 'fuel', 'gas', 'petrol'])) return 'Transport';
  if (has(['amazon', 'store', 'shopping', 'mall'])) return 'Shopping';
  if (has(['netflix', 'spotify', 'entertainment'])) return 'Entertainment';
  if (has(['electric', 'gas', 'water', 'internet', 'rent'])) return 'Utilities';
  if (has(['grocery', 'supermarket', 'aldi', 'tesco'])) return 'Groceries';
  if (value > 0 && has(['salary', 'payroll', 'income'])) return 'Income';

  return 'Uncategorized';
}

export async function categorizeViaOpenAI(description, counterparty, amount, currency) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const systemPrompt = `You are a strict classifier. Reply with exactly one category name from this list and nothing else: ${CATEGORY_OPTIONS.join(', ')}`;
  const userPrompt = `Transaction\nCounterparty: ${counterparty || ''}\nDescription: ${description || ''}\nAmount: ${amount ?? ''} ${currency || ''}\nReturn one of: ${CATEGORY_OPTIONS.join(', ')}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content?.trim();
    if (!text) return null;

    const match = CATEGORY_OPTIONS.find(c => c.toLowerCase() === text.toLowerCase());
    return match || null;
  } catch {
    return null;
  }
}

export async function suggestCategory(description, counterparty, amount, currency) {
  const heuristic = categorizeHeuristic(description, counterparty, amount);
  if (heuristic !== 'Uncategorized') return heuristic;

  const llm = await categorizeViaOpenAI(description, counterparty, amount, currency);
  return llm || 'Uncategorized';
}

export async function findExistingCategoryMongo(db, userId, description, counterparty) {
  const collection = db.collection('transactions_dev');
  
  const desc = (description || '').trim();
  const cp = (counterparty || '').trim();

  // Try exact match on counterparty + description
  if (cp && desc) {
    const docs = await collection
      .find({ userId, counterparty: cp, description: desc })
      .sort({ bookingDate: -1 })
      .limit(5)
      .toArray();
    
    for (const d of docs) {
      if (d?.category && d.category !== 'Uncategorized') return d.category;
    }
  }

  // Try counterparty only
  if (cp) {
    const docs = await collection
      .find({ userId, counterparty: cp })
      .sort({ bookingDate: -1 })
      .limit(5)
      .toArray();
    
    for (const d of docs) {
      if (d?.category && d.category !== 'Uncategorized') return d.category;
    }
  }

  return null;
}

