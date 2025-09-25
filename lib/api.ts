// API client for Nexpass backend
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const API_BASE_URL = "/api";

// Types
export interface Transaction {
  id: string;
  date: string;
  merchant: string;
  description?: string;
  category?: string;
  amount: number;
  currency: string;
  accountId: string;
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
async function apiRequest<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
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
    queryFn: () => apiRequest<{ ok: boolean; user: any }>("/auth/session"),
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Metrics
export const useMetrics = (dateRange?: { from: string; to: string }) => {
  return useQuery({
    queryKey: ["metrics", dateRange],
    queryFn: () => apiRequest<Metrics>(`/metrics${dateRange ? `?from=${dateRange.from}&to=${dateRange.to}` : ""}`),
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
  category?: string;
  accountId?: string;
}) => {
  return useQuery({
    queryKey: ["transactions", params],
    queryFn: () => {
      const searchParams = new URLSearchParams();
      if (params?.limit) searchParams.set("limit", params.limit.toString());
      if (params?.offset) searchParams.set("offset", params.offset.toString());
      if (params?.category) searchParams.set("category", params.category);
      if (params?.accountId) searchParams.set("accountId", params.accountId);
      
      return apiRequest<Transaction[]>(`/transactions?${searchParams.toString()}`);
    },
    staleTime: 1 * 60 * 1000, // 1 minute
  });
};

// Categories
export const useCategories = (dateRange?: { from: string; to: string }) => {
  return useQuery({
    queryKey: ["categories", dateRange],
    queryFn: () => apiRequest<CategorySlice[]>(`/categories${dateRange ? `?from=${dateRange.from}&to=${dateRange.to}` : ""}`),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

// Accounts
export const useAccounts = () => {
  return useQuery({
    queryKey: ["accounts"],
    queryFn: () => apiRequest<Account[]>("/accounts"),
    staleTime: 5 * 60 * 1000, // 5 minutes
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
