import express from 'express';
import os from 'os';
import fs from 'fs';
import path, { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import db from '../db.js';
import QRCode from 'qrcode';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', '..', 'equisense.db');
const PROJECT_ROOT = join(__dirname, '..', '..');

const router = express.Router();

/**
 * Collect all active, non-internal IPv4 addresses of this host.
 */
function getLocalIps() {
  const nets = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      const familyV4 = typeof net.family === 'string' ? 'IPv4' : 4;
      if (net.family === familyV4 && !net.internal) {
        ips.push(net.address);
      }
    }
  }
  return ips.length > 0 ? ips : ['127.0.0.1'];
}

/**
 * Helper to compute the latest updated_at timestamp across core tables.
 */
function getLatestTimestamp() {
  try {
    const row = db.prepare(`
      SELECT MAX(m) as max_ts FROM (
        SELECT MAX(updated_at) as m FROM user_portfolio
        UNION ALL
        SELECT MAX(updated_at) as m FROM portfolio_meta
        UNION ALL
        SELECT MAX(updated_at) as m FROM ai_analysis
        UNION ALL
        SELECT MAX(updated_at) as m FROM stocks
        UNION ALL
        SELECT MAX(updated_at) as m FROM quotes
      )
    `).get();
    return row?.max_ts || Date.now();
  } catch {
    return Date.now();
  }
}

/**
 * Helper to calculate row counts across tables and portfolio collections.
 */
function getTableCounts() {
  const safeCount = (table, where = '') => {
    try {
      const query = where ? `SELECT COUNT(*) as c FROM ${table} WHERE ${where}` : `SELECT COUNT(*) as c FROM ${table}`;
      return db.prepare(query).get()?.c || 0;
    } catch {
      return 0;
    }
  };

  const stocksCount = safeCount('stocks');
  const quotesCount = safeCount('quotes');
  const fundamentalsCount = safeCount('fundamentals');
  const quarterlyCount = safeCount('quarterly_financials');
  const historicalCount = safeCount('historical_prices');
  const aiCount = safeCount('ai_analysis');
  const totalPortfolioCount = safeCount('user_portfolio');
  const holdingsCount = safeCount('user_portfolio', "category = 'STOCKS' OR (category IS NULL AND (asset_type = 'EQUITY' OR asset_type IS NULL))");
  const mfCount = safeCount('user_portfolio', "category = 'MUTUAL_FUNDS' OR asset_type = 'MUTUAL_FUND'");
  const bondsCount = safeCount('user_portfolio', "category = 'BONDS_DEBT' OR asset_type = 'BOND'");

  let bankCount = 0;
  let epfoCount = 0;
  let watchlistCount = 0;

  try {
    const row = db.prepare("SELECT value FROM portfolio_meta WHERE key = 'bank_accounts'").get();
    if (row?.value) {
      const parsed = JSON.parse(row.value);
      if (Array.isArray(parsed)) bankCount = parsed.length;
    }
  } catch {}

  try {
    const row = db.prepare("SELECT value FROM portfolio_meta WHERE key = 'epfo_accounts'").get();
    if (row?.value) {
      const parsed = JSON.parse(row.value);
      if (Array.isArray(parsed)) epfoCount = parsed.length;
    }
  } catch {}

  try {
    const row = db.prepare("SELECT value FROM portfolio_meta WHERE key = 'watchlist' OR key = 'stock_ai_watchlist'").get();
    if (row?.value) {
      const parsed = JSON.parse(row.value);
      if (Array.isArray(parsed)) watchlistCount = parsed.length;
    }
  } catch {}

  return {
    holdings: holdingsCount || totalPortfolioCount,
    portfolio_holdings: holdingsCount || totalPortfolioCount,
    total_portfolio: totalPortfolioCount,
    mutual_funds: mfCount,
    bonds: bondsCount,
    watchlist: watchlistCount,
    ai_analysis: aiCount,
    bank: bankCount,
    epfo: epfoCount,
    stocks: stocksCount,
    quotes: quotesCount,
    fundamentals: fundamentalsCount,
    quarterly_financials: quarterlyCount,
    historical_prices: historicalCount,
  };
}

/**
 * GET /api/sync/status
 * Return local device metadata, IP addresses, sync protocol version,
 * last update timestamp, and row counts of all datasets.
 */
router.get('/status', (req, res) => {
  try {
    const ips = getLocalIps();
    const port = Number(process.env.PORT || 3001);
    const primaryIp = ips[0] || '127.0.0.1';
    const pairingUrl = `http://${primaryIp}:${port}`;
    const lastUpdated = getLatestTimestamp();
    const counts = getTableCounts();

    res.json({
      success: true,
      device: 'equisense-web',
      hostname: os.hostname(),
      ips,
      port,
      pairing_url: pairingUrl,
      version: '1.0',
      protocol_version: '1.0',
      last_updated: lastUpdated,
      updated_at: lastUpdated,
      counts,
      row_counts: counts,
    });
  } catch (err) {
    console.error('Sync status error:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve sync status: ' + err.message });
  }
});

/**
 * GET /api/sync/export
 * Return JSON export containing all tables and datasets.
 */
