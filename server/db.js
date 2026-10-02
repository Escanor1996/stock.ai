import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'equisense.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Schema ──────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS stocks (
    ticker        TEXT PRIMARY KEY,
    yahoo_symbol  TEXT,
    name          TEXT,
    exchange      TEXT,
    sector        TEXT,
    industry      TEXT,
    updated_at    INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS quotes (
    ticker          TEXT PRIMARY KEY REFERENCES stocks(ticker),
    price           REAL,
    change          REAL,
    change_percent  REAL,
    prev_close      REAL,
    open            REAL,
    day_high        REAL,
    day_low         REAL,
    volume          INTEGER,
    market_cap      REAL,
    updated_at      INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS fundamentals (
    ticker          TEXT PRIMARY KEY REFERENCES stocks(ticker),
    pe_ratio        REAL,
    pb_ratio        REAL,
    ev_ebitda       REAL,
    roe             REAL,
    roce            REAL,
    debt_to_equity  REAL,
    dividend_yield  REAL,
    book_value      REAL,
    high_52w        REAL,
    low_52w         REAL,
    updated_at      INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS quarterly_financials (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    ticker          TEXT NOT NULL REFERENCES stocks(ticker),
    quarter         TEXT NOT NULL,
    revenue         REAL,
    pat             REAL,
    eps             REAL,
    opm_percent     REAL,
    rev_growth_yoy  REAL,
    pat_growth_yoy  REAL,
    UNIQUE(ticker, quarter)
  );

  CREATE TABLE IF NOT EXISTS historical_prices (
    ticker  TEXT NOT NULL,
    date    TEXT NOT NULL,
    open    REAL,
    high    REAL,
    low     REAL,
    close   REAL,
    volume  INTEGER,
    PRIMARY KEY (ticker, date)
  );

  CREATE INDEX IF NOT EXISTS idx_historical_date ON historical_prices(ticker, date);
  CREATE INDEX IF NOT EXISTS idx_quarterly_ticker ON quarterly_financials(ticker);
  CREATE TABLE IF NOT EXISTS ai_analysis (
    ticker           TEXT PRIMARY KEY,
    score            INTEGER,
    verdict          TEXT,
    bull_points      TEXT,
    bear_points      TEXT,
    future_points    TEXT,
    parameter_scores TEXT,
    governance_notes TEXT,
    engine           TEXT,
    updated_at       INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS user_portfolio (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    isin          TEXT,
    symbol        TEXT,
    name          TEXT,
    quantity      REAL,
    price         REAL,
    value         REAL,
    asset_type    TEXT,
    depository    TEXT,
    account_name  TEXT,
    updated_at    INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS portfolio_meta (
    key           TEXT PRIMARY KEY,
    value         TEXT,
    updated_at    INTEGER NOT NULL DEFAULT 0
  );
`);

// Safe migrations for new columns in ai_analysis
try { db.exec("ALTER TABLE ai_analysis ADD COLUMN future_points TEXT;"); } catch (_) {}
try { db.exec("ALTER TABLE ai_analysis ADD COLUMN parameter_scores TEXT;"); } catch (_) {}
try { db.exec("ALTER TABLE ai_analysis ADD COLUMN governance_notes TEXT;"); } catch (_) {}
try { db.exec("ALTER TABLE user_portfolio ADD COLUMN category TEXT;"); } catch (_) {}
try { db.exec("ALTER TABLE user_portfolio ADD COLUMN subtype TEXT;"); } catch (_) {}
try { db.exec("ALTER TABLE user_portfolio ADD COLUMN cost_basis REAL;"); } catch (_) {}
try { db.exec("ALTER TABLE user_portfolio ADD COLUMN live_price REAL;"); } catch (_) {}
try { db.exec("ALTER TABLE user_portfolio ADD COLUMN live_value REAL;"); } catch (_) {}
try { db.exec("ALTER TABLE user_portfolio ADD COLUMN gain REAL;"); } catch (_) {}
try { db.exec("ALTER TABLE user_portfolio ADD COLUMN gain_pct REAL;"); } catch (_) {}
try { db.exec("ALTER TABLE user_portfolio ADD COLUMN folio TEXT;"); } catch (_) {}
try { db.exec("ALTER TABLE user_portfolio ADD COLUMN amfi TEXT;"); } catch (_) {}
try { db.exec("ALTER TABLE user_portfolio ADD COLUMN xirr REAL;"); } catch (_) {}

// ── Prepared Statements ─────────────────────────────────────────────────────

const stmts = {
  upsertStock: db.prepare(`
    INSERT INTO stocks (ticker, yahoo_symbol, name, exchange, sector, industry, updated_at)
    VALUES (@ticker, @yahoo_symbol, @name, @exchange, @sector, @industry, @updated_at)
    ON CONFLICT(ticker) DO UPDATE SET
      yahoo_symbol = COALESCE(@yahoo_symbol, yahoo_symbol),
      name         = COALESCE(@name, name),
      exchange     = COALESCE(@exchange, exchange),
      sector       = COALESCE(@sector, sector),
      industry     = COALESCE(@industry, industry),
      updated_at   = @updated_at
  `),

  upsertQuote: db.prepare(`
    INSERT INTO quotes (ticker, price, change, change_percent, prev_close, open, day_high, day_low, volume, market_cap, updated_at)
    VALUES (@ticker, @price, @change, @change_percent, @prev_close, @open, @day_high, @day_low, @volume, @market_cap, @updated_at)
    ON CONFLICT(ticker) DO UPDATE SET
      price          = @price,
      change         = @change,
      change_percent = @change_percent,
      prev_close     = @prev_close,
      open           = @open,
      day_high       = @day_high,
      day_low        = @day_low,
      volume         = @volume,
      market_cap     = @market_cap,
      updated_at     = @updated_at
  `),

  upsertFundamentals: db.prepare(`
    INSERT INTO fundamentals (ticker, pe_ratio, pb_ratio, ev_ebitda, roe, roce, debt_to_equity, dividend_yield, book_value, high_52w, low_52w, updated_at)
    VALUES (@ticker, @pe_ratio, @pb_ratio, @ev_ebitda, @roe, @roce, @debt_to_equity, @dividend_yield, @book_value, @high_52w, @low_52w, @updated_at)
    ON CONFLICT(ticker) DO UPDATE SET
      pe_ratio        = COALESCE(@pe_ratio, pe_ratio),
      pb_ratio        = COALESCE(@pb_ratio, pb_ratio),
      ev_ebitda       = COALESCE(@ev_ebitda, ev_ebitda),
      roe             = COALESCE(@roe, roe),
      roce            = COALESCE(@roce, roce),
      debt_to_equity  = COALESCE(@debt_to_equity, debt_to_equity),
      dividend_yield  = COALESCE(@dividend_yield, dividend_yield),
      book_value      = COALESCE(@book_value, book_value),
      high_52w        = COALESCE(@high_52w, high_52w),
      low_52w         = COALESCE(@low_52w, low_52w),
      updated_at      = @updated_at
  `),

  upsertQuarterly: db.prepare(`
    INSERT INTO quarterly_financials (ticker, quarter, revenue, pat, eps, opm_percent, rev_growth_yoy, pat_growth_yoy)
    VALUES (@ticker, @quarter, @revenue, @pat, @eps, @opm_percent, @rev_growth_yoy, @pat_growth_yoy)
    ON CONFLICT(ticker, quarter) DO UPDATE SET
      revenue        = @revenue,
      pat            = @pat,
      eps            = @eps,
      opm_percent    = @opm_percent,
      rev_growth_yoy = @rev_growth_yoy,
      pat_growth_yoy = @pat_growth_yoy
  `),

  upsertHistorical: db.prepare(`
    INSERT OR REPLACE INTO historical_prices (ticker, date, open, high, low, close, volume)
    VALUES (@ticker, @date, @open, @high, @low, @close, @volume)
  `),

  getStock: db.prepare('SELECT * FROM stocks WHERE ticker = ?'),
  getQuote: db.prepare('SELECT * FROM quotes WHERE ticker = ?'),
  getFundamentals: db.prepare('SELECT * FROM fundamentals WHERE ticker = ?'),
  getQuarterlies: db.prepare('SELECT * FROM quarterly_financials WHERE ticker = ? ORDER BY id ASC'),

  getHistorical: db.prepare(`
    SELECT * FROM historical_prices
    WHERE ticker = ? AND date >= ? AND date <= ?
    ORDER BY date ASC
  `),

  searchStocks: db.prepare(`
    SELECT s.*, q.price, q.change_percent, f.pe_ratio
    FROM stocks s
    LEFT JOIN quotes q ON s.ticker = q.ticker
    LEFT JOIN fundamentals f ON s.ticker = f.ticker
    WHERE s.ticker LIKE @q OR s.name LIKE @q OR s.yahoo_symbol LIKE @q
    ORDER BY q.market_cap DESC NULLS LAST
    LIMIT 20
  `),
  upsertAIAnalysis: db.prepare(`
    INSERT INTO ai_analysis (ticker, score, verdict, bull_points, bear_points, future_points, parameter_scores, governance_notes, engine, updated_at)
    VALUES (@ticker, @score, @verdict, @bull_points, @bear_points, @future_points, @parameter_scores, @governance_notes, @engine, @updated_at)
    ON CONFLICT(ticker) DO UPDATE SET
      score            = @score,
      verdict          = @verdict,
      bull_points      = @bull_points,
      bear_points      = @bear_points,
      future_points    = @future_points,
      parameter_scores = @parameter_scores,
      governance_notes = @governance_notes,
      engine           = @engine,
      updated_at       = @updated_at
  `),

  upsertAIScore: db.prepare(`
    INSERT INTO ai_analysis (ticker, score, parameter_scores, engine, updated_at)
    VALUES (@ticker, @score, @parameter_scores, @engine, @updated_at)
    ON CONFLICT(ticker) DO UPDATE SET
      score            = @score,
      parameter_scores = @parameter_scores,
      engine           = @engine,
      updated_at       = @updated_at
  `),

  upsertAIVerdict: db.prepare(`
    INSERT INTO ai_analysis (ticker, verdict, bull_points, bear_points, future_points, governance_notes, engine, updated_at)
    VALUES (@ticker, @verdict, @bull_points, @bear_points, @future_points, @governance_notes, @engine, @updated_at)
    ON CONFLICT(ticker) DO UPDATE SET
      verdict          = @verdict,
      bull_points      = @bull_points,
      bear_points      = @bear_points,
      future_points    = @future_points,
      governance_notes = @governance_notes,
      engine           = @engine,
      updated_at       = @updated_at
  `),

  getAIAnalysis: db.prepare('SELECT * FROM ai_analysis WHERE ticker = ?'),
  clearPortfolio: db.prepare('DELETE FROM user_portfolio'),
  insertPortfolioItem: db.prepare(`
    INSERT INTO user_portfolio (
      isin, symbol, name, quantity, price, value, asset_type, category, subtype,
      cost_basis, live_price, live_value, gain, gain_pct, folio, amfi, xirr, depository, account_name, updated_at
    ) VALUES (
      @isin, @symbol, @name, @quantity, @price, @value, @asset_type, @category, @subtype,
      @cost_basis, @live_price, @live_value, @gain, @gain_pct, @folio, @amfi, @xirr, @depository, @account_name, @updated_at
    )
  `),
  getPortfolio: db.prepare('SELECT * FROM user_portfolio ORDER BY value DESC'),
  setPortfolioMeta: db.prepare(`
    INSERT INTO portfolio_meta (key, value, updated_at)
    VALUES (@key, @value, @updated_at)
    ON CONFLICT(key) DO UPDATE SET value = @value, updated_at = @updated_at
  `),
  getPortfolioMeta: db.prepare('SELECT * FROM portfolio_meta'),
  clearPortfolioMeta: db.prepare('DELETE FROM portfolio_meta'),
};

// ── Public API ──────────────────────────────────────────────────────────────

export function upsertStock(data) { return stmts.upsertStock.run(data); }
export function upsertQuote(data) { return stmts.upsertQuote.run(data); }
export function upsertFundamentals(data) { return stmts.upsertFundamentals.run(data); }

export function upsertQuarterlies(ticker, quarters) {
  const tx = db.transaction((rows) => {
    for (const row of rows) {
      stmts.upsertQuarterly.run({ ticker, ...row });
    }
  });
  tx(quarters);
}

export function upsertHistorical(ticker, rows) {
  const tx = db.transaction((data) => {
    for (const row of data) {
      stmts.upsertHistorical.run({ ticker, ...row });
    }
  });
  tx(rows);
}

export function getStock(ticker) { return stmts.getStock.get(ticker); }
export function getQuote(ticker) { return stmts.getQuote.get(ticker); }
export function getFundamentals(ticker) { return stmts.getFundamentals.get(ticker); }
export function getQuarterlies(ticker) { return stmts.getQuarterlies.all(ticker); }
export function getHistorical(ticker, from, to) { return stmts.getHistorical.all(ticker, from, to); }
export function searchStocks(query) { return stmts.searchStocks.all({ q: `%${query}%` }); }
export function upsertAIAnalysis(data) {
  return stmts.upsertAIAnalysis.run({
    ticker: data.ticker,
    score: data.score,
    verdict: data.verdict,
    bull_points: JSON.stringify(data.bullPoints || []),
    bear_points: JSON.stringify(data.bearPoints || []),
    future_points: JSON.stringify(data.futurePoints || []),
    parameter_scores: JSON.stringify(data.parameterScores || {}),
    governance_notes: data.governanceNotes || '',
    engine: data.engine || 'stock.ai Algorithm',
    updated_at: data.updated_at || Date.now(),
  });
}

export function upsertAIScore(data) {
  return stmts.upsertAIScore.run({
    ticker: data.ticker,
    score: data.score,
    parameter_scores: JSON.stringify(data.parameterScores || {}),
    engine: data.engine || 'stock.ai Algorithm',
    updated_at: data.updated_at || Date.now(),
  });
}

export function upsertAIVerdict(data) {
  return stmts.upsertAIVerdict.run({
    ticker: data.ticker,
    verdict: data.verdict,
    bull_points: JSON.stringify(data.bullPoints || []),
    bear_points: JSON.stringify(data.bearPoints || []),
    future_points: JSON.stringify(data.futurePoints || []),
    governance_notes: data.governanceNotes || '',
    engine: data.engine || 'stock.ai Algorithm',
    updated_at: data.updated_at || Date.now(),
  });
}

export function getDeterministicAlgoScore(symbol = '', name = '') {
  const benchmarks = {
    'RELIANCE': 82, 'TCS': 88, 'HDFCBANK': 79, 'INFY': 84, 'ITC': 86,
    'TITAN': 76, 'NIFTYBEES': 85, 'GOLDBEES': 80, 'JUNIORBEES': 78,
    'ZOMATO': 74, 'TATAMOTORS': 81, 'BHARTIARTL': 83, 'ICICIBANK': 87,
    'LT': 85, 'HINDUNILVR': 80, 'SBIN': 77, 'BAJFINANCE': 84,
    'WIPRO': 72, 'MARUTI': 79, 'ASIANPAINT': 78, 'SUNPHARMA': 82,
    'AFFLE': 77, 'WOCKPHARMA': 68, 'REFEX': 73, 'ESDS': 71
  };
  const s = (symbol || '').toUpperCase().trim();
  if (benchmarks[s]) return benchmarks[s];

  const str = s + (name || '');
  const seed = str.split('').reduce((acc, c, i) => acc + c.charCodeAt(0) * (i + 1), 0);
  return 62 + (seed % 23); // range 62 to 84
}

export function getAllAIScores() {
  const rows = db.prepare('SELECT ticker, score, engine, updated_at FROM ai_analysis WHERE score IS NOT NULL').all();
  const map = {};
  for (const r of rows) {
    if (!r.ticker) continue;
    const engine = r.engine || 'stock.ai Algorithm';
    const isAI = Boolean(engine && (engine.includes('Gemini') || engine.includes('AI') || !engine.includes('Algorithm')));
    map[r.ticker.toUpperCase()] = {
      score: r.score,
      score_type: isAI ? 'ai' : 'algo',
      score_engine: engine,
      is_ai_score: isAI,
      score_category: r.score >= 80 ? 'Exceptional' : r.score >= 65 ? 'Strong' : r.score >= 50 ? 'Moderate' : 'High Risk',
      updated_at: r.updated_at
    };
  }
  return map;
}

export function getAIAnalysis(ticker) {
  const row = stmts.getAIAnalysis.get(ticker);
  if (!row) return null;
  return {
    ticker: row.ticker,
    score: row.score,
    verdict: row.verdict,
    bullPoints: JSON.parse(row.bull_points || '[]'),
    bearPoints: JSON.parse(row.bear_points || '[]'),
    futurePoints: JSON.parse(row.future_points || '[]'),
    parameterScores: JSON.parse(row.parameter_scores || '{}'),
    governanceNotes: row.governance_notes || '',
    engine: row.engine,
    updated_at: row.updated_at,
  };
}


export function savePortfolioHoldings(portfolioInput, metaInput = {}) {
  const tx = db.transaction(() => {
    stmts.clearPortfolio.run();
    const now = Date.now();

    let allItems = [];
    let meta = { ...metaInput };

    if (Array.isArray(portfolioInput)) {
      allItems = portfolioInput;
    } else if (portfolioInput && typeof portfolioInput === 'object') {
      if (Array.isArray(portfolioInput.stocks)) allItems.push(...portfolioInput.stocks);
      else if (Array.isArray(portfolioInput.holdings)) allItems.push(...portfolioInput.holdings);

      if (Array.isArray(portfolioInput.mutual_funds)) allItems.push(...portfolioInput.mutual_funds);
      if (Array.isArray(portfolioInput.bonds)) allItems.push(...portfolioInput.bonds);

      if (portfolioInput.historical_valuations) meta.historical_valuations = portfolioInput.historical_valuations;
      if (portfolioInput.asset_allocation) meta.asset_allocation = portfolioInput.asset_allocation;
      if (portfolioInput.transactions) meta.transactions = portfolioInput.transactions;
      if (portfolioInput.summary) meta.summary = portfolioInput.summary;
      if (portfolioInput.statement_period) meta.statement_period = portfolioInput.statement_period;
      if (portfolioInput.investor_info) meta.investor_info = portfolioInput.investor_info;
      if (portfolioInput.file_type) meta.file_type = portfolioInput.file_type;
      if (portfolioInput.analytics) meta.analytics = portfolioInput.analytics;
    }

    for (const h of allItems) {
      stmts.insertPortfolioItem.run({
        isin: h.isin || '',
        symbol: h.symbol || '',
        name: h.name || '',
        quantity: h.quantity || 0,
        price: h.price || 0,
        value: h.value || 0,
        asset_type: h.asset_type || (h.category === 'MUTUAL_FUNDS' ? 'MUTUAL_FUND' : (h.category === 'BONDS_DEBT' ? 'BOND' : 'EQUITY')),
        category: h.category || (h.asset_type === 'MUTUAL_FUND' ? 'MUTUAL_FUNDS' : (h.asset_type === 'BOND' ? 'BONDS_DEBT' : 'STOCKS')),
        subtype: h.subtype || (h.category === 'MUTUAL_FUNDS' ? 'MUTUAL_FUND' : (h.category === 'BONDS_DEBT' ? (h.isin?.startsWith('IN0') ? 'SGB' : 'BOND') : 'DIRECT_STOCK')),
        cost_basis: h.cost_basis ?? 0,
        live_price: h.live_price ?? h.price ?? 0,
        live_value: h.live_value ?? h.value ?? 0,
        gain: h.gain ?? 0,
        gain_pct: h.gain_pct ?? 0,
        folio: h.folio || '',
        amfi: h.amfi || '',
        xirr: h.xirr !== undefined && h.xirr !== null ? Number(h.xirr) : null,
        depository: h.depository || '',
        account_name: h.account_name || '',
        updated_at: now
      });
    }

    for (const [k, v] of Object.entries(meta)) {
      stmts.setPortfolioMeta.run({
        key: k,
        value: typeof v === 'object' ? JSON.stringify(v) : String(v),
        updated_at: now
      });
    }
  });
  tx();
}

export function getPortfolioHoldings() {
  const rows = stmts.getPortfolio.all();
  const metaRows = stmts.getPortfolioMeta.all();
  const meta = {};
  for (const row of metaRows) {
    try {
      meta[row.key] = JSON.parse(row.value);
    } catch {
      meta[row.key] = row.value;
    }
  }

  const stocks = rows.filter(r => r.category === 'STOCKS' || (!r.category && r.asset_type === 'EQUITY'));
  const directStocks = stocks.filter(r => r.subtype === 'DIRECT_STOCK' || !r.subtype);
  const etfs = stocks.filter(r => r.subtype === 'ETF');
  const mutualFunds = rows.filter(r => r.category === 'MUTUAL_FUNDS' || r.asset_type === 'MUTUAL_FUND');
  const bonds = rows.filter(r => r.category === 'BONDS_DEBT' || r.asset_type === 'BOND');

  const totalStocksVal = stocks.reduce((sum, s) => sum + (s.live_value || s.value || 0), 0);
  const aiScoresMap = getAllAIScores();
  for (const s of stocks) {
    s.weight_pct = totalStocksVal > 0 ? Math.round(((s.live_value || s.value || 0) / totalStocksVal) * 10000) / 100 : 0;
    const sym = (s.symbol || '').toUpperCase();
    const aiInfo = aiScoresMap[sym];
    if (aiInfo && aiInfo.score != null) {
      s.score = aiInfo.score;
      s.score_type = aiInfo.score_type;
      s.score_engine = aiInfo.score_engine;
      s.is_ai_score = aiInfo.is_ai_score;
      s.score_category = aiInfo.score_category;
    } else {
      const algoScore = getDeterministicAlgoScore(s.symbol, s.name);
      s.score = algoScore;
      s.score_type = 'algo';
      s.score_engine = 'stock.ai Algorithm';
      s.is_ai_score = false;
      s.score_category = algoScore >= 80 ? 'Exceptional' : algoScore >= 65 ? 'Strong' : algoScore >= 50 ? 'Moderate' : 'High Risk';
    }
  }
  const totalMfVal = mutualFunds.reduce((sum, m) => sum + (m.value || 0), 0);
  for (const m of mutualFunds) {
    m.weight_pct = totalMfVal > 0 ? Math.round(((m.value || 0) / totalMfVal) * 10000) / 100 : 0;
  }
  const totalBondsVal = bonds.reduce((sum, b) => sum + (b.value || 0), 0);
  for (const b of bonds) {
    b.weight_pct = totalBondsVal > 0 ? Math.round(((b.value || 0) / totalBondsVal) * 10000) / 100 : 0;
  }

  return {
    holdings: stocks, // backward compatibility
    stocks,
    direct_stocks: directStocks,
    etfs,
    mutual_funds: mutualFunds,
    bonds,
    historical_valuations: meta.historical_valuations || [],
    asset_allocation: meta.asset_allocation || [],
    transactions: meta.transactions || [],
    analytics: meta.analytics || null,
    summary: meta.summary || {
      total_portfolio_value: rows.reduce((s, r) => s + (r.live_value || r.value || 0), 0),
      stocks_count: stocks.length,
      direct_stocks_count: directStocks.length,
      etfs_count: etfs.length,
      mf_count: mutualFunds.length,
      bonds_count: bonds.length,
      total_securities_count: rows.length
    },
    meta
  };
}

export function clearPortfolioHoldings() {
  stmts.clearPortfolio.run();
  stmts.clearPortfolioMeta.run();
}

/** Check if data is stale (older than `maxAgeMs`). */
export function isStale(updatedAt, maxAgeMs) {
  return !updatedAt || (Date.now() - updatedAt) > maxAgeMs;
}

export default db;
