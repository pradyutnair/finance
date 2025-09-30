import { CATEGORY_OPTIONS } from "@/lib/categories";
import { Query } from "appwrite";

function toNumber(amount?: string | number | null): number {
  if (amount === null || amount === undefined) return 0;
  if (typeof amount === "number") return amount;
  const n = parseFloat(amount);
  return Number.isNaN(n) ? 0 : n;
}

export function categorizeHeuristic(description?: string | null, counterparty?: string | null, amount?: string | number | null): string {
  // Use both counterparty and description if either is non-null
  const counterpartyText = counterparty || "";
  const descriptionText = description || "";
  const text = `${counterpartyText} ${descriptionText}`.toLowerCase().trim();
  const value = toNumber(amount);

  const has = (arr: string[]) => arr.some((k) => text.includes(k));

  // Income/refunds
  if (has(["salary","payroll","income","dividend","bonus","payout","refund","reimbursement","cashback"]) || value > 0 && has(["salary","payroll","dividend"])) return "Income";

  // Groceries and supermarkets
  if (has(["aldi","lidl","tesco","sainsbury","sainsbury's","asda","morrisons","whole foods","costco","grocery","supermarket","spar","coop","co-op"])) return "Groceries";

  // Restaurants, cafes, takeaways
  if (has(["restaurant","cafe","coffee","starbucks","mcdonald","kfc","burger","pizza","domino","domino's","uber eats","deliveroo","doordash","just eat","pret","greggs","nando"])) return "Restaurant";

  // Education
  if (has(["tuition","course","udemy","coursera","school","university","textbook","exam","udacity","edx"])) return "Education";

  // Transport / Fuel
  if (has(["uber","lyft","bolt","taxi","bus","train","metro","fuel","gas","petrol","shell","bp","esso","tesla supercharger","cab"])) return "Transport";

  // Travel
  if (has(["hotel","airbnb","flight","airlines","ryanair","easyjet","booking.com","expedia","hostel","marriott","hilton"])) return "Travel";

  // Shopping / Retail
  if (has(["amazon","store","mall","retail","ikea","aliexpress","decathlon","shopping","primark","zara","h&m","nike","adidas"])) return "Shopping";

  // Utilities / Bills / Subscriptions
  if (has(["electric","gas","water","internet","broadband","phone","vodafone","o2","ee","three","bt","virgin","utility","rent","council tax","sky","direct debit","subscription","subscrip"])) return "Utilities";

  // Entertainment & streaming
  if (has(["netflix","spotify","hulu","disney","cinema","theatre","steam","playstation","xbox","prime video","youtube premium","twitch","paramount+","apple tv"])) return "Entertainment";

  // Health & fitness
  if (has(["pharmacy","doctor","dentist","clinic","gym","fitness","nhs","walgreens","boots","vision express","specsavers","optician"])) return "Health";

  return "Uncategorized";
}

export async function categorizeViaOpenAI(description?: string | null, counterparty?: string | null, amount?: string | number | null, currency?: string | null): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  // Prefer a widely-available small model; allow override via env
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const sys = `You are a strict classifier. Reply with exactly one category name from this list and nothing else: ${CATEGORY_OPTIONS.join(", ")}`;
  // Use both counterparty and description in the prompt
  const user = `Transaction\nCounterparty: ${counterparty || ""}\nDescription: ${description || ""}\nAmount: ${amount ?? ""} ${currency || ""}\nReturn one of: ${CATEGORY_OPTIONS.join(", ")}`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
      temperature: 0,
      max_tokens: 6,
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const text: string | undefined = data?.choices?.[0]?.message?.content?.trim();
  if (!text) return null;
  const normalized = text.replace(/^[^A-Za-z]*/g, "").replace(/[^A-Za-z]+$/g, "");
  const match = CATEGORY_OPTIONS.find((c) => c.toLowerCase() === normalized.toLowerCase());
  return match || null;
}

