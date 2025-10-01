import os

from appwrite.client import Client
from appwrite.services.databases import Databases
from appwrite.query import Query
from appwrite.exception import AppwriteException


def create_databases_client(api_key: str) -> Databases:
    client = Client()
    client.set_endpoint(os.environ["APPWRITE_FUNCTION_API_ENDPOINT"])
    client.set_project(os.environ["APPWRITE_FUNCTION_PROJECT_ID"])
    client.set_key(api_key)
    return Databases(client)


def get_active_accounts(databases: Databases, database_id: str, collection_id: str):
    print(f"Getting active accounts from {database_id}/{collection_id}")
    queries = [
        Query.equal("status", ["active"]),
        Query.limit(50),
    ]
    response = databases.list_documents(
        database_id=database_id,
        collection_id=collection_id,
        queries=queries
    )
    documents = response["documents"]
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
        queries = [
            Query.equal("userId", [user_id]),
            Query.equal("accountId", [account_id]),
            Query.order_desc("bookingDate"),
            Query.limit(1),
        ]
        response = databases.list_documents(
            database_id=database_id,
            collection_id=collection_id,
            queries=queries
        )
        documents = response["documents"]
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
        databases.get_document(database_id, collection_id, document_id)
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
        queries = [
            Query.equal("userId", [user_id]),
            Query.limit(100),
        ]
        response = databases.list_documents(
            database_id=database_id,
            collection_id=collection_id,
            queries=queries
        )
        documents = response["documents"]
        if len(documents) > 1:
            return [doc["category"] for doc in documents if doc["category"]]
        return []
    except AppwriteException:
        return []


