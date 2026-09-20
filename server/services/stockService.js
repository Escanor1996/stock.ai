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
