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
const brokerScript = path.join(__dirname, 'broker_parser.py');

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
        maxBuffer: 25 * 1024 * 1024,
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

    // Enrich equity & ETF holdings with live prices if requested
    if (enrichPrices && result.stocks && result.stocks.length > 0) {
      result.stocks = await enrichWithLiveQuotes(result.stocks);
      result.holdings = result.stocks; // Backward compatibility

      // Separate direct stocks and ETFs
      result.direct_stocks = result.stocks.filter(s => s.subtype === 'DIRECT_STOCK');
      result.etfs = result.stocks.filter(s => s.subtype === 'ETF');

      // Recalculate live portfolio summary
      let liveStocksTotal = 0;
      let costStocksTotal = 0;
      let liveDirectStocksTotal = 0;
      let liveEtfsTotal = 0;

      for (const h of result.stocks) {
        const itemLive = h.live_value ?? h.value ?? 0;
        const itemCost = h.value ?? 0;
        liveStocksTotal += itemLive;
        costStocksTotal += itemCost;

        if (h.subtype === 'ETF') {
          liveEtfsTotal += itemLive;
        } else {
          liveDirectStocksTotal += itemLive;
        }
      }

      const totalMfVal = result.summary.total_mf_value || 0;
      const totalBdVal = result.summary.total_bonds_value || 0;
      const totalLiveVal = Math.round((liveStocksTotal + totalMfVal + totalBdVal) * 100) / 100;

      result.summary.live_stocks_value = Math.round(liveStocksTotal * 100) / 100;
      result.summary.total_stocks_value = result.summary.live_stocks_value;
      result.summary.direct_stocks_value = Math.round(liveDirectStocksTotal * 100) / 100;
      result.summary.etfs_value = Math.round(liveEtfsTotal * 100) / 100;

      const unrealizedStockGain = Math.round((liveStocksTotal - costStocksTotal) * 100) / 100;
      result.summary.unrealized_gain = unrealizedStockGain;
      result.summary.unrealized_gain_pct = costStocksTotal > 0 ? Math.round((unrealizedStockGain / costStocksTotal) * 10000) / 100 : 0;
      result.summary.total_portfolio_value = totalLiveVal;

      // Recalculate weights based on live values
      for (const h of result.stocks) {
        h.weight_pct = liveStocksTotal > 0 ? Math.round(((h.live_value || h.value) / liveStocksTotal) * 10000) / 100 : 0;
        h.total_weight_pct = totalLiveVal > 0 ? Math.round(((h.live_value || h.value) / totalLiveVal) * 10000) / 100 : 0;
      }
    }
    result.analytics = computePortfolioAnalytics(result);
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
 * Parses a broker holdings spreadsheet (.xlsx, .xls, .csv).
 * @param {string} filePath - Absolute path to uploaded spreadsheet
 * @returns {Promise<Object>}
 */
export async function parseBrokerSpreadsheet(filePath) {
  try {
    const res = await execFileAsync(pythonBin, [brokerScript, filePath], {
      maxBuffer: 25 * 1024 * 1024,
      timeout: 30000
    });
    const result = JSON.parse(res.stdout);
    if (!result.success) {
      throw new Error(result.error || 'Failed to parse broker spreadsheet');
    }
    return result;
  } catch (err) {
    if (err.stdout) {
      try {
        const parsed = JSON.parse(err.stdout);
        if (parsed.error) throw new Error(parsed.error);
      } catch (_) {}
    }
    throw new Error(err.message || 'Failed to parse broker spreadsheet');
  } finally {
    if (filePath && filePath.includes('uploads') && fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch (_) {}
    }
  }
}

/**
 * Merges broker average buy prices into the CAS portfolio.
 * Keeps all other CAS data unchanged, but accurately computes true P&L and cost basis.
 */
function isSGBorBondItem(item) {
  const isin = (item.isin || '').toUpperCase();
  const name = (item.name || '').toUpperCase();
  const symbol = (item.symbol || '').toUpperCase();
  return (
    isin.startsWith('IN0') ||
    item.subtype === 'SGB' ||
    item.subtype === 'BOND' ||
    name.includes('SGB') ||
    name.includes('GOLDBOND') ||
    name.includes('SOVEREIGN GOLD') ||
    name.includes('NCD') ||
    name.includes('BOND') ||
    symbol.includes('SGB')
  );
}

