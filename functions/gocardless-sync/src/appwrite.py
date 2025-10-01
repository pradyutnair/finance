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
    response = databases.list_documents(
        database_id,
        collection_id,
        queries=[
            Query.equal("status", "active"),
            Query.limit(50),
        ],
    )
    return response.get("documents", [])


def get_last_booking_date(
    databases: Databases,
    database_id: str,
    collection_id: str,
    user_id: str,
    account_id: str,
):
    try:
        response = databases.list_documents(
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
            return doc.get("bookingDate") or doc.get("valueDate")
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
        response = databases.list_documents(
            database_id,
            collection_id,
            queries=[
                Query.equal("userId", user_id),
                Query.limit(100),
            ],
        )
        documents = response.get("documents", [])
        return [doc.get("category", "") for doc in documents if doc.get("category")]
    except AppwriteException:
        return []


