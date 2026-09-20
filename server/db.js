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
    ticker      TEXT PRIMARY KEY,
    score       INTEGER,
    verdict     TEXT,
    bull_points TEXT,
    bear_points TEXT,
    engine      TEXT,
    updated_at  INTEGER NOT NULL DEFAULT 0
  );
`);

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
    INSERT INTO ai_analysis (ticker, score, verdict, bull_points, bear_points, engine, updated_at)
    VALUES (@ticker, @score, @verdict, @bull_points, @bear_points, @engine, @updated_at)
    ON CONFLICT(ticker) DO UPDATE SET
      score       = @score,
      verdict     = @verdict,
      bull_points = @bull_points,
      bear_points = @bear_points,
      engine      = @engine,
      updated_at  = @updated_at
  `),

  getAIAnalysis: db.prepare('SELECT * FROM ai_analysis WHERE ticker = ?'),
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
    engine: data.engine || 'stock.ai Algorithm',
    updated_at: data.updated_at || Date.now(),
  });
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
    engine: row.engine,
    updated_at: row.updated_at,
  };
}


/** Check if data is stale (older than `maxAgeMs`). */
export function isStale(updatedAt, maxAgeMs) {
  return !updatedAt || (Date.now() - updatedAt) > maxAgeMs;
}

export default db;
