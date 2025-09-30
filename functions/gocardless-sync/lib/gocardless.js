/**
 * GoCardless Bank Account Data client for Appwrite Functions
 * Lightweight client with token caching and retries
 */

// Configuration
const BASE_URL = "https://bankaccountdata.gocardless.com/api/v2";
const DEFAULT_TIMEOUT_MS = 20000; // 20s per request
const MAX_RETRIES = 5;

// In-memory token cache (per function execution)
const tokenCache = {
  accessToken: null,
  expiresAtEpoch: 0,
  refreshPromise: null,
};

class HttpError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = "HttpError";
    this.status = status || 500;
    this.details = details;
  }
}

function assertEnvVars() {
  const missing = [];
  if (!process.env.GOCARDLESS_SECRET_ID) missing.push("GOCARDLESS_SECRET_ID");
  if (!process.env.GOCARDLESS_SECRET_KEY) missing.push("GOCARDLESS_SECRET_KEY");
  if (missing.length > 0) {
    throw new HttpError(
      `Missing required env var(s): ${missing.join(", ")}. Please set them before using GoCardless client.`,
      500
    );
  }
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const contentType = response.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");
    const body = isJson ? await response.json().catch(() => ({})) : await response.text();

    if (!response.ok) {
      const message = isJson && body && (body.detail || body.message)
        ? (body.detail || body.message)
        : `Request failed with status ${response.status}`;

      const headersSnapshot = {};
      try {
        response.headers.forEach((value, key) => {
          headersSnapshot[key.toLowerCase()] = value;
        });
      } catch {}

      throw new HttpError(message, response.status, { body, headers: headersSnapshot });
    }

    return body;
  } catch (error) {
    clearTimeout(timeout);

    if (error.name === 'AbortError') {
      throw new HttpError('Request timeout', 408);
    }

    throw error;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJsonWithRetry(url, options = {}, attempt = 1) {
  try {
    return await fetchJson(url, options);
  } catch (err) {
    const status = err?.status;
    const isNetworkAbort = err?.name === "AbortError";
    const isRetriableStatus = status === 429 || (status !== undefined && status >= 500 && status <= 599);
    const shouldRetry = attempt < MAX_RETRIES && (isNetworkAbort || isRetriableStatus);

    if (!shouldRetry) throw err;

    // Respect Retry-After if available, else exponential backoff with jitter
    let delayMs = 0;
    const retryAfterHeader = err?.details?.headers?.["retry-after"] || err?.details?.["retry_after"];

    if (retryAfterHeader) {
      const seconds = Number(retryAfterHeader);
      if (!Number.isNaN(seconds) && seconds >= 0) delayMs = seconds * 1000;
    }

    if (!delayMs) {
      const base = 300 * Math.pow(2, attempt - 1); // 300ms, 600ms, 1200ms, ...
      const jitter = Math.floor(Math.random() * 200);
      delayMs = base + jitter;
    }

    console.log(`[GoCardless] Retrying request (attempt ${attempt}/${MAX_RETRIES}) after ${delayMs}ms`);
    await sleep(delayMs);
    return fetchJsonWithRetry(url, options, attempt + 1);
  }
}

function isExpired() {
  // Consider token expired 30 seconds before actual expiry to avoid edge cases
  return !tokenCache.accessToken || Date.now() / 1000 > (tokenCache.expiresAtEpoch - 30);
}

async function requestNewToken() {
  assertEnvVars();
  const url = `${BASE_URL}/token/new/`;
  const body = {
    secret_id: process.env.GOCARDLESS_SECRET_ID,
    secret_key: process.env.GOCARDLESS_SECRET_KEY,
  };

  const data = await fetchJson(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  // Response shape: { access: string, access_expires: number, refresh: string, refresh_expires: number, ... }
  const accessToken = data.access;
  const accessExpiresSeconds = data.access_expires;

  if (!accessToken || !accessExpiresSeconds) {
    throw new HttpError("Invalid token response from GoCardless Bank Data API", 502);
  }

  tokenCache.accessToken = accessToken;
  tokenCache.expiresAtEpoch = Math.floor(Date.now() / 1000) + Number(accessExpiresSeconds);

  return tokenCache.accessToken;
}

async function getAccessToken() {
  if (!isExpired()) return tokenCache.accessToken;

  if (!tokenCache.refreshPromise) {
    tokenCache.refreshPromise = requestNewToken().finally(() => {
      tokenCache.refreshPromise = null;
    });
  }

  return tokenCache.refreshPromise;
}

async function fetchWithAuth(path, options = {}, retryOnUnauthorized = true) {
  const token = await getAccessToken();
  const headers = {
    ...(options.headers || {}),
    authorization: `Bearer ${token}`,
  };

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
async function getAccountDetails(accountId) {
  if (!accountId) {
    throw new HttpError("'accountId' is required", 400);
  }
  return fetchWithAuth(`/accounts/${encodeURIComponent(accountId)}/details/`, {
    method: "GET",
  });
}

async function getAccountBalances(accountId) {
  if (!accountId) {
    throw new HttpError("'accountId' is required", 400);
  }
  return fetchWithAuth(`/accounts/${encodeURIComponent(accountId)}/balances/`, {
    method: "GET",
  });
}

async function getAccountTransactions(accountId, { dateFrom, dateTo } = {}) {
  if (!accountId) {
    throw new HttpError("'accountId' is required", 400);
  }

  const params = new URLSearchParams();
  if (dateFrom) params.set("date_from", dateFrom);
  if (dateTo) params.set("date_to", dateTo);

  const qs = params.toString();
  const path = `/accounts/${encodeURIComponent(accountId)}/transactions/${qs ? `?${qs}` : ""}`;

  return fetchWithAuth(path, { method: "GET" });
}

async function getInstitution(institutionId) {
  if (!institutionId) {
    throw new HttpError("'institutionId' is required", 400);
  }
  return fetchWithAuth(`/institutions/${encodeURIComponent(institutionId)}/`, {
    method: "GET",
  });
}

// Alias functions for consistency
const getAccounts = getAccountDetails;
const getBalances = getAccountBalances;
const getTransactions = getAccountTransactions;

module.exports = {
  HttpError,
  getAccountDetails,
  getAccountBalances,
  getAccountTransactions,
  getInstitution,
  getAccounts,
  getBalances,
  getTransactions,
};
