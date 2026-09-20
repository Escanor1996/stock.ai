import yfDefault from 'yahoo-finance2';

const yf = new yfDefault({ suppressNotices: ['yahooSurvey'] });

// ── Ticker Resolution ───────────────────────────────────────────────────────
// Indian tickers need .NS suffix for NSE. US tickers are bare.
// We try .NS first for unknown tickers, fall back to bare.

const KNOWN_US = new Set(['AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'META', 'NVDA', 'TSLA', 'NFLX', 'AMD', 'INTC', 'CRM', 'ORCL', 'ADBE', 'PYPL']);

export function resolveYahooSymbol(ticker) {
  const t = ticker.toUpperCase();
  if (t.includes('.NS') || t.includes('.BO')) return t;
  if (KNOWN_US.has(t)) return t;
  return `${t}.NS`; // default to NSE
}

// ── Quote ───────────────────────────────────────────────────────────────────

export async function fetchQuote(ticker) {
  const symbol = resolveYahooSymbol(ticker);
  try {
    const q = await yf.quote(symbol);
    if (!q || !q.regularMarketPrice) {
      // Retry without suffix (maybe US stock not in KNOWN_US)
      if (symbol.endsWith('.NS')) {
        const bare = await yf.quote(ticker.toUpperCase());
        if (bare && bare.regularMarketPrice) return normalizeQuote(ticker, bare);
      }
      return null;
    }
    return normalizeQuote(ticker, q);
  } catch (err) {
    // Try bare symbol as fallback
    if (symbol.endsWith('.NS')) {
      try {
        const bare = await yf.quote(ticker.toUpperCase());
        if (bare && bare.regularMarketPrice) return normalizeQuote(ticker, bare);
      } catch { /* ignore */ }
    }
    console.error(`Yahoo quote failed for ${symbol}:`, err.message);
    return null;
  }
}

function normalizeQuote(ticker, q) {
  const exchange = q.exchange === 'NSI' ? 'NSE' : q.exchange === 'BSE' ? 'BSE' : q.exchange;
  return {
    stock: {
      ticker: ticker.toUpperCase(),
      yahoo_symbol: q.symbol,
      name: q.longName || q.shortName || ticker,
      exchange,
      sector: null, // filled by quoteSummary
      industry: null,
      updated_at: Date.now(),
    },
    quote: {
      ticker: ticker.toUpperCase(),
      price: q.regularMarketPrice,
      change: round(q.regularMarketChange),
      change_percent: round(q.regularMarketChangePercent),
      prev_close: q.regularMarketPreviousClose,
      open: q.regularMarketOpen,
      day_high: q.regularMarketDayHigh,
      day_low: q.regularMarketDayLow,
      volume: q.regularMarketVolume,
      market_cap: q.marketCap,
      updated_at: Date.now(),
    },
    fundamentals: {
      ticker: ticker.toUpperCase(),
      pe_ratio: round(q.trailingPE),
      pb_ratio: round(q.priceToBook),
      ev_ebitda: null,
      roe: null,
      roce: null,
      debt_to_equity: null,
      dividend_yield: null,
      book_value: null,
      high_52w: q.fiftyTwoWeekHigh,
      low_52w: q.fiftyTwoWeekLow,
      updated_at: Date.now(),
    },
  };
}

// ── Summary (deeper fundamentals) ───────────────────────────────────────────

export async function fetchSummary(ticker) {
  const symbol = resolveYahooSymbol(ticker);
  try {
    const res = await yf.quoteSummary(symbol, {
      modules: ['financialData', 'defaultKeyStatistics', 'assetProfile'],
    });

    const fd = res.financialData || {};
    const ks = res.defaultKeyStatistics || {};
    const ap = res.assetProfile || {};

    return {
      sector: ap.sector || null,
      industry: ap.industry || null,
      roe: round(fd.returnOnEquity != null ? fd.returnOnEquity * 100 : null),
      debt_to_equity: round(fd.debtToEquity),
      ev_ebitda: round(ks.enterpriseToEbitda),
      dividend_yield: round(ks.dividendYield != null ? ks.dividendYield * 100 : null),
      book_value: round(ks.bookValue),
    };
  } catch (err) {
    console.error(`Yahoo summary failed for ${symbol}:`, err.message);
    return null;
  }
}

// ── Historical Prices ───────────────────────────────────────────────────────

export async function fetchHistorical(ticker, period1, period2, interval = '1d') {
  const symbol = resolveYahooSymbol(ticker);
  try {
    const rows = await yf.historical(symbol, { period1, period2, interval });
    return rows.map((r) => ({
      date: r.date.toISOString().slice(0, 10),
      open: round(r.open),
      high: round(r.high),
      low: round(r.low),
      close: round(r.close),
      volume: r.volume,
    }));
  } catch (err) {
    console.error(`Yahoo historical failed for ${symbol}:`, err.message);
    return [];
  }
}

// ── Search ──────────────────────────────────────────────────────────────────

export async function searchTickers(query) {
  try {
    const res = await yf.search(query);
    return (res.quotes || [])
      .filter((q) => q.quoteType === 'EQUITY' && q.isYahooFinance)
      .slice(0, 15)
      .map((q) => ({
        symbol: q.symbol,
        ticker: q.symbol.replace(/\.(NS|BO)$/, ''),
        name: q.longname || q.shortname || q.symbol,
        exchange: q.exchDisp || q.exchange,
        sector: q.sectorDisp || null,
        industry: q.industryDisp || null,
      }));
  } catch (err) {
    console.error('Yahoo search failed:', err.message);
    return [];
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function round(v) {
  if (v == null || isNaN(v)) return null;
  return Math.round(v * 100) / 100;
}
