#!/bin/bash
# Setup script for Appwrite function with bundled libmongocrypt

set -e

echo "📦 Setting up MongoDB encryption..."

# Check if bundled libmongocrypt.so exists
if [ -f "src/libmongocrypt.so" ]; then
    echo "✅ Found bundled libmongocrypt.so"
    
    # Make it executable
    chmod +x src/libmongocrypt.so
    
    # Set environment variable for pymongocrypt to find the library
    export PYMONGOCRYPT_LIB="$(pwd)/src/libmongocrypt.so"
    echo "✅ Set PYMONGOCRYPT_LIB=$PYMONGOCRYPT_LIB"
    
    # Also set it in the environment for the Python process
    echo "export PYMONGOCRYPT_LIB=\"$(pwd)/src/libmongocrypt.so\"" >> ~/.bashrc
    
else
    echo "❌ No bundled libmongocrypt.so found"
    echo "⚠️ Encryption may not work properly"
fi

# Install Python dependencies
echo "📦 Installing Python dependencies..."
pip install --no-cache-dir -r requirements.txt

echo "✅ Setup completed successfully"

