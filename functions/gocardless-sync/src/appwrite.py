import os
from typing import List, Optional

import requests
from appwrite.client import Client
from appwrite.services.databases import Databases
from appwrite.query import Query
from appwrite.exception import AppwriteException


def create_databases_client(api_key: Optional[str] = None) -> Databases:
    client = Client()
    client.set_endpoint(os.environ["APPWRITE_FUNCTION_API_ENDPOINT"])  # includes /v1
    client.set_project(os.environ["APPWRITE_FUNCTION_PROJECT_ID"])
    client.set_key(api_key)
    return Databases(client)


def _base_url() -> str:
    # Provided by Appwrite runtime, typically already ends with /v1
    return os.environ["APPWRITE_FUNCTION_API_ENDPOINT"].rstrip("/")


def _auth_headers(api_key: Optional[str] = None) -> dict:
    key = api_key or os.environ.get("APPWRITE_API_KEY")
    headers = {
        "X-Appwrite-Project": os.environ["APPWRITE_FUNCTION_PROJECT_ID"],
    }
    if key:
        headers["X-Appwrite-Key"] = key
    return headers


def _list_documents_http(
    database_id: str,
    collection_id: str,
    queries: Optional[List[str]] = None,
    api_key: Optional[str] = None,
):
    """Use raw HTTP to avoid SDK GET-with-body issue."""
    url = f"{_base_url()}/databases/{database_id}/collections/{collection_id}/documents"
    params = {}
    if queries:
        params["queries[]"] = queries
    response = requests.get(url, headers=_auth_headers(api_key), params=params, timeout=30)
    response.raise_for_status()
    return response.json()


def _get_document_http(
    database_id: str,
    collection_id: str,
    document_id: str,
    api_key: Optional[str] = None,
):
    url = (
        f"{_base_url()}/databases/{database_id}/collections/{collection_id}/documents/{document_id}"
    )
    response = requests.get(url, headers=_auth_headers(api_key), timeout=30)
    if response.status_code == 404:
        raise AppwriteException("Document not found")
    response.raise_for_status()
    return response.json()


def get_active_accounts(databases: Databases, database_id: str, collection_id: str):
    print(f"Getting active accounts from {database_id}/{collection_id}")
    response = _list_documents_http(
        database_id,
        collection_id,
        queries=[
            Query.equal("status", "active"),
            Query.limit(50),
        ],
    )
    documents = response.get("documents", [])
    print(f"Found {len(documents)} active accounts")
    return documents if documents else []
    

def get_last_booking_date(
    databases: Databases,
    database_id: str,
    collection_id: str,
    user_id: str,
    account_id: str,
):
    try:
        response = _list_documents_http(
            database_id,
            collection_id,
            queries=[
                Query.equal("userId", user_id),
                Query.equal("accountId", account_id),
                Query.order_desc("bookingDate"),
                Query.limit(1),
            ],
        )
        documents = response.get("documents", [])
        if documents:
            doc = documents[0]
            return doc["bookingDate"] or doc["valueDate"]
        return None
    except AppwriteException:
        return None


def document_exists(
    databases: Databases, database_id: str, collection_id: str, document_id: str
) -> bool:
    try:
        _get_document_http(database_id, collection_id, document_id)
        return True
    except AppwriteException:
        return False


def fetch_previous_categories(
    databases: Databases,
    database_id: str,
    collection_id: str,
    user_id: str,
) -> list[str]:
    try:
        response = _list_documents_http(
            database_id,
            collection_id,
            queries=[
                Query.equal("userId", user_id),
                Query.limit(100),
            ],
        )
        documents = response.get("documents", [])
        if len(documents) > 1:
            return [doc["category"] for doc in documents if doc["category"]]
        return []
    except AppwriteException:
        return []


