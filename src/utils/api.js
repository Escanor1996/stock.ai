// ── Stock Data API ──────────────────────────────────────────────────────────
// Talks to our Express backend which merges Yahoo Finance + Screener.in + DB cache.

export async function fetchStockData(ticker) {
  const t = ticker.toUpperCase();
  const response = await fetch(`/api/stock/${encodeURIComponent(t)}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch data for ${t}: ${response.status}`);
  }

  const data = await response.json();
  return normalizeForUI(data);
}

export async function fetchHistorical(ticker, range = '1y') {
  const t = ticker.toUpperCase();
  const response = await fetch(`/api/stock/${encodeURIComponent(t)}/history?range=${range}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch history for ${t}`);
  }

  return response.json();
}

export async function fetchAIAnalysis(ticker, force = true) {
  const t = ticker.toUpperCase();
  const response = await fetch(`/api/stock/${encodeURIComponent(t)}/analysis?refresh=${force}`);
  if (!response.ok) throw new Error('AI analysis failed');
  return response.json();
}

export async function searchStocks(query) {
  if (!query || query.length < 1) return [];

  const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
  if (!response.ok) return [];

  return response.json();
}

// ── Normalize backend response to match UI component expectations ───────────

function normalizeForUI(data) {
  const formatMarketCap = (mc) => {
    if (!mc) return 'N/A';
    if (mc >= 1e12) return `₹${(mc / 1e12).toFixed(2)} T`;
    if (mc >= 1e7) return `₹${Math.round(mc / 1e7).toLocaleString()} Cr`;
    if (mc >= 1e5) return `₹${(mc / 1e5).toFixed(2)} L`;
    return `₹${mc.toLocaleString()}`;
  };

  // Compute a simple composite score from fundamentals (0-100)
  const computeScore = (d) => {
    let score = 50; // base

    // ROE contribution (0-20 points)
    if (d.roe != null) {
      if (d.roe >= 20) score += 20;
      else if (d.roe >= 15) score += 15;
      else if (d.roe >= 10) score += 10;
      else if (d.roe >= 5) score += 5;
      else if (d.roe < 0) score -= 10;
    }

    // ROCE contribution (0-15 points)
    if (d.roce != null) {
      if (d.roce >= 25) score += 15;
      else if (d.roce >= 15) score += 10;
      else if (d.roce >= 10) score += 5;
    }

    // Debt/Equity contribution (0-15 points, lower is better)
    if (d.debtToEquity != null) {
      if (d.debtToEquity <= 0.1) score += 15;
      else if (d.debtToEquity <= 0.5) score += 10;
      else if (d.debtToEquity <= 1) score += 5;
      else if (d.debtToEquity > 2) score -= 10;
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  };

  const baseScore = computeScore(data);
  const baseScoreCategory =
    baseScore >= 80 ? 'Exceptional' :
    baseScore >= 65 ? 'Strong' :
    baseScore >= 50 ? 'Moderate' :
    'Needs Attention';

  const hasAI = Boolean(data.aiAnalysis && data.aiAnalysis.verdict);
  const finalScore = hasAI ? data.aiAnalysis.score : baseScore;
  const finalScoreCategory = hasAI
    ? (data.aiAnalysis.score >= 80 ? 'Exceptional' : data.aiAnalysis.score >= 60 ? 'Strong' : 'Needs Attention')
    : baseScoreCategory;
  return {
    symbol: data.symbol,
    yahooSymbol: data.yahooSymbol,
    name: data.name,
    exchange: data.exchange,
    sector: data.sector || 'N/A',
    industry: data.industry || 'N/A',

    // Price
    price: data.price,
    change: data.change,
    changePercent: data.changePercent,
    prevClose: data.prevClose,
    open: data.open,
    dayHigh: data.dayHigh,
    dayLow: data.dayLow,
    volume: data.volume,
    marketCap: formatMarketCap(data.marketCap),
    marketCapRaw: data.marketCap,

    // Fundamentals
    peRatio: data.peRatio || 0,
    pbRatio: data.pbRatio || 0,
    evEbitda: data.evEbitda || 0,
    roe: data.roe != null ? `${data.roe}%` : 'N/A',
    roce: data.roce != null ? `${data.roce}%` : 'N/A',
    debtToEquity: data.debtToEquity || 0,
    dividendYield: data.dividendYield,
    bookValue: data.bookValue,
    high52: data.high52 || 0,
    low52: data.low52 || 0,

    // Computed score
    score: finalScore,
    scoreCategory: finalScoreCategory,
    kavachScore: finalScore, // placeholder until real governance data
    walkTheTalkScore: finalScore,
    // Radar scores from real data
    radarScores: buildRadarScores(data),

    // Quarterly
    quarterlyFinancials: (data.quarterlyFinancials || []).map((q) => ({
      quarter: q.quarter,
      revenue: q.revenue,
      pat: q.pat,
      eps: q.eps,
      ebitdaMargin: q.opm_percent || 0,
      revGrowthYoY: q.rev_growth_yoy || 0,
      patGrowthYoY: q.pat_growth_yoy || 0,
      beat: true, // no consensus data yet
    })),

    // Persisted AI Analysis section
    hasAIAnalysis: hasAI,
    engine: hasAI ? data.aiAnalysis.engine : null,
    aiVerdict: hasAI ? data.aiAnalysis.verdict : null,
    bullPoints: hasAI ? (data.aiAnalysis.bullPoints || []) : [],
    bearPoints: hasAI ? (data.aiAnalysis.bearPoints || []) : [],

    concall: {
      latestQuarter: data.quarterlyFinancials?.[data.quarterlyFinancials.length - 1]?.quarter || 'N/A',
      sentimentScore: 'N/A',
      keyHighlights: ['Concall intelligence requires earnings call transcript data.'],
      guidanceHistory: [],
    },

    peers: [],

    lastUpdated: data.lastUpdated,
  };
}

function buildRadarScores(d) {
  const norm = (val, max) => val != null ? Math.min(100, Math.round((val / max) * 100)) : 40;

  return [
    { category: 'Profitability', score: norm(d.roe, 30) },
    { category: 'Efficiency', score: norm(d.roce, 35) },
    { category: 'Valuation', score: d.peRatio ? Math.max(10, Math.min(100, Math.round(100 - (d.peRatio / 50) * 100 + 50))) : 50 },
    { category: 'Growth', score: 50 }, // needs revenue growth data
    { category: 'Leverage', score: d.debtToEquity != null ? Math.max(10, Math.min(100, Math.round(100 - d.debtToEquity * 20))) : 50 },
    { category: 'Stability', score: 50 }, // needs volatility data
  ];
}

function buildBullPoints(d) {
  const points = [];
  if (d.roe != null && d.roe >= 15) points.push(`Strong ROE of ${d.roe}% indicates efficient use of equity capital.`);
  if (d.roce != null && d.roce >= 20) points.push(`High ROCE of ${d.roce}% shows excellent capital efficiency.`);
  if (d.debtToEquity != null && d.debtToEquity <= 0.5) points.push(`Low debt-to-equity ratio of ${d.debtToEquity} indicates strong balance sheet.`);
  if (d.peRatio && d.peRatio < 20) points.push(`P/E of ${d.peRatio} suggests reasonable valuation.`);
  if (points.length === 0) points.push(`${d.sector} sector stock trading on ${d.exchange}.`);
  return points;
}

function buildBearPoints(d) {
  const points = [];
  if (d.peRatio && d.peRatio > 50) points.push(`High P/E of ${d.peRatio} indicates expensive valuation.`);
  if (d.roe != null && d.roe < 10) points.push(`ROE of ${d.roe}% is below ideal threshold of 15%.`);
  if (d.debtToEquity != null && d.debtToEquity > 1.5) points.push(`Elevated debt-to-equity ratio of ${d.debtToEquity}.`);
  if (points.length === 0) points.push('No major red flags identified from available data.');
  return points;
}
