# stock.ai Web Application — Session Handoff & Architecture Status

> **Session Date**: November 22, 2026  
> **Application Version**: 1.2.1 (Deep Dive & Watchlist Polish)  
> **Current Active Git Branch**: `v1.1` & `master` (Synchronized with remote `origin`)  
> **Repository**: `https://github.com/Escanor1996/stock.ai.git`  

---

## 1. Executive Summary & Session Achievements

In this session (November 22, 2026), we refined the Deep Dive stock page, modernized the AI Score visual language, decluttered redundant components, and aligned the Watchlist table:

1. **Prominent & Eye-Catching AI Score Bar (`src/App.jsx`)**:
   - Upgraded the AI Score presentation into an institutional, high-visibility progress bar capsule (`min-w-[260px] sm:min-w-[320px] lg:min-w-[360px]`, `h-3 sm:h-3.5`).
   - Sits directly beside the ticker badge (`SYMBOL : EXCHANGE`) and latest market CMP (`₹Price`).
   - Dynamic 4-tier color scheme matching Flexoki tokens:
     - **$\ge 80$ (Exceptional)**: Blue/Cyan gradient (`from-blue-600 via-indigo-500 to-cyan-400`, `text-info`, `border-info/30`, `glow-cyan`).
     - **$\ge 65$ (Strong)**: Emerald/Green gradient (`from-emerald-600 via-green-500 to-teal-400`, `text-success`, `border-success/30`, `glow-emerald`).
     - **$\ge 50$ (Moderate)**: Amber/Yellow gradient (`from-amber-600 via-yellow-500 to-amber-400`, `text-warning`, `border-warning/30`, `glow-amber`).
     - **$< 50$ (High Risk)**: Rose/Red gradient (`from-rose-600 via-red-500 to-orange-400`, `text-destructive`, `border-destructive/30`, `glow-rose`).
   - Replaced legacy `ECS` label with **`AI Score`** accompanied by a themed Sparkles icon badge.
   - Prominently displays integer score (`/100`) and qualitative tier badges (`Exceptional`, `Strong`, `Moderate`, `High Risk`).

2. **Compacted Header Elements for Visual Hierarchy (`src/App.jsx`)**:
   - Streamlined stock company name (`text-lg sm:text-xl font-serif font-bold`) and sector text to eliminate top-heavy clutter.
   - Compacted ticker badge (`text-[11px] font-mono px-2.5 py-1`).
   - Refined latest market price (`text-lg sm:text-xl font-mono`) and 1D percentage return, allowing the AI Score Bar to emerge as the central visual focal point.

3. **Decoupled AI Score Refresh Action (`src/components/StoryCard.jsx`)**:
   - Added a dedicated **`Refresh AI Score`** button with spinning state animation inside the header of `<StoryCard />` alongside `Regenerate Story`.
   - Cleans up the top price area while keeping on-demand re-scoring easily accessible.

4. **Watchlist Streamlining & Static Score Deprecation (`src/components/Watchlist.jsx`)**:
   - Completely removed the legacy `Static Score` column (`<th>` and `<td>`) and the `Highest Static Score` quick sort filter pill.
   - Renamed table header to **`AI Score`** and updated sorting logic (`sortField === 'aiScore'`) to sort directly by live/persisted AI scores.
   - Styled the Watchlist AI Score column with the dynamic 4-tier color scheme and qualitative badges.

5. **Navigation Watchlist Action (`src/App.jsx`)**:
   - Replaced the old `Trending:` tickers bar in the navigation tabs bar with a live **`Add to Watchlist / Saved in Watchlist`** toggle pill.
   - Real-time reactivity: toggling updates `localStorage`, global state, and the `Watchlist (X)` count badge across the navbar immediately.

6. **Removed Deprecated 360° Matrix Component (`src/App.jsx`)**:
   - Fully removed the redundant `<ScoreGauge />` component from the Deep Dive page.
   - Creates a clean, institutional flow from Side-by-Side Chart/Quarterly Financials directly into **THE STORY** and the **AI Fin-LLM 360° Verdict** cards.

---

## 2. Source Code Architecture & File Inventory

