from appwrite.client import Client
from appwrite.services.users import Users
from appwrite.services.databases import Databases
from appwrite.query import Query
from appwrite.exception import AppwriteException
import os

def get_active_accounts(databases: Databases, database_id: str, collection_id: str):
    print(f"Getting active accounts from {database_id}/{collection_id}")
    queries = [
        Query.equal("status", "active"),
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

# This Appwrite function will be executed every time your function is triggered
def main(context):
    # You can use the Appwrite SDK to interact with other services
    # For this example, we're using the Users service
    client = (
        Client()
        .set_endpoint(os.environ["APPWRITE_FUNCTION_API_ENDPOINT"])
        .set_project(os.environ["APPWRITE_FUNCTION_PROJECT_ID"])
        .set_key(context.req.headers["x-appwrite-key"])
    )

    databases = Databases(client)
    try:
        documents = get_active_accounts(databases, "68d42ac20031b27284c9", "bank_accounts")
        # Log messages and errors to the Appwrite Console
        # These logs won't be seen by your end users
        context.log("Documents: " + str(documents["documents"]))
        context.log("Total users: " + str(documents["total"]))
        context.log("Total documents: " + str(len(documents["documents"])))
    except AppwriteException as err:
        context.error("Could not list users: " + repr(err))

    # The req object contains the request data
    if context.req.path == "/ping":
        # Use res object to respond with text(), json(), or binary()
        # Don't forget to return a response!
        return context.res.text("Pong")

    return context.res.json(
        {
            "motto": "Build like a team of hundreds_",
            "learn": "https://appwrite.io/docs",
            "connect": "https://appwrite.io/discord",
            "getInspired": "https://builtwith.appwrite.io",
        }
    )
