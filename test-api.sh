#!/bin/bash

# Test script for GeiminiRevolver API

echo "Testing GeiminiRevolver API..."

# Check if server is running
echo "1. Checking if server is running on port 3000..."
if curl -s http://localhost:3000/health > /dev/null; then
    echo "✓ Server is running"
else
    echo "✗ Server is not running. Start it with: npm run dev"
    exit 1
fi

# Test health endpoint
echo "2. Testing health endpoint..."
curl -s http://localhost:3000/health | jq '.'

# Test models endpoint (should fail without auth)
echo "3. Testing models endpoint without authentication (should fail)..."
curl -s http://localhost:3000/v1/models | jq '.'

# Test models endpoint with authentication
echo "4. Testing models endpoint with authentication..."
API_PASSWORD="change_this_secure_password"
curl -s http://localhost:3000/v1/models \
  -H "Authorization: Bearer $API_PASSWORD" | jq '.'

# Test chat completions endpoint
echo "5. Testing chat completions endpoint..."
curl -s http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer $API_PASSWORD" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-flash-lite-latest",
    "messages": [
      {"role": "user", "content": "Say hello in one word."}
    ]
  }' | jq '.'

echo "6. Checking log files..."
if [ -d "./logs" ]; then
    echo "✓ Log directory exists"
    ls -la ./logs/
else
    echo "✗ Log directory not found"
fi

echo "Test completed!"
