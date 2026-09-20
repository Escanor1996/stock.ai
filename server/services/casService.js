import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as yahoo from '../sources/yahoo.js';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Resolve Python executable and script
const projectRoot = path.join(__dirname, '..', '..');
const venvPython = path.join(__dirname, '..', 'venv', 'bin', 'python');
const systemPython = 'python3';
const pythonBin = fs.existsSync(venvPython) ? venvPython : systemPython;
const parserScript = path.join(__dirname, 'cas_parser.py');

/**
 * Parses a CAS PDF using the Python bridge.
 * @param {string} filePath - Absolute path to uploaded PDF
 * @param {string} password - PDF password (e.g. PAN in uppercase)
 * @param {boolean} enrichPrices - Whether to enrich with live market prices
 * @returns {Promise<Object>}
 */
export async function parseCASFile(filePath, password = '', enrichPrices = true) {
  try {
    let stdout, stderr;
    try {
      const res = await execFileAsync(pythonBin, [parserScript, filePath, password || ''], {
        maxBuffer: 20 * 1024 * 1024,
        timeout: 45000
      });
      stdout = res.stdout;
      stderr = res.stderr;
    } catch (execErr) {
      stdout = execErr.stdout;
      stderr = execErr.stderr;
      if (!stdout || !stdout.trim()) {
        const errorMsg = stderr ? stderr.trim().split('\n').pop() : execErr.message;
        throw new Error(errorMsg || 'Failed to execute statement parser');
      }
    }

    let result;
    try {
      result = JSON.parse(stdout);
    } catch (parseErr) {
      console.error('Failed to parse Python JSON output:', stdout, stderr);
      const cleanError = stderr ? stderr.trim().split('\n').pop() : 'Parser returned malformed output';
      throw new Error(cleanError);
    }

    if (!result.success) {
      const err = new Error(result.message || 'Failed to parse CAS file');
      err.errorType = result.error_type;
      throw err;
    }
    // Enrich equity holdings with live prices if requested
    if (enrichPrices && result.holdings && result.holdings.length > 0) {
      result.holdings = await enrichWithLiveQuotes(result.holdings);
      
      // Recalculate live portfolio summary
      let liveTotal = 0;
      let costTotal = 0;

      for (const h of result.holdings) {
        liveTotal += (h.live_value || h.value || 0);
        costTotal += (h.value || 0);
      }

      result.summary.live_equities_value = Math.round(liveTotal * 100) / 100;
      result.summary.unrealized_gain = Math.round((liveTotal - costTotal) * 100) / 100;
      result.summary.unrealized_gain_pct = costTotal > 0 ? Math.round(((liveTotal - costTotal) / costTotal) * 10000) / 100 : 0;
      result.summary.total_portfolio_value = Math.round((liveTotal + (result.summary.total_mf_value || 0) + (result.summary.total_bonds_value || 0)) * 100) / 100;

      // Recalculate weights based on live values
      for (const h of result.holdings) {
        h.weight_pct = liveTotal > 0 ? Math.round(((h.live_value || h.value) / liveTotal) * 10000) / 100 : 0;
      }
    }

    return result;
  } finally {
    // Securely delete temporary file
    if (filePath && fs.existsSync(filePath)) {
      try {
        await fs.promises.unlink(filePath);
      } catch (cleanupErr) {
        console.warn('Failed to delete temporary CAS file:', cleanupErr.message);
      }
    }
  }
}

/**
 * Concurrently enrich holdings with live quotes from Yahoo Finance (batched).
 */
async function enrichWithLiveQuotes(holdings) {
  const enriched = [...holdings];
  const BATCH_SIZE = 5;

  for (let i = 0; i < enriched.length; i += BATCH_SIZE) {
    const batch = enriched.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (item) => {
        if (!item.symbol) return;
        try {
          const q = await yahoo.fetchQuote(item.symbol);
          if (q && q.price) {
            item.live_price = q.price;
            item.live_change = q.change;
            item.live_change_percent = q.change_percent;
            item.live_value = Math.round(item.quantity * q.price * 100) / 100;
            item.gain = Math.round((item.live_value - item.value) * 100) / 100;
            item.gain_pct = item.price > 0 ? Math.round(((q.price - item.price) / item.price) * 10000) / 100 : 0;
          } else {
            item.live_price = item.price;
            item.live_value = item.value;
            item.gain = 0;
            item.gain_pct = 0;
          }
        } catch {
          item.live_price = item.price;
          item.live_value = item.value;
          item.gain = 0;
          item.gain_pct = 0;
        }
      })
    );
  }

  return enriched;
}

/**
 * Generates an institutional demo portfolio for immediate preview and testing.
 */
