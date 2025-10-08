"""Helpers to fetch user IDs from Appwrite."""

import os
from appwrite.client import Client
from appwrite.services.databases import Databases
from appwrite.query import Query


def _get_client(api_key: str) -> Client:
    endpoint = os.environ.get("APPWRITE_FUNCTION_API_ENDPOINT")
    project_id = os.environ.get("APPWRITE_FUNCTION_PROJECT_ID")
    if not endpoint or not project_id:
        raise ValueError("Missing APPWRITE_FUNCTION_API_ENDPOINT or APPWRITE_FUNCTION_PROJECT_ID")
    client = Client().set_endpoint(endpoint).set_project(project_id).set_key(api_key)
    return client


def list_user_ids(context) -> list[str]:
    """List userIds from users_private (or users_dev if configured)."""
    api_key = context.req.headers.get('x-appwrite-key') or os.environ.get('APPWRITE_API_KEY')
    if not api_key:
        raise ValueError("Missing Appwrite API key: x-appwrite-key header or APPWRITE_API_KEY env var")

    client = _get_client(api_key)
    databases = Databases(client)

    # Read from configured DB and collection names
    database_id = os.environ.get("APPWRITE_DATABASE_ID") or os.environ.get("APPWRITE_DB_ID") or "68d42ac20031b27284c9"
    users_collection = os.environ.get("APPWRITE_USERS_COLLECTION_ID") or "users_private"

    # Fetch up to 1000 users
    queries = [Query.limit(1000)]
    res = databases.list_documents(database_id=database_id, collection_id=users_collection, queries=queries)
    docs = res.get("documents", []) if isinstance(res, dict) else []
    return [d.get("userId") for d in docs if d.get("userId")]


