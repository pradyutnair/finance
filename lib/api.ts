// API client for Nexpass backend
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { account } from "@/lib/appwrite";

const API_BASE_URL = "/api";

// Client-side caches (module-scoped) to avoid duplicate fetches across components
const categoriesMemoryCache = new Map<string, CategorySlice[]>();
const categoriesInflight = new Map<string, Promise<CategorySlice[]>>();

// Types
export interface Transaction {
  id: string;
  date: string;
  bookingDate?: string; // Actual date field from backend
  valueDate?: string; // Alternative date field
  authorizedDate?: string; // Date transaction was authorized
  bookingDateTime?: string; // Full ISO datetime
  merchant: string;
  counterparty?: string;
  description?: string;
  category?: string;
  amount: number;
  currency: string;
  accountId: string;
  exclude?: boolean;
  pending?: boolean; // Transaction pending status
  paymentChannel?: string; // online, in store, etc.
  location?: {
    address?: string;
    city?: string;
    region?: string;
    postalCode?: string;
    country?: string;
    lat?: number;
    lon?: number;
    storeNumber?: string;
  };
  counterparties?: Array<{
    name: string;
    type: string;
    website?: string;
    logoUrl?: string;
    confidenceLevel?: string;
  }>;
  personalFinanceCategory?: {
    primary?: string;
    detailed?: string;
    confidenceLevel?: string;
  };
  merchantName?: string;
  logoUrl?: string;
  website?: string;
}

export interface Metrics {
  grossIncome: number;
  expenses: number;
  netIncome: number;
  savingRatePct: number;
  deltas?: {
    netPct: number;
    incomePct: number;
    expensesPct: number;
  };
}

export interface SeriesPoint {
  date: string;
  income: number;
  expenses: number;
}

export interface CategorySlice {
  name: string;
  amount: number;
  percent: number;
}

export interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
  currency: string;
  status: string;
  lastSync: string;
}

// API functions

// Robust JWT caching to ensure every request includes a valid Appwrite JWT.
// This avoids relying on cookies on our own domain, which don't include Appwrite's session cookie.
let cachedJwtToken: string | null = null;
let cachedJwtExpiresAtMs = 0; // epoch ms
let inflightJwtPromise: Promise<string> | null = null;

function decodeJwtExpirationMs(token: string): number | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payloadJson = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(payloadJson || "{}");
    if (typeof payload.exp === "number") {
      return payload.exp * 1000;
    }
  } catch (_err) {
    // ignore decode errors; we'll fallback to default TTL
  }
  return null;
}

async function fetchFreshJwt(): Promise<string> {
  // Ensure there is an active Appwrite session in the browser
  await account.get();
  const jwt = await account.createJWT();
  const token = (jwt as any).jwt || (jwt as any).token;
  if (typeof token !== "string" || token.length < 10) {
    throw new Error("Invalid JWT token returned by Appwrite");
  }
  const expMs = decodeJwtExpirationMs(token) ?? (Date.now() + 10 * 60 * 1000);
  cachedJwtToken = token;
  // Refresh 60s before expiry
  cachedJwtExpiresAtMs = expMs - 60 * 1000;
  return token;
}

async function ensureJwt(): Promise<string> {
  const now = Date.now();
  if (cachedJwtToken && now < cachedJwtExpiresAtMs) {
    return cachedJwtToken;
  }
  if (inflightJwtPromise) {
    return inflightJwtPromise;
  }
  inflightJwtPromise = (async () => {
    try {
      return await fetchFreshJwt();
    } finally {
      inflightJwtPromise = null;
    }
  })();
  return inflightJwtPromise;
}

export async function getAuthHeader(): Promise<Record<string, string>> {
  try {
    const token = await ensureJwt();
    return { Authorization: `Bearer ${token}` };
  } catch (_e) {
    // No active session; return empty headers so server returns 401 cleanly
    return {};
  }
}

