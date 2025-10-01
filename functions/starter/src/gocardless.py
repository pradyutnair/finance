"""GoCardless API client helpers."""

import time

import requests

GOCARDLESS_BASE_URL = "https://bankaccountdata.gocardless.com/api/v2"
DEFAULT_TIMEOUT = 20
MAX_RETRIES = 3


class GoCardlessClient:
    def __init__(self, secret_id, secret_key):
        self.secret_id = secret_id
        self.secret_key = secret_key
        self._access_token = None
        self._token_expires_at = 0

    def _get_access_token(self):
        if self._access_token and time.time() < (self._token_expires_at - 30):
            print(f"✅ Using cached access token")
            return self._access_token

        print(f"🔍 Requesting new GoCardless access token...")
        url = f"{GOCARDLESS_BASE_URL}/token/new/"
        payload = {"secret_id": self.secret_id, "secret_key": self.secret_key}

        try:
            response = requests.post(url, json=payload, timeout=DEFAULT_TIMEOUT)
            response.raise_for_status()
            print(f"✅ Successfully obtained GoCardless access token")
        except Exception as e:
            print(f"❌ Error getting GoCardless access token: {e}")
            print(f"❌ Error type: {type(e).__name__}")
            raise

        token_data = response.json()
        self._access_token = token_data["access"]
        self._token_expires_at = time.time() + token_data["access_expires"]
        return self._access_token

    def _request(self, path, params=None):
        print(f"🔍 Making GoCardless request to: {path}")
        print(f"🔍 Request params: {params}")
        token = self._get_access_token()
        headers = {"Authorization": f"Bearer {token}"}
        url = f"{GOCARDLESS_BASE_URL}{path}"

        for attempt in range(MAX_RETRIES):
            try:
                print(f"🔍 Attempt {attempt + 1}/{MAX_RETRIES} - GET request to {url}")
                response = requests.get(
                    url, headers=headers, params=params, timeout=DEFAULT_TIMEOUT
                )
                print(f"✅ GoCardless API response received: {response.status_code}")
                response.raise_for_status()
                return response.json()
            except Exception as e:
                print(f"❌ GoCardless API request failed (attempt {attempt + 1}): {e}")
                print(f"❌ Error type: {type(e).__name__}")
                if attempt == MAX_RETRIES - 1:
                    print(f"❌ Max retries reached, raising error")
                    raise
                print(f"⏳ Waiting before retry...")
                time.sleep(1)

    def get_transactions(self, account_id, date_from=None):
        print(f"🔍 Getting transactions for account {account_id}")
        params = {"date_from": date_from} if date_from else None
        return self._request(f"/accounts/{account_id}/transactions/", params)

    def get_balances(self, account_id):
        print(f"🔍 Getting balances for account {account_id}")
        return self._request(f"/accounts/{account_id}/balances/")


