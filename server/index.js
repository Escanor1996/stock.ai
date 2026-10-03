import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { getStockData, getHistoricalPrices, searchStocks } from './services/stockService.js';
import { generateAIScore, generateAIVerdict, generateAIAnalysis } from './services/aiService.js';
import { parseCASFile, parseBrokerSpreadsheet, parseEPFOPassbook, parseBankStatement, mergeBrokerPrices, mergeEPFOAccounts, mergeBankAccounts, refreshPortfolioSummary, computePortfolioAnalytics, getSamplePortfolio, exportToCSV } from './services/casService.js';
import * as db from './db.js';
import multer from 'multer';
import os from 'os';
import path from 'path';

const upload = multer({
  dest: path.join(os.tmpdir(), 'stock_ai_cas_uploads'),
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB max
});
const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ── GET /api/stock/:ticker — Full stock data (quote + fundamentals + quarters)
app.get('/api/stock/:ticker', async (req, res) => {
  const { ticker } = req.params;
  if (!ticker) return res.status(400).json({ error: 'Ticker is required' });

  try {
    const data = await getStockData(ticker);
    if (!data) return res.status(404).json({ error: `No data found for ${ticker}` });
    res.json(data);
  } catch (err) {
    console.error(`Error fetching ${ticker}:`, err);
    res.status(500).json({ error: 'Failed to fetch stock data' });
  }
});

// ── GET /api/stock/:ticker/history?range=1y — Historical price data
app.get('/api/stock/:ticker/history', async (req, res) => {
  const { ticker } = req.params;
  const range = req.query.range || '1y';

  try {
    const data = await getHistoricalPrices(ticker, range);
    res.json(data);
  } catch (err) {
    console.error(`Error fetching history for ${ticker}:`, err);
    res.status(500).json({ error: 'Failed to fetch historical data' });
  }
});

// ── GET /api/stock/:ticker/analysis — AI Verdict
app.get('/api/stock/:ticker/analysis', async (req, res) => {
  const { ticker } = req.params;
  const force = req.query.refresh === 'true' || req.query.force === 'true';
  try {
    const data = await generateAIAnalysis(ticker, force);
    console.log(`AI Analysis Data for ${ticker} (force=${force}):`, data?.engine);
    res.json(data);
  } catch (err) {
    console.error(`Error generating AI analysis for ${ticker}:`, err);
    res.status(500).json({ error: 'Failed to generate AI analysis' });
  }
});

// ── GET /api/stock/:ticker/score — Decoupled AI 360° Score
app.get('/api/stock/:ticker/score', async (req, res) => {
  const { ticker } = req.params;
  const force = req.query.refresh === 'true' || req.query.force === 'true';
  try {
    const data = await generateAIScore(ticker, force);
    res.json(data);
  } catch (err) {
    console.error(`Error generating AI score for ${ticker}:`, err);
    res.status(500).json({ error: 'Failed to generate AI score' });
  }
});

// ── GET /api/stock/:ticker/verdict — Decoupled Fin-LLM 360° Verdict
app.get('/api/stock/:ticker/verdict', async (req, res) => {
  const { ticker } = req.params;
  const force = req.query.refresh === 'true' || req.query.force === 'true';
  try {
    const data = await generateAIVerdict(ticker, force);
    res.json(data);
  } catch (err) {
    console.error(`Error generating AI verdict for ${ticker}:`, err);
    res.status(500).json({ error: 'Failed to generate AI verdict' });
  }
});

