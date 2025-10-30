import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { getAuthHeader } from "@/lib/api"
import type { TransactionRule, TransactionRuleTestRequest, TransactionRuleTestResult, RuleApplicationOptions, RuleApplicationResult } from "@/lib/types/transaction-rules"

// API endpoints
const RULES_API_BASE = "/api/transaction-rules"

// Helper function for authenticated API requests
async function authenticatedRequest<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const authHeader = await getAuthHeader()
  const response = await fetch(endpoint, {
    headers: {
      "Content-Type": "application/json",
      ...authHeader,
      ...options?.headers,
    },
    credentials: 'include',
    ...options,
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || `API Error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

// Fetch all transaction rules for the current user
export function useTransactionRules() {
  return useQuery({
    queryKey: ["transaction-rules"],
    queryFn: async () => {
      return await authenticatedRequest<TransactionRule[]>(RULES_API_BASE)
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

// Create a new transaction rule
export function useCreateTransactionRule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (rule: Omit<TransactionRule, "id" | "userId" | "createdAt" | "updatedAt" | "matchCount" | "lastMatched">) => {
      return await authenticatedRequest<TransactionRule>(RULES_API_BASE, {
        method: "POST",
        body: JSON.stringify(rule),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transaction-rules"] })
    },
  })
}

// Update an existing transaction rule
export function useUpdateTransactionRule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TransactionRule> & { id: string }) => {
      return await authenticatedRequest<TransactionRule>(`${RULES_API_BASE}/${id}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transaction-rules"] })
    },
  })
}

// Delete a transaction rule
export function useDeleteTransactionRule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      return await authenticatedRequest(`${RULES_API_BASE}/${id}`, {
        method: "DELETE",
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transaction-rules"] })
    },
  })
}

// Test a rule against transactions
export function useTestTransactionRule() {
  return useMutation({
    mutationFn: async (request: TransactionRuleTestRequest) => {
      return await authenticatedRequest<TransactionRuleTestResult>(`${RULES_API_BASE}/test`, {
        method: "POST",
        body: JSON.stringify(request),
      })
    },
  })
}

// Apply a rule to existing transactions
export function useApplyTransactionRule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ ruleId, options }: { ruleId: string; options?: RuleApplicationOptions }) => {
      return await authenticatedRequest<RuleApplicationResult>(`${RULES_API_BASE}/${ruleId}/apply`, {
        method: "POST",
        body: JSON.stringify(options || {}),
      })
    },
    onSuccess: () => {
      // Invalidate transactions cache and rules cache
      queryClient.invalidateQueries({ queryKey: ["transactions"] })
      queryClient.invalidateQueries({ queryKey: ["transaction-rules"] })
    },
  })
}

// Apply all enabled rules to existing transactions
export function useApplyAllTransactionRules() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (options?: RuleApplicationOptions) => {
      return await authenticatedRequest<RuleApplicationResult>(`${RULES_API_BASE}/apply-all`, {
        method: "POST",
        body: JSON.stringify(options || {}),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] })
      queryClient.invalidateQueries({ queryKey: ["transaction-rules"] })
    },
  })
}