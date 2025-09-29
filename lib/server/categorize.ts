import { CATEGORY_OPTIONS } from "@/lib/categories";
import { Query } from "appwrite";

function toNumber(amount?: string | number | null): number {
  if (amount === null || amount === undefined) return 0;
  if (typeof amount === "number") return amount;
  const n = parseFloat(amount);
  return Number.isNaN(n) ? 0 : n;
}

export function categorizeHeuristic(description?: string | null, counterparty?: string | null, amount?: string | number | null): string {
  // Prioritize counterparty over description
  const text = `${counterparty || ""} ${description || ""}`.toLowerCase();
  const value = toNumber(amount);

  const has = (arr: string[]) => arr.some((k) => text.includes(k));

  if (has(["aldi","lidl","tesco","sainsbury","asda","whole foods","costco","grocery","supermarket","spar"])) return "Groceries";
  if (has(["restaurant","cafe","coffee","starbucks","mcdonald","kfc","burger","pizza","domino","uber eats","deliveroo","doordash"])) return "Restaurant";
  if (has(["tuition","course","udemy","coursera","school","university","textbook","exam"])) return "Education";
  if (has(["uber","lyft","bolt","taxi","bus","train","metro","fuel","gas","petrol","shell","bp" ,"cab"])) return "Transport";
  if (has(["hotel","airbnb","flight","airlines","ryanair","easyjet","booking.com","expedia"])) return "Travel";
  if (has(["amazon","store","mall","retail","ikea","aliexpress","decathlon"])) return "Shopping";
  if (has(["electric","gas","water","internet","broadband","phone","vodafone","o2","ee","three","bt","virgin","utility", "rent"])) return "Utilities";
  if (has(["netflix","spotify","hulu","disney","cinema","theatre","steam","playstation","xbox","prime video"])) return "Entertainment";
  if (has(["pharmacy","doctor","dentist","clinic","gym","fitness","nhs","walgreens","boots"])) return "Health";
  if (has(["salary","payroll","income","dividend"])) return "Income";

  return "Uncategorized";
}

export async function categorizeViaOpenAI(description?: string | null, counterparty?: string | null, amount?: string | number | null, currency?: string | null): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const model = process.env.OPENAI_MODEL || "gpt-5-nano";
  const sys = `You are a strict classifier. Reply with exactly one category name from this list and nothing else: ${CATEGORY_OPTIONS.join(", ")}`;
  // Prioritize counterparty over description in the prompt
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
  return llm || "Miscellaneous";
}

// Try to reuse an existing category by counterparty first, then description for this user
export async function findExistingCategory(
  databases: any,
  databaseId: string,
  collectionId: string,
  userId: string,
  description?: string | null,
  counterparty?: string | null
): Promise<string | null> {
  // First try to find by counterparty
  if (counterparty && counterparty.trim()) {
    try {
      const page = await databases.listDocuments(databaseId, collectionId, [
        Query.equal('userId', userId),
        Query.equal('counterparty', counterparty.trim()),
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
  
  // If no match by counterparty, try by description
  const desc = (description || "").trim();
  if (!desc) return null;
  try {
    const page = await databases.listDocuments(databaseId, collectionId, [
      Query.equal('userId', userId),
      Query.equal('description', desc),
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
  return null;
}


