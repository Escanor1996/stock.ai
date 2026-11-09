import * as db from '../db.js';
import { getStockData, normalizeTicker } from './stockService.js';
// ── 1. Decoupled AI 360° Score Engine ────────────────────────────────────────

export async function generateAIScore(ticker, force = false) {
  const t = normalizeTicker(ticker);
  if (!force) {
    const cached = db.getAIAnalysis(t);
    if (cached && cached.score != null) {
      return {
        score: cached.score,
        parameterScores: cached.parameterScores || {},
        engine: cached.engine || 'stock.ai Algorithm'
      };
    }
  }

  let stock = db.getStock(t);
  let quote = db.getQuote(t);
  let fund = db.getFundamentals(t);
  let quarters = db.getQuarterlies(t);

  // If data missing in DB, automatically pre-fetch it
  if (!stock || !quote || !fund) {
    try {
      await getStockData(t);
      stock = db.getStock(t);
      quote = db.getQuote(t);
      fund = db.getFundamentals(t);
      quarters = db.getQuarterlies(t);
    } catch (e) {
      console.error(`Auto-fetch stock data failed for ${t}:`, e.message);
    }
  }

  // Provide safe fallback objects so AI analysis never hard-crashes on missing/partial vendor feeds
  stock = stock || { ticker: t, name: t, sector: 'Equity', industry: 'Diversified' };
  quote = quote || { price: 0, change: 0, change_percent: 0 };
  fund = fund || { ticker: t, pe_ratio: null, pb_ratio: null, roe: null, roce: null, debt_to_equity: null };
  quarters = quarters || [];

  let result = null;
  if (process.env.GEMINI_API_KEY) {
    try {
      result = await callGeminiScoreAPI(stock, quote, fund, quarters);
    } catch (e) {
      console.error('Gemini Score API failed, using heuristic score engine:', e.message);
    }
  }

  if (!result) {
    result = computeHeuristicScore(stock, quote, fund, quarters);
  }

  // Persist score independently
  db.upsertAIScore({
    ticker: t,
    score: result.score,
    parameterScores: result.parameterScores,
    engine: result.engine
  });
  const origTicker = ticker ? ticker.toUpperCase().trim() : '';
  if (origTicker && origTicker !== t) {
    db.upsertAIScore({
      ticker: origTicker,
      score: result.score,
      parameterScores: result.parameterScores,
      engine: result.engine
    });
  }

  return result;
}

// ── 2. Decoupled Fin-LLM 360° Verdict Engine ─────────────────────────────────

export async function generateAIVerdict(ticker, force = false) {
  const t = normalizeTicker(ticker);
  if (!force) {
    const cached = db.getAIAnalysis(t);
    if (cached && cached.verdict) {
      return {
        verdict: cached.verdict,
        governanceNotes: cached.governanceNotes || '',
        bullPoints: cached.bullPoints || [],
        bearPoints: cached.bearPoints || [],
        futurePoints: cached.futurePoints || [],
        engine: cached.engine || 'stock.ai Algorithm'
      };
    }
  }

  let stock = db.getStock(t);
  let quote = db.getQuote(t);
  let fund = db.getFundamentals(t);
  let quarters = db.getQuarterlies(t);

  // If data missing in DB, automatically pre-fetch it
  if (!stock || !quote || !fund) {
    try {
      await getStockData(t);
      stock = db.getStock(t);
      quote = db.getQuote(t);
      fund = db.getFundamentals(t);
      quarters = db.getQuarterlies(t);
    } catch (e) {
      console.error(`Auto-fetch stock data failed for ${t}:`, e.message);
    }
  }

  // Provide safe fallback objects so AI analysis never hard-crashes on missing/partial vendor feeds
  stock = stock || { ticker: t, name: t, sector: 'Equity', industry: 'Diversified' };
  quote = quote || { price: 0, change: 0, change_percent: 0 };
  fund = fund || { ticker: t, pe_ratio: null, pb_ratio: null, roe: null, roce: null, debt_to_equity: null };
  quarters = quarters || [];

  let result = null;
  if (process.env.GEMINI_API_KEY) {
    try {
      result = await callGeminiVerdictAPI(stock, quote, fund, quarters);
    } catch (e) {
      console.error('Gemini Verdict API failed, using heuristic verdict engine:', e.message);
    }
  }

  if (!result) {
    result = computeHeuristicVerdict(stock, quote, fund, quarters);
  }

  // Persist verdict independently
  db.upsertAIVerdict({
    ticker: t,
    verdict: result.verdict,
    bullPoints: result.bullPoints,
    bearPoints: result.bearPoints,
    futurePoints: result.futurePoints,
    governanceNotes: result.governanceNotes,
    engine: result.engine
  });
  const origTicker = ticker ? ticker.toUpperCase().trim() : '';
  if (origTicker && origTicker !== t) {
    db.upsertAIVerdict({
      ticker: origTicker,
      verdict: result.verdict,
      bullPoints: result.bullPoints,
      bearPoints: result.bearPoints,
      futurePoints: result.futurePoints,
      governanceNotes: result.governanceNotes,
      engine: result.engine
    });
  }

  return result;
}

