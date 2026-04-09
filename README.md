# Parse Analyzer

AI-powered WarcraftLogs comparison tool. Compare your casts against another player and ask Claude what to improve.

## Setup

### 1. Install Node.js
If you don't have it: https://nodejs.org (download the LTS version)

### 2. Install dependencies
Open a terminal in this folder and run:
```
npm install
```

### 3. Add your API keys
Edit `.env.local` and fill in:

**WCL_TOKEN** — your WarcraftLogs access token
- Open your old `parse-analyzer-ai.html` file in a browser
- Press F12 to open DevTools → Console tab
- Type: `localStorage.getItem('wcl_token')`
- Copy the result and paste it in

**ANTHROPIC_API_KEY** — your Anthropic API key
- Get one free at https://console.anthropic.com
- New accounts get $5 free credit

### 4. Run the app
```
npm run dev
```

Open http://localhost:3000 in your browser.

## Usage

1. Go to WarcraftLogs and find a compare URL (two players, same boss)
   - Example: `https://www.warcraftlogs.com/reports/compare/REPORT1/REPORT2?fight=X%2CY&source=NAME1%2CNAME2`
2. Paste the URL into the app
3. Click **Load & Analyze**
4. Claude automatically analyzes what the other player is doing better
5. Use the preset question buttons or type your own questions

## Keeping your token fresh
WCL tokens expire. If you get auth errors, re-run the PKCE flow in `parse-analyzer-ai.html` and update `WCL_TOKEN` in `.env.local`, then restart with `npm run dev`.