export function mergeBrokerPrices(portfolio, brokerData) {
  if (!portfolio || !brokerData?.holdings) return portfolio;

  const brokerMap = new Map();
  for (const h of brokerData.holdings) {
    if (h.isin) brokerMap.set(h.isin.toUpperCase(), h);
  }

  let matchedCount = 0;
  const matchedISINs = new Set();

  // 1. Update Bonds & Sovereign Gold Bonds (SGBs) using broker statement prices
  const bondsList = portfolio.bonds || [];
  bondsList.forEach(item => {
    const isin = (item.isin || '').toUpperCase();
    const b = brokerMap.get(isin);
    if (b) {
      matchedISINs.add(isin);
      matchedCount++;
      if (b.quantity > 0) item.quantity = b.quantity;
      const qty = item.quantity || 0;
      item.buy_price = b.avg_buy_price || item.price || 0;
      item.cost_basis = b.buy_value || Math.round(qty * item.buy_price * 100) / 100;
      item.has_broker_buy_price = true;
      item.broker_name = brokerData.broker || 'Broker';

      // SGB gain calculation from broker statement prices
      const currentPrice = b.closing_price || item.live_price || item.price || 0;
      item.live_price = currentPrice;
      item.closing_price = b.closing_price || currentPrice;
      item.value = b.closing_value || Math.round(qty * currentPrice * 100) / 100;
      item.live_value = item.value;
      item.gain = (b.pnl !== null && b.pnl !== undefined) ? b.pnl : Math.round((item.value - item.cost_basis) * 100) / 100;
      item.gain_pct = item.cost_basis > 0 ? Math.round((item.gain / item.cost_basis) * 10000) / 100 : 0;
    }
  });

  // Ingest broker SGB/Bond holdings not present in CAS
  for (const [isin, b] of brokerMap) {
    if (matchedISINs.has(isin)) continue;
    if (isSGBorBondItem(b) && b.quantity > 0) {
      matchedISINs.add(isin);
      matchedCount++;
      const isSgb = isin.startsWith('IN0') || (b.name || '').toUpperCase().includes('SGB') || (b.name || '').toUpperCase().includes('GOLDBOND');
      const qty = b.quantity || 0;
      const buyPrice = b.avg_buy_price || 0;
      const costBasis = b.buy_value || Math.round(qty * buyPrice * 100) / 100;
      const curPrice = b.closing_price || buyPrice;
      const curVal = b.closing_value || Math.round(qty * curPrice * 100) / 100;
      const gain = (b.pnl !== null && b.pnl !== undefined) ? b.pnl : Math.round((curVal - costBasis) * 100) / 100;
      const gainPct = costBasis > 0 ? Math.round((gain / costBasis) * 10000) / 100 : 0;

      bondsList.push({
        isin: b.isin,
        symbol: b.symbol || (isSgb ? 'SGB' : 'BOND'),
        name: b.name || (isSgb ? 'Sovereign Gold Bond' : 'Bond'),
        quantity: qty,
        price: curPrice,
        buy_price: buyPrice,
        cost_basis: costBasis,
        closing_price: b.closing_price,
        live_price: curPrice,
        value: curVal,
        live_value: curVal,
        gain,
        gain_pct: gainPct,
        category: 'BONDS_DEBT',
        subtype: isSgb ? 'SGB' : 'BOND',
        asset_type: 'BOND',
        has_broker_buy_price: true,
        broker_name: brokerData.broker || 'Broker',
        broker_only: true
      });
    }
  }
  portfolio.bonds = bondsList;

  // 2. Update Stocks & ETFs (Equities)
  // Broker spreadsheet is authoritative for active stock & ETF holdings.
  // If a stock was in CAS but absent from broker statement (e.g. MASPTOP50), it has been SOLD -> omit from active holdings.
  const oldStocks = portfolio.stocks || [];
  const activeStocks = [];

  for (const item of oldStocks) {
    const isin = (item.isin || '').toUpperCase();
    const b = brokerMap.get(isin);
    if (b && b.quantity > 0) {
      matchedISINs.add(isin);
      matchedCount++;
      item.quantity = b.quantity;
      item.buy_price = b.avg_buy_price;
      item.cost_basis = b.buy_value || Math.round(b.quantity * b.avg_buy_price * 100) / 100;
      item.has_broker_buy_price = true;
      item.broker_name = brokerData.broker || 'Broker';

      if (!item.live_price && b.closing_price > 0) item.live_price = b.closing_price;
      item.closing_price = b.closing_price;
      const curPrice = item.live_price ?? b.closing_price ?? item.price ?? 0;
      item.live_value = b.closing_value || Math.round(curPrice * item.quantity * 100) / 100;
      item.gain = (b.pnl !== null && b.pnl !== undefined) ? b.pnl : Math.round((curPrice - item.buy_price) * item.quantity * 100) / 100;
      item.gain_pct = item.buy_price > 0 ? Math.round(((curPrice - item.buy_price) / item.buy_price) * 10000) / 100 : 0;
      activeStocks.push(item);
    }
  }

  // Add broker equity holdings not present in CAS
  for (const [isin, b] of brokerMap) {
    if (matchedISINs.has(isin)) continue;
    if (isSGBorBondItem(b)) continue;
    if (!b.quantity || b.quantity <= 0) continue;

    const isEtf = isin.startsWith('INF') || (b.name || '').toUpperCase().includes('ETF') || (b.name || '').toUpperCase().includes('BEES') || (b.symbol || '').toUpperCase().includes('BEES');
    const buyPrice = b.avg_buy_price || 0;
    const costBasis = b.buy_value || Math.round(b.quantity * buyPrice * 100) / 100;
    const curPrice = b.closing_price || buyPrice;
    const curVal = b.closing_value || Math.round(b.quantity * curPrice * 100) / 100;
    const gain = (b.pnl !== null && b.pnl !== undefined) ? b.pnl : Math.round((curVal - costBasis) * 100) / 100;
    const gainPct = costBasis > 0 ? Math.round((gain / costBasis) * 10000) / 100 : 0;

    activeStocks.push({
      isin: b.isin,
      symbol: b.symbol || b.name || 'UNKNOWN',
      name: b.name || b.symbol || 'Unknown Holding',
      quantity: b.quantity,
      price: curPrice,
      live_price: b.closing_price || curPrice,
      buy_price: buyPrice,
      cost_basis: costBasis,
      value: curVal,
      live_value: curVal,
      gain,
      gain_pct: gainPct,
      has_broker_buy_price: true,
      broker_name: brokerData.broker || 'Broker',
      subtype: isEtf ? 'ETF' : 'DIRECT_STOCK',
      asset_type: 'EQUITY',
      broker_only: true
    });
    matchedISINs.add(isin);
    matchedCount++;
  }

  portfolio.stocks = activeStocks;
  portfolio.holdings = activeStocks;
  portfolio.direct_stocks = activeStocks.filter(s => s.subtype !== 'ETF');
  portfolio.etfs = activeStocks.filter(s => s.subtype === 'ETF');

  // 3. Recalculate summary metrics across stocks and bonds
  const stocksCostTotal = portfolio.stocks.reduce((sum, h) => sum + (h.cost_basis || ((h.price || 0) * (h.quantity || 0))), 0);
  const stocksLiveVal = portfolio.stocks.reduce((sum, h) => sum + (h.live_value || h.value || 0), 0);
  const stocksGain = portfolio.stocks.reduce((sum, h) => sum + (h.gain || 0), 0);

  const bondsCostTotal = (portfolio.bonds || []).reduce((sum, b) => sum + (b.cost_basis || ((b.price || 0) * (b.quantity || 0))), 0);
  const bondsLiveVal = (portfolio.bonds || []).reduce((sum, b) => sum + (b.live_value || b.value || 0), 0);
  const bondsGain = (portfolio.bonds || []).reduce((sum, b) => sum + (b.gain || 0), 0);

  const totalMfVal = (portfolio.mutual_funds || []).reduce((sum, m) => sum + (m.value || 0), 0);
  const totalPortfolioVal = stocksLiveVal + totalMfVal + bondsLiveVal;
  const totalBrokerInvested = stocksCostTotal + bondsCostTotal;
  const totalGain = Math.round((stocksGain + bondsGain) * 100) / 100;
  const totalGainPct = totalBrokerInvested > 0 ? Math.round((totalGain / totalBrokerInvested) * 10000) / 100 : 0;

  // Recalculate weights
  if (stocksLiveVal > 0) {
    portfolio.stocks.forEach(h => {
      const val = h.live_value || h.value || 0;
      h.weight_pct = Math.round((val / stocksLiveVal) * 10000) / 100;
      if (totalPortfolioVal > 0) {
        h.total_weight_pct = Math.round((val / totalPortfolioVal) * 10000) / 100;
      }
    });
  }
  if (bondsLiveVal > 0) {
    (portfolio.bonds || []).forEach(b => {
      const val = b.live_value || b.value || 0;
      b.weight_pct = Math.round((val / bondsLiveVal) * 10000) / 100;
      if (totalPortfolioVal > 0) {
        b.total_weight_pct = Math.round((val / totalPortfolioVal) * 10000) / 100;
      }
    });
  }

  portfolio.summary = {
    ...portfolio.summary,
    total_portfolio_value: Math.round(totalPortfolioVal * 100) / 100,
    total_stocks_value: Math.round(stocksLiveVal * 100) / 100,
    total_bonds_value: Math.round(bondsLiveVal * 100) / 100,
    total_positions: portfolio.stocks.length,
    unrealized_gain: totalGain,
    unrealized_gain_pct: totalGainPct,
    stocks_unrealized_gain: Math.round(stocksGain * 100) / 100,
    bonds_unrealized_gain: Math.round(bondsGain * 100) / 100,
    total_stocks_invested: Math.round(stocksCostTotal * 100) / 100,
    total_bonds_invested: Math.round(bondsCostTotal * 100) / 100,
    broker_source: brokerData.broker,
    broker_client_code: brokerData.client_code,
    broker_enriched_count: matchedCount,
    broker_total_positions: brokerData.total_positions,
    broker_total_invested: brokerData.total_invested_value,
    broker_total_closing: brokerData.total_closing_value,
    broker_total_pnl: brokerData.total_unrealised_pnl
  };

  return portfolio;
}

