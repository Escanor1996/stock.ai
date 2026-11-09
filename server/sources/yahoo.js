import yfDefault from 'yahoo-finance2';

const yf = new yfDefault({ suppressNotices: ['yahooSurvey'] });

// ── Ticker Resolution ───────────────────────────────────────────────────────
// Indian tickers need .NS suffix for NSE. US tickers are bare.
// We try .NS first for unknown tickers, fall back to bare.

const KNOWN_US = new Set(['AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'META', 'NVDA', 'TSLA', 'NFLX', 'AMD', 'INTC', 'CRM', 'ORCL', 'ADBE', 'PYPL']);

export function resolveYahooSymbol(ticker) {
  const t = ticker.toUpperCase();
  if (t === 'TATAMOTORS' || t === 'TATAMTRDVR' || t === 'TATA') return 'TMCV.NS';
  if (t === 'ZOMATO') return 'ETERNAL.NS';
  if (t.includes('.NS') || t.includes('.BO')) return t;
  if (KNOWN_US.has(t)) return t;
  return `${t}.NS`; // default to NSE
}

// ── Quote ───────────────────────────────────────────────────────────────────

export async function fetchQuote(ticker) {
  const symbol = resolveYahooSymbol(ticker);
  try {
    const q = await yf.quote(symbol);
    if (q && q.regularMarketPrice) {
      return normalizeQuote(ticker, q);
    }
  } catch {
    // fallback to direct v8 chart API
  }

  // Fallback to direct v8/finance/chart for 100% reliable CMP
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=1d&interval=1d`;
    const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
    const data = await resp.json();
    const res = data.chart?.result?.[0];
    const meta = res?.meta;
    if (meta && meta.regularMarketPrice) {
      const price = meta.regularMarketPrice;
      const prevClose = meta.previousClose || meta.chartPreviousClose || price;
      const change = round(price - prevClose);
      const changePercent = prevClose > 0 ? round(((price - prevClose) / prevClose) * 100) : 0;
      return {
        stock: {
          ticker: ticker.toUpperCase(),
          yahoo_symbol: symbol,
          name: meta.shortName || ticker,
          exchange: meta.exchangeName || (symbol.endsWith('.NS') ? 'NSE' : 'BSE'),
          sector: null,
          industry: null,
          updated_at: Date.now(),
        },
        quote: {
          ticker: ticker.toUpperCase(),
          price,
          change,
          change_percent: changePercent,
          prev_close: prevClose,
          open: meta.regularMarketDayLow || price,
          day_high: meta.regularMarketDayHigh || price,
          day_low: meta.regularMarketDayLow || price,
          volume: meta.regularMarketVolume || 0,
          market_cap: null,
          updated_at: Date.now(),
        },
        fundamentals: {
          ticker: ticker.toUpperCase(),
          pe_ratio: null,
          pb_ratio: null,
          ev_ebitda: null,
          roe: null,
          roce: null,
          debt_to_equity: null,
          dividend_yield: null,
          book_value: null,
          high_52w: meta.fiftyTwoWeekHigh || null,
          low_52w: meta.fiftyTwoWeekLow || null,
          updated_at: Date.now(),
        },
      };
    }
  } catch (err) {
    console.error(`Yahoo chart quote failed for ${symbol}:`, err.message);
  }

  return null;
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

export async function fetchHistorical(ticker, rangeOrPeriod1 = '1y', period2, interval = '1d') {
  const symbol = resolveYahooSymbol(ticker);

  // Resolve range and interval for direct v8/finance/chart
  let range = typeof rangeOrPeriod1 === 'string' && ['1w', '1m', '3m', '6m', '1y', '5y'].includes(rangeOrPeriod1)
    ? rangeOrPeriod1
    : '1y';

  const rangeConfig = {
    '1w': { range: '5d', interval: '1d' },
    '1m': { range: '1mo', interval: '1d' },
    '3m': { range: '3mo', interval: '1d' },
    '6m': { range: '6mo', interval: '1d' },
    '1y': { range: '1y', interval: '1d' },
    '5y': { range: '5y', interval: '1wk' },
  };
  const cfg = rangeConfig[range] || { range: '1y', interval: '1d' };

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=${cfg.range}&interval=${cfg.interval}`;
    const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
    const data = await resp.json();
    const res = data.chart?.result?.[0];
    if (res && res.timestamp && res.timestamp.length > 0) {
      const meta = res.meta;
      const timestamps = res.timestamp;
      const quote = res.indicators?.quote?.[0] || {};
      const rows = [];

      for (let i = 0; i < timestamps.length; i++) {
        const c = quote.close?.[i];
        if (c != null && !isNaN(c)) {
          rows.push({
            date: new Date(timestamps[i] * 1000).toISOString().slice(0, 10),
            open: round(quote.open?.[i] ?? c),
            high: round(quote.high?.[i] ?? c),
            low: round(quote.low?.[i] ?? c),
            close: round(c),
            volume: quote.volume?.[i] ?? 0,
          });
        }
      }

      // Ensure live CMP is attached at the end of the series
      const livePrice = meta?.regularMarketPrice;
      if (livePrice != null && livePrice > 0) {
        const todayStr = new Date().toISOString().slice(0, 10);
        const last = rows[rows.length - 1];
        if (last && last.date === todayStr) {
          last.close = round(livePrice);
        } else {
          rows.push({
            date: todayStr,
            open: last?.close ?? livePrice,
            high: Math.max(last?.high ?? livePrice, livePrice),
            low: Math.min(last?.low ?? livePrice, livePrice),
            close: round(livePrice),
            volume: meta?.regularMarketVolume ?? 0,
          });
        }
      }

      if (rows.length > 0) return rows;
    }
  } catch (err) {
    console.warn(`Yahoo v8/chart failed for ${symbol} (${err.message}), trying yf.historical...`);
  }

  // Fallback to legacy yf.historical
  try {
    const p1 = period2 ? rangeOrPeriod1 : new Date(Date.now() - 365 * 86400000);
    const p2 = period2 || new Date();
    const rows = await yf.historical(symbol, { period1: p1, period2: p2, interval });
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
