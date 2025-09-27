// Lightweight GoCardless Bank Account Data client with token caching and retries
// Docs: https://bankaccountdata.gocardless.com/api-reference/

const BASE_URL = "https://bankaccountdata.gocardless.com/api/v2";
const DEFAULT_TIMEOUT_MS = 20000; // 20s per request
const MAX_RETRIES = 5;

export class HttpError extends Error {
  status: number;
  details?: unknown;
  constructor(message: string, status?: number, details?: unknown) {
    super(message);
    this.name = "HttpError";
    this.status = status ?? 500;
    this.details = details;
  }
}

// In-memory token cache (per server process)
const tokenCache: {
  accessToken: string | null;
  expiresAtEpoch: number;
  refreshPromise: Promise<string> | null;
} = {
  accessToken: null,
  expiresAtEpoch: 0,
  refreshPromise: null,
};

function assertEnvVars(): void {
  const missing: string[] = [];
  if (!process.env.GOCARDLESS_SECRET_ID) missing.push("GOCARDLESS_SECRET_ID");
  if (!process.env.GOCARDLESS_SECRET_KEY) missing.push("GOCARDLESS_SECRET_KEY");
  if (missing.length > 0) {
    throw new Error(
      `Missing required env var(s): ${missing.join(", ")}. Please set them before using GoCardless client.`
    );
  }
}

async function fetchJson(url: string, options: RequestInit = {}): Promise<any> {
  const res = await fetch(url, options);
  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const body = isJson ? await res.json().catch(() => ({})) : await res.text();
  if (!res.ok) {
    const message = isJson && body && (body.detail || body.message)
      ? (body.detail || body.message)
      : `Request failed with status ${res.status}`;
    const headersSnapshot: Record<string, string> = {};
    try {
      res.headers.forEach((value, key) => {
        headersSnapshot[key.toLowerCase()] = value;
      });
    } catch {}
    throw new HttpError(message, res.status, { body, headers: headersSnapshot });
  }
  return body;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJsonWithRetry(url: string, options: RequestInit = {}, attempt = 1): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const merged: RequestInit = { ...options, signal: controller.signal };
    return await fetchJson(url, merged);
  } catch (err: any) {
    const status = err?.status as number | undefined;
    const isNetworkAbort = err?.name === "AbortError";
    const isRetriableStatus = status === 429 || (status !== undefined && status >= 500 && status <= 599);
    const shouldRetry = attempt < MAX_RETRIES && (isNetworkAbort || isRetriableStatus);
    if (!shouldRetry) throw err;

    // Respect Retry-After if available, else exponential backoff with jitter
    let delayMs = 0;
    const retryAfterHeader = err?.details?.headers?.["retry-after"] || err?.details?.["retry_after"]; // best-effort
    if (retryAfterHeader) {
      const seconds = Number(retryAfterHeader);
      if (!Number.isNaN(seconds) && seconds >= 0) delayMs = seconds * 1000;
    }
    if (!delayMs) {
      const base = 300 * Math.pow(2, attempt - 1); // 300ms, 600ms, 1200ms, ...
      const jitter = Math.floor(Math.random() * 200);
      delayMs = base + jitter;
    }
    await sleep(delayMs);
    return fetchJsonWithRetry(url, options, attempt + 1);
  } finally {
    clearTimeout(timeout);
  }
}

function isExpired(): boolean {
  // Consider token expired 30 seconds before actual expiry to avoid edge cases
  return !tokenCache.accessToken || Date.now() / 1000 > (tokenCache.expiresAtEpoch - 30);
}

