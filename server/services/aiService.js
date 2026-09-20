import * as db from '../db.js';

export async function generateAIAnalysis(ticker) {
  const stock = db.getStock(ticker);
  const quote = db.getQuote(ticker);
  const fund = db.getFundamentals(ticker);
  const quarters = db.getQuarterlies(ticker);

  if (!stock || !quote || !fund) {
    throw new Error('Data missing for AI analysis');
  }

  // If GEMINI_API_KEY is provided, use it
  if (process.env.GEMINI_API_KEY) {
    try {
      return await callGeminiAPI(stock, quote, fund, quarters);
    } catch (e) {
      console.error('Gemini API failed, falling back to local heuristic engine', e);
    }
  }

  // Local Heuristic "AI" Fallback (Generates dynamic human-like text based on thresholds)
  return generateHeuristicAnalysis(stock, quote, fund, quarters);
}

async function callGeminiAPI(stock, quote, fund, quarters) {
  const prompt = `
    You are a professional equity research analyst. Analyze this stock data and return a JSON object exactly matching this structure, with no markdown formatting or extra text:
    {
      "score": <0-100 integer based on overall health>,
      "verdict": "<2-sentence summary of the company's financial standing and valuation>",
      "bullPoints": ["<point 1>", "<point 2>", "<point 3>"],
      "bearPoints": ["<point 1>", "<point 2>"]
    }

    Data:
    Name: ${stock.name} (${stock.ticker})
    Sector: ${stock.sector}
    Price: ${quote.price}
    P/E Ratio: ${fund.pe_ratio}
    ROE: ${fund.roe}%
    ROCE: ${fund.roce}%
    Debt to Equity: ${fund.debt_to_equity}
    Recent Revenue Trend: ${quarters.slice(-4).map(q => `${q.quarter}: ${q.revenue}`).join(', ')}
  `;

  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': process.env.GEMINI_API_KEY,
      'Api-Revision': '2026-05-20'
    },
    body: JSON.stringify({
      model: 'gemini-3.5-flash',
      input: prompt
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`API error ${response.status}: ${errText}`);
  }
  const data = await response.json();
  
  // Extract text from the new Interactions API response structure
  const outputStep = data.steps.find(s => s.type === 'model_output');
  const rawText = outputStep.content[0].text;
  
  // Clean up any potential markdown formatting the model might add (like ```json)
  const cleanText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
  const result = JSON.parse(cleanText);
  result.engine = 'Gemini 3.5 Flash';
  return result;
}

function generateHeuristicAnalysis(stock, quote, fund, quarters) {
  let score = 50;
  const bullPoints = [];
  const bearPoints = [];
  
  // Profitability
  if (fund.roe > 20) { score += 15; bullPoints.push(`Exceptional Return on Equity (ROE) of ${fund.roe}%, indicating highly efficient capital allocation.`); }
  else if (fund.roe > 12) { score += 5; bullPoints.push(`Solid ROE of ${fund.roe}%, showing stable profitability.`); }
  else if (fund.roe < 5 && fund.roe !== null) { score -= 10; bearPoints.push(`Poor ROE (${fund.roe}%), suggesting inefficient use of shareholder equity.`); }

  if (fund.roce > 20) { score += 10; bullPoints.push(`Strong ROCE (${fund.roce}%), proving the core business generates excellent operational returns.`); }

  // Valuation
  if (fund.pe_ratio > 0 && fund.pe_ratio < 15) { score += 15; bullPoints.push(`Highly attractive valuation with a P/E ratio of ${fund.pe_ratio}x, trading at a discount to broader markets.`); }
  else if (fund.pe_ratio > 50) { score -= 15; bearPoints.push(`Stretched valuation with a high P/E ratio of ${fund.pe_ratio}x, pricing in significant future growth.`); }
  
  // Leverage
  if (fund.debt_to_equity < 0.2) { score += 10; bullPoints.push(`Virtually debt-free balance sheet (D/E: ${fund.debt_to_equity}), minimizing financial risk.`); }
  else if (fund.debt_to_equity > 1.5) { score -= 15; bearPoints.push(`Highly leveraged balance sheet (D/E: ${fund.debt_to_equity}), posing risks in high-interest rate environments.`); }

  // Growth (Last 4 quarters)
  const recentQ = quarters.slice(-4);
  if (recentQ.length >= 2) {
    const latest = recentQ[recentQ.length - 1];
    if (latest.rev_growth_yoy > 15) { score += 10; bullPoints.push(`Robust top-line momentum, accelerating revenue by ${latest.rev_growth_yoy}% YoY in the latest quarter.`); }
    else if (latest.rev_growth_yoy < 0) { score -= 10; bearPoints.push(`Revenue contracted by ${latest.rev_growth_yoy}% YoY, indicating demand headwinds or cyclical down-turn.`); }
  }

  // Normalize
  score = Math.max(10, Math.min(99, Math.round(score)));

  let verdict = '';
  if (score >= 80) verdict = `${stock.name} demonstrates outstanding fundamental strength with a pristine balance sheet and excellent capital efficiency. The current valuation profile combined with its operational metrics makes it a top-tier asset in the ${stock.sector || 'market'}.`;
  else if (score >= 60) verdict = `${stock.name} is a fundamentally stable company with solid execution in its space. While it possesses strong core metrics, investors should weigh its current valuation against near-term macro headwinds.`;
  else verdict = `${stock.name} is currently facing structural headwinds, reflected in its suboptimal return ratios and leverage metrics. A turnaround or multiple-re-rating is heavily contingent on management execution in upcoming quarters.`;

  if (bullPoints.length === 0) bullPoints.push('Stable operational history in its respective sector.');
  if (bearPoints.length === 0) bearPoints.push('Vulnerable to broader macroeconomic shifts and sector rotation.');

  return {
    score,
    verdict,
    bullPoints,
    bearPoints,
    engine: 'EquiSense Algorithm'
  };
}