/**
 * Computes comprehensive portfolio analytics from historical valuations, asset allocations, and transactions.
 */
export function computePortfolioAnalytics(portfolio) {
  const valuations = portfolio.historical_valuations || [];
  let performance = null;

  if (valuations.length >= 2) {
    const start = valuations[0];
    const latest = valuations[valuations.length - 1];
    const growthRs = Math.round((latest.value - start.value) * 100) / 100;
    const growthPct = start.value > 0 ? Math.round((growthRs / start.value) * 10000) / 100 : 0;

    const monthsWithChanges = valuations.slice(1);
    let best = monthsWithChanges[0];
    let worst = monthsWithChanges[0];
    let posCount = 0;
    let negCount = 0;

    for (const m of monthsWithChanges) {
      if (m.change_pct > (best?.change_pct ?? -Infinity)) best = m;
      if (m.change_pct < (worst?.change_pct ?? Infinity)) worst = m;
      if (m.change_pct >= 0) posCount++;
      else negCount++;
    }

    const numMonths = valuations.length - 1;
    const cagr = start.value > 0 && numMonths > 0
      ? Math.round((Math.pow(latest.value / start.value, 12 / numMonths) - 1) * 10000) / 100
      : growthPct;

    performance = {
      start_value: start.value,
      start_period: start.month_year,
      latest_value: latest.value,
      latest_period: latest.month_year,
      total_growth_rs: growthRs,
      total_growth_pct: growthPct,
      cagr_pct: cagr,
      best_month: best ? { month_year: best.month_year, change_pct: best.change_pct, change_rs: best.change_rs } : null,
      worst_month: worst ? { month_year: worst.month_year, change_pct: worst.change_pct, change_rs: worst.change_rs } : null,
      positive_months: posCount,
      negative_months: negCount,
      avg_monthly_change_rs: numMonths > 0 ? Math.round((growthRs / numMonths) * 100) / 100 : 0
    };
  }

  const summary = portfolio.summary || {};
  const totalVal = summary.total_portfolio_value || 1;
  const directStocksVal = summary.direct_stocks_value || 0;
  const etfsVal = summary.etfs_value || 0;
  const mfVal = summary.total_mf_value || 0;
  const bondsVal = summary.total_bonds_value || 0;

  const allocation = [
    { name: 'Mutual Funds', value: Math.round(mfVal * 100) / 100, pct: Math.round((mfVal / totalVal) * 10000) / 100, color: '#10b981' },
    { name: 'Direct Stocks', value: Math.round(directStocksVal * 100) / 100, pct: Math.round((directStocksVal / totalVal) * 10000) / 100, color: '#06b6d4' },
    { name: 'ETFs', value: Math.round(etfsVal * 100) / 100, pct: Math.round((etfsVal / totalVal) * 10000) / 100, color: '#8b5cf6' },
    { name: 'Bonds & SGBs', value: Math.round(bondsVal * 100) / 100, pct: Math.round((bondsVal / totalVal) * 10000) / 100, color: '#f59e0b' }
  ].filter(a => a.value > 0);

  const txns = portfolio.transactions || [];
  let totalInflows = 0;
  let totalOutflows = 0;
  let buyCount = 0;
  let sellCount = 0;

  for (const t of txns) {
    if (t.type === 'BUY' || t.type === 'PURCHASE') {
      buyCount++;
      if (t.amount) totalInflows += t.amount;
    } else if (t.type === 'SELL' || t.type === 'REDEMPTION') {
      sellCount++;
      if (t.amount) totalOutflows += t.amount;
    }
  }

  const transaction_summary = {
    total_transactions: txns.length,
    buy_count: buyCount,
    sell_count: sellCount,
    total_inflows: Math.round(totalInflows * 100) / 100,
    total_outflows: Math.round(totalOutflows * 100) / 100,
    net_flow: Math.round((totalInflows - totalOutflows) * 100) / 100
  };

  return { performance, allocation, transaction_summary };
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
          const res = await yahoo.fetchQuote(item.symbol);
          const q = res?.quote;
          if (q && q.price != null) {
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
  const sampleStocks = [
    {
      isin: "INE002A01018",
      symbol: "RELIANCE",
      name: "Reliance Industries Limited",
      quantity: 120,
      price: 2980.50,
      value: 357660.00,
      category: "STOCKS",
      subtype: "DIRECT_STOCK",
      asset_type: "EQUITY",
      depository: "CDSL Demat Account",
      account_name: "GROWW INVEST TECH",
      live_price: 3012.20,
      live_value: 361464.00,
      gain: 3804.00,
      gain_pct: 1.06
    },
    {
      isin: "INE467B01029",
      symbol: "TCS",
      name: "Tata Consultancy Services Limited",
      quantity: 80,
      price: 4190.00,
      value: 335200.00,
      category: "STOCKS",
      subtype: "DIRECT_STOCK",
      asset_type: "EQUITY",
      depository: "CDSL Demat Account",
      account_name: "GROWW INVEST TECH",
      live_price: 4245.50,
      live_value: 339640.00,
      gain: 4440.00,
      gain_pct: 1.32
    },
    {
      isin: "INE040A01034",
      symbol: "HDFCBANK",
      name: "HDFC Bank Limited",
      quantity: 190,
      price: 1640.00,
      value: 311600.00,
      category: "STOCKS",
      subtype: "DIRECT_STOCK",
      asset_type: "EQUITY",
      depository: "CDSL Demat Account",
      account_name: "GROWW INVEST TECH",
      live_price: 1675.80,
      live_value: 318402.00,
      gain: 6802.00,
      gain_pct: 2.18
    },
    {
      isin: "INE009A01021",
      symbol: "INFY",
      name: "Infosys Limited",
      quantity: 150,
      price: 1820.00,
      value: 273000.00,
      category: "STOCKS",
      subtype: "DIRECT_STOCK",
      asset_type: "EQUITY",
      depository: "CDSL Demat Account",
      account_name: "GROWW INVEST TECH",
      live_price: 1850.40,
      live_value: 277560.00,
      gain: 4560.00,
      gain_pct: 1.67
    },
    {
      isin: "INE742F01042",
      symbol: "ADANIPORTS",
      name: "Adani Ports and Special Economic Zone Limited",
      quantity: 90,
      price: 1635.00,
      value: 147150.00,
      category: "STOCKS",
      subtype: "DIRECT_STOCK",
      asset_type: "EQUITY",
      depository: "CDSL Demat Account",
      account_name: "GROWW INVEST TECH",
      live_price: 1788.00,
      live_value: 160920.00,
      gain: 13770.00,
      gain_pct: 9.36
    },
    {
      isin: "INE066F01020",
      symbol: "HAL",
      name: "Hindustan Aeronautics Limited",
      quantity: 35,
      price: 4650.00,
      value: 162750.00,
      category: "STOCKS",
      subtype: "DIRECT_STOCK",
      asset_type: "EQUITY",
      depository: "CDSL Demat Account",
      account_name: "GROWW INVEST TECH",
      live_price: 4800.00,
      live_value: 168000.00,
      gain: 5250.00,
      gain_pct: 3.23
    },
    // ETFs in Demat
    {
      isin: "INF204KB14I2",
      symbol: "NIFTYBEES",
      name: "Nippon India ETF Nifty 50 BeES",
      quantity: 800,
      price: 258.00,
      value: 206400.00,
      category: "STOCKS",
      subtype: "ETF",
      asset_type: "EQUITY",
      depository: "CDSL Demat Account",
      account_name: "GROWW INVEST TECH",
      live_price: 264.13,
      live_value: 211304.00,
      gain: 4904.00,
      gain_pct: 2.38
    },
    {
      isin: "INF247L01AP3",
      symbol: "MON100",
      name: "Motilal Oswal NASDAQ 100 ETF",
      quantity: 500,
      price: 310.00,
      value: 155000.00,
      category: "STOCKS",
      subtype: "ETF",
      asset_type: "EQUITY",
      depository: "CDSL Demat Account",
      account_name: "GROWW INVEST TECH",
      live_price: 324.11,
      live_value: 162055.00,
      gain: 7055.00,
      gain_pct: 4.55
    },
    {
      isin: "INF204KB14L6",
      symbol: "GOLDBEES",
      name: "Nippon India ETF Gold BeES",
      quantity: 1200,
      price: 64.50,
      value: 77400.00,
      category: "STOCKS",
      subtype: "ETF",
      asset_type: "EQUITY",
      depository: "CDSL Demat Account",
      account_name: "GROWW INVEST TECH",
      live_price: 67.20,
      live_value: 80640.00,
      gain: 3240.00,
      gain_pct: 4.19
    }
  ];

  const sampleMutualFunds = [
    {
      isin: "INF879O01027",
      name: "Parag Parikh Flexi Cap Fund - Direct Plan Growth",
      quantity: 10564.16,
      price: 92.41,
      value: 959042.97,
      cost_basis: 834000.00,
      gain: 125042.97,
      gain_pct: 15.00,
      category: "MUTUAL_FUNDS",
      subtype: "MUTUAL_FUND",
      asset_type: "MUTUAL_FUND",
      depository: "Mutual Fund Folios",
      account_name: "PPFAS Mutual Fund",
      folio: "001ZG-910283",
      amfi: "122639"
    },
    {
      isin: "INF966L01986",
      name: "quant ELSS Tax Saver Fund - Direct Plan - Growth",
      quantity: 2197.88,
      price: 464.68,
      value: 1021328.32,
      cost_basis: 814000.00,
      gain: 207328.32,
      gain_pct: 25.47,
      category: "MUTUAL_FUNDS",
      subtype: "MUTUAL_FUND",
      asset_type: "MUTUAL_FUND",
      depository: "Mutual Fund Folios",
      account_name: "quant Mutual Fund",
      folio: "TPDG-448102",
      amfi: "120823"
    },
    {
      isin: "INF879O01175",
      name: "Parag Parikh Conservative Hybrid Fund - Direct Plan Growth",
      quantity: 7631.96,
      price: 16.10,
      value: 122887.63,
      cost_basis: 100000.00,
      gain: 22887.63,
      gain_pct: 22.89,
      category: "MUTUAL_FUNDS",
      subtype: "MUTUAL_FUND",
      asset_type: "MUTUAL_FUND",
      depository: "Mutual Fund Folios",
      account_name: "PPFAS Mutual Fund",
      folio: "CHFGZ-771822",
      amfi: "148905"
    }
  ];

  const sampleBonds = [
    {
      isin: "IN0020230168",
      symbol: "SGB",
      name: "GOVT OF INDIA 2.5% SGB 2023-24 SERIES III",
      quantity: 55,
      price: 7145.70,
      value: 393013.50,
      category: "BONDS_DEBT",
      subtype: "SGB",
      asset_type: "BOND",
      depository: "CDSL Demat Account",
      account_name: "GROWW INVEST TECH"
    },
    {
      isin: "INE532F07HR9",
      symbol: "BOND",
      name: "EFSL 10.50 24072035 Corporate Bond",
      quantity: 28,
      price: 1065.00,
      value: 29820.00,
      category: "BONDS_DEBT",
      subtype: "BOND",
      asset_type: "BOND",
      depository: "CDSL Demat Account",
      account_name: "GROWW INVEST TECH"
    }
  ];

  const directStocks = sampleStocks.filter(s => s.subtype === 'DIRECT_STOCK');
  const etfs = sampleStocks.filter(s => s.subtype === 'ETF');

  const totalStocksVal = sampleStocks.reduce((sum, h) => sum + (h.live_value || h.value), 0);
  const directStocksVal = directStocks.reduce((sum, h) => sum + (h.live_value || h.value), 0);
  const etfsVal = etfs.reduce((sum, h) => sum + (h.live_value || h.value), 0);
  const totalMfVal = sampleMutualFunds.reduce((sum, m) => sum + m.value, 0);
  const totalBdVal = sampleBonds.reduce((sum, b) => sum + b.value, 0);
  const totalPortfolioVal = totalStocksVal + totalMfVal + totalBdVal;

  sampleStocks.forEach(h => {
    h.weight_pct = Math.round((h.value / totalStocksVal) * 10000) / 100;
    h.total_weight_pct = Math.round((h.value / totalPortfolioVal) * 10000) / 100;
  });

  const historicalValuations = [
    { month_year: "Sep 2025", month: "Sep", year: 2025, value: 2450000.00, change_rs: 0.00, change_pct: 0.00 },
    { month_year: "Oct 2025", month: "Oct", year: 2025, value: 2545000.00, change_rs: 95000.00, change_pct: 3.88 },
    { month_year: "Nov 2025", month: "Nov", year: 2025, value: 2580000.00, change_rs: 35000.00, change_pct: 1.38 },
    { month_year: "Dec 2025", month: "Dec", year: 2025, value: 2615000.00, change_rs: 35000.00, change_pct: 1.36 },
    { month_year: "Jan 2026", month: "Jan", year: 2026, value: 2595000.00, change_rs: -20000.00, change_pct: -0.76 },
    { month_year: "Feb 2026", month: "Feb", year: 2026, value: 2950000.00, change_rs: 355000.00, change_pct: 13.68 },
    { month_year: "Mar 2026", month: "Mar", year: 2026, value: 2920000.00, change_rs: -30000.00, change_pct: -1.02 },
    { month_year: "Apr 2026", month: "Apr", year: 2026, value: 3450000.00, change_rs: 530000.00, change_pct: 18.15 },
    { month_year: "May 2026", month: "May", year: 2026, value: 3600000.00, change_rs: 150000.00, change_pct: 4.35 },
    { month_year: "Jun 2026", month: "Jun", year: 2026, value: 3660000.00, change_rs: 60000.00, change_pct: 1.67 },
    { month_year: "Jul 2026", month: "Jul", year: 2026, value: 3760000.00, change_rs: 100000.00, change_pct: 2.73 },
    { month_year: "Aug 2026", month: "Aug", year: 2026, value: 3845000.00, change_rs: 85000.00, change_pct: 2.26 }
  ];

  const assetAllocation = [
    { asset_class: "Mutual Fund Folios", value: totalMfVal, percentage: Math.round((totalMfVal / totalPortfolioVal) * 10000) / 100 },
    { asset_class: "Direct Stocks", value: directStocksVal, percentage: Math.round((directStocksVal / totalPortfolioVal) * 10000) / 100 },
    { asset_class: "Exchange Traded Funds (ETFs)", value: etfsVal, percentage: Math.round((etfsVal / totalPortfolioVal) * 10000) / 100 },
    { asset_class: "Sovereign Gold Bonds (SGB)", value: 393013.50, percentage: Math.round((393013.50 / totalPortfolioVal) * 10000) / 100 },
    { asset_class: "Debts & Corporate Bonds", value: 29820.00, percentage: Math.round((29820.00 / totalPortfolioVal) * 10000) / 100 }
  ];

  const sampleTransactions = [
    { date: "03-08-2026", isin: "INE742F01042", name: "ADANI PORTS AND SPECIAL ECONOMIC ZONE", type: "BUY", units: 15, amount: null, nav: null, balance: 90, category: "STOCKS" },
    { date: "07-08-2026", isin: "INF204KB14I2", name: "Nippon India ETF Nifty 50 BeES", type: "BUY", units: 50, amount: null, nav: null, balance: 800, category: "STOCKS" },
    { date: "10-08-2026", isin: "INF879O01027", name: "Parag Parikh Flexi Cap Fund", type: "PURCHASE", units: 432.81, amount: 39998.00, nav: 92.41, balance: null, category: "MUTUAL_FUNDS", description: "Monthly SIP" },
    { date: "12-08-2026", isin: "INE002A01018", name: "RELIANCE INDUSTRIES LIMITED", type: "BUY", units: 10, amount: null, nav: null, balance: 120, category: "STOCKS" }
  ];

  const unrealizedGain = sampleStocks.reduce((sum, h) => sum + (h.gain || 0), 0) + sampleMutualFunds.reduce((sum, m) => sum + (m.gain || 0), 0);

  const res = {
    success: true,
    file_type: "CDSL",
    is_sample: true,
    statement_period: { from: "01-Aug-2026", to: "31-Aug-2026" },
    investor_info: {
      name: "INSTITUTIONAL DEMO PORTFOLIO",
      email: "portfolio@stock.ai",
      mobile: "+91 98765 43210"
    },
    holdings: sampleStocks,
    stocks: sampleStocks,
    direct_stocks: directStocks,
    etfs: etfs,
    mutual_funds: sampleMutualFunds,
    bonds: sampleBonds,
    historical_valuations: historicalValuations,
    asset_allocation: assetAllocation,
    transactions: sampleTransactions,
    summary: {
      total_portfolio_value: Math.round(totalPortfolioVal * 100) / 100,
      total_stocks_value: Math.round(totalStocksVal * 100) / 100,
      stocks_count: sampleStocks.length,
      direct_stocks_value: Math.round(directStocksVal * 100) / 100,
      direct_stocks_count: directStocks.length,
      etfs_value: Math.round(etfsVal * 100) / 100,
      etfs_count: etfs.length,
      total_mf_value: Math.round(totalMfVal * 100) / 100,
      mf_count: sampleMutualFunds.length,
      total_bonds_value: Math.round(totalBdVal * 100) / 100,
      bonds_count: sampleBonds.length,
      total_securities_count: sampleStocks.length + sampleMutualFunds.length + sampleBonds.length,
      unrealized_gain: Math.round(unrealizedGain * 100) / 100,
      unrealized_gain_pct: 5.42
    }
  };
  res.analytics = computePortfolioAnalytics(res);
  return res;
}

/**
 * Converts categorized holdings array to comprehensive CSV formatted text.
 */
export function exportToCSV(payload = {}, summaryOverride = null) {
  // Support both legacy array call or structured object call
  let stocks = [];
  let mutualFunds = [];
  let bonds = [];
  let summary = {};

  if (Array.isArray(payload)) {
    stocks = payload;
    summary = summaryOverride || {};
  } else {
    stocks = payload.stocks || payload.holdings || [];
    mutualFunds = payload.mutual_funds || [];
    bonds = payload.bonds || [];
    summary = payload.summary || summaryOverride || {};
  }

  const csvLines = [];

  // 1. Direct Stocks & ETFs Section
  csvLines.push('"=== EQUITIES & ETFS ===",,,,,,,,,,,,');
  csvLines.push([
    "Category",
    "Subtype",
    "Symbol",
    "Security Name",
    "ISIN",
    "Quantity",
    "Statement Price (INR)",
    "Live Price (INR)",
    "Current Value (INR)",
    "Weight (%)",
    "P&L (INR)",
    "Return (%)",
    "Depository"
  ].join(','));

  for (const h of stocks) {
    csvLines.push([
      `"${h.category || 'STOCKS'}"`,
      `"${h.subtype || 'DIRECT_STOCK'}"`,
      `"${(h.symbol || '').replace(/"/g, '""')}"`,
      `"${(h.name || '').replace(/"/g, '""')}"`,
      `"${(h.isin || '').replace(/"/g, '""')}"`,
      h.quantity ?? 0,
      h.price ?? 0,
      h.live_price ?? h.price ?? 0,
      h.live_value ?? h.value ?? 0,
      `${h.weight_pct ?? 0}%`,
      h.gain ?? 0,
      `${h.gain_pct ?? 0}%`,
      `"${(h.depository || '').replace(/"/g, '""')}"`
    ].join(','));
  }

  // 2. Mutual Funds Section
  if (mutualFunds.length > 0) {
    csvLines.push('');
    csvLines.push('"=== MUTUAL FUNDS ===",,,,,,,,,,,,');
    csvLines.push([
      "Category",
      "Scheme Name",
      "ISIN",
      "Folio Number",
      "Units",
      "Cost NAV / Basis",
      "Current NAV",
      "Invested Cost (INR)",
      "Current Value (INR)",
      "Weight (%)",
      "Unrealized Gain (INR)",
      "Return (%)",
      "AMC / Account"
    ].join(','));

    for (const m of mutualFunds) {
      csvLines.push([
        `"MUTUAL_FUNDS"`,
        `"${(m.name || '').replace(/"/g, '""')}"`,
        `"${(m.isin || '').replace(/"/g, '""')}"`,
        `"${(m.folio || '').replace(/"/g, '""')}"`,
        m.quantity ?? 0,
        m.cost_basis && m.quantity ? Math.round((m.cost_basis / m.quantity) * 100) / 100 : (m.price ?? 0),
        m.price ?? 0,
        m.cost_basis ?? 0,
        m.value ?? 0,
        `${m.weight_pct ?? 0}%`,
        m.gain ?? 0,
        `${m.gain_pct ?? 0}%`,
        `"${(m.account_name || '').replace(/"/g, '""')}"`
      ].join(','));
    }
  }

  // 3. Bonds & SGBs Section
  if (bonds.length > 0) {
    csvLines.push('');
    csvLines.push('"=== BONDS & SOVEREIGN GOLD BONDS (SGB) ===",,,,,,,,,,,,');
    csvLines.push([
      "Category",
      "Subtype",
      "Security Name",
      "ISIN",
      "Quantity",
      "Issue / Face Price (INR)",
      "Holding Value (INR)",
      "Depository"
    ].join(','));

    for (const b of bonds) {
      csvLines.push([
        `"BONDS_DEBT"`,
        `"${b.subtype || 'BOND'}"`,
        `"${(b.name || '').replace(/"/g, '""')}"`,
        `"${(b.isin || '').replace(/"/g, '""')}"`,
        b.quantity ?? 0,
        b.price ?? 0,
        b.value ?? 0,
        `"${(b.depository || '').replace(/"/g, '""')}"`
      ].join(','));
    }
  }

  // 4. Summary Section
  if (summary && summary.total_portfolio_value) {
    csvLines.push('');
    csvLines.push('"=== PORTFOLIO SUMMARY ===",,,,,,,,,,,,');
    csvLines.push(`"Total Portfolio Value (INR)",${summary.total_portfolio_value || 0},,,,,,,,,,,`);
    csvLines.push(`"Direct Stocks Value (INR)",${summary.direct_stocks_value || 0},,,,,,,,,,,`);
    csvLines.push(`"ETFs Value (INR)",${summary.etfs_value || 0},,,,,,,,,,,`);
    csvLines.push(`"Mutual Funds Value (INR)",${summary.total_mf_value || 0},,,,,,,,,,,`);
    csvLines.push(`"Bonds & SGB Value (INR)",${summary.total_bonds_value || 0},,,,,,,,,,,`);
    csvLines.push(`"Total Securities Count",${summary.total_securities_count || (stocks.length + mutualFunds.length + bonds.length)},,,,,,,,,,,`);
    if (summary.unrealized_gain !== undefined) {
      csvLines.push(`"Total Unrealized P&L (INR)",${summary.unrealized_gain || 0},,,,,,,,,,,`);
      csvLines.push(`"Total Unrealized Return",${summary.unrealized_gain_pct || 0}%,,,,,,,,,,,`);
    }
  }

  return csvLines.join('\r\n');
}
