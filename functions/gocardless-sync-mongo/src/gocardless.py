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
            return self._access_token
        
        url = f"{GOCARDLESS_BASE_URL}/token/new/"
        payload = {"secret_id": self.secret_id, "secret_key": self.secret_key}
        try:
            response = requests.post(url, json=payload, timeout=DEFAULT_TIMEOUT)
            response.raise_for_status()
            
        except Exception as e:
            raise e

        token_data = response.json()
        self._access_token = token_data["access"]
        self._token_expires_at = time.time() + token_data["access_expires"]
        return self._access_token

    def _request(self, path, params=None):
        
        token = self._get_access_token()
        headers = {"Authorization": f"Bearer {token}"}
        url = f"{GOCARDLESS_BASE_URL}{path}"

        for attempt in range(MAX_RETRIES):
            try:
                response = requests.get(
                    url, headers=headers, params=params, timeout=DEFAULT_TIMEOUT
                )
                response.raise_for_status()
                return response.json()
            except Exception as e:
                if attempt == MAX_RETRIES - 1:
                    raise e
                time.sleep(1)

    def get_transactions(self, account_id, date_from=None):
        params = {"date_from": date_from} if date_from else None
        return self._request(f"/accounts/{account_id}/transactions/", params)

    def get_balances(self, account_id):
        return self._request(f"/accounts/{account_id}/balances/")