// ── GET /api/search?q=query — Search stocks
app.get('/api/search', async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 1) return res.json([]);

  try {
    const results = await searchStocks(q);
    res.json(results);
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

// ── Legacy compat: redirect old /api/scrape to new endpoint
app.get('/api/scrape', async (req, res) => {
  const { ticker } = req.query;
  if (!ticker) return res.status(400).json({ error: 'Ticker is required' });

  try {
    const data = await getStockData(ticker);
    if (!data) return res.status(404).json({ error: `No data found for ${ticker}` });
    // Map to legacy shape so frontend doesn't break during transition
    res.json({
      status: 'success',
      ticker: data.symbol,
      name: data.name,
      price: data.price,
      score: 0, // no longer scraping equisense score
      mktCap: data.marketCap ? `₹${Math.round(data.marketCap / 10000000)} Cr` : 'N/A',
      peRatio: data.peRatio,
      roe: data.roe != null ? `${data.roe}%` : '0%',
      roce: data.roce != null ? `${data.roce}%` : '0%',
      debtToEquity: data.debtToEquity,
      high52: data.high52,
      low52: data.low52,
      quarters: data.quarterlyFinancials.length > 0 ? data.quarterlyFinancials.slice(-6).map(q => ({
        quarter: q.quarter,
        revenue: q.revenue,
        pat: q.pat,
        eps: q.eps,
        ebitdaMargin: q.opm_percent,
        revGrowthYoY: q.rev_growth_yoy || 0,
        patGrowthYoY: q.pat_growth_yoy || 0,
        beat: true,
      })) : null,
      aiVerdict: `Live data for ${data.name} (${data.symbol})`,
      bullPoints: [`Sector: ${data.sector}`, `Industry: ${data.industry}`],
      bearPoints: [],
    });
  } catch (err) {
    console.error(`Legacy scrape error for ${ticker}:`, err);
    res.status(500).json({ error: 'Failed to fetch stock data' });
  }
});

// ── Portfolio Endpoints ───────────────────────────────────────────────────────

// POST /api/portfolio/parse — Parse uploaded CAS PDF (CDSL / NSDL / CAMS)
app.post('/api/portfolio/parse', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No PDF file uploaded' });
  }

  const password = req.body.password || '';
  const enrich = req.query.enrich !== 'false';

  try {
    let result = await parseCASFile(req.file.path, password, enrich);
    if (req.body.portfolio) {
      const currentPortfolio = typeof req.body.portfolio === 'string'
        ? JSON.parse(req.body.portfolio)
        : req.body.portfolio;
      const existingEPFOAccounts = currentPortfolio?.epfo_accounts || currentPortfolio?.meta?.epfo_accounts;
      if (Array.isArray(existingEPFOAccounts) && existingEPFOAccounts.length > 0) {
        result = mergeEPFOAccounts(result, { accounts: existingEPFOAccounts });
      }
      const existingBankAccounts = currentPortfolio?.bank_accounts || currentPortfolio?.meta?.bank_accounts;
      if (Array.isArray(existingBankAccounts) && existingBankAccounts.length > 0) {
        result = mergeBankAccounts(result, { accounts: existingBankAccounts });
      }
    }
    res.json(result);
  } catch (err) {
    console.error('CAS parse error:', err.message);
    const statusCode = err.errorType === 'INCORRECT_PASSWORD' ? 401 : 422;
    res.status(statusCode).json({
      success: false,
      error_type: err.errorType || 'PARSE_ERROR',
      error: err.message || 'Failed to process CAS statement'
    });
  }
});

