/**
 * GoCardless API Client
 */

const BASE_URL = 'https://bankaccountdata.gocardless.com/api/v2';
const DEFAULT_TIMEOUT_MS = 20000;
const MAX_RETRIES = 3;

let accessToken = null;
let tokenExpiresAt = 0;

async function getAccessToken() {
  // Return cached token if still valid (with 30s buffer)
  if (accessToken && Date.now() / 1000 < (tokenExpiresAt - 30)) {
    return accessToken;
  }

  const url = `${BASE_URL}/token/new/`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      secret_id: process.env.GOCARDLESS_SECRET_ID,
      secret_key: process.env.GOCARDLESS_SECRET_KEY,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to get GoCardless token: ${response.status}`);
  }

  const data = await response.json();
  accessToken = data.access;
  tokenExpiresAt = Math.floor(Date.now() / 1000) + data.access_expires;

  return accessToken;
}

async function request(path, params) {
  const token = await getAccessToken();
  const url = new URL(`${BASE_URL}${path}`);
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value) url.searchParams.set(key, value);
    });
  }

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      });

      if (!response.ok) {
        throw new Error(`GoCardless API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      if (attempt === MAX_RETRIES - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
}

export async function getTransactions(accountId, dateFrom) {
  const params = {};
  if (dateFrom) params.date_from = dateFrom;
  
  return request(`/accounts/${accountId}/transactions/`, params);
}

export async function getBalances(accountId) {
  return request(`/accounts/${accountId}/balances/`);
}

