import * as db from '../db.js';
import * as yahoo from '../sources/yahoo.js';
import * as screener from '../sources/screener.js';

// ── Cache TTLs ──────────────────────────────────────────────────────────────
const QUOTE_TTL       = 5  * 60 * 1000; // 5 min — price data
const FUNDAMENTAL_TTL = 60 * 60 * 1000; // 1 hour — ratios, sector
const QUARTERLY_TTL   = 24 * 60 * 60 * 1000; // 24 hours — quarterly results
const HISTORICAL_TTL  = 24 * 60 * 60 * 1000; // 24 hours

// In-flight request dedup: prevents concurrent identical fetches
const inflight = new Map();

function dedup(key, fn) {
  if (inflight.has(key)) return inflight.get(key);
  const promise = fn().finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}

// ── Main Entry: Get Full Stock Data ─────────────────────────────────────────

export async function getStockData(ticker) {
  const t = ticker.toUpperCase();
  return dedup(`stock:${t}`, () => _fetchAndMerge(t));
}

async function _fetchAndMerge(ticker) {
  const existing = db.getStock(ticker);
  const existingQuote = db.getQuote(ticker);
  const existingFund = db.getFundamentals(ticker);

  const quoteStale = !existingQuote || db.isStale(existingQuote.updated_at, QUOTE_TTL);
  const fundStale = !existingFund || db.isStale(existingFund.updated_at, FUNDAMENTAL_TTL);

  // ── Yahoo quote (fast, always needed for price) ───────────────────────
  let yahooData = null;
  if (quoteStale) {
    yahooData = await yahoo.fetchQuote(ticker);
    if (yahooData) {
      db.upsertStock(yahooData.stock);
      db.upsertQuote(yahooData.quote);
      db.upsertFundamentals(yahooData.fundamentals);
    }
  }

  // ── Yahoo summary + Screener (slower, only when fundamentals stale) ───
  if (fundStale) {
    const [summary, screenerData] = await Promise.all([
      yahoo.fetchSummary(ticker),
      screener.fetchScreenerData(ticker),
    ]);

    if (summary) {
      const stock = db.getStock(ticker);
      if (stock) {
        db.upsertStock({
          ...stock,
          sector: summary.sector || stock.sector,
          industry: summary.industry || stock.industry,
          updated_at: Date.now(),
        });
      }
      // Merge Yahoo summary into fundamentals
      const fund = db.getFundamentals(ticker) || { ticker, updated_at: Date.now() };
      db.upsertFundamentals({
        ...fund,
        roe: summary.roe ?? fund.roe,
        debt_to_equity: summary.debt_to_equity ?? fund.debt_to_equity,
        ev_ebitda: summary.ev_ebitda ?? fund.ev_ebitda,
        dividend_yield: summary.dividend_yield ?? fund.dividend_yield,
        book_value: summary.book_value ?? fund.book_value,
        updated_at: Date.now(),
      });
    }

    if (screenerData) {
      // Screener ratios override Yahoo for Indian-specific metrics
      const fund = db.getFundamentals(ticker) || { ticker, updated_at: Date.now() };
      const sr = screenerData.ratios;
      db.upsertFundamentals({
        ...fund,
        roce: sr.roce ?? fund.roce,
        roe: sr.roe ?? fund.roe,         // screener ROE preferred for Indian stocks
        pe_ratio: sr.pe_ratio ?? fund.pe_ratio,
        high_52w: sr.high_52w ?? fund.high_52w,
        low_52w: sr.low_52w ?? fund.low_52w,
        book_value: sr.book_value ?? fund.book_value,
        dividend_yield: sr.dividend_yield ?? fund.dividend_yield,
        debt_to_equity: sr.debt_to_equity ?? fund.debt_to_equity,
        updated_at: Date.now(),
      });

      // Quarterly financials
      if (screenerData.quarters.length > 0) {
        db.upsertQuarterlies(ticker, screenerData.quarters);
      }
    }
  }

  // ── Assemble response from DB ─────────────────────────────────────────
  return assembleResponse(ticker);
}

// ── Assemble a unified response object from DB tables ───────────────────────

