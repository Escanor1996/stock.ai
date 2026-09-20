import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { getStockData, getHistoricalPrices, searchStocks } from './services/stockService.js';
import { generateAIAnalysis } from './services/aiService.js';

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
  try {
    const data = await generateAIAnalysis(ticker);
    console.log('AI Analysis Data:', data);
    res.json(data);
  } catch (err) {
    console.error(`Error generating AI analysis for ${ticker}:`, err);
    res.status(500).json({ error: 'Failed to generate AI analysis' });
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

app.listen(port, () => {
  console.log(`EquiSense backend running on http://localhost:${port}`);
});
