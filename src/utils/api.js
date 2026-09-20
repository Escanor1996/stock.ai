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

  const staticScore = data.staticScore ?? computeScore(data);
  const staticCategory =
    staticScore >= 80 ? 'Exceptional' :
    staticScore >= 65 ? 'Strong' :
    staticScore >= 50 ? 'Moderate' :
    'Needs Attention';

  const hasAI = Boolean(data.aiAnalysis && data.aiAnalysis.score != null);
  const aiScore = hasAI ? data.aiAnalysis.score : null;
  const aiCategory = hasAI
    ? (data.aiAnalysis.score >= 80 ? 'Exceptional' : data.aiAnalysis.score >= 60 ? 'Strong' : 'Needs Attention')
    : null;
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

    // Deterministic Static Financial Score
    staticScore,
    staticCategory,
    staticBreakdown: data.staticBreakdown || {
      capitalEfficiency: 50,
      growth: 50,
      solvency: 50,
      valuation: 50,
      priceHealth: 50
    },

    // Legacy unified score for backward compat
    score: aiScore ?? staticScore,
    scoreCategory: aiCategory ?? staticCategory,

    // Radar scores (6-axis institutional breakdown)
    radarScores: buildRadarScores(data, hasAI ? data.aiAnalysis.parameterScores : null),

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
    // Persisted AI 360° Analysis section
    hasAIAnalysis: hasAI,
    aiScore,
    aiCategory,
    engine: hasAI ? data.aiAnalysis.engine : null,
    aiVerdict: hasAI ? data.aiAnalysis.verdict : null,
    bullPoints: hasAI ? (data.aiAnalysis.bullPoints || []) : [],
    bearPoints: hasAI ? (data.aiAnalysis.bearPoints || []) : [],
    futurePoints: hasAI ? (data.aiAnalysis.futurePoints || []) : [],
    parameterScores: hasAI ? (data.aiAnalysis.parameterScores || {}) : {},
    governanceNotes: hasAI ? (data.aiAnalysis.governanceNotes || '') : '',
    peers: [],

    lastUpdated: data.lastUpdated,
  };
}

function buildRadarScores(d, aiParams) {
  if (aiParams && Object.keys(aiParams).length > 0) {
    return [
      { category: 'Capital Efficiency', score: aiParams.capitalEfficiency ?? 50 },
      { category: 'Growth Momentum', score: aiParams.growth ?? 50 },
      { category: 'Solvency & Health', score: aiParams.solvency ?? 50 },
      { category: 'Valuation Safety', score: aiParams.valuation ?? 50 },
      { category: 'Corp Governance', score: aiParams.corporateGovernance ?? 75 },
      { category: 'Future Potential', score: aiParams.futurePotential ?? 75 },
    ];
  }

  const breakdown = d.staticBreakdown || {};
  return [
    { category: 'Capital Efficiency', score: breakdown.capitalEfficiency ?? 50 },
    { category: 'Growth Momentum', score: breakdown.growth ?? 50 },
    { category: 'Solvency & Health', score: breakdown.solvency ?? 50 },
    { category: 'Valuation Safety', score: breakdown.valuation ?? 50 },
    { category: 'Price Health', score: breakdown.priceHealth ?? 50 },
    { category: 'Future Potential', score: 50 },
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
