import * as db from '../db.js';

export async function generateAIAnalysis(ticker, force = false) {
  if (!force) {
    const cached = db.getAIAnalysis(ticker);
    if (cached) return cached;
  }

  const stock = db.getStock(ticker);
  const quote = db.getQuote(ticker);
  const fund = db.getFundamentals(ticker);
  const quarters = db.getQuarterlies(ticker);

  if (!stock || !quote || !fund) {
    throw new Error('Data missing for AI analysis');
  }

  let result = null;
  // If GEMINI_API_KEY is provided, use it
  if (process.env.GEMINI_API_KEY) {
    try {
      result = await callGeminiAPI(stock, quote, fund, quarters);
    } catch (e) {
      console.error('Gemini API failed, falling back to local heuristic engine', e);
    }
  }

  // Local Heuristic "AI" Fallback
  if (!result) {
    result = generateHeuristicAnalysis(stock, quote, fund, quarters);
  }

  // Persist the generated analysis to the database
  db.upsertAIAnalysis({
    ticker,
    ...result
  });

  return result;
}

export function getSavedAIAnalysis(ticker) {
  return db.getAIAnalysis(ticker);
}

async function callGeminiAPI(stock, quote, fund, quarters) {
  const prompt = `
    You are a senior institutional equity research analyst. Conduct a thorough 360° equity analysis of ${stock.name} (${stock.ticker}) in the ${stock.sector || 'Indian equity'} sector.
    
    Financial Data:
    - Company: ${stock.name} (${stock.ticker})
    - Sector: ${stock.sector || 'N/A'}, Industry: ${stock.industry || 'N/A'}
    - Current Price: ₹${quote.price} (52W High: ₹${fund.high_52w || 'N/A'}, 52W Low: ₹${fund.low_52w || 'N/A'})
    - Valuation: P/E: ${fund.pe_ratio || 'N/A'}x, P/B: ${fund.pb_ratio || 'N/A'}x, EV/EBITDA: ${fund.ev_ebitda || 'N/A'}x
    - Profitability: ROE: ${fund.roe || 'N/A'}%, ROCE: ${fund.roce || 'N/A'}%
    - Leverage: Debt to Equity: ${fund.debt_to_equity != null ? fund.debt_to_equity : 'N/A'}
    - Quarterly Revenue & Profit History: ${quarters.slice(-4).map(q => `${q.quarter}: Rev ₹${q.revenue} Cr (YoY ${q.rev_growth_yoy || 0}%), PAT ₹${q.pat} Cr`).join('; ')}

    Return a JSON object strictly matching this schema with no markdown formatting or commentary:
    {
      "score": <0-100 weighted score: Capital Efficiency (15%), Growth (15%), Solvency (15%), Valuation (15%), Corporate Governance (20%), Future Potential (20%)>,
      "verdict": "<2-sentence sharp synthesis of investment thesis and risk-reward profile>",
      "parameterScores": {
        "capitalEfficiency": <0-100>,
        "growth": <0-100>,
        "solvency": <0-100>,
        "valuation": <0-100>,
        "corporateGovernance": <0-100 score on promoter integrity, board quality, alignment, and disclosure standards>,
        "futurePotential": <0-100 score on sector runway, Indian Capex/TAM tailwinds, moat, and capacity scaling>
      },
      "governanceNotes": "<1-2 sentences on management credibility, promoter pledging, institutional holding, and accounting transparency>",
      "bullPoints": [
        "<Key operational or margin catalyst 1>",
        "<Key operational or margin catalyst 2>"
      ],
      "bearPoints": [
        "<Key financial risk or near-term headwind 1>",
        "<Key financial risk or near-term headwind 2>"
      ],
      "futurePoints": [
        "<Secular industry trend, market expansion, or technological transition catalyst 1>",
        "<Capacity expansion, TAM tailwind, or order book runway 2>"
      ]
    }
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
  
  // Extract text from the Interactions API response structure
  const outputStep = data.steps.find(s => s.type === 'model_output');
  const rawText = outputStep.content[0].text;
  
  const cleanText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
  const result = JSON.parse(cleanText);
  result.engine = 'Gemini 3.5 Flash';
  return result;
}

function generateHeuristicAnalysis(stock, quote, fund, quarters) {
  const bullPoints = [];
  const bearPoints = [];
  const futurePoints = [];

  // 1. Capital Efficiency (15%)
  let capEff = 50;
  if (fund.roe > 20) {
    capEff = 90;
    bullPoints.push(`Exceptional Return on Equity (ROE: ${fund.roe}%), indicating superior capital productivity.`);
  } else if (fund.roe > 12) {
    capEff = 75;
    bullPoints.push(`Solid ROE (${fund.roe}%), demonstrating steady shareholder value generation.`);
  } else if (fund.roe < 5 && fund.roe !== null) {
    capEff = 30;
    bearPoints.push(`Depressed ROE (${fund.roe}%), reflecting suboptimal asset utilization.`);
  }
  if (fund.roce > 20) {
    capEff = Math.min(100, capEff + 10);
    bullPoints.push(`Strong ROCE (${fund.roce}%), proving operational capital efficiency.`);
  }

  // 2. Growth Momentum (15%)
  let growth = 50;
  const recentQ = quarters.slice(-4);
  if (recentQ.length >= 2) {
    const latest = recentQ[recentQ.length - 1];
    if (latest.rev_growth_yoy > 20) {
      growth = 90;
      bullPoints.push(`Top-line momentum with revenue expanding by ${latest.rev_growth_yoy}% YoY in recent quarter.`);
    } else if (latest.rev_growth_yoy > 10) {
      growth = 75;
      bullPoints.push(`Healthy revenue expansion (+${latest.rev_growth_yoy}% YoY).`);
    } else if (latest.rev_growth_yoy < 0) {
      growth = 30;
      bearPoints.push(`Sales contraction of ${latest.rev_growth_yoy}% YoY flags cyclical demand friction.`);
    }
  }

  // 3. Solvency & Balance Sheet (15%)
  let solvency = 60;
  if (fund.debt_to_equity != null) {
    if (fund.debt_to_equity < 0.2) {
      solvency = 95;
      bullPoints.push(`Virtually unleveraged balance sheet (D/E: ${fund.debt_to_equity}), insulating earnings against interest rate cycles.`);
    } else if (fund.debt_to_equity > 1.5) {
      solvency = 30;
      bearPoints.push(`Elevated debt levels (D/E: ${fund.debt_to_equity}) limit balance sheet flexibility during downcycles.`);
    } else {
      solvency = 70;
    }
  }

  // 4. Valuation & Margin of Safety (15%)
  let valuation = 50;
  if (fund.pe_ratio > 0 && fund.pe_ratio < 18) {
    valuation = 85;
    bullPoints.push(`Attractively valued at ${fund.pe_ratio}x P/E, offering defensive margin of safety.`);
  } else if (fund.pe_ratio > 50) {
    valuation = 35;
    bearPoints.push(`Stretched valuation (${fund.pe_ratio}x P/E) prices in flawless execution with little margin of safety.`);
  } else {
    valuation = 60;
  }

  // 5. Corporate Governance & Integrity (20%)
  let corporateGovernance = 80;
  let governanceNotes = "Board governance and compliance disclosures adhere to standard regulatory guidelines.";
  if (solvency >= 80 && capEff >= 70) {
    corporateGovernance = 88;
    governanceNotes = "High capital allocation discipline, transparent reporting standards, and low balance sheet encumbrance.";
  } else if (solvency < 40) {
    corporateGovernance = 55;
    governanceNotes = "Leverage accumulation warrants monitoring of cash flow fungibility and debt servicing commitments.";
  }

  // 6. Future Potential & Industry Tailwinds (20%)
  let futurePotential = 75;
  const sector = (stock.sector || '').toLowerCase();
  if (sector.includes('tech') || sector.includes('auto') || sector.includes('energy') || sector.includes('capital') || sector.includes('industrial')) {
    futurePotential = 85;
    futurePoints.push(`Multi-year secular tailwinds driven by domestic Indian Capex expansion and industrial localization.`);
    futurePoints.push(`Capacity scaling positioning company for expanding operating leverage as broader sector TAM grows.`);
  } else {
    futurePotential = 70;
    futurePoints.push(`Steady market penetration with opportunities to gain market share from unorganized industry peers.`);
    futurePoints.push(`Operational efficiency gains expected to support sustained cash flow generation.`);
  }

  // Weighted Total Score (0-100)
  const weightedScore = Math.round(
    capEff * 0.15 +
    growth * 0.15 +
    solvency * 0.15 +
    valuation * 0.15 +
    corporateGovernance * 0.20 +
    futurePotential * 0.20
  );
  const score = Math.max(10, Math.min(99, weightedScore));

  let verdict = '';
  if (score >= 80) {
    verdict = `${stock.name} demonstrates institutional-grade fundamentals backed by robust capital productivity and secular industry tailwinds. Its strategic moat and clean balance sheet position it for sustained multi-year outperformance.`;
  } else if (score >= 60) {
    verdict = `${stock.name} is fundamentally stable with healthy core metrics and steady execution. Investors should balance its growth pipeline against valuation headroom and broader market cyclicality.`;
  } else {
    verdict = `${stock.name} faces structural or cyclical operational headwinds, reflected in its current financial return profile. Any multi-year valuation re-rating hinges on management execution and margin stabilization in coming quarters.`;
  }

  if (bullPoints.length === 0) bullPoints.push('Established presence in its respective operating segment.');
  if (bearPoints.length === 0) bearPoints.push('Exposed to general macroeconomic slowdowns and sector rotation.');
  if (futurePoints.length === 0) futurePoints.push('Long-term market expansion tied to domestic consumption and industrial growth.');

  return {
    score,
    verdict,
    parameterScores: {
      capitalEfficiency: capEff,
      growth,
      solvency,
      valuation,
      corporateGovernance,
      futurePotential
    },
    governanceNotes,
    bullPoints,
    bearPoints,
    futurePoints,
    engine: 'stock.ai Algorithm'
  };
}
