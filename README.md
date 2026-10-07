# Contact Driver Analytics

AI-powered contact center analytics application built on Snowflake Cortex, providing real-time call driver analysis, sentiment tracking, and automated insight generation.

## Features

| Capability | Description |
|---|---|
| **Trend Analysis** | 13-week rolling view of call volume, sentiment, escalation rates, and average duration |
| **Contact Driver Breakdown** | Top drivers segmented by line of business, product, customer segment, and caller type |
| **AI-Generated Insights** | One-click executive summaries, key findings, and recommendations via Cortex COMPLETE |
| **Sentiment Scoring** | Per-call and aggregate sentiment analysis via Cortex SENTIMENT |
| **Transcript Explorer** | Full call transcript viewer with AI summaries via Cortex SUMMARIZE |
| **Call Classification** | Automatic call categorization and escalation detection via Cortex CLASSIFY_TEXT |
| **Interactive Filters** | Filter all views by line of business and customer segment |
| **Mock Data Mode** | Runs immediately with built-in realistic data — no Snowflake connection required |

## Quick Start (Mock Data)

The application runs out of the box with built-in mock data. No Snowflake account needed.

```bash
git clone https://github.com/sfc-gh-ooral/sfguide-contact-driver-analytics.git
cd sfguide-contact-driver-analytics
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The dashboard loads with 13 weeks of simulated call data, 10 realistic transcript templates, and full AI insight generation.

## Deploy with Live Data

### Step 1: Create Database Objects

Open a **Snowsight SQL Worksheet** and paste the contents of [`sql/setup.sql`](sql/setup.sql). Execute all statements. This creates:

- Database `CONTACT_ANALYTICS` with schema `ANALYTICS`
- Warehouse `CORTEX_WH` (Medium, auto-suspend 60s)
- Required grants

### Step 2: Load Your Data

Create the `CALL_TRANSCRIPTS` table with your call data. See [Connecting Your Own Data](#connecting-your-own-data) for the expected schema.

### Step 3: Set Up Authentication (Key-Pair Recommended)

Generate an RSA key pair:

```bash
openssl genrsa 2048 | openssl pkcs8 -topk8 -inform PEM -out rsa_key.p8 -nocrypt
openssl rsa -in rsa_key.p8 -pubout -out rsa_key.pub
```

Set the public key on your Snowflake user (run in Snowsight):

```sql
ALTER USER <your_user> SET RSA_PUBLIC_KEY='<paste contents of rsa_key.pub>';
```

### Step 4: Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local` with your Snowflake account details:

```env
SNOWFLAKE_ACCOUNT=xy12345.us-east-1
SNOWFLAKE_USER=your_username
SNOWFLAKE_PRIVATE_KEY_PATH=./rsa_key.p8
SNOWFLAKE_WAREHOUSE=CORTEX_WH
SNOWFLAKE_DATABASE=CONTACT_ANALYTICS
SNOWFLAKE_SCHEMA=ANALYTICS
SNOWFLAKE_ROLE=SYSADMIN
```

### Step 5: Run

```bash
npm run dev
```

The application auto-detects your Snowflake connection. If any connection issue occurs, it gracefully falls back to mock data.

## Connecting Your Own Data

The application queries a `CALL_TRANSCRIPTS` table. Match this schema:

| Column | Type | Description |
|---|---|---|
| `CALL_ID` | VARCHAR | Unique call identifier |
| `CALL_DATE` | TIMESTAMP | When the call occurred |
| `LINE_OF_BUSINESS` | VARCHAR | Business unit (e.g., "Retirement Services") |
| `PRODUCT_CATEGORY` | VARCHAR | Product area (e.g., "IRA/401k") |
| `CUSTOMER_SEGMENT` | VARCHAR | Customer tier (e.g., "High Net Worth") |
| `CALLER_TYPE` | VARCHAR | Who called (e.g., "Advisor", "Client") |
| `CALL_DURATION_SEC` | NUMBER | Duration in seconds |
| `DISPOSITION` | VARCHAR | Call outcome (e.g., "Resolved", "Escalated") |
| `SENTIMENT_SCORE` | FLOAT | Sentiment value from -1.0 to 1.0 |
| `AI_SUMMARY` | VARCHAR | Cortex SUMMARIZE output |
| `TRANSCRIPT` | VARCHAR | Full call transcript text |
| `CONTACT_REASON` | VARCHAR | Primary reason for the call |