// POST /api/portfolio/epfo-passbook — Parse and merge user-exported official EPFO passbook PDFs (single or multiple)
app.post('/api/portfolio/epfo-passbook', upload.any(), async (req, res) => {
  const uploadedFiles = Array.isArray(req.files) && req.files.length > 0
    ? req.files
    : (req.file ? [req.file] : []);

  if (uploadedFiles.length === 0) {
    return res.status(400).json({ success: false, error: 'No EPFO passbook PDF uploaded' });
  }

  try {
    let currentPortfolio = req.body.portfolio
      ? (typeof req.body.portfolio === 'string' ? JSON.parse(req.body.portfolio) : req.body.portfolio)
      : (db.getPortfolioHoldings() || {});

    const allAccounts = [];
    const errors = [];

    for (const file of uploadedFiles) {
      try {
        const epfoData = await parseEPFOPassbook(file.path);
        if (Array.isArray(epfoData.accounts)) {
          allAccounts.push(...epfoData.accounts);
        }
      } catch (fileErr) {
        console.error(`Error parsing passbook ${file.originalname}:`, fileErr.message);
        errors.push({ file: file.originalname, error: fileErr.message });
      }
    }

    if (allAccounts.length === 0) {
      const firstError = errors[0]?.error || 'Failed to parse EPFO passbook(s). Ensure valid official EPFO passbook PDFs are uploaded.';
      return res.status(422).json({
        success: false,
        error_type: 'EPFO_PARSE_ERROR',
        error: firstError,
        details: errors
      });
    }

    const combinedData = {
      success: true,
      source: 'EPFO Member Passbook',
      accounts: allAccounts
    };

    const portfolio = mergeEPFOAccounts(currentPortfolio, combinedData);
    db.savePortfolioHoldings(portfolio, portfolio.meta || {});

    res.json({
      success: true,
      epfo_data: combinedData,
      portfolio,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (err) {
    console.error('EPFO passbook merge error:', err.message);
    res.status(422).json({
      success: false,
      error_type: err.errorType || 'EPFO_PARSE_ERROR',
      error: err.message || 'Failed to process EPFO passbook(s)'
    });
  }
});
// DELETE /api/portfolio/epfo-account/:memberId — Remove a specific EPFO member account
app.delete('/api/portfolio/epfo-account/:memberId', (req, res) => {
  const memberId = req.params.memberId?.toUpperCase();
  if (!memberId) {
    return res.status(400).json({ success: false, error: 'Member ID is required' });
  }

  try {
    const portfolio = db.getPortfolioHoldings();
    if (!portfolio || !Array.isArray(portfolio.epfo_accounts)) {
      return res.status(404).json({ success: false, error: 'No EPFO accounts found' });
    }

    const filtered = portfolio.epfo_accounts.filter(
      acc => String(acc.member_id).toUpperCase() !== memberId
    );

    portfolio.epfo_accounts = filtered;
    if (portfolio.meta) {
      portfolio.meta.epfo_accounts = filtered;
    }

    db.savePortfolioHoldings(portfolio, portfolio.meta || {});
    const updated = db.getPortfolioHoldings();

    res.json({
      success: true,
      message: `Account ${memberId} removed successfully`,
      portfolio: updated
    });
  } catch (err) {
    console.error('Delete EPFO account error:', err);
    res.status(500).json({ success: false, error: 'Failed to delete EPFO account' });
  }
});

// POST /api/portfolio/bank-statement — Parse and merge bank account statement PDFs (HDFC, Standard Chartered, Generic)
app.post('/api/portfolio/bank-statement', upload.any(), async (req, res) => {
  const uploadedFiles = Array.isArray(req.files) && req.files.length > 0
    ? req.files
    : (req.file ? [req.file] : []);

  if (uploadedFiles.length === 0) {
    return res.status(400).json({ success: false, error: 'No bank statement PDF uploaded' });
  }

  const password = req.body.password || '';
  const bankType = req.body.bank_type || 'auto';

  try {
    let currentPortfolio = req.body.portfolio
      ? (typeof req.body.portfolio === 'string' ? JSON.parse(req.body.portfolio) : req.body.portfolio)
      : (db.getPortfolioHoldings() || {});

    const allAccounts = [];
    const errors = [];

    for (const file of uploadedFiles) {
      try {
        const bankData = await parseBankStatement(file.path, password, bankType);
        if (Array.isArray(bankData.accounts)) {
          allAccounts.push(...bankData.accounts);
        }
      } catch (fileErr) {
        console.error(`Error parsing bank statement ${file.originalname}:`, fileErr.message);
        errors.push({
          file: file.originalname,
          error: fileErr.message,
          errorType: fileErr.errorType || 'BANK_PARSE_ERROR'
        });
      }
    }

    if (allAccounts.length === 0) {
      const pwdError = errors.find(e => e.errorType === 'INCORRECT_PASSWORD');
      const firstError = pwdError?.error || errors[0]?.error || 'Failed to parse bank statement(s). Check password or file format.';
      const statusCode = pwdError ? 401 : 422;
      return res.status(statusCode).json({
        success: false,
        error_type: pwdError ? 'INCORRECT_PASSWORD' : 'BANK_PARSE_ERROR',
        error: firstError,
        details: errors
      });
    }

    const combinedData = {
      success: true,
      source: 'Bank Statement',
      accounts: allAccounts
    };

    const portfolio = mergeBankAccounts(currentPortfolio, combinedData);
    db.savePortfolioHoldings(portfolio, portfolio.meta || {});

    res.json({
      success: true,
      bank_data: combinedData,
      portfolio,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (err) {
    console.error('Bank statement merge error:', err.message);
    const statusCode = err.errorType === 'INCORRECT_PASSWORD' ? 401 : 422;
    res.status(statusCode).json({
      success: false,
      error_type: err.errorType || 'BANK_PARSE_ERROR',
      error: err.message || 'Failed to process bank statement(s)'
    });
  }
});

// DELETE /api/portfolio/bank-account/:accountNumber — Remove a specific bank account
app.delete('/api/portfolio/bank-account/:accountNumber', (req, res) => {
  const rawAcc = req.params.accountNumber;
  if (!rawAcc) {
    return res.status(400).json({ success: false, error: 'Account number is required' });
  }
  const target = String(rawAcc).toUpperCase().replace(/\s+/g, '');

  try {
    const portfolio = db.getPortfolioHoldings();
    if (!portfolio || !Array.isArray(portfolio.bank_accounts)) {
      return res.status(404).json({ success: false, error: 'No bank accounts found' });
    }

    const filtered = portfolio.bank_accounts.filter(acc => {
      const accNum = String(acc.account_number || '').toUpperCase().replace(/\s+/g, '');
      const maskedNum = String(acc.masked_account_number || '').toUpperCase().replace(/\s+/g, '');
      return accNum !== target && maskedNum !== target;
    });

    portfolio.bank_accounts = filtered;
    if (portfolio.meta) {
      portfolio.meta.bank_accounts = filtered;
    }

    refreshPortfolioSummary(portfolio);
    portfolio.analytics = computePortfolioAnalytics(portfolio);

    db.savePortfolioHoldings(portfolio, portfolio.meta || {});
    const updated = db.getPortfolioHoldings();

    res.json({
      success: true,
      message: `Bank account ${rawAcc} removed successfully`,
      portfolio: updated
    });
  } catch (err) {
    console.error('Delete bank account error:', err);
    res.status(500).json({ success: false, error: 'Failed to delete bank account' });
  }
});

// POST /api/portfolio/broker-statement — Parse and merge broker spreadsheet (Groww, Zerodha, Upstox, etc.)
app.post('/api/portfolio/broker-statement', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No spreadsheet file uploaded' });
  }

  try {
    const brokerData = await parseBrokerSpreadsheet(req.file.path);
    
    let enrichedPortfolio = null;
    if (req.body.portfolio) {
      try {
        const portfolioPayload = typeof req.body.portfolio === 'string' ? JSON.parse(req.body.portfolio) : req.body.portfolio;
        enrichedPortfolio = mergeBrokerPrices(portfolioPayload, brokerData);
        if (enrichedPortfolio) {
          try {
            db.savePortfolioHoldings(enrichedPortfolio, enrichedPortfolio.meta || {});
          } catch (saveErr) {
            console.warn('Could not auto-save enriched portfolio to DB:', saveErr.message);
          }
        }
      } catch (err) {
        console.warn('Could not merge broker prices server-side:', err.message);
      }
    }

    res.json({
      success: true,
      broker_data: brokerData,
      portfolio: enrichedPortfolio
    });
  } catch (err) {
    console.error('Broker statement parse error:', err.message);
    res.status(422).json({
      success: false,
      error: err.message || 'Failed to process broker spreadsheet'
    });
  }
});

// GET /api/portfolio/sample — Load instant demo portfolio for evaluation
app.get('/api/portfolio/sample', (req, res) => {
  try {
    const sample = getSamplePortfolio();
    res.json(sample);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/portfolio/save — Persist portfolio to local SQLite
app.post('/api/portfolio/save', (req, res) => {
  const payload = req.body;
  if (!payload || (!payload.holdings && !payload.stocks && !payload.mutual_funds && !payload.epfo_accounts && !payload.bank_accounts && !Array.isArray(payload))) {
    return res.status(400).json({ success: false, error: 'Valid portfolio payload is required' });
  }

  try {
    db.savePortfolioHoldings(payload, payload.meta || {});
    res.json({ success: true, message: 'Portfolio saved successfully' });
  } catch (err) {
    console.error('Save portfolio error:', err);
    res.status(500).json({ success: false, error: 'Failed to save portfolio' });
  }
});

// GET /api/portfolio — Retrieve saved portfolio from local SQLite
app.get('/api/portfolio', (req, res) => {
  try {
    const data = db.getPortfolioHoldings();
    res.json({ success: true, data });
  } catch (err) {
    console.error('Get portfolio error:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve portfolio' });
  }
});

// GET /api/portfolio/scores - Retrieve all persisted AI & Algorithm scores
app.get('/api/portfolio/scores', (req, res) => {
  try {
    const scores = db.getAllAIScores();
    res.json({ success: true, scores });
  } catch (err) {
    console.error('Get portfolio scores error:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve portfolio scores' });
  }
});

// DELETE /api/portfolio — Clear saved portfolio
app.delete('/api/portfolio', (req, res) => {
  try {
    db.clearPortfolioHoldings();
    res.json({ success: true, message: 'Portfolio cleared successfully' });
  } catch (err) {
    console.error('Clear portfolio error:', err);
    res.status(500).json({ success: false, error: 'Failed to clear portfolio' });
  }
});

// POST /api/portfolio/export/csv — Generate downloadable CSV
app.post('/api/portfolio/export/csv', (req, res) => {
  const payload = req.body;
  if (!payload || (!payload.holdings && !payload.stocks && !payload.mutual_funds && !payload.epfo_accounts && !payload.bank_accounts && !Array.isArray(payload))) {
    return res.status(400).json({ success: false, error: 'Holdings or portfolio payload is required' });
  }

  try {
    const csv = exportToCSV(payload, payload.summary);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="stock_ai_portfolio.csv"');
    res.send(csv);
  } catch (err) {
    console.error('Export CSV error:', err);
    res.status(500).json({ success: false, error: 'Failed to generate CSV' });
  }
});

app.listen(port, () => {
  console.log(`stock.ai backend running on http://localhost:${port}`);
});