async function apiRequest<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const authHeader = await getAuthHeader();
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      ...authHeader,
      ...options?.headers,
    },
    credentials: 'include',
    ...options,
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// Auth
export const useSession = () => {
  return useQuery({
    queryKey: ["session"],
    queryFn: () => apiRequest<{ ok: boolean; user: unknown }>("/auth/session"),
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export interface DashboardMetrics {
  balance: number;
  income: number;
  expenses: number;
  netIncome: number;
  savingsRate: number;
  transactionCount: number;
  deltas?: {
    balancePct: number;
    incomePct: number;
    expensesPct: number;
    savingsPct: number;
  };
}

// Metrics
export const useMetrics = (dateRange?: { from: string; to: string }) => {
  return useQuery({
    queryKey: ["metrics", dateRange],
    queryFn: () => apiRequest<DashboardMetrics>(`/metrics${dateRange ? `?from=${dateRange.from}&to=${dateRange.to}` : ""}`),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

// Time series data
export const useTimeseries = (dateRange?: { from: string; to: string }) => {
  return useQuery({
    queryKey: ["timeseries", dateRange],
    queryFn: () => apiRequest<SeriesPoint[]>(`/timeseries${dateRange ? `?from=${dateRange.from}&to=${dateRange.to}` : ""}`),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

// Transactions
export const useTransactions = (params?: {
  limit?: number;
  offset?: number;
  all?: boolean;
  category?: string;
  accountId?: string;
  dateRange?: { from: string; to: string };
  includeExcluded?: boolean;
}) => {
  return useQuery({
    queryKey: ["transactions", params],
    queryFn: () => {
      const searchParams = new URLSearchParams();
      if (params?.limit) searchParams.set("limit", params.limit.toString());
      if (params?.offset) searchParams.set("offset", params.offset.toString());
      if (params?.all) searchParams.set("all", "true");
      if (params?.category) searchParams.set("category", params.category);
      if (params?.accountId) searchParams.set("accountId", params.accountId);
      if (params?.dateRange?.from) searchParams.set("from", params.dateRange.from);
      if (params?.dateRange?.to) searchParams.set("to", params.dateRange.to);
      if (params?.includeExcluded) searchParams.set("includeExcluded", "true");

      return apiRequest<{ok: boolean; transactions: Transaction[]; total: number}>(`/transactions?${searchParams.toString()}`);
    },
    // Disable staleness so UI refetches promptly
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
};

// Mutations: Update transaction fields
export const useUpdateTransaction = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: { 
      id: string; 
      category?: string; 
      exclude?: boolean; 
      description?: string; 
      counterparty?: string;
      similarTransactionIds?: string[];
    }) => {
      const authHeader = await getAuthHeader();
      const response = await fetch(`/api/transactions/${args.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...authHeader,
        },
        credentials: 'include',
        body: JSON.stringify({
          category: args.category,
          exclude: args.exclude,
          description: args.description,
          counterparty: args.counterparty,
          similarTransactionIds: args.similarTransactionIds
        }),
      });
      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }
      return response.json();
    },
    onMutate: async (args) => {
      await queryClient.cancelQueries({ queryKey: ["transactions"] });
      const previous = queryClient.getQueriesData<{ ok: boolean; transactions: any[]; total: number }>({
        queryKey: ["transactions"],
      });

      // Get all transaction IDs that should be updated (target + similar)
      const similarTransactionIds = args.similarTransactionIds || [];
      const allTransactionIdsToUpdate = [args.id, ...similarTransactionIds];

      previous.forEach(([key, data]) => {
        if (!data) return;
        const updatedTransactions = data.transactions.map((t) => {
          const transactionId = t.$id || t.id;
          const isTargetTransaction = transactionId === args.id;
          const isSimilarTransaction = similarTransactionIds.includes(transactionId);

          // Only update the target transaction and explicitly provided similar transactions
          if (isTargetTransaction || isSimilarTransaction) {
            return {
              ...t,
              ...(typeof args.category === "string" ? { category: args.category } : {}),
              ...(typeof args.exclude === "boolean" ? { exclude: args.exclude } : {}),
              ...(typeof args.counterparty === "string" ? { counterparty: args.counterparty } : {}),
              ...(typeof args.description === "string" ? { description: args.description } : {}),
            };
          }
          return t;
        });

        const updated = { ...data, transactions: updatedTransactions };
        queryClient.setQueryData(key, updated);
      });

      return { previous };
    },
    onError: (_err, _args, context) => {
      if (!context) return;
      context.previous?.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });
};

// Categories
export const useCategories = (dateRange?: { from: string; to: string }) => {
  return useQuery({
    queryKey: ["categories", dateRange],
    queryFn: async () => {
      const key = `categories:${dateRange?.from ?? ''}:${dateRange?.to ?? ''}`;

      // 1) Return from in-memory cache if present
      const mem = categoriesMemoryCache.get(key);
      if (mem) return mem;

      // 2) Return from sessionStorage if present
      try {
        const raw = sessionStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw) as CategorySlice[];
          if (Array.isArray(parsed)) {
            categoriesMemoryCache.set(key, parsed);
            return parsed;
          }
        }
      } catch {}

      // 3) De-dupe concurrent fetches
      const inflight = categoriesInflight.get(key);
      if (inflight) return inflight;

      const p = (async () => {
        const data = await apiRequest<CategorySlice[]>(`/categories${dateRange ? `?from=${dateRange.from}&to=${dateRange.to}` : ""}`);
        categoriesMemoryCache.set(key, data);
        try { sessionStorage.setItem(key, JSON.stringify(data)); } catch {}
        categoriesInflight.delete(key);
        return data;
      })();
      categoriesInflight.set(key, p);
      return p;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes to strongly prefer cache
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
};

// Manual auto-categorization trigger
export const useAutoCategorize = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args?: { limit?: number }) => {
      return apiRequest<{ ok: boolean; execution?: any }>(`/transactions/auto-categorize`, {
        method: "POST",
        body: JSON.stringify({ limit: args?.limit ?? 200 }),
      });
    },
    onSuccess: () => {
      // Refresh transactions and categories after categorization
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    }
  });
};

// Accounts
export const useAccounts = () => {
  return useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const res = await apiRequest<{ ok: boolean; accounts: any[] }>("/accounts");
      return Array.isArray((res as any).accounts) ? (res as any).accounts : [];
    },
    staleTime: 3 * 60 * 1000, // 3 minutes
  });
};

// GoCardless Integration
export const useInstitutions = (countryCode: string) => {
  return useQuery({
    queryKey: ["institutions", countryCode],
    queryFn: () => apiRequest(`/gocardless/institutions?country=${countryCode}`),
    enabled: !!countryCode,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

export const useCreateRequisition = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: {
      institutionId: string;
      redirect: string;
      reference?: string;
      userLanguage?: string;
    }) => apiRequest("/gocardless/requisitions", {
      method: "POST",
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
};

export const useRequisition = (requisitionId: string) => {
  return useQuery({
    queryKey: ["requisition", requisitionId],
    queryFn: () => apiRequest(`/gocardless/requisitions/${requisitionId}`),
    enabled: !!requisitionId,
  });
};

export const useAccountDetails = (accountId: string) => {
  return useQuery({
    queryKey: ["account-details", accountId],
    queryFn: () => apiRequest(`/gocardless/accounts/${accountId}`),
    enabled: !!accountId,
  });
};

export const useAccountTransactions = (accountId: string, dateRange?: { from: string; to: string }) => {
  return useQuery({
    queryKey: ["account-transactions", accountId, dateRange],
    queryFn: () => {
      const params = new URLSearchParams();
      if (dateRange?.from) params.set("dateFrom", dateRange.from);
      if (dateRange?.to) params.set("dateTo", dateRange.to);
      
      return apiRequest(`/gocardless/accounts/${accountId}/transactions?${params.toString()}`);
    },
    enabled: !!accountId,
  });
};

// Chat API
export const useSendMessage = () => {
  return useMutation({
    mutationFn: (message: string) => apiRequest<{ reply: string }>("/chat", {
      method: "POST",
      body: JSON.stringify({ message }),
    }),
  });
};

