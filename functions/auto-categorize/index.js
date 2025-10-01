/*
  Appwrite Function: Auto-categorize transactions
  - Trigger: HTTP (manual) and Database document create event (transactions_dev)
  - Strategy: Cheap heuristics first; fallback to Together AI (Hugging Face openai/gpt-oss-120b) only if uncertain

  Required environment variables in the Function settings:
  - APPWRITE_ENDPOINT or NEXT_PUBLIC_APPWRITE_ENDPOINT
  - APPWRITE_PROJECT_ID or NEXT_PUBLIC_APPWRITE_PROJECT_ID
  - APPWRITE_API_KEY (server key)
  - APPWRITE_DATABASE_ID or NEXT_PUBLIC_APPWRITE_DATABASE_ID
  - APPWRITE_TRANSACTIONS_COLLECTION_ID (e.g. transactions_dev)
  - OPENAI_API_KEY (OpenAI API key)
  - OPENAI_MODEL (optional, default: gpt-5-nano)
*/

const sdk = require('node-appwrite');

/** @typedef {{ $id:string, userId?:string, description?:string, counterparty?:string, amount?:number|string, currency?:string }} TxDoc */

function getEnv(name, fallback) {
  return process.env[name] ?? fallback;
}

function createClient() {
  const endpoint = getEnv('APPWRITE_ENDPOINT', getEnv('NEXT_PUBLIC_APPWRITE_ENDPOINT'));
  const project = getEnv('APPWRITE_PROJECT_ID', getEnv('NEXT_PUBLIC_APPWRITE_PROJECT_ID'));
  const apiKey = getEnv('APPWRITE_API_KEY');
  if (!endpoint || !project || !apiKey) {
    throw new Error('Missing Appwrite env: endpoint/project/apiKey');
  }
  const client = new sdk.Client().setEndpoint(endpoint).setProject(project).setKey(apiKey);
  return client;
}

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
];

/** Basic, fast keyword heuristics */
function categorizeHeuristic(description, counterparty, amount) {
  const text = `${(description||'')} ${(counterparty||'')}`.toLowerCase();
  const value = typeof amount === 'string' ? parseFloat(amount) : Number(amount || 0);
  if (!Number.isNaN(value) && value > 0.0001) return 'Income';

  const has = (arr) => arr.some((k) => text.includes(k));

  if (has(['aldi','lidl','tesco','sainsbury','asda','whole foods','costco','grocery','supermarket','spar'])) return 'Groceries';
  if (has(['restaurant','cafe','coffee','starbucks','mcdonald','kfc','burger','pizza','domino','uber eats','deliveroo','doordash'])) return 'Restaurants';
  if (has(['tuition','course','udemy','coursera','school','university','textbook','exam'])) return 'Education';
  if (has(['uber','lyft','bolt','taxi','bus','train','metro','fuel','gas','petrol','shell','bp'])) return 'Transport';
  if (has(['hotel','airbnb','flight','airlines','ryanair','easyjet','booking.com','expedia'])) return 'Travel';
  if (has(['amazon','store','mall','retail','ikea','aliexpress','decathlon'])) return 'Shopping';
  if (has(['electric','gas','water','internet','broadband','phone','vodafone','o2','ee','three','bt','virgin','utility'])) return 'Utilities';
  if (has(['netflix','spotify','hulu','disney','cinema','theatre','steam','playstation','xbox','prime video'])) return 'Entertainment';
  if (has(['pharmacy','doctor','dentist','clinic','gym','fitness','nhs','walgreens','boots'])) return 'Health';
  if (has(['salary','payroll','income','dividend'])) return 'Income';

  return 'Uncategorized';
}

async function callOpenAiLLM(modelId, apiKey, description, counterparty, amount, currency) {
  if (!apiKey) return null;
  const endpoint = 'https://api.openai.com/v1/chat/completions';
  const sys = `You are a strict classifier. Choose exactly one category from this list and reply with only the category name (no punctuation): ${CATEGORY_OPTIONS.join(', ')}`;
  const user = `Transaction:\nDescription: ${description || ''}\nCounterparty: ${counterparty || ''}\nAmount: ${amount} ${currency || ''}\nRespond with one of: ${CATEGORY_OPTIONS.join(', ')}`;
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelId || 'gpt-5-nano',
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: user },
        ],
        temperature: 0,
        max_tokens: 6,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content?.trim();
    if (!text) return null;
    const normalized = text.replace(/^[^A-Za-z]*/g, '').replace(/[^A-Za-z]+$/g, '');
    const match = CATEGORY_OPTIONS.find((c) => c.toLowerCase() === normalized.toLowerCase());
    return match || null;
  } catch { return null; }
}

