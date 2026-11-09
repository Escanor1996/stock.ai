# stock.ai — 360° AI Equity Research & Financial Intelligence Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-v18+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-06B6D4?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![SQLite](https://img.shields.io/badge/SQLite-WAL_Mode-003B57?logo=sqlite&logoColor=white)](https://sqlite.org/)
[![Google Gemini](https://img.shields.io/badge/Gemini_LLM-Multi--Model_Fallback-4285F4?logo=google&logoColor=white)](https://aistudio.google.com/)

**stock.ai** is an institutional-grade equity analysis, portfolio intelligence, and wealth management platform built for Indian and global equities (NSE, BSE, and US exchanges). It unifies real-time market data from Yahoo Finance, verified quarterly financial statements from Screener.in, deterministic quantitative ratings, offline statement parsing (CDSL/NSDL e-CAS, broker spreadsheets, EPFO passbooks, bank statements), and multi-pillar qualitative research synthesized by **Google Gemini** with a resilient multi-model fallback pipeline.

---

## 📸 Screenshots & Visual Walkthrough

### 1. Multi-Asset Portfolio Dashboard (Wealthfolio Design System)
Consolidated net worth overview across all asset classes with privacy masking (`••••••`), asset allocation ribbon, historical trajectory, and connected account rollups.

![stock.ai Portfolio Dashboard](./portfolio_dashboard.png)

- **One-Tap Privacy Mode**: Toggle the privacy eye icon (`Eye` / `EyeOff`) to instantly mask all balance figures across the entire dashboard.
- **5-Asset Class Architecture**: Real-time aggregation across Direct Stocks & ETFs, Mutual Funds (with XIRR), Sovereign Gold Bonds (SGB), EPFO Provident Fund, and Liquid Bank Accounts.
- **Live CMP Quote Refresh**: Re-evaluates live market valuations and daily returns against Yahoo Finance with one click.

---

### 2. Institutional Watchlist Table
High-density tabular screening monitoring saved assets, real-time market quotes, deterministic scores, and AI evaluations.

![stock.ai Watchlist Table](./watchlist.png)

- **One-Click Sorting**: Sort instantly by Highest Static Score, Highest AI Score, Price (High $\rightarrow$ Low, Low $\rightarrow$ High), or Top Gainers.
- **Side-by-Side Score Badges**: Compare pure quantitative ratings alongside qualitative AI evaluations.
- **Fast Quick-Add**: Add any ticker with live validation and auto-resolution.

---

### 3. Compact 360° Deep Dive: Side-by-Side Chart, Financials & "The Story"
Compact layout featuring a real-time historical chart, descending chronological quarterly financials table (latest records on top), and the Fin-LLM synthesized business breakdown.

![stock.ai Company Deep Dive & The Story](./deep_dive.png)

- **Side-by-Side Layout**: Responsive 2-column grid pairing the interactive historical chart with the 8-quarter chronological financial table.
- **Live CMP Anchor**: Chart automatically pins the latest candle to the real-time CMP price with a live pulsing indicator badge.
- **Latest Quarters on Top**: Chronological 8-quarter financial table sorted descending so the latest quarter displays on row #1.
- **"THE STORY" Section**:
  - **Institutional Business Narrative**: Deep synthesis answering core revenue drivers, GPU cluster economics, non-cash depreciation dynamics, and capex runways.
  - **Theme Hashtags**: Color-coded technology and moat tags (`#GPUCloud`, `#SovereignAI`, `#NVIDIA`, `#AIInfrastructure`).
  - **End Markets**: Target customer segments (`Sovereign AI company`, `International customer`, `Domestic market`).
  - **What They Do**: Structured operational capabilities with bold titles and quantitative metrics.

---

### 4. Dual 360° Score Matrix & Fin-LLM Research Thesis
Decoupled quantitative evaluation and qualitative research thesis with independent generation and isolated SQLite persistence.

![stock.ai Dual Score Matrix & Fin-LLM Verdict](./deepdive2.png)

- **Dual 360° Dial Gauges**:
  - **Deterministic Static Financial Score (Left)**: 100% mathematical formula grading Capital Efficiency (25%), Growth Momentum (25%), Solvency (20%), Valuation (20%), and Price Health (10%).
  - **AI 360° Qualitative Score (Right)**: Evaluated by Gemini incorporating Corporate Governance (20%) and Future Potential (20%) with a dedicated **Regenerate Score** button.
- **stock.ai Fin-LLM 360° Verdict**:
  - **Executive Research Thesis**: 2-sentence synthesis of valuation and risk-reward profile with a dedicated **Regenerate Verdict** button.
  - **Corporate Governance Assessment**: Analysis of promoter pledging, institutional alignment, and accounting disclosures.
  - **3-Pillar Research Grid**: Parallel cards for **Key Bullish Catalysts** (Emerald), **Risk Factors & Cautionary Notes** (Rose), and **Future Potential & Runway** (Cyan).

---

## ⚡ Key Architectural Features

- **Multi-Model LLM Fallback Pipeline**:
  - Seamlessly cascades across Google Generative Language models:
    $$\text{gemini-3.5-flash (Interactions)} \longrightarrow \text{gemini-3.5-flash} \longrightarrow \text{gemini-3.6-flash} \longrightarrow \text{gemini-flash-lite-latest} \longrightarrow \text{gemini-3.8-flash}$$
  - Eliminates HTTP 503 high-demand temporary outages and 429 quota exhaustion.
  - Generous 90-second timeout with resilient JSON extraction.
- **Offline Mathematical Fallback**: If no Gemini API key is configured or offline, the platform automatically runs on the deterministic `stock.ai Algorithm` without crashing.
- **Offline-First Statement Parsers**:
  - **CDSL & NSDL e-CAS**: Automatic password casing permutations, extracting equities, mutual funds, and SGBs.
  - **Broker Excel Statements**: Groww, Zerodha, Upstox, Coin imports with purchase average fusion and XIRR tracking.
  - **EPFO Member Passbooks**: Multi-passbook parser consolidating past and present employer accounts.
  - **Bank Statements & Spend Analyser**: 8-category spend taxonomy with 50/30/20 budget lens for HDFC and Standard Chartered accounts.
- **Zero-Leak Temp File Management**: Uploaded financial PDFs and Excel files are automatically unlinked from temporary storage immediately after parsing.
- **In-App Settings & Key Manager**: Configure, test, and persist Google AI Studio keys directly within the UI with live connection testing.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, Vite 5.4, Tailwind CSS 3.4, Lucide React, Recharts |
| **Backend** | Node.js, Express 5, Axios, Cheerio, Multer |
| **Database** | SQLite (`better-sqlite3` with Write-Ahead Logging `journal_mode = WAL`) |
| **Data Sources** | Yahoo Finance API (`v8/finance/chart`), Screener.in Web Scraper |
| **Statement Parsers** | Python 3.12, `casparser`, `pypdfium2`, `openpyxl`, `poppler-utils` |
| **AI Engine** | Google Gemini (`gemini-3.5-flash`, `gemini-3.6-flash`, `gemini-flash-lite`, `gemini-3.8-flash`) |
| **Design Language** | Steph Ango's Flexoki Paper Cream Palette (`#fffcf0` / `#100f0f`) |

---

## 🚀 Getting Started

### Prerequisites
- Node.js v18.0.0 or higher
- Python 3.10+ (for local statement parsers)
- npm or yarn

### 1. Clone the Repository
```bash
git clone https://github.com/Escanor1996/stock.ai.git
cd stock.ai
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
Create a `.env` file in the root directory (or enter your key via the in-app Settings modal):
```env
PORT=3001
GEMINI_API_KEY=your_google_ai_studio_api_key_here
```
> **Note**: If `GEMINI_API_KEY` is omitted, the app will automatically run offline using the built-in `stock.ai Algorithm` heuristic engine.

### 4. Run Development Servers
Start both the Express backend (port 3001) and Vite frontend (port 3000) concurrently:
```bash
npm run dev
```

Open your browser and navigate to **`http://localhost:3000`**.

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/stock/:ticker` | Returns unified stock profile (quote, fundamentals, quarters, and saved AI analysis). |
| `GET` | `/api/stock/:ticker/history?range=1y` | Returns historical price series anchored to live CMP (`1w`, `1m`, `3m`, `6m`, `1y`, `5y`). |
| `GET` | `/api/stock/:ticker/score?refresh=true` | Triggers independent AI 360° quantitative scoring across the 6 pillars. |
| `GET` | `/api/stock/:ticker/verdict?refresh=true` | Synthesizes independent Fin-LLM qualitative research thesis & 3-pillar catalysts. |
| `GET` | `/api/stock/:ticker/story?refresh=true` | Generates "The Story" business breakdown with hashtags, end markets, and capabilities. |
| `GET` | `/api/search?q=:query` | Real-time ticker and company lookup. |
| `POST` | `/api/portfolio/refresh-quotes` | Refreshes all portfolio stocks and ETFs with latest live CMP and recalculates valuation. |
| `POST` | `/api/portfolio/parse` | Ingests and parses official CDSL/NSDL e-CAS PDF statements. |
| `POST` | `/api/portfolio/broker-statement` | Parses Groww/Zerodha/Upstox XLSX/CSV statements with cost basis and XIRR. |
| `POST` | `/api/portfolio/epfo-passbook` | Parses single or multiple EPFO member passbook PDFs. |
| `POST` | `/api/portfolio/bank-statement` | Ingests HDFC or Standard Chartered bank statements with spend intelligence. |
| `GET` | `/api/settings` | Returns active AI engine status and masked API key. |
| `POST` | `/api/settings` | Saves new Gemini API key to local `.env`. |
| `POST` | `/api/settings/test` | Live endpoint validation against Google AI Studio. |

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](./LICENSE) file for details.

```
MIT License
Copyright (c) 2026 Arka Chakraborty
```

---

## ⚖️ Disclaimer

Information provided by **stock.ai** is strictly for educational and analytical purposes only. It does not constitute investment advice, financial endorsement, or a recommendation to buy or sell securities. The platform is not a SEBI-registered investment advisor. Always conduct your own research before making financial decisions.
