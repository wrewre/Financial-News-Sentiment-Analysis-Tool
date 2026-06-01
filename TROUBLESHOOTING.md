# Troubleshooting Guide

## "Failed to fetch" Error

This error occurs when the frontend cannot connect to the backend server. Here's how to fix it:

### Solution

The application requires **TWO separate processes** running simultaneously:

1. **Backend Server** (Port 3001) - Handles article fetching and sentiment analysis
2. **Frontend** (Port 5173) - The web interface

### Step-by-Step Fix

#### Terminal 1: Start Backend
```bash
cd server
npm start
```

You should see:
```
🚀 Sentiment Analysis API running on http://localhost:3001
```

#### Terminal 2: Start Frontend
```bash
npm run dev
```

You should see:
```
VITE ready in XXX ms
Local: http://localhost:5173/
```

### Verify Backend is Running

Test the backend health endpoint:
```bash
curl http://localhost:3001/api/health
```

Expected response:
```json
{"status":"ok"}
```

### Common Issues

1. **Port 3001 already in use**
   ```bash
   # Find and kill the process using port 3001
   lsof -ti:3001 | xargs kill -9
   ```

2. **Backend not starting**
   - Make sure you installed backend dependencies: `cd server && npm install`
   - Check for error messages in the backend terminal

3. **CORS errors**
   - Ensure backend started successfully before opening the frontend
   - Check browser console for specific error messages

4. **Article not loading**
   - Some websites may block scraping
   - Try different financial news URLs
   - Check backend logs for detailed error messages

## Testing the Economic Times URL

The Economic Times URL you provided should work. Make sure:

1. Backend is running on port 3001
2. You see the backend startup message
3. The URL is pasted correctly: `https://economictimes.indiatimes.com/news/international/world-news/china-and-us-agree-to-fresh-trade-talks/articleshow/124654290.cms`

## Logs to Check

### Backend Terminal
Look for these messages:
- `🚀 Sentiment Analysis API running on http://localhost:3001` - Server started
- `Fetching URL: ...` - Article fetch started
- `Successfully fetched article, size: ...` - Article downloaded
- `Extracted text length: ...` - Text extracted
- `Found paragraphs: ...` - Paragraphs identified

### Browser Console
Open Developer Tools (F12) and check for:
- Network errors (red requests)
- CORS errors
- Failed fetch to `http://localhost:3001/api/analyze`

## Quick Start Script

Use the provided startup script:
```bash
./start-backend.sh
```

This automatically navigates to the server directory and starts the backend.
