// Plaid client to replace GoCardless Bank Account Data API
// Docs: https://plaid.com/docs/api/

import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from 'plaid';

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

// Plaid client configuration
let plaidClient: PlaidApi | null = null;

function assertEnvVars(): void {
  const missing: string[] = [];
  if (!process.env.PLAID_CLIENT_ID) missing.push("PLAID_CLIENT_ID");
  if (!process.env.PLAID_SANDBOX_API_KEY) missing.push("PLAID_SANDBOX_API_KEY");
  if (!process.env.PLAID_SANDBOX_SECRET) missing.push("PLAID_SANDBOX_SECRET");

  if (missing.length > 0) {
    throw new Error(
      `Missing required env var(s): ${missing.join(", ")}. Please set them before using Plaid client.`
    );
  }
}

function getPlaidClient(): PlaidApi {
  if (!plaidClient) {
    assertEnvVars();

    const configuration = new Configuration({
      basePath: PlaidEnvironments.sandbox,
      baseOptions: {
        headers: {
          'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
          'PLAID-SECRET': process.env.PLAID_SANDBOX_SECRET,
        },
      },
    });

    plaidClient = new PlaidApi(configuration);
  }
  return plaidClient;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(fn: () => Promise<T>, attempt = 1): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    const status = err?.response?.status as number | undefined;
    const isNetworkError = err?.code === 'ECONNRESET' || err?.code === 'ETIMEDOUT';
    const isRetriableStatus = status === 429 || (status !== undefined && status >= 500 && status <= 599);
    const shouldRetry = attempt < MAX_RETRIES && (isNetworkError || isRetriableStatus);

    if (!shouldRetry) throw err;

    // Exponential backoff with jitter
    const base = 300 * Math.pow(2, attempt - 1); // 300ms, 600ms, 1200ms, ...
    const jitter = Math.floor(Math.random() * 200);
    const delayMs = base + jitter;

    await sleep(delayMs);
    return withRetry(fn, attempt + 1);
  }
}

// Convert Plaid errors to our HttpError format
function handlePlaidError(err: any): never {
  if (err?.response?.data) {
    const { error_code, error_message, error_type } = err.response.data;
    throw new HttpError(
      error_message || `Plaid API error: ${error_code}`,
      err.response.status,
      { error_code, error_type, details: err.response.data }
    );
  }
  throw new HttpError(
    err?.message || 'Unknown Plaid API error',
    err?.response?.status || 500,
    err
  );
}

// Public API functions to replace GoCardless equivalents

export async function listInstitutions(countryCode: string): Promise<any> {
  if (!countryCode || typeof countryCode !== "string" || countryCode.length !== 2) {
    throw new HttpError("Query param 'country' must be a 2-letter ISO code", 400);
  }

  const cc = countryCode.toUpperCase();
  const client = getPlaidClient();

  return withRetry(async () => {
    try {
      const response = await client.institutionsGet({
        country_codes: [cc as CountryCode],
        count: 500,
        offset: 0,
      });
      return response.data;
    } catch (err) {
      handlePlaidError(err);
    }
  });
}

export async function getInstitution(institutionId: string): Promise<any> {
  if (!institutionId) {
    throw new HttpError("'institutionId' is required", 400);
  }

  const client = getPlaidClient();

  return withRetry(async () => {
    try {
      const response = await client.institutionsGetById({
        institution_id: institutionId,
        country_codes: ['US', 'GB', 'DE', 'FR', 'ES', 'IE', 'NL', 'SE', 'NO', 'DK', 'FI'],
      });
      return response.data;
    } catch (err) {
      handlePlaidError(err);
    }
  });
}

export async function createLinkToken({
  user,
  clientName,
  countryCodes = ['US'],
  language = 'en',
  webhook = '',
  products = [Products.Transactions, Products.Auth],
}: {
  user: { client_user_id: string; email?: string };
  clientName: string;
  countryCodes?: string[];
  language?: string;
  webhook?: string;
  products?: string[];
}): Promise<any> {
  if (!user?.client_user_id) {
    throw new HttpError("'user.client_user_id' is required", 400);
  }
  if (!clientName) {
    throw new HttpError("'clientName' is required", 400);
  }

  const client = getPlaidClient();

  return withRetry(async () => {
    try {
      const response = await client.linkTokenCreate({
        user: {
          client_user_id: user.client_user_id,
        },
        client_name: clientName,
        products: products as Products[],
        country_codes: countryCodes as CountryCode[],
        language,
        webhook,
      });
      return response.data;
    } catch (err) {
      handlePlaidError(err);
    }
  });
}

export async function exchangePublicToken(publicToken: string): Promise<any> {
  if (!publicToken) {
    throw new HttpError("'publicToken' is required", 400);
  }

  const client = getPlaidClient();

  return withRetry(async () => {
    try {
      const response = await client.itemPublicTokenExchange({
        public_token: publicToken,
      });
      return response.data;
    } catch (err) {
      handlePlaidError(err);
    }
  });
}

export async function getAccounts(accessToken: string): Promise<any> {
  if (!accessToken) {
    throw new HttpError("'accessToken' is required", 400);
  }

  const client = getPlaidClient();

  return withRetry(async () => {
    try {
      const response = await client.accountsGet({
        access_token: accessToken,
      });
      return response.data;
    } catch (err) {
      handlePlaidError(err);
    }
  });
}

export async function getBalances(accessToken: string): Promise<any> {
  if (!accessToken) {
    throw new HttpError("'accessToken' is required", 400);
  }

  const client = getPlaidClient();

  return withRetry(async () => {
    try {
      const response = await client.accountsBalanceGet({
        access_token: accessToken,
      });
      return response.data;
    } catch (err) {
      handlePlaidError(err);
    }
  });
}

export async function getTransactions(
  accessToken: string,
  { startDate, endDate, count = 100, offset = 0 }: {
    startDate?: string;
    endDate?: string;
    count?: number;
    offset?: number;
  } = {}
): Promise<any> {
  if (!accessToken) {
    throw new HttpError("'accessToken' is required", 400);
  }

  const client = getPlaidClient();

  return withRetry(async () => {
    try {
      const response = await client.transactionsGet({
        access_token: accessToken,
        start_date: startDate || new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
        end_date: endDate || new Date().toISOString().split('T')[0],
      });
      return response.data;
    } catch (err) {
      handlePlaidError(err);
    }
  });
}

export async function getItem(accessToken: string): Promise<any> {
  if (!accessToken) {
    throw new HttpError("'accessToken' is required", 400);
  }

  const client = getPlaidClient();

  return withRetry(async () => {
    try {
      const response = await client.itemGet({
        access_token: accessToken,
      });
      return response.data;
    } catch (err) {
      handlePlaidError(err);
    }
  });
}

export function generateReference(): string {
  // 16-char URL-safe reference (same as GoCardless)
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
}

// Compatibility aliases for existing code
export const createEndUserAgreement = createLinkToken;
export const createRequisition = createLinkToken;
export const getRequisition = getItem;
export const getAccountDetails = getAccounts;
export const getAccountBalances = getBalances;
export const getAccountTransactions = getTransactions;
export const listRequisitions = () => Promise.resolve({ results: [] }); // No equivalent in Plaid