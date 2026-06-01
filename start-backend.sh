#!/bin/bash
cd "$(dirname "$0")/server"
echo "Starting Financial News Sentiment Analyzer Backend..."
echo "Backend will run on http://localhost:3001"
echo ""
npm start