function assembleResponse(ticker) {
  const stock = db.getStock(ticker);
  if (!stock) return null;

  const quote = db.getQuote(ticker) || {};
  const fund = db.getFundamentals(ticker) || {};
  const quarters = db.getQuarterlies(ticker);
  const aiAnalysis = db.getAIAnalysis(ticker);
  const staticScoreResult = calculateStaticScore(quote, fund, quarters);
  return {
    // Identity
    symbol: stock.ticker,
    yahooSymbol: stock.yahoo_symbol,
    name: stock.name,
    exchange: stock.exchange,
    sector: stock.sector || 'N/A',
    industry: stock.industry || 'N/A',

    // Price
    price: quote.price || 0,
    change: quote.change || 0,
    changePercent: round(quote.change_percent) || 0,
    prevClose: quote.prev_close,
    open: quote.open,
    dayHigh: quote.day_high,
    dayLow: quote.day_low,
    volume: quote.volume,
    marketCap: quote.market_cap,

    // Fundamentals
    peRatio: fund.pe_ratio,
    pbRatio: fund.pb_ratio,
    evEbitda: fund.ev_ebitda,
    roe: fund.roe,
    roce: fund.roce,
    debtToEquity: fund.debt_to_equity,
    dividendYield: fund.dividend_yield,
    bookValue: fund.book_value,
    high52: fund.high_52w,
    low52: fund.low_52w,

    // Quarterly
    quarterlyFinancials: quarters.length > 0 ? quarters.slice(-8) : [],

    // Metadata
    lastUpdated: quote.updated_at || stock.updated_at,
    // Saved AI Analysis (persisted)
    aiAnalysis,
    // Deterministic Static Financial Score
    staticScore: staticScoreResult.score,
    staticBreakdown: staticScoreResult.breakdown,
  };
}

// ── Historical Prices ───────────────────────────────────────────────────────

export async function getHistoricalPrices(ticker, range = '1y') {
  const t = ticker.toUpperCase();
  return dedup(`hist:${t}:${range}`, () => _fetchHistorical(t, range));
}

async function _fetchHistorical(ticker, range) {
  const { period1, period2, interval } = rangeToParams(range);
  const fromStr = period1.toISOString().slice(0, 10);
  const toStr = period2.toISOString().slice(0, 10);

  // Check DB
  const cached = db.getHistorical(ticker, fromStr, toStr);
  // Only use cache if we have a reasonable number of rows and data is fresh
  const stock = db.getStock(ticker);
  const histFresh = stock && !db.isStale(stock.updated_at, HISTORICAL_TTL);
  if (cached.length > 5 && histFresh) return cached;

  // Fetch fresh
  const rows = await yahoo.fetchHistorical(ticker, period1, period2, interval);
  if (rows.length > 0) {
    db.upsertHistorical(ticker, rows);
  }
  return rows.length > 0 ? rows : cached;
}

function rangeToParams(range) {
  const now = new Date();
  const period2 = now;
  let period1;
  let interval = '1d';

  switch (range) {
    case '1w':
      period1 = new Date(now.getTime() - 7 * 86400000);
      interval = '1d';
      break;
    case '1m':
      period1 = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      interval = '1d';
      break;
    case '3m':
      period1 = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      interval = '1d';
      break;
    case '6m':
      period1 = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
      interval = '1d';
      break;
    case '1y':
      period1 = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      interval = '1wk';
      break;
    case '5y':
      period1 = new Date(now.getFullYear() - 5, now.getMonth(), now.getDate());
      interval = '1mo';
      break;
    default:
      period1 = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      interval = '1wk';
  }

  return { period1, period2, interval };
}

// ── Search ──────────────────────────────────────────────────────────────────