The application also queries two views:

- **`V_TREND_SUMMARY`** — Weekly aggregates (call volume, sentiment, escalations, duration)
- **`V_CALL_DRIVER_ANALYSIS`** — Driver breakdown by LOB, product, segment, and caller type

## Architecture

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | Next.js + React + shadcn/ui | Dashboard UI, charts, transcript viewer |
| **Charts** | Recharts | Trend lines, pie charts, data visualization |
| **API** | Next.js API Routes | Data fetching with automatic mock fallback |
| **AI/ML** | Snowflake Cortex AI | COMPLETE, SENTIMENT, SUMMARIZE, CLASSIFY_TEXT, EXTRACT_ANSWER, EMBED_TEXT_768 |
| **Compute** | Snowflake Warehouse | Query execution and Cortex function processing |
| **Storage** | Snowflake Tables/Views | Call transcripts, trend summaries, driver analysis |

## API Routes

| Route | Method | Description |
|---|---|---|
| `/api/trends` | GET | Weekly trend data (last 13 weeks) |
| `/api/segments` | GET | Available filter options (LOBs, segments) |
| `/api/drivers` | GET | Contact driver analysis with optional LOB/segment filters |
| `/api/transcripts` | GET | Call transcripts with filters (LOB, segment, week, escalated) |
| `/api/insights` | POST | AI-generated insights with timeframe parameter |

All routes return mock data when Snowflake is not configured.

## Project Structure

```
sfguide-contact-driver-analytics/
├── app/
│   ├── layout.tsx              # Root layout with Geist fonts
│   ├── page.tsx                # Main dashboard (tabs, charts, KPIs)
│   ├── globals.css             # Theme and color system
│   └── api/
│       ├── trends/route.ts     # Weekly trend aggregates
│       ├── segments/route.ts   # Filter dropdown options
│       ├── drivers/route.ts    # Contact driver breakdown
│       ├── transcripts/route.ts # Full call transcripts
│       └── insights/route.ts   # AI insight generation
├── components/
│   ├── transcript-modal.tsx    # Full-screen transcript viewer
│   └── ui/                     # shadcn/ui + custom components
│       └── cortex-badge.tsx    # Interactive Cortex AI badges
├── lib/
│   ├── snowflake.ts            # Connection, queries, mock data
│   └── utils.ts                # Tailwind utilities
├── sql/
│   └── setup.sql               # Database/schema/warehouse setup
├── docs/                       # GitHub Pages landing page
├── .env.example                # Environment variable template
├── LICENSE                     # Apache 2.0
├── LEGAL.md                    # Snowflake disclaimer
└── package.json
```

## Tech Stack

- **Next.js 16** with App Router and React 19
- **TypeScript 5**
- **shadcn/ui** component library (New York style)
- **Tailwind CSS v4**
- **Recharts** for data visualization
- **Snowflake SDK** (Node.js) for database connectivity
- **Snowflake Cortex AI** (Llama 3.1 70B, Claude 3.5 Sonnet)

## Live Guide

View the interactive project guide at: https://sfc-gh-ooral.github.io/sfguide-contact-driver-analytics/

## Legal

This project is open source under the [Apache 2.0 License](LICENSE). See [LEGAL.md](LEGAL.md) for the full Snowflake disclaimer.

This application is not affiliated with or endorsed by any specific financial services company.