async function requestNewToken(): Promise<string> {
  assertEnvVars();
  const url = `${BASE_URL}/token/new/`;
  const body = {
    secret_id: process.env.GOCARDLESS_SECRET_ID as string,
    secret_key: process.env.GOCARDLESS_SECRET_KEY as string,
  };
  const data = await fetchJson(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  // Response shape: { access: string, access_expires: number, refresh: string, refresh_expires: number, ... }
  const accessToken: string | undefined = data.access;
  const accessExpiresSeconds: number | undefined = data.access_expires;
  if (!accessToken || !accessExpiresSeconds) {
    throw new Error("Invalid token response from GoCardless Bank Data API");
  }
  tokenCache.accessToken = accessToken;
  tokenCache.expiresAtEpoch = Math.floor(Date.now() / 1000) + Number(accessExpiresSeconds);
  return tokenCache.accessToken;
}

async function getAccessToken(): Promise<string> {
  if (!isExpired()) return tokenCache.accessToken as string;
  if (!tokenCache.refreshPromise) {
    tokenCache.refreshPromise = requestNewToken().finally(() => {
      tokenCache.refreshPromise = null;
    });
  }
  return tokenCache.refreshPromise;
}

async function fetchWithAuth(path: string, options: RequestInit = {}, retryOnUnauthorized = true): Promise<any> {
  const token = await getAccessToken();
  const headers = {
    ...(options.headers || {}),
    authorization: `Bearer ${token}`,
  } as Record<string, string>;
  try {
    return await fetchJsonWithRetry(`${BASE_URL}${path}`, { ...options, headers });
  } catch (err) {
    if (
      retryOnUnauthorized &&
      err instanceof HttpError &&
      (err.status === 401 || err.status === 403)
    ) {
      // Force refresh token and retry once
      tokenCache.accessToken = null;
      await getAccessToken();
      return fetchJsonWithRetry(`${BASE_URL}${path}`, { ...options, headers });
    }
    throw err;
  }
}

// Public API wrappers
export async function listInstitutions(countryCode: string): Promise<any> {
  if (!countryCode || typeof countryCode !== "string" || countryCode.length !== 2) {
    throw new HttpError("Query param 'country' must be a 2-letter ISO code", 400);
  }
  const cc = countryCode.toUpperCase();
  return fetchWithAuth(`/institutions/?country=${encodeURIComponent(cc)}`, {
    method: "GET",
  });
}
export async function getInstitution(institutionId: string): Promise<any> {
  if (!institutionId) {
    throw new HttpError("'institutionId' is required", 400);
  }
  return fetchWithAuth(`/institutions/${encodeURIComponent(institutionId)}/`, {
    method: "GET",
  });
}

export async function createEndUserAgreement({
  institutionId,
  maxHistoricalDays = 90,
  accessValidForDays = 90,
  accessScope = ["balances", "details", "transactions"],
}: {
  institutionId: string;
  maxHistoricalDays?: number;
  accessValidForDays?: number;
  accessScope?: string[];
}): Promise<any> {
  if (!institutionId) {
    throw new HttpError("'institutionId' is required", 400);
  }
  const body = {
    institution_id: institutionId,
    max_historical_days: maxHistoricalDays,
    access_valid_for_days: accessValidForDays,
    access_scope: accessScope,
  };
  return fetchWithAuth(`/agreements/enduser/`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function createRequisition({
  redirect,
  institutionId,
  reference,
  userLanguage,
  agreementId,
}: {
  redirect: string;
  institutionId: string;
  reference?: string;
  userLanguage?: string;
  agreementId?: string;
}): Promise<any> {
  if (!redirect) throw new HttpError("'redirect' is required", 400);
  if (!institutionId) throw new HttpError("'institutionId' is required", 400);
  const body: Record<string, unknown> = {
    redirect,
    institution_id: institutionId,
    reference: reference || generateReference(),
    user_language: userLanguage || "EN",
  };
  if (agreementId) body.agreement = agreementId;

  return fetchWithAuth(`/requisitions/`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function getRequisition(requisitionId: string): Promise<any> {
  if (!requisitionId) throw new HttpError("'id' is required", 400);
  return fetchWithAuth(`/requisitions/${encodeURIComponent(requisitionId)}/`, {
    method: "GET",
  });
}

export async function getAccountDetails(accountId: string): Promise<any> {
  if (!accountId) throw new HttpError("'accountId' is required", 400);
  return fetchWithAuth(`/accounts/${encodeURIComponent(accountId)}/details/`, {
    method: "GET",
  });
}

export async function getAccountBalances(accountId: string): Promise<any> {
  if (!accountId) throw new HttpError("'accountId' is required", 400);
  return fetchWithAuth(`/accounts/${encodeURIComponent(accountId)}/balances/`, {
    method: "GET",
  });
}

export async function getAccountTransactions(accountId: string, { dateFrom, dateTo }: { dateFrom?: string | null; dateTo?: string | null } = {}): Promise<any> {
  if (!accountId) throw new HttpError("'accountId' is required", 400);
  const params = new URLSearchParams();
  if (dateFrom) params.set("date_from", dateFrom);
  if (dateTo) params.set("date_to", dateTo);
  const qs = params.toString();
  const path = `/accounts/${encodeURIComponent(accountId)}/transactions/${qs ? `?${qs}` : ""}`;
  return fetchWithAuth(path, { method: "GET" });
}

function generateReference(): string {
  // 16-char URL-safe reference
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
}

// Alias functions for consistency with the callback route
export const getAccounts = getAccountDetails;
export const getBalances = getAccountBalances;
export const getTransactions = getAccountTransactions;

export async function listRequisitions(): Promise<any> {
  return fetchWithAuth(`/requisitions/`, {
    method: "GET",
  });
}