router.get('/export', (req, res) => {
  try {
    const userPortfolio = db.prepare('SELECT * FROM user_portfolio').all();
    const portfolioMeta = db.prepare('SELECT * FROM portfolio_meta').all();
    const aiAnalysis = db.prepare('SELECT * FROM ai_analysis').all();
    const stocks = db.prepare('SELECT * FROM stocks').all();
    const quotes = db.prepare('SELECT * FROM quotes').all();
    const fundamentals = db.prepare('SELECT * FROM fundamentals').all();
    const quarterlyFinancials = db.prepare('SELECT * FROM quarterly_financials').all();
    const historicalPrices = db.prepare('SELECT * FROM historical_prices').all();

    // Parse bank_accounts, epfo_accounts, and spend_transactions from portfolio_meta
    let bankAccounts = [];
    let epfoAccounts = [];
    let spendTransactions = [];

    for (const meta of portfolioMeta) {
      if (meta.key === 'bank_accounts') {
        try {
          const parsed = JSON.parse(meta.value);
          if (Array.isArray(parsed)) bankAccounts = parsed;
        } catch {}
      } else if (meta.key === 'epfo_accounts') {
        try {
          const parsed = JSON.parse(meta.value);
          if (Array.isArray(parsed)) epfoAccounts = parsed;
        } catch {}
      } else if (meta.key === 'spend_transactions' || meta.key === 'transactions') {
        try {
          const parsed = JSON.parse(meta.value);
          if (Array.isArray(parsed)) spendTransactions.push(...parsed);
        } catch {}
      }
    }

    // Extract embedded transactions from bank accounts if not present
    if (spendTransactions.length === 0 && bankAccounts.length > 0) {
      for (const acc of bankAccounts) {
        if (Array.isArray(acc.transactions)) {
          for (const tx of acc.transactions) {
            spendTransactions.push({
              ...tx,
              account_number: acc.account_number,
              bank_name: acc.bank_name,
            });
          }
        }
      }
    }

    const exportedAt = Date.now();
    const payload = {
      user_portfolio: userPortfolio,
      portfolio_meta: portfolioMeta,
      ai_analysis: aiAnalysis,
      stocks,
      quotes,
      fundamentals,
      quarterly_financials: quarterlyFinancials,
      historical_prices: historicalPrices,
      bank_accounts: bankAccounts,
      epfo_accounts: epfoAccounts,
      spend_transactions: spendTransactions,
    };

    res.json({
      success: true,
      version: '1.0',
      protocol_version: '1.0',
      exported_at: exportedAt,
      timestamp: exportedAt,
      device: 'equisense-web',
      data: payload,
      ...payload, // flat tables for top-level access compatibility
    });
  } catch (err) {
    console.error('Sync export error:', err);
    res.status(500).json({ success: false, error: 'Failed to export sync data: ' + err.message });
  }
});

/**
 * GET /api/sync/qr
 * Generates pairing QR code data URL or SVG for quick connection.
 */
router.get('/qr', async (req, res) => {
  try {
    const ips = getLocalIps();
    const port = Number(process.env.PORT || 3001);
    const pairingUrl = `http://${ips[0] || '127.0.0.1'}:${port}`;
    const format = req.query.format || 'json';

    if (format === 'svg') {
      const svg = await QRCode.toString(pairingUrl, { type: 'svg', margin: 2 });
      res.setHeader('Content-Type', 'image/svg+xml');
      return res.send(svg);
    }

    const dataUrl = await QRCode.toDataURL(pairingUrl, { margin: 2, scale: 6 });
    res.json({
      success: true,
      pairing_url: pairingUrl,
      qr_data_url: dataUrl,
    });
  } catch (err) {
    console.error('QR code generation error:', err);
    res.status(500).json({ success: false, error: 'Failed to generate QR code: ' + err.message });
  }
});

/**
 * POST /api/sync/import
 * Accept { mode: 'merge' | 'replace', data: { ... } }
 * Creates safety backup before any write operation.
 */
