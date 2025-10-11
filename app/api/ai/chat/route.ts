export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth";
import OpenAI from "openai";
import { getUserTransactionCache } from "@/lib/server/cache-service";
import { databases } from "@/lib/appwrite";

type AuthUser = { $id?: string; id?: string };

// Simple in-memory cache for responses (expires after 5 minutes)
const responseCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Transaction data cache per user (expires after 2 minutes)
const transactionCache = new Map<string, { data: any[]; timestamp: number }>();
const TRANSACTION_CACHE_TTL = 2 * 60 * 1000; // 2 minutes

// Cache cleanup function to prevent memory leaks
function cleanupCache() {
  const now = Date.now();

  // Clean response cache
  for (const [key, value] of responseCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      responseCache.delete(key);
    }
  }

  // Clean transaction cache
  for (const [key, value] of transactionCache.entries()) {
    if (now - value.timestamp > TRANSACTION_CACHE_TTL) {
      transactionCache.delete(key);
    }
  }
}

// Helper function to stream cached responses
function streamCachedResponse(data: { answer: string; suggestions: string[] }) {
  return new Response(
    new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        const send = (s: string) => controller.enqueue(encoder.encode(`data: ${s}\n\n`));

        // Stream cached answer immediately (no artificial delays)
        send(data.answer);
        if (data.suggestions?.length > 0) {
          send(`SUGGESTIONS:${JSON.stringify(data.suggestions)}`);
        }
        send("[DONE]");
        controller.close();
      }
    }),
    {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no"
      }
    }
  );
}

// AI Function Tools - The AI can dynamically call these based on user questions
class FinanceTools {
  private transactions: any[];
  private currency: string;
  private processedData: Map<string, any> = new Map();

  constructor(transactions: any[]) {
    this.transactions = transactions;
    this.currency = transactions[0]?.currency || 'EUR';
    // Pre-process common data for faster queries
    this.preprocessData();
  }

  private preprocessData() {
    const now = new Date();
    const timeRanges = {
      7: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      30: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      90: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    };

    // Pre-calculate common aggregations
    Object.entries(timeRanges).forEach(([days, cutoff]) => {
      const filtered = this.transactions.filter(tx => new Date(tx.bookingDate) >= cutoff);
      const expenses = filtered.filter(tx => Number(tx.amount) < 0);
      const income = filtered.filter(tx => Number(tx.amount) > 0);

      this.processedData.set(`filtered_${days}`, filtered);
      this.processedData.set(`expenses_${days}`, expenses);
      this.processedData.set(`income_${days}`, income);
    });
  }

  // Get spending by category with filters - OPTIMIZED
  getSpendingByCategory(params: { days?: number; category?: string }) {
    const { days = 30, category } = params;

    // Use pre-processed data if available
    let expenses = this.processedData.get(`expenses_${days}`);
    if (!expenses) {
      // Fallback to manual filtering for uncommon time ranges
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      expenses = this.transactions.filter((tx: any) => {
        const amount = Number(tx.amount || 0);
        return amount < 0 && new Date(tx.bookingDate) >= cutoff;
      });
    }

    const filtered = category ? expenses.filter((tx: any) => tx.category === category) : expenses;

    // Use reduce for more efficient aggregation
    const byCategory = filtered.reduce((acc: Record<string, { total: number; count: number }>, tx: any) => {
      const cat = tx.category || 'Uncategorized';
      const amount = Math.abs(Number(tx.amount));
      if (!acc[cat]) acc[cat] = { total: 0, count: 0 };
      acc[cat].total += amount;
      acc[cat].count += 1;
      return acc;
    }, {});

    // Calculate averages and sort in one pass
    const categories = Object.entries(byCategory).map(([name, data]) => {
      const categoryData = data as { total: number; count: number };
      return {
        category: name,
        total: categoryData.total,
        count: categoryData.count,
        avg: categoryData.total / categoryData.count
      };
    }).sort((a, b) => b.total - a.total);

    return {
      categories,
      totalSpent: categories.reduce((sum, c) => sum + c.total, 0),
      transactionCount: filtered.length,
      currency: this.currency
    };
  }

  // Get income vs expenses
  getIncomeVsExpenses(params: { days?: number }) {
    const { days = 30 } = params;
    const now = new Date();
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    
    const filtered = this.transactions.filter((tx: any) => {
      const txDate = new Date(tx.bookingDate);
      return txDate >= cutoff;
    });

    let income = 0, expenses = 0;
    filtered.forEach((tx: any) => {
      const amount = Number(tx.amount || 0);
      if (amount > 0) income += amount;
      else expenses += Math.abs(amount);
    });

    return {
      income,
      expenses,
      net: income - expenses,
      savingsRate: income > 0 ? ((income - expenses) / income * 100) : 0,
      currency: this.currency
    };
  }

