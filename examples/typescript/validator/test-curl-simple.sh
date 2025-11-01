#!/bin/bash

# Simple test script for Essay Word Count API (no jq dependency)
# Make sure the server is running on port 3001 (or set PORT env var)

BASE_URL="${BASE_URL:-http://localhost:3001}"

echo "🧪 Testing Essay Word Count API at $BASE_URL"
echo ""

# Test 1: Health check
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 1: Health Check (GET /)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
curl -X GET "$BASE_URL/" \
  -H "Content-Type: application/json" \
  -w "\n\nStatus: %{http_code}\n"
echo ""

# Test 2: Word count with a simple essay
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 2: Simple Essay Word Count (POST /word-count)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
curl -X POST "$BASE_URL/word-count" \
  -H "Content-Type: application/json" \
  -d '{
    "essay": "Artificial intelligence is transforming the way we live and work. Machine learning algorithms can now process vast amounts of data to identify patterns and make predictions."
  }' \
  -w "\n\nStatus: %{http_code}\n"
echo ""

# Test 3: Word count with a longer essay
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 3: Longer Essay Word Count (POST /word-count)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
curl -X POST "$BASE_URL/word-count" \
  -H "Content-Type: application/json" \
  -d '{
    "essay": "Climate change is one of the most pressing challenges of our time. The Earth is experiencing unprecedented changes in temperature, weather patterns, and sea levels. These changes are primarily driven by human activities, particularly the burning of fossil fuels and deforestation. Scientists have been warning about the consequences of climate change for decades, and we are now seeing the effects manifest in real-time. From extreme weather events to rising sea levels, the impacts are far-reaching and require immediate action from governments, businesses, and individuals alike."
  }' \
  -w "\n\nStatus: %{http_code}\n"
echo ""

# Test 4: Error case - missing essay
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 4: Error Handling - Missing Essay"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
curl -X POST "$BASE_URL/word-count" \
  -H "Content-Type: application/json" \
  -d '{}' \
  -w "\n\nStatus: %{http_code}\n"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ All tests completed!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