// ── Combined Legacy Entry ───────────────────────────────────────────────────

export async function generateAIAnalysis(ticker, force = false) {
  const [scoreResult, verdictResult] = await Promise.all([
    generateAIScore(ticker, force),
    generateAIVerdict(ticker, force)
  ]);

  return {
    ...scoreResult,
    ...verdictResult,
    engine: verdictResult.engine || scoreResult.engine
  };
}

export function getSavedAIAnalysis(ticker) {
  return db.getAIAnalysis(ticker);
}

// ── Gemini Specialized Prompts ──────────────────────────────────────────────

/**
 * Executes LLM request with generous 90-second timeout.
 * Mirrors stock-ai-android: tries Google Interactions API (gemini-3.5-flash) first,
 * falling back to multi-model generateContent API (gemini-3.5-flash, gemini-3.6-flash,
 * gemini-flash-lite-latest, gemini-3.8-flash) before heuristic fallback.
 */
export async function callLlmWithFallback(prompt, apiKey = process.env.GEMINI_API_KEY) {
  if (!apiKey || !apiKey.trim()) {
    throw new Error('GEMINI_API_KEY is not configured');
  }
  const cleanKey = apiKey.trim();

  // Attempt 1: Google Generative Language Interactions API (gemini-3.5-flash)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000);

    const resp = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': cleanKey,
        'Api-Revision': '2026-05-20'
      },
      body: JSON.stringify({
        model: 'gemini-3.5-flash',
        input: prompt
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (resp.ok) {
      const data = await resp.json();
      const outputStep = data.steps?.find(s => s.type === 'model_output');
      const text = outputStep?.content?.[0]?.text;
      if (text && text.trim().length > 0) {
        return { text: text.trim(), engine: 'Gemini 3.5 Flash' };
      }
    } else {
      const errText = await resp.text().catch(() => '');
      console.warn(`Interactions API response code ${resp.status}: ${errText.slice(0, 150)}`);
    }
  } catch (err) {
    console.warn(`Interactions API error (${err.message}), trying generateContent fallbacks...`);
  }

  // Multi-tier fallback on generateContent across reliable models
  const fallbackModels = ['gemini-3.5-flash', 'gemini-3.6-flash', 'gemini-flash-lite-latest', 'gemini-3.8-flash'];
  let lastError = null;

  for (const model of fallbackModels) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 90000);

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(cleanKey)}`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': cleanKey
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            responseMimeType: 'application/json'
          }
        }),
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (resp.ok) {
        const data = await resp.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text && text.trim().length > 0) {
          const engineLabel = model === 'gemini-3.5-flash'
            ? 'Gemini 3.5 Flash'
            : model === 'gemini-3.6-flash'
              ? 'Gemini 3.6 Flash'
              : model === 'gemini-flash-lite-latest'
                ? 'Gemini Flash Lite'
                : 'Gemini 3.8 Flash';
          return { text: text.trim(), engine: engineLabel };
        }
      } else {
        const errText = await resp.text().catch(() => '');
        console.warn(`generateContent for ${model} returned code ${resp.status}: ${errText.slice(0, 150)}`);
        lastError = new Error(`generateContent for ${model} returned ${resp.status}: ${errText.slice(0, 100)}`);
      }
    } catch (err) {
      console.warn(`generateContent for ${model} error: ${err.message}`);
      lastError = err;
    }
  }

  throw lastError || new Error('All Gemini live fallback endpoints failed');
}

function parseJsonFromText(rawText) {
  let clean = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(clean);
  } catch (err) {
    const firstBrace = clean.indexOf('{');
    const lastBrace = clean.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(clean.slice(firstBrace, lastBrace + 1));
    }
    throw err;
  }
}

async function callGeminiScoreAPI(stock, quote, fund, quarters) {
  const prompt = `
    You are an institutional equity quantitative analyst. Evaluate ${stock.name} (${stock.ticker}) across 6 core pillars and return 0-100 scores for each.
    
    Data:
    - Sector: ${stock.sector || 'N/A'}, Industry: ${stock.industry || 'N/A'}
    - Price: ₹${quote.price} (52W High: ₹${fund.high_52w || 'N/A'}, 52W Low: ₹${fund.low_52w || 'N/A'})
    - P/E: ${fund.pe_ratio || 'N/A'}x, P/B: ${fund.pb_ratio || 'N/A'}x, EV/EBITDA: ${fund.ev_ebitda || 'N/A'}x
    - ROE: ${fund.roe || 'N/A'}%, ROCE: ${fund.roce || 'N/A'}%
    - Debt to Equity: ${fund.debt_to_equity != null ? fund.debt_to_equity : 'N/A'}
    - Recent Quarters: ${quarters.slice(-4).map(q => `${q.quarter}: Rev ₹${q.revenue} Cr, PAT ₹${q.pat} Cr`).join('; ')}

    Return JSON only with this structure:
    {
      "score": <0-100 weighted total: Capital Efficiency (15%), Growth (15%), Solvency (15%), Valuation (15%), Corporate Governance (20%), Future Potential (20%)>,
      "parameterScores": {
        "capitalEfficiency": <0-100 score>,
        "growth": <0-100 score>,
        "solvency": <0-100 score>,
        "valuation": <0-100 score>,
        "corporateGovernance": <0-100 score on promoter integrity and board disclosures>,
        "futurePotential": <0-100 score on sector runway, Indian Capex/TAM growth, and moat>
      }
    }
  `;

  const { text, engine } = await callLlmWithFallback(prompt);
  const result = parseJsonFromText(text);
  const score = Math.max(10, Math.min(99, Math.round(Number(result.score) || 75)));
  const parameterScores = {};
  if (result.parameterScores && typeof result.parameterScores === 'object') {
    for (const [k, v] of Object.entries(result.parameterScores)) {
      parameterScores[k] = Math.max(0, Math.min(100, Math.round(Number(v) || 70)));
    }
  }

  return {
    score,
    parameterScores,
    engine
  };
}

async function callGeminiVerdictAPI(stock, quote, fund, quarters) {
  const prompt = `
    You are a senior institutional equity research analyst. Synthesize a qualitative 360° research thesis for ${stock.name} (${stock.ticker}).
    
    Data:
    - Sector: ${stock.sector || 'N/A'}, Industry: ${stock.industry || 'N/A'}
    - Price: ₹${quote.price}
    - P/E: ${fund.pe_ratio || 'N/A'}x, P/B: ${fund.pb_ratio || 'N/A'}x, D/E: ${fund.debt_to_equity != null ? fund.debt_to_equity : 'N/A'}
    - ROE: ${fund.roe || 'N/A'}%, ROCE: ${fund.roce || 'N/A'}%
    - Recent Quarters: ${quarters.slice(-4).map(q => `${q.quarter}: Rev ₹${q.revenue} Cr, PAT ₹${q.pat} Cr`).join('; ')}

    Return JSON only with this structure:
    {
      "verdict": "<2-sentence sharp synthesis of investment thesis and valuation risk-reward>",
      "governanceNotes": "<1-2 sentences on board quality, promoter pledging, institutional alignment, and accounting disclosures>",
      "bullPoints": [
        "<Key operational catalyst 1>",
        "<Key operational catalyst 2>"
      ],
      "bearPoints": [
        "<Key financial risk or margin headwind 1>",
        "<Key financial risk or margin headwind 2>"
      ],
      "futurePoints": [
        "<Secular industry trend, market expansion, or technological transition trigger 1>",
        "<Capacity expansion, TAM tailwind, or order book runway 2>"
      ]
    }
  `;

  const { text, engine } = await callLlmWithFallback(prompt);
  const result = parseJsonFromText(text);

  return {
    verdict: typeof result.verdict === 'string' ? result.verdict : '',
    governanceNotes: typeof result.governanceNotes === 'string' ? result.governanceNotes : '',
    bullPoints: Array.isArray(result.bullPoints) ? result.bullPoints.map(String) : [],
    bearPoints: Array.isArray(result.bearPoints) ? result.bearPoints.map(String) : [],
    futurePoints: Array.isArray(result.futurePoints) ? result.futurePoints.map(String) : [],
    engine
  };
}

// ── Heuristic Scoring & Verdict Implementations ─────────────────────────────

function computeHeuristicScore(stock, quote, fund, quarters) {
  // 1. Capital Efficiency (15%)
  let capEff = 50;
  if (fund.roe > 20) capEff = 90;
  else if (fund.roe > 12) capEff = 75;
  else if (fund.roe < 5 && fund.roe !== null) capEff = 30;
  if (fund.roce > 20) capEff = Math.min(100, capEff + 10);

  // 2. Growth Momentum (15%)
  let growth = 50;
  const recentQ = quarters.slice(-4);
  if (recentQ.length >= 2) {
    const latest = recentQ[recentQ.length - 1];
    if (latest.rev_growth_yoy > 20) growth = 90;
    else if (latest.rev_growth_yoy > 10) growth = 75;
    else if (latest.rev_growth_yoy < 0) growth = 30;
  }

  // 3. Solvency (15%)
  let solvency = 60;
  if (fund.debt_to_equity != null) {
    if (fund.debt_to_equity < 0.2) solvency = 95;
    else if (fund.debt_to_equity > 1.5) solvency = 30;
    else solvency = 70;
  }

  // 4. Valuation (15%)
  let valuation = 50;
  if (fund.pe_ratio > 0 && fund.pe_ratio < 18) valuation = 85;
  else if (fund.pe_ratio > 50) valuation = 35;
  else valuation = 60;

  // 5. Corporate Governance (20%)
  let corporateGovernance = 80;
  if (solvency >= 80 && capEff >= 70) corporateGovernance = 88;
  else if (solvency < 40) corporateGovernance = 55;

  // 6. Future Potential (20%)
  const sector = (stock.sector || '').toLowerCase();
  let futurePotential = 70;
  if (sector.includes('tech') || sector.includes('auto') || sector.includes('energy') || sector.includes('capital') || sector.includes('industrial')) {
    futurePotential = 85;
  }

  const weightedScore = Math.round(
    capEff * 0.15 +
    growth * 0.15 +
    solvency * 0.15 +
    valuation * 0.15 +
    corporateGovernance * 0.20 +
    futurePotential * 0.20
  );
  const score = Math.max(10, Math.min(99, weightedScore));

  return {
    score,
    parameterScores: {
      capitalEfficiency: capEff,
      growth,
      solvency,
      valuation,
      corporateGovernance,
      futurePotential
    },
    engine: 'stock.ai Algorithm'
  };
}

function computeHeuristicVerdict(stock, quote, fund, quarters) {
  const bullPoints = [];
  const bearPoints = [];
  const futurePoints = [];

  if (fund.roe > 15) bullPoints.push(`Strong Return on Equity (ROE: ${fund.roe}%), proving efficient capital allocation.`);
  if (fund.roce > 18) bullPoints.push(`Solid ROCE (${fund.roce}%), demonstrating operational return discipline.`);
  if (fund.debt_to_equity != null && fund.debt_to_equity < 0.3) bullPoints.push(`Conservative balance sheet with low leverage (D/E: ${fund.debt_to_equity}).`);

  if (fund.pe_ratio > 50) bearPoints.push(`Valuation multiple (${fund.pe_ratio}x P/E) reflects elevated expectations with modest margin of safety.`);
  if (fund.debt_to_equity != null && fund.debt_to_equity > 1.2) bearPoints.push(`Elevated debt levels (D/E: ${fund.debt_to_equity}) increase sensitivity to macro interest rate shifts.`);

  const recentQ = quarters.slice(-4);
  if (recentQ.length >= 1) {
    const latest = recentQ[recentQ.length - 1];
    if (latest.rev_growth_yoy < 0) bearPoints.push(`Recent quarterly revenue contracted by ${latest.rev_growth_yoy}% YoY.`);
  }

  const sector = (stock.sector || '').toLowerCase();
  if (sector.includes('tech') || sector.includes('auto') || sector.includes('energy') || sector.includes('capital') || sector.includes('industrial')) {
    futurePoints.push(`Multi-year secular tailwinds driven by domestic Indian Capex expansion and industrial localization.`);
    futurePoints.push(`Capacity scaling positioning company for expanding operating leverage as broader sector TAM grows.`);
  } else {
    futurePoints.push(`Steady market penetration with opportunities to gain market share from unorganized industry peers.`);
    futurePoints.push(`Operational efficiency gains expected to support sustained cash flow generation.`);
  }

  if (bullPoints.length === 0) bullPoints.push('Established presence in its respective operating segment.');
  if (bearPoints.length === 0) bearPoints.push('Exposed to general macroeconomic slowdowns and sector rotation.');

  let governanceNotes = "Board governance and compliance disclosures adhere to standard regulatory guidelines.";
  if (fund.debt_to_equity != null && fund.debt_to_equity < 0.5) {
    governanceNotes = "High capital allocation discipline, transparent reporting standards, and clean balance sheet structure.";
  }

  let verdict = `${stock.name} presents a balanced risk-reward profile supported by stable core operations. Investors should monitor quarterly margin execution against industry tailwinds.`;
  if (fund.roe > 20) {
    verdict = `${stock.name} demonstrates superior fundamental productivity with high capital efficiency and secular industry runway, positioning it well for long-term compounding.`;
  }

  return {
    verdict,
    governanceNotes,
    bullPoints,
    bearPoints,
    futurePoints,
    engine: 'stock.ai Algorithm'
  };
}