  // Predict end of month spending
  predictEndOfMonth() {
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const monthTxs = this.transactions.filter((tx: any) => {
      const date = new Date(tx.bookingDate);
      return date >= firstOfMonth && date <= now && Number(tx.amount) < 0;
    });

    let totalSpent = 0;
    const byCat: Record<string, number> = {};

    monthTxs.forEach((tx: any) => {
      const amount = Math.abs(Number(tx.amount));
      totalSpent += amount;
      const cat = tx.category || 'Uncategorized';
      byCat[cat] = (byCat[cat] || 0) + amount;
    });

    const daysElapsed = Math.max(1, Math.ceil((now.getTime() - firstOfMonth.getTime()) / (24 * 60 * 60 * 1000)));
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysRemaining = lastDay - daysElapsed;
    const dailyAvg = totalSpent / daysElapsed;
    const projected = totalSpent + (dailyAvg * daysRemaining);

    return {
      currentSpent: totalSpent,
      projectedTotal: projected,
      dailyAverage: dailyAvg,
      daysRemaining,
      currency: this.currency
    };
  }

  // Find unusual transactions
  findUnusualTransactions(params: { limit?: number } = {}) {
    const { limit = 5 } = params;
    const byCat: Record<string, number[]> = {};
    
    this.transactions.forEach((tx: any) => {
      const amount = Math.abs(Number(tx.amount || 0));
      if (amount > 0 && Number(tx.amount) < 0) {
        const cat = tx.category || 'Uncategorized';
        if (!byCat[cat]) byCat[cat] = [];
        byCat[cat].push(amount);
      }
    });

    const anomalies: any[] = [];

    Object.entries(byCat).forEach(([cat, amounts]) => {
      if (amounts.length < 5) return;
      
      const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      const variance = amounts.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / amounts.length;
      const stdDev = Math.sqrt(variance);
      
      this.transactions.forEach((tx: any) => {
        if (tx.category === cat && Number(tx.amount) < 0) {
          const amount = Math.abs(Number(tx.amount));
          const zScore = (amount - mean) / stdDev;
          if (zScore > 2) {
            anomalies.push({
              date: tx.bookingDate,
              category: cat,
              amount,
              description: tx.description,
              zScore
            });
          }
        }
      });
    });

    return {
      unusualTransactions: anomalies
        .sort((a, b) => b.zScore - a.zScore)
        .slice(0, limit)
        .map(({ zScore, ...rest }) => rest),
      currency: this.currency
    };
  }

  // Search transactions
  searchTransactions(params: { query: string; limit?: number }) {
    const { query, limit = 10 } = params;
    const term = query.toLowerCase();

    const matches = this.transactions.filter((tx: any) => {
      const desc = (tx.description || '').toLowerCase();
      const counterparty = (tx.counterparty || '').toLowerCase();
      return desc.includes(term) || counterparty.includes(term);
    });

    return {
      transactions: matches.slice(0, limit).map((tx: any) => ({
        date: tx.bookingDate,
        amount: Number(tx.amount),
        category: tx.category,
        description: tx.description
      })),
      totalFound: matches.length,
      currency: this.currency
    };
  }

  // Compare time periods
  compareTimePeriods(params: { period1Days: number; period2Days: number }) {
    const { period1Days, period2Days } = params;
    const now = new Date();
    
    const p1Start = new Date(now.getTime() - period1Days * 24 * 60 * 60 * 1000);
    const p2Start = new Date(now.getTime() - (period1Days + period2Days) * 24 * 60 * 60 * 1000);
    const p2End = p1Start;

    const calcStats = (start: Date, end: Date) => {
      const txs = this.transactions.filter((tx: any) => {
        const date = new Date(tx.bookingDate);
        return date >= start && date <= end;
      });
      let income = 0, expenses = 0;
      txs.forEach((tx: any) => {
        const amt = Number(tx.amount || 0);
        if (amt > 0) income += amt;
        else expenses += Math.abs(amt);
      });
      return { income, expenses, net: income - expenses };
    };

    const stats1 = calcStats(p1Start, now);
    const stats2 = calcStats(p2Start, p2End);

    return {
      period1: { days: period1Days, ...stats1 },
      period2: { days: period2Days, ...stats2 },
      changes: {
        expensesChange: stats1.expenses - stats2.expenses,
        expensesChangePercent: stats2.expenses > 0 ? ((stats1.expenses - stats2.expenses) / stats2.expenses * 100) : 0
      },
      currency: this.currency
    };
  }