router.post('/import', async (req, res) => {
  const mode = req.body?.mode === 'replace' ? 'replace' : 'merge';
  const incomingData = req.body?.data || req.body;

  if (!incomingData || typeof incomingData !== 'object') {
    return res.status(400).json({ success: false, error: 'Invalid sync payload. Missing data object.' });
  }

  // Normalize data tables from possible envelope structures
  const tables = {
    user_portfolio: incomingData.user_portfolio || incomingData.holdings || [],
    portfolio_meta: incomingData.portfolio_meta || [],
    ai_analysis: incomingData.ai_analysis || [],
    stocks: incomingData.stocks || [],
    quotes: incomingData.quotes || [],
    fundamentals: incomingData.fundamentals || [],
    quarterly_financials: incomingData.quarterly_financials || [],
    historical_prices: incomingData.historical_prices || [],
    bank_accounts: incomingData.bank_accounts || [],
    epfo_accounts: incomingData.epfo_accounts || [],
    spend_transactions: incomingData.spend_transactions || [],
  };

  // Step 1: ALWAYS create a safety backup of equisense.db before applying changes
  const backupFileName = `equisense.db.pre-sync-${Date.now()}.bak`;
  const backupPath = join(PROJECT_ROOT, backupFileName);

  try {
    if (fs.existsSync(DB_PATH)) {
      try {
        await db.backup(backupPath);
      } catch (backupErr) {
        console.warn('db.backup failed, falling back to fs.copyFileSync:', backupErr.message);
        fs.copyFileSync(DB_PATH, backupPath);
      }

      if (!fs.existsSync(backupPath) || fs.statSync(backupPath).size === 0) {
        throw new Error('Safety backup file was not created or is empty');
      }
      console.log(`[Sync] Safety backup successfully created at: ${backupPath}`);
    }
  } catch (backupErr) {
    console.error('[Sync] Safety backup failed:', backupErr);
    return res.status(500).json({
      success: false,
      error: `Failed to create safety backup copy: ${backupErr.message}. Aborting import for data integrity.`,
    });
  }

  // Step 2: Database transaction execution
  try {
    const importTransaction = db.transaction((currentMode) => {
      // Prepared statements for upserts
      const upsertStockStmt = db.prepare(`
        INSERT INTO stocks (ticker, yahoo_symbol, name, exchange, sector, industry, updated_at)
        VALUES (@ticker, @yahoo_symbol, @name, @exchange, @sector, @industry, @updated_at)
        ON CONFLICT(ticker) DO UPDATE SET
          yahoo_symbol = COALESCE(@yahoo_symbol, stocks.yahoo_symbol),
          name         = COALESCE(@name, stocks.name),
          exchange     = COALESCE(@exchange, stocks.exchange),
          sector       = COALESCE(@sector, stocks.sector),
          industry     = COALESCE(@industry, stocks.industry),
          updated_at   = @updated_at
      `);

      const upsertQuoteStmt = db.prepare(`
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
      `);

      const upsertFundamentalsStmt = db.prepare(`
        INSERT INTO fundamentals (ticker, pe_ratio, pb_ratio, ev_ebitda, roe, roce, debt_to_equity, dividend_yield, book_value, high_52w, low_52w, updated_at)
        VALUES (@ticker, @pe_ratio, @pb_ratio, @ev_ebitda, @roe, @roce, @debt_to_equity, @dividend_yield, @book_value, @high_52w, @low_52w, @updated_at)
        ON CONFLICT(ticker) DO UPDATE SET
          pe_ratio       = COALESCE(@pe_ratio, fundamentals.pe_ratio),
          pb_ratio       = COALESCE(@pb_ratio, fundamentals.pb_ratio),
          ev_ebitda      = COALESCE(@ev_ebitda, fundamentals.ev_ebitda),
          roe            = COALESCE(@roe, fundamentals.roe),
          roce           = COALESCE(@roce, fundamentals.roce),
          debt_to_equity = COALESCE(@debt_to_equity, fundamentals.debt_to_equity),
          dividend_yield = COALESCE(@dividend_yield, fundamentals.dividend_yield),
          book_value     = COALESCE(@book_value, fundamentals.book_value),
          high_52w       = COALESCE(@high_52w, fundamentals.high_52w),
          low_52w        = COALESCE(@low_52w, fundamentals.low_52w),
          updated_at     = @updated_at
      `);

      const upsertQuarterlyStmt = db.prepare(`
        INSERT INTO quarterly_financials (ticker, quarter, revenue, pat, eps, opm_percent, rev_growth_yoy, pat_growth_yoy)
        VALUES (@ticker, @quarter, @revenue, @pat, @eps, @opm_percent, @rev_growth_yoy, @pat_growth_yoy)
        ON CONFLICT(ticker, quarter) DO UPDATE SET
          revenue        = @revenue,
          pat            = @pat,
          eps            = @eps,
          opm_percent    = @opm_percent,
          rev_growth_yoy = @rev_growth_yoy,
          pat_growth_yoy = @pat_growth_yoy
      `);

      const upsertHistoricalStmt = db.prepare(`
        INSERT OR REPLACE INTO historical_prices (ticker, date, open, high, low, close, volume)
        VALUES (@ticker, @date, @open, @high, @low, @close, @volume)
      `);

      const upsertAiAnalysisStmt = db.prepare(`
        INSERT INTO ai_analysis (
          ticker, score, verdict, bull_points, bear_points, future_points, parameter_scores, governance_notes,
          engine, story, story_tags, story_end_markets, story_what_they_do, story_engine, updated_at
        ) VALUES (
          @ticker, @score, @verdict, @bull_points, @bear_points, @future_points, @parameter_scores, @governance_notes,
          @engine, @story, @story_tags, @story_end_markets, @story_what_they_do, @story_engine, @updated_at
        )
        ON CONFLICT(ticker) DO UPDATE SET
          score            = @score,
          verdict          = @verdict,
          bull_points      = @bull_points,
          bear_points      = @bear_points,
          future_points    = @future_points,
          parameter_scores = @parameter_scores,
          governance_notes = @governance_notes,
          engine           = @engine,
          story            = COALESCE(@story, ai_analysis.story),
          story_tags       = COALESCE(@story_tags, ai_analysis.story_tags),
          story_end_markets = COALESCE(@story_end_markets, ai_analysis.story_end_markets),
          story_what_they_do = COALESCE(@story_what_they_do, ai_analysis.story_what_they_do),
          story_engine     = COALESCE(@story_engine, ai_analysis.story_engine),
          updated_at       = @updated_at
      `);

      const insertPortfolioStmt = db.prepare(`
        INSERT INTO user_portfolio (
          isin, symbol, name, quantity, price, value, asset_type, category, subtype,
          cost_basis, live_price, live_value, gain, gain_pct, folio, amfi, xirr, depository, account_name, updated_at
        ) VALUES (
          @isin, @symbol, @name, @quantity, @price, @value, @asset_type, @category, @subtype,
          @cost_basis, @live_price, @live_value, @gain, @gain_pct, @folio, @amfi, @xirr, @depository, @account_name, @updated_at
        )
      `);

      const updatePortfolioStmt = db.prepare(`
        UPDATE user_portfolio SET
          isin         = @isin,
          symbol       = @symbol,
          name         = @name,
          quantity     = @quantity,
          price        = @price,
          value        = @value,
          asset_type   = @asset_type,
          category     = @category,
          subtype      = @subtype,
          cost_basis   = @cost_basis,
          live_price   = @live_price,
          live_value   = @live_value,
          gain         = @gain,
          gain_pct     = @gain_pct,
          folio        = @folio,
          amfi         = @amfi,
          xirr         = @xirr,
          depository   = @depository,
          account_name = @account_name,
          updated_at   = @updated_at
        WHERE id = @id
      `);

      const upsertMetaStmt = db.prepare(`
        INSERT INTO portfolio_meta (key, value, updated_at)
        VALUES (@key, @value, @updated_at)
        ON CONFLICT(key) DO UPDATE SET
          value      = @value,
          updated_at = @updated_at
      `);

      // ── REPLACE MODE ──────────────────────────────────────────────────────────
      if (currentMode === 'replace') {
        // Clear child and parent tables in safe order
        db.prepare('DELETE FROM quarterly_financials').run();
        db.prepare('DELETE FROM historical_prices').run();
        db.prepare('DELETE FROM quotes').run();
        db.prepare('DELETE FROM fundamentals').run();
        db.prepare('DELETE FROM stocks').run();
        db.prepare('DELETE FROM ai_analysis').run();
        db.prepare('DELETE FROM user_portfolio').run();
        db.prepare('DELETE FROM portfolio_meta').run();

        // 1. Insert stocks
        if (Array.isArray(tables.stocks)) {
          for (const s of tables.stocks) {
            upsertStockStmt.run({
              ticker: s.ticker,
              yahoo_symbol: s.yahoo_symbol ?? s.yahooSymbol ?? null,
              name: s.name ?? null,
              exchange: s.exchange ?? null,
              sector: s.sector ?? null,
              industry: s.industry ?? null,
              updated_at: s.updated_at ?? s.updatedAt ?? Date.now(),
            });
          }
        }

        // 2. Insert quotes
        if (Array.isArray(tables.quotes)) {
          for (const q of tables.quotes) {
            upsertQuoteStmt.run({
              ticker: q.ticker,
              price: q.price ?? null,
              change: q.change ?? null,
              change_percent: q.change_percent ?? q.changePercent ?? null,
              prev_close: q.prev_close ?? q.prevClose ?? null,
              open: q.open ?? null,
              day_high: q.day_high ?? q.dayHigh ?? null,
              day_low: q.day_low ?? q.dayLow ?? null,
              volume: q.volume ?? null,
              market_cap: q.market_cap ?? q.marketCap ?? null,
              updated_at: q.updated_at ?? q.updatedAt ?? Date.now(),
            });
          }
        }

        // 3. Insert fundamentals
        if (Array.isArray(tables.fundamentals)) {
          for (const f of tables.fundamentals) {
            upsertFundamentalsStmt.run({
              ticker: f.ticker,
              pe_ratio: f.pe_ratio ?? f.peRatio ?? null,
              pb_ratio: f.pb_ratio ?? f.pbRatio ?? null,
              ev_ebitda: f.ev_ebitda ?? f.evEbitda ?? null,
              roe: f.roe ?? null,
              roce: f.roce ?? null,
              debt_to_equity: f.debt_to_equity ?? f.debtToEquity ?? null,
              dividend_yield: f.dividend_yield ?? f.dividendYield ?? null,
              book_value: f.book_value ?? f.bookValue ?? null,
              high_52w: f.high_52w ?? f.high52w ?? null,
              low_52w: f.low_52w ?? f.low52w ?? null,
              updated_at: f.updated_at ?? f.updatedAt ?? Date.now(),
            });
          }
        }

        // 4. Insert quarterly financials
        if (Array.isArray(tables.quarterly_financials)) {
          for (const qf of tables.quarterly_financials) {
            upsertQuarterlyStmt.run({
              ticker: qf.ticker,
              quarter: qf.quarter,
              revenue: qf.revenue ?? null,
              pat: qf.pat ?? null,
              eps: qf.eps ?? null,
              opm_percent: qf.opm_percent ?? qf.opmPercent ?? null,
              rev_growth_yoy: qf.rev_growth_yoy ?? qf.revGrowthYoy ?? null,
              pat_growth_yoy: qf.pat_growth_yoy ?? qf.patGrowthYoy ?? null,
            });
          }
        }

        // 5. Insert historical prices
        if (Array.isArray(tables.historical_prices)) {
          for (const hp of tables.historical_prices) {
            upsertHistoricalStmt.run({
              ticker: hp.ticker,
              date: hp.date,
              open: hp.open ?? null,
              high: hp.high ?? null,
              low: hp.low ?? null,
              close: hp.close ?? null,
              volume: hp.volume ?? null,
            });
          }
        }

        // 6. Insert AI analysis
        if (Array.isArray(tables.ai_analysis)) {
          for (const ai of tables.ai_analysis) {
            upsertAiAnalysisStmt.run({
              ticker: ai.ticker,
              score: ai.score ?? null,
              verdict: ai.verdict ?? null,
              bull_points: typeof ai.bull_points === 'string' ? ai.bull_points : JSON.stringify(ai.bull_points ?? ai.bullPoints ?? []),
              bear_points: typeof ai.bear_points === 'string' ? ai.bear_points : JSON.stringify(ai.bear_points ?? ai.bearPoints ?? []),
              future_points: typeof ai.future_points === 'string' ? ai.future_points : JSON.stringify(ai.future_points ?? ai.futurePoints ?? []),
              parameter_scores: typeof ai.parameter_scores === 'string' ? ai.parameter_scores : JSON.stringify(ai.parameter_scores ?? ai.parameterScores ?? {}),
              governance_notes: ai.governance_notes ?? ai.governanceNotes ?? null,
              engine: ai.engine ?? null,
              story: ai.story ?? null,
              story_tags: typeof ai.story_tags === 'string' ? ai.story_tags : JSON.stringify(ai.story_tags ?? ai.storyTags ?? []),
              story_end_markets: typeof ai.story_end_markets === 'string' ? ai.story_end_markets : JSON.stringify(ai.story_end_markets ?? ai.storyEndMarkets ?? []),
              story_what_they_do: typeof ai.story_what_they_do === 'string' ? ai.story_what_they_do : JSON.stringify(ai.story_what_they_do ?? ai.storyWhatTheyDo ?? []),
              story_engine: ai.story_engine ?? ai.storyEngine ?? null,
              updated_at: ai.updated_at ?? ai.updatedAt ?? Date.now(),
            });
          }
        }

        // 7. Insert user portfolio
        if (Array.isArray(tables.user_portfolio)) {
          for (const p of tables.user_portfolio) {
            insertPortfolioStmt.run({
              isin: p.isin ?? '',
              symbol: p.symbol ?? '',
              name: p.name ?? '',
              quantity: p.quantity ?? 0,
              price: p.price ?? 0,
              value: p.value ?? 0,
              asset_type: p.asset_type ?? p.assetType ?? 'EQUITY',
              category: p.category ?? (p.asset_type === 'MUTUAL_FUND' ? 'MUTUAL_FUNDS' : (p.asset_type === 'BOND' ? 'BONDS_DEBT' : 'STOCKS')),
              subtype: p.subtype ?? 'DIRECT_STOCK',
              cost_basis: p.cost_basis ?? p.costBasis ?? 0,
              live_price: p.live_price ?? p.livePrice ?? p.price ?? 0,
              live_value: p.live_value ?? p.liveValue ?? p.value ?? 0,
              gain: p.gain ?? 0,
              gain_pct: p.gain_pct ?? p.gainPct ?? 0,
              folio: p.folio ?? '',
              amfi: p.amfi ?? '',
              xirr: p.xirr != null ? Number(p.xirr) : null,
              depository: p.depository ?? '',
              account_name: p.account_name ?? p.accountName ?? '',
              updated_at: p.updated_at ?? p.updatedAt ?? Date.now(),
            });
          }
        }

        // 8. Insert portfolio meta
        const metaMap = new Map();
        if (Array.isArray(tables.portfolio_meta)) {
          for (const m of tables.portfolio_meta) {
            metaMap.set(m.key, {
              key: m.key,
              value: typeof m.value === 'object' ? JSON.stringify(m.value) : String(m.value),
              updated_at: m.updated_at ?? m.updatedAt ?? Date.now(),
            });
          }
        }

        // If bank_accounts, epfo_accounts or spend_transactions were passed as separate lists
        if (Array.isArray(tables.bank_accounts) && tables.bank_accounts.length > 0 && !metaMap.has('bank_accounts')) {
          metaMap.set('bank_accounts', {
            key: 'bank_accounts',
            value: JSON.stringify(tables.bank_accounts),
            updated_at: Date.now(),
          });
        }
        if (Array.isArray(tables.epfo_accounts) && tables.epfo_accounts.length > 0 && !metaMap.has('epfo_accounts')) {
          metaMap.set('epfo_accounts', {
            key: 'epfo_accounts',
            value: JSON.stringify(tables.epfo_accounts),
            updated_at: Date.now(),
          });
        }
        if (Array.isArray(tables.spend_transactions) && tables.spend_transactions.length > 0 && !metaMap.has('spend_transactions')) {
          metaMap.set('spend_transactions', {
            key: 'spend_transactions',
            value: JSON.stringify(tables.spend_transactions),
            updated_at: Date.now(),
          });
        }

        for (const meta of metaMap.values()) {
          upsertMetaStmt.run(meta);
        }

        return;
      }

      // ── MERGE MODE (Smart Merge with Last-Write-Wins based on updated_at) ───
      // 1. Stocks merge
      if (Array.isArray(tables.stocks)) {
        for (const s of tables.stocks) {
          const sUpdated = s.updated_at ?? s.updatedAt ?? Date.now();
          const existing = db.prepare('SELECT updated_at FROM stocks WHERE ticker = ?').get(s.ticker);
          if (!existing || sUpdated >= (existing.updated_at || 0)) {
            upsertStockStmt.run({
              ticker: s.ticker,
              yahoo_symbol: s.yahoo_symbol ?? s.yahooSymbol ?? null,
              name: s.name ?? null,
              exchange: s.exchange ?? null,
              sector: s.sector ?? null,
              industry: s.industry ?? null,
              updated_at: sUpdated,
            });
          }
        }
      }

      // 2. Quotes merge
      if (Array.isArray(tables.quotes)) {
        for (const q of tables.quotes) {
          const qUpdated = q.updated_at ?? q.updatedAt ?? Date.now();
          const existing = db.prepare('SELECT updated_at FROM quotes WHERE ticker = ?').get(q.ticker);
          if (!existing || qUpdated >= (existing.updated_at || 0)) {
            upsertQuoteStmt.run({
              ticker: q.ticker,
              price: q.price ?? null,
              change: q.change ?? null,
              change_percent: q.change_percent ?? q.changePercent ?? null,
              prev_close: q.prev_close ?? q.prevClose ?? null,
              open: q.open ?? null,
              day_high: q.day_high ?? q.dayHigh ?? null,
              day_low: q.day_low ?? q.dayLow ?? null,
              volume: q.volume ?? null,
              market_cap: q.market_cap ?? q.marketCap ?? null,
              updated_at: qUpdated,
            });
          }
        }
      }

      // 3. Fundamentals merge
      if (Array.isArray(tables.fundamentals)) {
        for (const f of tables.fundamentals) {
          const fUpdated = f.updated_at ?? f.updatedAt ?? Date.now();
          const existing = db.prepare('SELECT updated_at FROM fundamentals WHERE ticker = ?').get(f.ticker);
          if (!existing || fUpdated >= (existing.updated_at || 0)) {
            upsertFundamentalsStmt.run({
              ticker: f.ticker,
              pe_ratio: f.pe_ratio ?? f.peRatio ?? null,
              pb_ratio: f.pb_ratio ?? f.pbRatio ?? null,
              ev_ebitda: f.ev_ebitda ?? f.evEbitda ?? null,
              roe: f.roe ?? null,
              roce: f.roce ?? null,
              debt_to_equity: f.debt_to_equity ?? f.debtToEquity ?? null,
              dividend_yield: f.dividend_yield ?? f.dividendYield ?? null,
              book_value: f.book_value ?? f.bookValue ?? null,
              high_52w: f.high_52w ?? f.high52w ?? null,
              low_52w: f.low_52w ?? f.low52w ?? null,
              updated_at: fUpdated,
            });
          }
        }
      }

      // 4. Quarterly Financials merge
      if (Array.isArray(tables.quarterly_financials)) {
        for (const qf of tables.quarterly_financials) {
          upsertQuarterlyStmt.run({
            ticker: qf.ticker,
            quarter: qf.quarter,
            revenue: qf.revenue ?? null,
            pat: qf.pat ?? null,
            eps: qf.eps ?? null,
            opm_percent: qf.opm_percent ?? qf.opmPercent ?? null,
            rev_growth_yoy: qf.rev_growth_yoy ?? qf.revGrowthYoy ?? null,
            pat_growth_yoy: qf.pat_growth_yoy ?? qf.patGrowthYoy ?? null,
          });
        }
      }

      // 5. Historical Prices merge
      if (Array.isArray(tables.historical_prices)) {
        for (const hp of tables.historical_prices) {
          upsertHistoricalStmt.run({
            ticker: hp.ticker,
            date: hp.date,
            open: hp.open ?? null,
            high: hp.high ?? null,
            low: hp.low ?? null,
            close: hp.close ?? null,
            volume: hp.volume ?? null,
          });
        }
      }

      // 6. AI Analysis merge
      if (Array.isArray(tables.ai_analysis)) {
        for (const ai of tables.ai_analysis) {
          const aiUpdated = ai.updated_at ?? ai.updatedAt ?? Date.now();
          const existing = db.prepare('SELECT updated_at FROM ai_analysis WHERE ticker = ?').get(ai.ticker);
          if (!existing || aiUpdated >= (existing.updated_at || 0)) {
            upsertAiAnalysisStmt.run({
              ticker: ai.ticker,
              score: ai.score ?? null,
              verdict: ai.verdict ?? null,
              bull_points: typeof ai.bull_points === 'string' ? ai.bull_points : JSON.stringify(ai.bull_points ?? ai.bullPoints ?? []),
              bear_points: typeof ai.bear_points === 'string' ? ai.bear_points : JSON.stringify(ai.bear_points ?? ai.bearPoints ?? []),
              future_points: typeof ai.future_points === 'string' ? ai.future_points : JSON.stringify(ai.future_points ?? ai.futurePoints ?? []),
              parameter_scores: typeof ai.parameter_scores === 'string' ? ai.parameter_scores : JSON.stringify(ai.parameter_scores ?? ai.parameterScores ?? {}),
              governance_notes: ai.governance_notes ?? ai.governanceNotes ?? null,
              engine: ai.engine ?? null,
              story: ai.story ?? null,
              story_tags: typeof ai.story_tags === 'string' ? ai.story_tags : JSON.stringify(ai.story_tags ?? ai.storyTags ?? []),
              story_end_markets: typeof ai.story_end_markets === 'string' ? ai.story_end_markets : JSON.stringify(ai.story_end_markets ?? ai.storyEndMarkets ?? []),
              story_what_they_do: typeof ai.story_what_they_do === 'string' ? ai.story_what_they_do : JSON.stringify(ai.story_what_they_do ?? ai.storyWhatTheyDo ?? []),
              story_engine: ai.story_engine ?? ai.storyEngine ?? null,
              updated_at: aiUpdated,
            });
          }
        }
      }

      // 7. Portfolio Holdings merge (smart merge: update if newer or insert if not present)
      if (Array.isArray(tables.user_portfolio)) {
        const existingHoldings = db.prepare('SELECT * FROM user_portfolio').all();

        for (const incoming of tables.user_portfolio) {
          const incUpdated = incoming.updated_at ?? incoming.updatedAt ?? Date.now();
          const incIsin = (incoming.isin || '').trim();
          const incSym = (incoming.symbol || '').toUpperCase().trim();
          const incFolio = (incoming.folio || '').trim();
          const incAcc = (incoming.account_name || incoming.accountName || '').trim();

          // Match by ISIN if available, or symbol + folio + account_name
          const matched = existingHoldings.find((ex) => {
            if (incIsin && ex.isin && ex.isin.trim() === incIsin) return true;
            if (incSym && ex.symbol && ex.symbol.toUpperCase().trim() === incSym) {
              const exFolio = (ex.folio || '').trim();
              const exAcc = (ex.account_name || '').trim();
              if (incFolio || exFolio) return incFolio === exFolio;
              if (incAcc || exAcc) return incAcc === exAcc;
              return true;
            }
            return false;
          });

          if (matched) {
            // Update if incoming is newer or equal
            if (incUpdated >= (matched.updated_at || 0)) {
              updatePortfolioStmt.run({
                id: matched.id,
                isin: incIsin || matched.isin,
                symbol: incoming.symbol || matched.symbol,
                name: incoming.name || matched.name,
                quantity: incoming.quantity ?? matched.quantity,
                price: incoming.price ?? matched.price,
                value: incoming.value ?? matched.value,
                asset_type: incoming.asset_type ?? incoming.assetType ?? matched.asset_type,
                category: incoming.category ?? matched.category,
                subtype: incoming.subtype ?? matched.subtype,
                cost_basis: incoming.cost_basis ?? incoming.costBasis ?? matched.cost_basis,
                live_price: incoming.live_price ?? incoming.livePrice ?? matched.live_price,
                live_value: incoming.live_value ?? incoming.liveValue ?? matched.live_value,
                gain: incoming.gain ?? matched.gain,
                gain_pct: incoming.gain_pct ?? incoming.gainPct ?? matched.gain_pct,
                folio: incoming.folio ?? matched.folio,
                amfi: incoming.amfi ?? matched.amfi,
                xirr: incoming.xirr != null ? Number(incoming.xirr) : matched.xirr,
                depository: incoming.depository ?? matched.depository,
                account_name: incoming.account_name ?? incoming.accountName ?? matched.account_name,
                updated_at: incUpdated,
              });
            }
          } else {
            // Insert new position
            insertPortfolioStmt.run({
              isin: incIsin,
              symbol: incoming.symbol || '',
              name: incoming.name || '',
              quantity: incoming.quantity ?? 0,
              price: incoming.price ?? 0,
              value: incoming.value ?? 0,
              asset_type: incoming.asset_type ?? incoming.assetType ?? 'EQUITY',
              category: incoming.category ?? (incoming.asset_type === 'MUTUAL_FUND' ? 'MUTUAL_FUNDS' : (incoming.asset_type === 'BOND' ? 'BONDS_DEBT' : 'STOCKS')),
              subtype: incoming.subtype ?? 'DIRECT_STOCK',
              cost_basis: incoming.cost_basis ?? incoming.costBasis ?? 0,
              live_price: incoming.live_price ?? incoming.livePrice ?? incoming.price ?? 0,
              live_value: incoming.live_value ?? incoming.liveValue ?? incoming.value ?? 0,
              gain: incoming.gain ?? 0,
              gain_pct: incoming.gain_pct ?? incoming.gainPct ?? 0,
              folio: incoming.folio || '',
              amfi: incoming.amfi || '',
              xirr: incoming.xirr != null ? Number(incoming.xirr) : null,
              depository: incoming.depository || '',
              account_name: incoming.account_name ?? incoming.accountName ?? '',
              updated_at: incUpdated,
            });
          }
        }
      }

      // 8. Portfolio Meta merge (with smart bank_accounts and epfo_accounts array merging)
      const incomingMetaList = Array.isArray(tables.portfolio_meta) ? [...tables.portfolio_meta] : [];

      // If separate bank_accounts or epfo_accounts were provided, inject into meta list
      if (Array.isArray(tables.bank_accounts) && tables.bank_accounts.length > 0) {
        incomingMetaList.push({ key: 'bank_accounts', value: JSON.stringify(tables.bank_accounts), updated_at: Date.now() });
      }
      if (Array.isArray(tables.epfo_accounts) && tables.epfo_accounts.length > 0) {
        incomingMetaList.push({ key: 'epfo_accounts', value: JSON.stringify(tables.epfo_accounts), updated_at: Date.now() });
      }
      if (Array.isArray(tables.spend_transactions) && tables.spend_transactions.length > 0) {
        incomingMetaList.push({ key: 'spend_transactions', value: JSON.stringify(tables.spend_transactions), updated_at: Date.now() });
      }

      for (const item of incomingMetaList) {
        const key = item.key;
        const valStr = typeof item.value === 'object' ? JSON.stringify(item.value) : String(item.value);
        const itemUpdated = item.updated_at ?? item.updatedAt ?? Date.now();
        const existingRow = db.prepare('SELECT value, updated_at FROM portfolio_meta WHERE key = ?').get(key);

        if (!existingRow) {
          upsertMetaStmt.run({ key, value: valStr, updated_at: itemUpdated });
          continue;
        }

        if (key === 'bank_accounts') {
          try {
            const existingAccounts = JSON.parse(existingRow.value) || [];
            const incomingAccounts = JSON.parse(valStr) || [];
            const mergedAccounts = [...existingAccounts];

            for (const incAcc of incomingAccounts) {
              const incNum = String(incAcc.account_number || incAcc.masked_account_number || '').toUpperCase().replace(/\s+/g, '');
              const matchIdx = mergedAccounts.findIndex((ex) => {
                const exNum = String(ex.account_number || ex.masked_account_number || '').toUpperCase().replace(/\s+/g, '');
                return incNum && exNum && incNum === exNum;
              });

              if (matchIdx >= 0) {
                // Merge transactions without duplicates
                const exAcc = mergedAccounts[matchIdx];
                const exTxMap = new Map();
                for (const tx of exAcc.transactions || []) {
                  const txKey = `${tx.date}_${tx.amount}_${tx.type}_${tx.description || tx.narration}`;
                  exTxMap.set(txKey, tx);
                }
                for (const tx of incAcc.transactions || []) {
                  const txKey = `${tx.date}_${tx.amount}_${tx.type}_${tx.description || tx.narration}`;
                  if (!exTxMap.has(txKey)) exTxMap.set(txKey, tx);
                }

                mergedAccounts[matchIdx] = {
                  ...exAcc,
                  ...incAcc,
                  transactions: Array.from(exTxMap.values()),
                  closing_balance: incAcc.closing_balance ?? exAcc.closing_balance,
                  statement_date: incAcc.statement_date || exAcc.statement_date,
                };
              } else {
                mergedAccounts.push(incAcc);
              }
            }

            upsertMetaStmt.run({
              key: 'bank_accounts',
              value: JSON.stringify(mergedAccounts),
              updated_at: Math.max(itemUpdated, existingRow.updated_at || 0),
            });
            continue;
          } catch (bankErr) {
            console.warn('Bank accounts merge fallback to overwrite:', bankErr.message);
          }
        }

        if (key === 'epfo_accounts') {
          try {
            const existingEpfo = JSON.parse(existingRow.value) || [];
            const incomingEpfo = JSON.parse(valStr) || [];
            const mergedEpfo = [...existingEpfo];

            for (const incAcc of incomingEpfo) {
              const incMid = String(incAcc.member_id || '').toUpperCase().trim();
              const matchIdx = mergedEpfo.findIndex((ex) => String(ex.member_id || '').toUpperCase().trim() === incMid);
              if (matchIdx >= 0) {
                mergedEpfo[matchIdx] = { ...mergedEpfo[matchIdx], ...incAcc };
              } else {
                mergedEpfo.push(incAcc);
              }
            }

            upsertMetaStmt.run({
              key: 'epfo_accounts',
              value: JSON.stringify(mergedEpfo),
              updated_at: Math.max(itemUpdated, existingRow.updated_at || 0),
            });
            continue;
          } catch (epfoErr) {
            console.warn('EPFO accounts merge fallback to overwrite:', epfoErr.message);
          }
        }

        // Default last-write-wins for other meta keys
        if (itemUpdated >= (existingRow.updated_at || 0)) {
          upsertMetaStmt.run({ key, value: valStr, updated_at: itemUpdated });
        }
      }
    });

    importTransaction(mode);

    // Refresh summary if user_portfolio was modified
    try {
      const { refreshPortfolioSummary, computePortfolioAnalytics } = await import('../services/casService.js');
      const { getPortfolioHoldings, savePortfolioHoldings } = await import('../db.js');
      const portfolio = getPortfolioHoldings();
      if (portfolio) {
        refreshPortfolioSummary(portfolio);
        portfolio.analytics = computePortfolioAnalytics(portfolio);
        savePortfolioHoldings(portfolio, portfolio.meta || {});
      }
    } catch (refreshErr) {
      console.warn('[Sync] Non-critical error refreshing portfolio analytics after import:', refreshErr.message);
    }

    const newCounts = getTableCounts();

    res.json({
      success: true,
      mode,
      backup_file: backupFileName,
      counts: newCounts,
      stats: newCounts,
      message: `Database successfully synced in '${mode}' mode with pre-sync safety backup created at ${backupFileName}.`,
    });
  } catch (txErr) {
    console.error('[Sync] Import transaction failed:', txErr);
    res.status(500).json({
      success: false,
      error: `Failed to import sync data: ${txErr.message}`,
      backup_file: backupFileName,
    });
  }
});

export default router;