async function categorizeOne(databases, databaseId, collectionId, doc) {
  const { $id, description, counterparty, amount, currency } = doc || {};
  let category = categorizeHeuristic(description, counterparty, amount);
  if (category === 'Uncategorized') {
    category = await callOpenAiLLM(
      getEnv('OPENAI_MODEL', 'gpt-5-nano'),
      getEnv('OPENAI_API_KEY'),
      description,
      counterparty,
      amount,
      currency
    ) || 'Miscellaneous'; // keep cost low, fallback to Miscellaneous
  }

  if (category && CATEGORY_OPTIONS.includes(category)) {
    try {
      await databases.updateDocument(databaseId, collectionId, $id, { category });
    } catch (e) {
      console.error('updateDocument failed', $id, e?.message || e);
      throw e;
    }
  }
}

async function handleHttp(req, res) {
  try {
    const payload = (() => { try { return JSON.parse(req.payload || '{}'); } catch { return {}; }})();
    const userId = payload.userId;
    const limit = Math.min(Number(payload.limit || 100), 500);
    if (!userId) {
      res.json(400, { ok: false, error: 'userId is required' });
      return;
    }

    const client = createClient();
    const databases = new sdk.Databases(client);
    const databaseId = getEnv('APPWRITE_DATABASE_ID', getEnv('NEXT_PUBLIC_APPWRITE_DATABASE_ID'));
    const collectionId = getEnv('APPWRITE_TRANSACTIONS_COLLECTION_ID', 'transactions_dev');

    let offset = 0;
    let processed = 0;
    const pageSize = 100;
    let triedWithoutUserFilter = false;
    // Iterate newest-first and categorize only docs that need it
    while (processed < limit) {
      const filters = [
        sdk.Query.orderDesc('$createdAt'),
        sdk.Query.limit(pageSize),
        sdk.Query.offset(offset),
      ];
      if (!triedWithoutUserFilter) filters.unshift(sdk.Query.equal('userId', userId));

      const page = await databases.listDocuments(databaseId, collectionId, filters);
      const docs = page.documents || [];

      if (!docs.length) {
        if (!triedWithoutUserFilter && offset === 0) {
          // Fallback: process all uncategorized docs if user filter returns none
          triedWithoutUserFilter = true;
          continue;
        }
        break;
      }

      for (const d of docs) {
        if (processed >= limit) break;
        const needs = !d.category || d.category === '' || d.category === 'Uncategorized';
        const excluded = d.exclude === true;
        if (!needs || excluded) continue;
        await categorizeOne(databases, databaseId, collectionId, d);
        processed += 1;
      }
      offset += docs.length;
      if (docs.length < pageSize) break;
    }
    res.json(200, { ok: true, processed });
  } catch (e) {
    res.json(500, { ok: false, error: String(e?.message || e) });
  }
}

async function handleEvent(res) {
  try {
    const client = createClient();
    const databases = new sdk.Databases(client);
    const databaseId = getEnv('APPWRITE_DATABASE_ID', getEnv('NEXT_PUBLIC_APPWRITE_DATABASE_ID'));
    const collectionId = getEnv('APPWRITE_TRANSACTIONS_COLLECTION_ID', 'transactions_dev');

    // Try to parse event data (document JSON)
    const raw = getEnv('APPWRITE_FUNCTION_EVENT_DATA');
    let doc = null;
    if (raw) {
      try { doc = JSON.parse(raw); } catch { /* ignore */ }
    }
    // Fallback to older payload format
    if (!doc && typeof globalThis.req?.payload === 'string') {
      try { doc = JSON.parse(globalThis.req.payload); } catch { /* ignore */ }
    }

    if (doc && doc.$id) {
      await categorizeOne(databases, databaseId, collectionId, doc);
      res.json(200, { ok: true, processed: 1 });
      return;
    }
    res.json(200, { ok: true, processed: 0 });
  } catch (e) {
    res.json(500, { ok: false, error: String(e?.message || e) });
  }
}

module.exports = async (req, res) => {
  // Expose req on global fallback for some envs
  globalThis.req = req;
  const isEvent = Boolean(process.env.APPWRITE_FUNCTION_EVENT);
  if (isEvent) {
    return handleEvent(res);
  }
  return handleHttp(req, res);
};