  // Get top merchants
  getTopMerchants(params: { category?: string; limit?: number; days?: number }) {
    const { category, limit = 10, days = 30 } = params;
    const now = new Date();
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    let filtered = this.transactions.filter((tx: any) => {
      const txDate = new Date(tx.bookingDate);
      return txDate >= cutoff && Number(tx.amount) < 0;
    });

    if (category) filtered = filtered.filter((tx: any) => tx.category === category);

    const byMerchant: Record<string, { total: number; count: number }> = {};
    filtered.forEach((tx: any) => {
      const merchant = tx.counterparty || tx.description || 'Unknown';
      const amount = Math.abs(Number(tx.amount));
      if (!byMerchant[merchant]) byMerchant[merchant] = { total: 0, count: 0 };
      byMerchant[merchant].total += amount;
      byMerchant[merchant].count += 1;
    });

    return {
      merchants: Object.entries(byMerchant)
        .sort(([, a], [, b]) => b.total - a.total)
        .slice(0, limit)
        .map(([name, data]) => ({ merchant: name, ...data })),
      currency: this.currency
    };
  }
}

// OpenAI function definitions
const TOOL_DEFINITIONS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "getSpendingByCategory",
      description: "Get spending breakdown by category. Use for questions about categories, where money goes, or spending patterns.",
      parameters: {
        type: "object",
        properties: {
          days: { type: "number", description: "Days to look back (default 30)" },
          category: { type: "string", description: "Optional: specific category to filter" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "getIncomeVsExpenses",
      description: "Get income, expenses, net savings. Use for questions about total spending, income, or savings rate.",
      parameters: {
        type: "object",
        properties: {
          days: { type: "number", description: "Days to look back (default 30)" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "predictEndOfMonth",
      description: "Predict end-of-month spending based on daily average. Use for forecasting or budget questions.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "findUnusualTransactions",
      description: "Find statistically unusual transactions. Use for questions about unusual or anomalous spending.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Max results (default 5)" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "searchTransactions",
      description: "Search transactions by merchant/description. Use when user asks about specific stores or merchants.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search term" },
          limit: { type: "number", description: "Max results (default 10)" }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "compareTimePeriods",
      description: "Compare spending between two periods. Use for 'compared to' or trend questions.",
      parameters: {
        type: "object",
        properties: {
          period1Days: { type: "number", description: "Recent period days" },
          period2Days: { type: "number", description: "Previous period days" }
        },
        required: ["period1Days", "period2Days"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "getTopMerchants",
      description: "Get top merchants by spending. Use for questions about where user spends most.",
      parameters: {
        type: "object",
        properties: {
          category: { type: "string", description: "Optional: filter by category" },
          limit: { type: "number", description: "Max merchants (default 10)" },
          days: { type: "number", description: "Days to look back (default 30)" }
        }
      }
    }
  }
];

export async function POST(request: Request) {
  try {
    // Clean up expired cache entries periodically
    if (Math.random() < 0.1) cleanupCache(); // 10% chance to clean cache on each request

    const body = await request.json().catch(() => ({}));
    const userMessage: string = body?.message || "";
    if (!userMessage || typeof userMessage !== "string") {
      return NextResponse.json({ ok: false, error: "Missing message" }, { status: 400 });
    }

    const user = (await requireAuthUser(request)) as AuthUser;
    const userId = (user.$id ?? user.id) as string;

    // Check response cache first (only cache common queries)
    const cacheKey = `${userId}:${userMessage.toLowerCase().trim()}`;
    const cached = responseCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return streamCachedResponse(cached.data);
    }

    // Get transactions from cache or fetch fresh data
    let allTransactions = transactionCache.get(userId);
    if (!allTransactions || Date.now() - allTransactions.timestamp > TRANSACTION_CACHE_TTL) {
      allTransactions = {
        data: await getUserTransactionCache(userId, databases),
        timestamp: Date.now()
      };
      transactionCache.set(userId, allTransactions);
    }
    
    if (!allTransactions.data || allTransactions.data.length === 0) {
      return new Response(
        new ReadableStream({
          start(controller) {
            const encoder = new TextEncoder();
            controller.enqueue(encoder.encode(`data: No transaction data yet. Connect your bank to get started.\n\n`));
            controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
            controller.close();
          }
        }),
        {
          headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive"
          }
        }
      );
    }

    // Initialize tools with transaction data
    const tools = new FinanceTools(allTransactions.data);
    const currency = allTransactions.data[0]?.currency || 'EUR';

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    const systemPrompt = `You are a decisive, concise financial analyst with access to the user's transaction data.

CRITICAL GUIDELINES:
- Be EXTREMELY concise and direct 
- Make smart inferences from context 
- Use reasonable defaults
- For simple questions, give ONE sentence or just the number with currency
- Call appropriate tools immediately - don't ask permission
- Only ask for clarification if truly ambiguous (e.g., "which account?" when user has multiple or if the date range is)
- Use currency symbols (${currency})
- Today is ${new Date().toISOString().split('T')[0]}
- Default behavior: answer > ask

INFERENCE RULES:
- "last month" = ask the user if they want last 30 days or last calendar month
- "this month" = current calendar month to date
- "recently" = past 7 days
- "spending" = expenses only (negative amounts)
- "biggest category" = highest spending category by total amount
- If comparing periods, use equal time windows

DO NOT ask questions unless the user is unclear - just use sensible defaults and answer.

IMPORTANT: After answering, you MUST also suggest 2 smart follow-up questions the user might ask next.
- If you asked a question → provide direct answer options (e.g., ["Last calendar month", "Last 30 days"])
- If you gave data/analysis → suggest deeper dives (e.g., ["Top merchants", "Compare to last month"])
- Keep each under 6 words, actionable, and natural
- Avoid repeating what was just discussed
- Never include the options list or suggestions in the main answer. Only return them in the suggestions.
- Include question marks and ask politely. Don't ask multiple questions, only one per reply.

Your response must be in this JSON format:
{
  "answer": "your concise answer here",
  "suggestions": ["suggestion1", "suggestion2"]
}`;

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage }
    ];

    // First API call - let AI decide which tools to use and format response
    let response = await openai.chat.completions.create({
      model,
      messages,
      tools: TOOL_DEFINITIONS,
      tool_choice: "auto",
    });

    let assistantMessage = response.choices[0].message;

    // Handle tool calls iteratively
    while (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      messages.push(assistantMessage);

      // Execute all tool calls in parallel where possible
      const toolPromises = assistantMessage.tool_calls.map(async (toolCall) => {
        if (toolCall.type !== 'function') return null;
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);

        try {
          switch (functionName) {
            case "getSpendingByCategory":
              return tools.getSpendingByCategory(functionArgs);
            case "getIncomeVsExpenses":
              return tools.getIncomeVsExpenses(functionArgs);
            case "predictEndOfMonth":
              return tools.predictEndOfMonth();
            case "findUnusualTransactions":
              return tools.findUnusualTransactions(functionArgs);
            case "searchTransactions":
              return tools.searchTransactions(functionArgs);
            case "compareTimePeriods":
              return tools.compareTimePeriods(functionArgs);
            case "getTopMerchants":
              return tools.getTopMerchants(functionArgs);
            default:
              return { error: "Unknown function" };
          }
        } catch (err: any) {
          return { error: err.message };
        }
      });

      const toolResults = await Promise.all(toolPromises);

      // Add tool results to messages
      assistantMessage.tool_calls.forEach((toolCall, index) => {
        const result = toolResults[index];
        if (result) {
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(result)
          });
        }
      });

      // Get AI's final response with structured format in ONE API call
      response = await openai.chat.completions.create({
        model,
        messages: [...messages, {
          role: "user",
          content: "Provide your final answer and 2 follow-up suggestions in this JSON format: {\"answer\": \"your concise answer\", \"suggestions\": [\"suggestion1\", \"suggestion2\"]}"
        }],
        response_format: { type: "json_object" }
      });

      assistantMessage = response.choices[0].message;
      break; // Exit loop after final response
    }

    const finalResponse = assistantMessage.content ? JSON.parse(assistantMessage.content) : {
      answer: "I couldn't generate a response.",
      suggestions: ["Tell me more", "What else?"]
    };

    // Cache the response for common queries
    const responseToCache = { answer: finalResponse.answer, suggestions: finalResponse.suggestions };
    responseCache.set(cacheKey, { data: responseToCache, timestamp: Date.now() });

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const encoder = new TextEncoder();
        const send = (s: string) => controller.enqueue(encoder.encode(`data: ${s}\n\n`));

        try {
          const finalContent = finalResponse.answer || "I couldn't generate a response.";
          const suggestions = Array.isArray(finalResponse.suggestions) ? finalResponse.suggestions.slice(0, 2) : [];

          // Optimized streaming: send in chunks instead of word by word
          const chunkSize = 3; // Send 3 words at a time for faster UX
          const words = finalContent.split(' ');

          for (let i = 0; i < words.length; i += chunkSize) {
            const chunk = words.slice(i, i + chunkSize).join(' ');
            send(chunk + (i + chunkSize < words.length ? ' ' : ''));
            // Reduced delay from 30ms to 10ms for faster streaming
            if (i + chunkSize < words.length) {
              await new Promise(resolve => setTimeout(resolve, 10));
            }
          }

          // Send suggestions if available
          if (suggestions.length > 0) {
            send(`SUGGESTIONS:${JSON.stringify(suggestions)}`);
          }

          send("[DONE]");
          controller.close();
        } catch (err: any) {
          console.error('AI streaming error:', err);
          send("Error generating response.");
          send("[DONE]");
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no"
      }
    });

  } catch (error: any) {
    console.error("AI chat route error:", error);
    const status = error?.status || 500;
    return NextResponse.json({ ok: false, error: error?.message || "Internal Server Error" }, { status });
  }
}