```
equisense-web/
├── server/
│   ├── index.js                     # Express server & endpoints (/api/stock, /api/portfolio, /api/settings)
│   ├── db.js                        # SQLite schema & prepared statements (better-sqlite3 in WAL mode)
│   ├── sources/
│   │   ├── yahoo.js                 # Direct v8/finance/chart & yf.quote quote/history engine
│   │   └── screener.js              # Cheerio scraper for Screener.in ratios & quarters
│   └── services/
│       ├── aiService.js             # Multi-model LLM fallback pipeline & heuristic engines
│       ├── casService.js            # Statement fusion, XIRR, live quote enrichment, and Python bridges
│       ├── stockService.js          # TTL caching, dedup, and ticker alias normalization
│       ├── cas_parser.py            # CDSL/NSDL e-CAS PDF parser (casparser + pypdfium2)
│       ├── broker_parser.py         # Groww/Zerodha/Upstox XLSX/CSV parser
│       ├── epfo_parser.py           # EPFO member passbook PDF parser
│       └── bank_parser.py           # Multi-bank statement parser (HDFC & SCB) with spend classification
├── src/
│   ├── App.jsx                      # Root application, prominent AI Score bar, header cluster, navigation
│   ├── index.css                    # Steph Ango Flexoki Paper Cream design tokens
│   ├── components/
│   │   ├── SearchModal.jsx          # Instant Ctrl+K ticker search modal
│   │   ├── SettingsModal.jsx        # In-app Gemini API key manager & live connection validator
│   │   ├── StoryCard.jsx            # "THE STORY" institutional business breakdown & Refresh AI Score action
│   │   ├── StockChart.jsx           # Recharts area chart anchored to live CMP with pulsing badge
│   │   ├── QuarterlyAnalysis.jsx    # Table-only 8-quarter financials (latest on top)
│   │   ├── Watchlist.jsx            # High-density screening table (pure AI Score, static score removed)
│   │   └── portfolio/
│   │       ├── PortfolioDashboard.jsx # Wealthfolio net worth landing page with Privacy Mode toggle
│   │       ├── PortfolioPage.jsx    # Holdings tab coordinator
│   │       ├── PortfolioHeader.jsx  # Sync actions, Live CMP button, CSV/JSON export
│   │       ├── StocksTable.jsx      # 4-column holdings table with Live CMP button & 1D returns
│   │       ├── MutualFundsTable.jsx # Mutual fund folios with scheme-level XIRR
│   │       ├── BondsTable.jsx       # Sovereign Gold Bonds (SGB) & corporate debt
│   │       ├── EpfoTable.jsx        # EPFO member passbook accounts & monthly ledgers
│   │       ├── BankAccountsTable.jsx# Liquid cash accounts & transaction ledgers
│   │       ├── SpendAnalyser.jsx    # 8-category spend taxonomy & 50/30/20 budget lens
│   │       └── AnalyticsDashboard.jsx# Asset allocation & strategy lens donut charts
│   └── utils/
│       ├── api.js                   # Client HTTP API helpers
│       ├── usePortfolio.js          # Shared singleton state observer & SQLite synchronization
│       └── spendCategorizer.js      # Statement transaction classifier & merchant normalizer
├── LICENSE                          # MIT License
├── README.md                        # Documentation with visual walkthrough & API reference
├── SESSION_NOTES.md                 # Detailed session changelog & schema tracking
└── SESSION_HANDOFF.md               # This handoff document
```

---

## 3. Operational Verification Status

| Feature / Subsystem | Verification Method | Status | Notes |
|---|---|---|---|
| **Prominent AI Score Bar** | Headless Chrome & Vite Build | **OPERATIONAL** | Verified on `TMCV`, `E2E`, `RELIANCE`. Renders prominent gradient capsule with dynamic color scheme and `/100` badge. |
| **Top Header Spacing & Layout** | Headless Chrome Capture | **OPERATIONAL** | Stock name and price space compacted; ticker, score bar, and CMP sit side-by-side cleanly. |
| **Score Refresh in StoryCard** | Component & State Check | **OPERATIONAL** | Dedicated `Refresh AI Score` button in `<StoryCard />` header triggers `handleGenerateAIScore` with spinner. |
| **Watchlist Static Score Removal** | Headless Chrome (`?tab=watchlist`) | **OPERATIONAL** | Static Score column and quick filter pill removed; pure AI Score table with dynamic color badges. |
| **Watchlist Navigation Pill** | Click-to-toggle Test | **OPERATIONAL** | Replaced `Trending:` bar with `Add to Watchlist / Saved in Watchlist` toggle pill. |
| **360° Matrix Component Deprecation** | DOM & Component Render | **OPERATIONAL** | `<ScoreGauge />` removed from Deep Dive page without any regression. |
| **Production Build** | `npm run build` (Vite) | **OPERATIONAL** | 0 build errors; gzip bundle size verified. |
| **Live CMP Price Engine** | Direct API & Chart | **OPERATIONAL** | Anchors real-time market price to historical Recharts area chart with pulsing badge. |

---

## 4. Work Backlog for Future Sessions

1. **Mobile & Tablet App Parity (Capacitor / React Native)**:
   - Synchronize new prominent AI score bar and decoupled StoryCard refresh to `stock-ai-android`.
2. **Desktop Sync Automation (`scripts/sync-desktop.sh`)**:
   - Propagate updated `App.jsx`, `StoryCard.jsx`, and `Watchlist.jsx` to `stock-ai-desktop`.
3. **Market Cap & Sector Allocation Visualizations**:
   - Donut/bar classifying equity holdings into Large-Cap, Mid-Cap, and Small-Cap tiers.
   - Treemap displaying capital concentration by economic sector.
4. **AI Portfolio Health Diagnostics (Fin-LLM)**:
   - Consolidated portfolio health score (0–100) using Gemini.
   - Automated overconcentration warnings and hedge ratio recommendations.
