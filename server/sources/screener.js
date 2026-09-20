import axios from 'axios';
import * as cheerio from 'cheerio';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
const TIMEOUT = 8000;

// ── Fetch & Parse ───────────────────────────────────────────────────────────

export async function fetchScreenerData(ticker) {
  const t = ticker.toUpperCase();
  let html = null;

  // Try consolidated first, then standalone
  for (const suffix of ['/consolidated/', '/']) {
    try {
      const url = `https://www.screener.in/company/${t}${suffix}`;
      const { data, status } = await axios.get(url, {
        headers: { 'User-Agent': UA },
        timeout: TIMEOUT,
        validateStatus: (s) => s < 500,
      });
      if (status === 200 && data) { html = data; break; }
    } catch { /* try next */ }
  }

  if (!html) return null;

  const $ = cheerio.load(html);
  return {
    ratios: extractRatios($),
    quarters: extractQuarterlies($),
  };
}

// ── Ratio Extraction ────────────────────────────────────────────────────────

function extractRatios($) {
  const ratios = {};

  $('#top-ratios li').each((_, li) => {
    const name = $(li).find('.name').text().trim();
    const nums = [];
    $(li).find('.number').each((_, n) => nums.push($(n).text().trim()));

    switch (name) {
      case 'Market Cap':
        ratios.market_cap_cr = parseNum(nums[0]);
        break;
      case 'Stock P/E':
        ratios.pe_ratio = parseNum(nums[0]);
        break;
      case 'High / Low':
        ratios.high_52w = parseNum(nums[0]);
        ratios.low_52w = parseNum(nums[1]);
        break;
      case 'ROCE':
        ratios.roce = parseNum(nums[0]);
        break;
      case 'ROE':
        ratios.roe = parseNum(nums[0]);
        break;
      case 'Debt to equity':
        ratios.debt_to_equity = parseNum(nums[0]);
        break;
      case 'Book Value':
        ratios.book_value = parseNum(nums[0]);
        break;
      case 'Dividend Yield':
        ratios.dividend_yield = parseNum(nums[0]);
        break;
    }
  });

  return ratios;
}

// ── Quarterly Financials ────────────────────────────────────────────────────

function extractQuarterlies($) {
  const section = $('#quarters');
  if (!section.length) return [];

  // Column headers (quarter names)
  const ths = [];
  section.find('thead th').each((_, th) => ths.push($(th).text().trim()));

  // Helper: extract row values by checking if the first cell includes the label
  const getRowByFirstCell = (label) => {
    const vals = [];
    section.find('tbody tr').each((_, tr) => {
      const firstCell = $(tr).find('td').first().text().trim();
      if (firstCell.includes(label)) {
        $(tr).find('td').each((i, td) => {
          if (i === 0) return; // skip label cell
          vals.push($(td).text().trim());
        });
      }
    });
    return vals;
  };

  const salesFinal = getRowByFirstCell('Sales');
  const npFinal = getRowByFirstCell('Net Profit');
  const epsFinal = getRowByFirstCell('EPS');
  const opmFinal = getRowByFirstCell('OPM');

  const quarters = [];
  // ths[0] is empty or "Quarter" header; data starts at index 1
  for (let i = 1; i < ths.length; i++) {
    const dataIdx = i - 1;
    if (!ths[i] || !salesFinal[dataIdx]) continue;

    const rev = parseNum(salesFinal[dataIdx]);
    const pat = parseNum(npFinal[dataIdx]);
    if (rev == null) continue; // skip empty columns

    quarters.push({
      quarter: ths[i],
      revenue: rev,
      pat: pat,
      eps: parseNum(epsFinal[dataIdx]),
      opm_percent: parseNum(opmFinal[dataIdx]?.replace(/%/g, '')),
      rev_growth_yoy: null, // computed after collection
      pat_growth_yoy: null,
    });
  }

  // Compute YoY growth (quarter vs same quarter last year = index - 4)
  for (let i = 4; i < quarters.length; i++) {
    const prev = quarters[i - 4];
    if (prev.revenue && prev.revenue !== 0) {
      quarters[i].rev_growth_yoy = round(((quarters[i].revenue - prev.revenue) / Math.abs(prev.revenue)) * 100);
    }
    if (prev.pat && prev.pat !== 0) {
      quarters[i].pat_growth_yoy = round(((quarters[i].pat - prev.pat) / Math.abs(prev.pat)) * 100);
    }
  }

  return quarters;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function parseNum(str) {
  if (!str) return null;
  const cleaned = str.replace(/,/g, '').replace(/%/g, '').trim();
  const val = parseFloat(cleaned);
  return isNaN(val) ? null : val;
}

function round(v) {
  if (v == null || isNaN(v)) return null;
  return Math.round(v * 100) / 100;
}