export async function suggestCategory(description?: string | null, counterparty?: string | null, amount?: string | number | null, currency?: string | null): Promise<string> {
  const heuristic = categorizeHeuristic(description ?? undefined, counterparty ?? undefined, amount ?? undefined);
  if (heuristic !== "Uncategorized") return heuristic;
  const llm = await categorizeViaOpenAI(description ?? undefined, counterparty ?? undefined, amount ?? undefined, currency ?? undefined);
  // Default to Uncategorized when we cannot confidently classify
  return llm || "Uncategorized";
}

// Try to reuse an existing category by matching both counterparty and description for this user
export async function findExistingCategory(
  databases: any,
  databaseId: string,
  collectionId: string,
  userId: string,
  description?: string | null,
  counterparty?: string | null
): Promise<string | null> {
  const counterpartyText = (counterparty || "").trim();
  const descriptionText = (description || "").trim();
  
  // If we have both counterparty and description, try to find exact matches
  if (counterpartyText && descriptionText) {
    try {
      const page = await databases.listDocuments(databaseId, collectionId, [
        Query.equal('userId', userId),
        Query.equal('counterparty', counterpartyText),
        Query.equal('description', descriptionText),
        Query.orderDesc('bookingDate'),
        Query.limit(5),
      ]);
      const docs: any[] = (page as any)?.documents || [];
      for (const d of docs) {
        if (d?.category && d.category !== 'Uncategorized') return d.category as string;
      }
    } catch (_e) {
      // ignore
    }
  }
  
  // Try to find by counterparty only
  if (counterpartyText) {
    try {
      const page = await databases.listDocuments(databaseId, collectionId, [
        Query.equal('userId', userId),
        Query.equal('counterparty', counterpartyText),
        Query.orderDesc('bookingDate'),
        Query.limit(5),
      ]);
      const docs: any[] = (page as any)?.documents || [];
      for (const d of docs) {
        if (d?.category && d.category !== 'Uncategorized') return d.category as string;
      }
    } catch (_e) {
      // ignore
    }
  }
  
  // Try to find by description only
  if (descriptionText) {
    try {
      const page = await databases.listDocuments(databaseId, collectionId, [
        Query.equal('userId', userId),
        Query.equal('description', descriptionText),
        Query.orderDesc('bookingDate'),
        Query.limit(5),
      ]);
      const docs: any[] = (page as any)?.documents || [];
      for (const d of docs) {
        if (d?.category && d.category !== 'Uncategorized') return d.category as string;
      }
    } catch (_e) {
      // ignore
    }
  }

  // Fuzzy search fallback: try token-based full-text search on description/counterparty and
  // pick the most frequent non-generic category among recent matches.
  try {
    const makeTokens = (s: string) =>
      s
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 4 && !/^\d+$/.test(w));

    const descTokens = descriptionText ? Array.from(new Set(makeTokens(descriptionText))).slice(0, 2) : [];
    const cpTokens = counterpartyText ? Array.from(new Set(makeTokens(counterpartyText))).slice(0, 2) : [];

    if (descTokens.length || cpTokens.length) {
      const queries: any[] = [
        Query.equal('userId', userId),
        Query.orderDesc('bookingDate'),
        Query.limit(50),
      ];
      for (const t of descTokens) queries.push(Query.search('description', t));
      for (const t of cpTokens) queries.push(Query.search('counterparty', t));

      const page = await databases.listDocuments(databaseId, collectionId, queries);
      const docs: any[] = (page as any)?.documents || [];

      const counts = new Map<string, number>();
      for (const d of docs) {
        const cat = (d?.category || '').trim();
        if (!cat || cat === 'Uncategorized' || cat === 'Miscellaneous') continue;
        counts.set(cat, (counts.get(cat) || 0) + 1);
      }

      let best: string | null = null;
      let bestCount = 0;
      counts.forEach((c, k) => {
        if (c > bestCount) {
          best = k;
          bestCount = c;
        }
      });

      if (best && bestCount >= 2) return best;
    }
  } catch (_e) {
    // ignore fuzzy failures
  }

  return null;
}


