# Quickstart Guide: Jet Local Optimizer

## Prerequisites
- Node.js & NPM installed
- Internet connection (for API calls)

## Setup
1. Clone repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start development server:
   ```bash
   npm run dev
   ```

## How to Test
1. Open http://localhost:3000/jet-local-optimizer
2. Enter a real business URL (e.g. `https://www.atlantaplumbing.com`)
3. Click "INITIATE SCAN"
4. Watch the progress as it connects to Google servers and parses the site.

## Troubleshooting
- **Scan fails?** Check your internet connection. Some sites block AWS/Cloud IPs which proxies often use.
- **Low score?** The tool is strict! It simulates Google's actual ranking criteria.
