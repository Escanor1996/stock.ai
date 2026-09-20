import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { getStockData, getHistoricalPrices, searchStocks } from './services/stockService.js';
import { generateAIScore, generateAIVerdict, generateAIAnalysis } from './services/aiService.js';
import { parseCASFile, getSamplePortfolio, exportToCSV } from './services/casService.js';
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
    const result = await parseCASFile(req.file.path, password, enrich);
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
  const { holdings, meta } = req.body;
  if (!holdings || !Array.isArray(holdings)) {
    return res.status(400).json({ success: false, error: 'Holdings array is required' });
  }

  try {
    db.savePortfolioHoldings(holdings, meta || {});
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
  const { holdings, summary } = req.body;
  if (!holdings || !Array.isArray(holdings)) {
    return res.status(400).json({ success: false, error: 'Holdings array is required' });
  }

  try {
    const csv = exportToCSV(holdings, summary);
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