export async function searchStocks(query) {
  // First check local DB
  const local = db.searchStocks(query);
  if (local.length >= 5) {
    return local.map((r) => ({
      symbol: r.ticker,
      name: r.name,
      exchange: r.exchange,
      sector: r.sector,
      price: r.price,
      changePercent: r.change_percent,
    }));
  }

  // Fall back to Yahoo search
  const results = await yahoo.searchTickers(query);
  return results;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function round(v) {
  if (v == null || isNaN(v)) return null;
  return Math.round(v * 100) / 100;
}

export function calculateStaticScore(quote = {}, fund = {}, quarters = []) {
  // 1. Capital Efficiency & Profitability (25%)
  let roeScore = 50;
  if (fund.roe != null) {
    if (fund.roe >= 25) roeScore = 100;
    else if (fund.roe >= 15) roeScore = 70 + ((fund.roe - 15) / 10) * 30;
    else if (fund.roe >= 5) roeScore = 40 + ((fund.roe - 5) / 10) * 30;
    else if (fund.roe >= 0) roeScore = 25 + (fund.roe / 5) * 15;
    else roeScore = 10;
  }

  let roceScore = 50;
  if (fund.roce != null) {
    if (fund.roce >= 25) roceScore = 100;
    else if (fund.roce >= 15) roceScore = 70 + ((fund.roce - 15) / 10) * 30;
    else if (fund.roce >= 5) roceScore = 40 + ((fund.roce - 5) / 10) * 30;
    else roceScore = 20;
  }

  const capitalEfficiency = Math.round(roeScore * 0.6 + roceScore * 0.4);

  // 2. Growth Momentum (25%)
  let growthScore = 50;
  if (quarters && quarters.length > 0) {
    const recent = quarters.slice(-4);
    const validRevGrowth = recent.map(q => q.rev_growth_yoy).filter(g => g != null);
    const validPatGrowth = recent.map(q => q.pat_growth_yoy).filter(g => g != null);

    const avgRev = validRevGrowth.length ? validRevGrowth.reduce((a, b) => a + b, 0) / validRevGrowth.length : 0;
    const avgPat = validPatGrowth.length ? validPatGrowth.reduce((a, b) => a + b, 0) / validPatGrowth.length : 0;

    let revPts = 50;
    if (avgRev >= 25) revPts = 100;
    else if (avgRev >= 15) revPts = 80;
    else if (avgRev >= 5) revPts = 60;
    else if (avgRev >= 0) revPts = 40;
    else revPts = 15;

    let patPts = 50;
    if (avgPat >= 25) patPts = 100;
    else if (avgPat >= 10) patPts = 75;
    else if (avgPat >= 0) patPts = 50;
    else patPts = 20;

    growthScore = Math.round(revPts * 0.6 + patPts * 0.4);
  }

  // 3. Solvency & Balance Sheet Health (20%)
  let solvency = 60;
  if (fund.debt_to_equity != null) {
    const de = fund.debt_to_equity;
    if (de <= 0.1) solvency = 100;
    else if (de <= 0.5) solvency = 85;
    else if (de <= 1.0) solvency = 65;
    else if (de <= 1.5) solvency = 45;
    else solvency = 20;
  }

  // 4. Valuation & Margin of Safety (20%)
  let valuation = 50;
  if (fund.pe_ratio != null && fund.pe_ratio > 0) {
    const pe = fund.pe_ratio;
    if (pe < 15) valuation = 95;
    else if (pe <= 25) valuation = 80;
    else if (pe <= 45) valuation = 60;
    else if (pe <= 75) valuation = 35;
    else valuation = 20;
  } else if (fund.pe_ratio != null && fund.pe_ratio < 0) {
    valuation = 15; // loss making
  }

  // 5. Price Health & Momentum (10%)
  let priceHealth = 50;
  if (quote.price && fund.high_52w && fund.low_52w && fund.high_52w > fund.low_52w) {
    const range = fund.high_52w - fund.low_52w;
    const pos = (quote.price - fund.low_52w) / range;
    priceHealth = Math.round(Math.max(10, Math.min(100, pos * 100)));
  }

  const weighted = Math.round(
    capitalEfficiency * 0.25 +
    growthScore * 0.25 +
    solvency * 0.20 +
    valuation * 0.20 +
    priceHealth * 0.10
  );

  const totalScore = Math.max(10, Math.min(99, weighted));

  return {
    score: totalScore,
    breakdown: {
      capitalEfficiency,
      growth: growthScore,
      solvency,
      valuation,
      priceHealth
    }
  };
}
