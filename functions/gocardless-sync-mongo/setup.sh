#!/bin/bash
# Setup script to install libmongocrypt before Python dependencies

set -e

echo "📦 Installing libmongocrypt..."

# Update package list
apt-get update

# Install required tools
apt-get install -y curl gpg

# Add MongoDB's public key
curl -s --location https://pgp.mongodb.com/libmongocrypt.asc | gpg --dearmor > /etc/apt/trusted.gpg.d/libmongocrypt.gpg

# Add MongoDB repository (using debian bookworm for Python 3.12 runtime)
echo "deb https://libmongocrypt.s3.amazonaws.com/apt/debian bookworm/libmongocrypt/1.16 main" | tee /etc/apt/sources.list.d/libmongocrypt.list

# Update package list again
apt-get update

# Install libmongocrypt
apt-get install -y libmongocrypt-dev

# Clean up
apt-get clean
rm -rf /var/lib/apt/lists/*

echo "✅ libmongocrypt installed successfully"

# Install Python dependencies
echo "📦 Installing Python dependencies..."
pip install --no-cache-dir -r requirements.txt

echo "✅ All dependencies installed successfully"

