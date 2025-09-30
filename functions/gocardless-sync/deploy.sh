#!/bin/bash

# GoCardless Sync Function Deployment Script
# This script helps deploy the Appwrite Function to your project

set -e

echo "🚀 Deploying GoCardless Sync Function..."

# Check if Appwrite CLI is installed
if ! command -v appwrite &> /dev/null; then
    echo "❌ Appwrite CLI is not installed. Please install it first:"
    echo "   npm install -g @appwrite/cli"
    exit 1
fi

# Check if we're in the function directory
if [ ! -f "appwrite.json" ]; then
    echo "❌ Please run this script from the gocardless-sync function directory"
    exit 1
fi

# Check if required environment variables are set
REQUIRED_VARS=(
    "APPWRITE_FUNCTION_API_ENDPOINT"
    "APPWRITE_FUNCTION_PROJECT_ID"
    "APPWRITE_DATABASE_ID"
    "APPWRITE_API_KEY"
    "GOCARDLESS_SECRET_ID"
    "GOCARDLESS_SECRET_KEY"
)

echo "🔍 Checking environment variables..."
MISSING_VARS=()
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        MISSING_VARS+=("$var")
    fi
done

if [ ${#MISSING_VARS[@]} -ne 0 ]; then
    echo "❌ Missing required environment variables:"
    printf '   %s\n' "${MISSING_VARS[@]}"
    echo ""
    echo "Please set these variables before deploying:"
    echo "   export APPWRITE_FUNCTION_API_ENDPOINT='your-appwrite-endpoint'"
    echo "   export APPWRITE_FUNCTION_PROJECT_ID='your-project-id'"
    echo "   export APPWRITE_DATABASE_ID='your-database-id'"
    echo "   export APPWRITE_API_KEY='your-appwrite-api-key'"
    echo "   export GOCARDLESS_SECRET_ID='your-gocardless-id'"
    echo "   export GOCARDLESS_SECRET_KEY='your-gocardless-key'"
    exit 1
fi

echo "✅ All required environment variables are set"

# Install dependencies
echo "📦 Installing dependencies..."
pip install -r requirements.txt

# Deploy the function
echo "🔄 Deploying function to Appwrite..."
   appwrite functions create \
    --function-id "gocardless-sync" \
    --name "GoCardless Transaction Sync" \
    --runtime "python-3.11" \
    --entrypoint "src/main.py"

# Deploy the code
echo "📤 Deploying function code..."
appwrite functions deploy "gocardless-sync"

echo ""
echo "🎉 Function deployed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Go to your Appwrite Console"
echo "2. Navigate to Functions → gocardless-sync"
echo "3. Configure the environment variables in the function settings (APPWRITE_FUNCTION_API_ENDPOINT and APPWRITE_FUNCTION_PROJECT_ID are auto-provided)"
echo "4. Set up the cron schedule: 0 8,14,20,23 * * *"
echo "5. Enable the function"
echo ""
echo "🔗 Function URL will be available in the Appwrite Console"
echo "📊 Monitor executions in Functions → Executions"

echo ""
echo "✅ Deployment completed!"