export function getSamplePortfolio() {
  const sampleHoldings = [
    {
      isin: "INE002A01018",
      symbol: "RELIANCE",
      name: "RELIANCE INDUSTRIES LIMITED",
      quantity: 50,
      price: 2920.00,
      value: 146000.00,
      asset_type: "EQUITY",
      depository: "CDSL",
      account_name: "ZERODHA BROKING LTD",
      dp_id: "12081600",
      client_id: "00123456"
    },
    {
      isin: "INE467B01029",
      symbol: "TCS",
      name: "TATA CONSULTANCY SERVICES LTD",
      quantity: 35,
      price: 4180.00,
      value: 146300.00,
      asset_type: "EQUITY",
      depository: "CDSL",
      account_name: "ZERODHA BROKING LTD",
      dp_id: "12081600",
      client_id: "00123456"
    },
    {
      isin: "INE040A01034",
      symbol: "HDFCBANK",
      name: "HDFC BANK LIMITED",
      quantity: 90,
      price: 1640.00,
      value: 147600.00,
      asset_type: "EQUITY",
      depository: "CDSL",
      account_name: "ZERODHA BROKING LTD",
      dp_id: "12081600",
      client_id: "00123456"
    },
    {
      isin: "INE009A01021",
      symbol: "INFY",
      name: "INFOSYS LIMITED",
      quantity: 75,
      price: 1890.00,
      value: 141750.00,
      asset_type: "EQUITY",
      depository: "CDSL",
      account_name: "ZERODHA BROKING LTD",
      dp_id: "12081600",
      client_id: "00123456"
    },
    {
      isin: "INE154A01025",
      symbol: "ITC",
      name: "ITC LIMITED",
      quantity: 240,
      price: 510.00,
      value: 122400.00,
      asset_type: "EQUITY",
      depository: "CDSL",
      account_name: "ZERODHA BROKING LTD",
      dp_id: "12081600",
      client_id: "00123456"
    },
    {
      isin: "INE018A01030",
      symbol: "LT",
      name: "LARSEN & TOUBRO LIMITED",
      quantity: 30,
      price: 3620.00,
      value: 108600.00,
      asset_type: "EQUITY",
      depository: "CDSL",
      account_name: "ZERODHA BROKING LTD",
      dp_id: "12081600",
      client_id: "00123456"
    },
    {
      isin: "INE155A01022",
      symbol: "TATAMOTORS",
      name: "TATA MOTORS LIMITED",
      quantity: 110,
      price: 980.00,
      value: 107800.00,
      asset_type: "EQUITY",
      depository: "CDSL",
      account_name: "ZERODHA BROKING LTD",
      dp_id: "12081600",
      client_id: "00123456"
    }
  ];

  const totalEq = sampleHoldings.reduce((sum, h) => sum + h.value, 0);
  sampleHoldings.forEach(h => {
    h.weight_pct = Math.round((h.value / totalEq) * 10000) / 100;
    h.live_price = h.price;
    h.live_value = h.value;
    h.gain = 0;
    h.gain_pct = 0;
  });

  return {
    success: true,
    file_type: "CDSL",
    is_sample: true,
    statement_period: { from: "01-Aug-2026", to: "31-Aug-2026" },
    investor_info: {
      name: "DEMO PORTFOLIO INVESTOR",
      email: "investor@example.com",
      mobile: "+91 98765 43210"
    },
    holdings: sampleHoldings,
    mutual_funds: [],
    bonds: [],
    summary: {
      total_portfolio_value: Math.round(totalEq * 100) / 100,
      total_equities_value: Math.round(totalEq * 100) / 100,
      live_equities_value: Math.round(totalEq * 100) / 100,
      equities_count: sampleHoldings.length,
      total_mf_value: 0,
      mf_count: 0,
      total_bonds_value: 0,
      bonds_count: 0,
      total_securities_count: sampleHoldings.length,
      unrealized_gain: 0,
      unrealized_gain_pct: 0
    }
  };
}

/**
 * Converts holdings array to CSV formatted text.
 */
export function exportToCSV(holdings = [], summary = {}) {
  const headers = [
    "Symbol",
    "Company Name",
    "ISIN",
    "Asset Type",
    "Depository",
    "Account / Broker",
    "Quantity",
    "Statement Price (INR)",
    "Live Price (INR)",
    "Total Holding Value (INR)",
    "Weight (%)",
    "Unrealized P&L (INR)",
    "Return (%)"
  ];

  const rows = holdings.map(h => [
    `"${(h.symbol || '').replace(/"/g, '""')}"`,
    `"${(h.name || '').replace(/"/g, '""')}"`,
    `"${(h.isin || '').replace(/"/g, '""')}"`,
    `"${(h.asset_type || 'EQUITY').replace(/"/g, '""')}"`,
    `"${(h.depository || '').replace(/"/g, '""')}"`,
    `"${(h.account_name || '').replace(/"/g, '""')}"`,
    h.quantity ?? 0,
    h.price ?? 0,
    h.live_price ?? h.price ?? 0,
    h.live_value ?? h.value ?? 0,
    `${h.weight_pct ?? 0}%`,
    h.gain ?? 0,
    `${h.gain_pct ?? 0}%`
  ]);

  const csvLines = [
    headers.join(','),
    ...rows.map(r => r.join(','))
  ];

  if (summary && summary.total_portfolio_value) {
    csvLines.push('');
    csvLines.push(`"--- SUMMARY ---",,,,,,,,,,,,`);
    csvLines.push(`"Total Portfolio Value (INR)",${summary.total_portfolio_value || 0},,,,,,,,,,,`);
    csvLines.push(`"Total Equities Count",${summary.equities_count || holdings.length},,,,,,,,,,,`);
    if (summary.unrealized_gain !== undefined) {
      csvLines.push(`"Total Unrealized P&L (INR)",${summary.unrealized_gain || 0},,,,,,,,,,,`);
      csvLines.push(`"Total Portfolio Return",${summary.unrealized_gain_pct || 0}%,,,,,,,,,,,`);
    }
  }

  return csvLines.join('\r\n');
}
