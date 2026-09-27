import React, { useState, useEffect, useMemo } from 'react';
import { Search } from 'lucide-react';
import PortfolioHeader from './PortfolioHeader';
import PortfolioUploader from './PortfolioUploader';
import MetricCards from './MetricCards';
import PortfolioGrowthChart from './PortfolioGrowthChart';
import StocksTable from './StocksTable';
import MutualFundsTable from './MutualFundsTable';
import BondsTable from './BondsTable';
import AllocationBreakdown from './AllocationBreakdown';
import TransactionsLedger from './TransactionsLedger';
import {
  uploadCASFile,
  uploadBrokerStatement,
  fetchSamplePortfolio,
  savePortfolio,
  fetchSavedPortfolio,
  clearSavedPortfolio,
  exportPortfolioCSV
} from '../../utils/api';
const LOCAL_STORAGE_KEY = 'stock_ai_cached_portfolio';

export default function PortfolioPage({ onSelectStock = () => {}, initialTab = 'stocks' }) {
  const [portfolioData, setPortfolioData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Tabs: 'stocks' | 'mutual_funds' | 'bonds' | 'analytics'
  const [activeTab, setActiveTab] = useState(initialTab || 'stocks');
  // Chart toggle: 'value' | 'change_pct'
  const [chartMetric, setChartMetric] = useState('value');

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const [searchQuery, setSearchQuery] = useState('');
  const [saveStatus, setSaveStatus] = useState(null); // 'saving' | 'saved' | null
  const [isExporting, setIsExporting] = useState(false);
  const [isBrokerUploading, setIsBrokerUploading] = useState(false);
  const [brokerNotice, setBrokerNotice] = useState(null);
  // Load cached or saved portfolio on mount
  useEffect(() => {
    const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (cached) {
      try {
        setPortfolioData(JSON.parse(cached));
        return;
      } catch (e) {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
      }
    }

    // Fallback to SQLite store
    fetchSavedPortfolio()
      .then(res => {
        if (res?.data && (res.data.holdings?.length > 0 || res.data.stocks?.length > 0 || res.data.mutual_funds?.length > 0)) {
          setPortfolioData(res.data);
        }
      })
      .catch(() => {});
  }, []);

  // Sync to localStorage
  const updatePortfolioState = (data) => {
    setPortfolioData(data);
    if (data) {
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
      } catch (e) {
        console.warn('LocalStorage quota exceeded');
      }
    } else {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  };

  // Statement Upload Handler
  const handleParseStatement = async (file, password, enrichPrices) => {
    setLoading(true);
    setError(null);
    try {
      const result = await uploadCASFile(file, password, enrichPrices);
      updatePortfolioState(result);
      setActiveTab('stocks');
    } catch (err) {
      if (err.errorType === 'INCORRECT_PASSWORD') {
        setError('Incorrect password. For CDSL/NSDL CAS, it is typically your uppercase PAN (e.g. ABCDE1234F) or Date of Birth (DDMMYYYY).');
      } else {
        setError(err.message || 'Failed to parse CAS statement. Please verify the file.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Load Sample Demo Portfolio
  const handleLoadDemo = async () => {
    setLoading(true);
    setError(null);
    try {
      const sample = await fetchSamplePortfolio();
      updatePortfolioState(sample);
      setActiveTab('stocks');
    } catch (err) {
      setError('Failed to load sample demo portfolio.');
    } finally {
      setLoading(false);
    }
  };

  // Save to SQLite
  const handleSaveToDatabase = async () => {
    if (!portfolioData) return;
    setSaveStatus('saving');
    try {
      await savePortfolio(portfolioData, portfolioData.meta || {});
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      setError('Failed to save portfolio to local database.');
      setSaveStatus(null);
    }
  };

  // Clear Portfolio
  const handleClearPortfolio = async () => {
    if (window.confirm('Are you sure you want to clear your loaded portfolio? This will remove all local cached statement data.')) {
      try {
        await clearSavedPortfolio();
      } catch (e) {}
      updatePortfolioState(null);
      setError(null);
    }
  };

  // Export CSV
  const handleExportCSV = async () => {
    if (!portfolioData) return;
    setIsExporting(true);
    try {
      await exportPortfolioCSV(portfolioData, portfolioData.summary);
    } catch (err) {
      setError('Failed to export CSV: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  // Export JSON
  const handleExportJSON = () => {
    if (!portfolioData) return;
    const jsonStr = JSON.stringify(portfolioData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stock_ai_portfolio_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    a.remove();
  };

  // Upload broker spreadsheet (Groww, Zerodha, Upstox, etc.) to set accurate buy prices
  const handleUploadBrokerSpreadsheet = async (file) => {
    if (!file || !portfolioData) return;
    setIsBrokerUploading(true);
    setError(null);
    try {
      const res = await uploadBrokerStatement(file, portfolioData);
      let updatedPortfolio = res.portfolio;

      if (!updatedPortfolio && res.broker_data?.holdings) {
        const brokerMap = new Map();
        for (const h of res.broker_data.holdings) {
          if (h.isin) brokerMap.set(h.isin.toUpperCase(), h);
        }

        let matched = 0;
        const matchedISINs = new Set();

        const isSGBorBond = (item) => {
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
        };

        // 1. Update Bonds & SGBs
        const newBonds = (portfolioData.bonds || []).map(item => {
          const isin = (item.isin || '').toUpperCase();
          const b = brokerMap.get(isin);
          if (b) {
            matched++;
            matchedISINs.add(isin);
            const qty = (b.quantity > 0) ? b.quantity : (item.quantity || 0);
            const buyPrice = b.avg_buy_price || item.price || 0;
            const costBasis = b.buy_value || Math.round(qty * buyPrice * 100) / 100;
            const currentPrice = b.closing_price || item.live_price || item.price || 0;
            const curVal = b.closing_value || Math.round(qty * currentPrice * 100) / 100;
            const gain = (b.pnl !== null && b.pnl !== undefined) ? b.pnl : Math.round((curVal - costBasis) * 100) / 100;
            const gainPct = costBasis > 0 ? Math.round((gain / costBasis) * 10000) / 100 : 0;
            return {
              ...item,
              quantity: qty,
              buy_price: buyPrice,
              cost_basis: costBasis,
              live_price: currentPrice,
              closing_price: b.closing_price,
              value: curVal,
              live_value: curVal,
              gain,
              gain_pct: gainPct,
              has_broker_buy_price: true,
              broker_name: res.broker_data.broker || 'Broker'
            };
          }
          return item;
        });

        // Ingest broker SGB/Bond holdings not in CAS
        for (const [isin, b] of brokerMap) {
          if (matchedISINs.has(isin)) continue;
          if (isSGBorBond(b) && b.quantity > 0) {
            matchedISINs.add(isin);
            matched++;
            const isSgb = isin.startsWith('IN0') || (b.name || '').toUpperCase().includes('SGB') || (b.name || '').toUpperCase().includes('GOLDBOND');
            const qty = b.quantity || 0;
            const buyPrice = b.avg_buy_price || 0;
            const costBasis = b.buy_value || Math.round(qty * buyPrice * 100) / 100;
            const curPrice = b.closing_price || buyPrice;
            const curVal = b.closing_value || Math.round(qty * curPrice * 100) / 100;
            const gain = (b.pnl !== null && b.pnl !== undefined) ? b.pnl : Math.round((curVal - costBasis) * 100) / 100;
            const gainPct = costBasis > 0 ? Math.round((gain / costBasis) * 10000) / 100 : 0;
            newBonds.push({
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
              broker_name: res.broker_data.broker || 'Broker',
              broker_only: true
            });
          }
        }

        // 2. Update Stocks & ETFs (Equities)
        // Drop equities absent from broker spreadsheet (like MASPTOP50) because they were sold
        const oldStocks = portfolioData.stocks || portfolioData.holdings || [];
        const newStocks = [];

        for (const item of oldStocks) {
          const isin = (item.isin || '').toUpperCase();
          const b = brokerMap.get(isin);
          if (b && b.quantity > 0) {
            matched++;
            matchedISINs.add(isin);
            const qty = b.quantity;
            const buyPrice = b.avg_buy_price;
            const costBasis = b.buy_value || Math.round(qty * buyPrice * 100) / 100;
            if (!item.live_price && b.closing_price > 0) item.live_price = b.closing_price;
            const curPrice = item.live_price ?? b.closing_price ?? item.price ?? 0;
            const liveValue = b.closing_value || Math.round(curPrice * qty * 100) / 100;
            const gain = (b.pnl !== null && b.pnl !== undefined) ? b.pnl : Math.round((curPrice - buyPrice) * qty * 100) / 100;
            const gainPct = buyPrice > 0 ? Math.round(((curPrice - buyPrice) / buyPrice) * 10000) / 100 : 0;
            newStocks.push({
              ...item,
              quantity: qty,
              buy_price: buyPrice,
              cost_basis: costBasis,
              closing_price: b.closing_price,
              live_value: liveValue,
              gain,
              gain_pct: gainPct,
              has_broker_buy_price: true,
              broker_name: res.broker_data.broker || 'Broker'
            });
          }
        }

        // Add broker equity holdings not in CAS
        for (const [isin, b] of brokerMap) {
          if (matchedISINs.has(isin)) continue;
          if (isSGBorBond(b)) continue;
          if (!b.quantity || b.quantity <= 0) continue;
          const isEtf = isin.startsWith('INF') || (b.name || '').toUpperCase().includes('ETF') || (b.name || '').toUpperCase().includes('BEES') || (b.symbol || '').toUpperCase().includes('BEES');
          const buyPrice = b.avg_buy_price || 0;
          const costBasis = b.buy_value || Math.round(b.quantity * buyPrice * 100) / 100;
          const curPrice = b.closing_price || buyPrice;
          const curVal = b.closing_value || Math.round(b.quantity * curPrice * 100) / 100;
          const gain = (b.pnl !== null && b.pnl !== undefined) ? b.pnl : Math.round((curVal - costBasis) * 100) / 100;
          const gainPct = costBasis > 0 ? Math.round((gain / costBasis) * 10000) / 100 : 0;
          newStocks.push({
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
            broker_name: res.broker_data.broker || 'Broker',
            subtype: isEtf ? 'ETF' : 'DIRECT_STOCK',
            asset_type: 'EQUITY',
            broker_only: true
          });
          matched++;
        }

        // Re-derive sublists from updated stocks
        const newDirect = newStocks.filter(s => s.subtype !== 'ETF');
        const newEtfs = newStocks.filter(s => s.subtype === 'ETF');

        // Recalculate summary metrics across stocks and bonds
        const stocksCostTotal = newStocks.reduce((sum, h) => sum + (h.cost_basis || ((h.price || 0) * (h.quantity || 0))), 0);
        const stocksLiveVal = newStocks.reduce((sum, h) => sum + (h.live_value || h.value || 0), 0);
        const stocksGain = newStocks.reduce((sum, h) => sum + (h.gain || 0), 0);

        const bondsCostTotal = newBonds.reduce((sum, b) => sum + (b.cost_basis || ((b.price || 0) * (b.quantity || 0))), 0);
        const bondsLiveVal = newBonds.reduce((sum, b) => sum + (b.live_value || b.value || 0), 0);
        const bondsGain = newBonds.reduce((sum, b) => sum + (b.gain || 0), 0);

        const totalMfVal = (portfolioData.mutual_funds || []).reduce((sum, m) => sum + (m.value || 0), 0);
        const totalPortfolioVal = stocksLiveVal + totalMfVal + bondsLiveVal;
        const totalBrokerInvested = stocksCostTotal + bondsCostTotal;
        const totalGain = Math.round((stocksGain + bondsGain) * 100) / 100;
        const totalGainPct = totalBrokerInvested > 0 ? Math.round((totalGain / totalBrokerInvested) * 10000) / 100 : 0;

        // Recalculate weights
        if (stocksLiveVal > 0) {
          newStocks.forEach(h => {
            const val = h.live_value || h.value || 0;
            h.weight_pct = Math.round((val / stocksLiveVal) * 10000) / 100;
            if (totalPortfolioVal > 0) {
              h.total_weight_pct = Math.round((val / totalPortfolioVal) * 10000) / 100;
            }
          });
        }
        if (bondsLiveVal > 0) {
          newBonds.forEach(b => {
            const val = b.live_value || b.value || 0;
            b.weight_pct = Math.round((val / bondsLiveVal) * 10000) / 100;
            if (totalPortfolioVal > 0) {
              b.total_weight_pct = Math.round((val / totalPortfolioVal) * 10000) / 100;
            }
          });
        }

        updatedPortfolio = {
          ...portfolioData,
          stocks: newStocks,
          holdings: newStocks,
          direct_stocks: newDirect,
          etfs: newEtfs,
          bonds: newBonds,
          summary: {
            ...portfolioData.summary,
            total_portfolio_value: Math.round(totalPortfolioVal * 100) / 100,
            total_stocks_value: Math.round(stocksLiveVal * 100) / 100,
            total_bonds_value: Math.round(bondsLiveVal * 100) / 100,
            total_positions: newStocks.length,
            unrealized_gain: totalGain,
            unrealized_gain_pct: totalGainPct,
            stocks_unrealized_gain: Math.round(stocksGain * 100) / 100,
            bonds_unrealized_gain: Math.round(bondsGain * 100) / 100,
            total_stocks_invested: Math.round(stocksCostTotal * 100) / 100,
            total_bonds_invested: Math.round(bondsCostTotal * 100) / 100,
            broker_source: res.broker_data.broker || 'Broker',
            broker_client_code: res.broker_data.client_code,
            broker_enriched_count: matched,
            broker_total_positions: res.broker_data.total_positions,
            broker_total_invested: res.broker_data.total_invested_value,
            broker_total_closing: res.broker_data.total_closing_value,
            broker_total_pnl: res.broker_data.total_unrealised_pnl
          }
        };
      }

      if (updatedPortfolio) {
        updatePortfolioState(updatedPortfolio);
        // Auto-save the broker-precedence portfolio to database
        try {
          await savePortfolio(updatedPortfolio, updatedPortfolio.meta || {});
        } catch (saveErr) {
          console.warn('Could not auto-save to DB:', saveErr);
        }
        const count = updatedPortfolio.summary?.broker_enriched_count || 0;
        setBrokerNotice({
          type: 'success',
          message: `Successfully imported ${res.broker_data?.broker || 'broker'} buy prices for ${count} positions. Accurate P&L active.`
        });
        setTimeout(() => setBrokerNotice(null), 6000);
      }
    } catch (err) {
      setError('Failed to import broker buy prices: ' + err.message);
    } finally {
      setIsBrokerUploading(false);
    }
  };

  // Data Collections
  const stocksList = useMemo(() => {
    return portfolioData?.stocks || portfolioData?.holdings || [];
  }, [portfolioData]);

  const directStocksList = useMemo(() => {
    if (Array.isArray(portfolioData?.direct_stocks)) {
      return portfolioData.direct_stocks;
    }
    return stocksList.filter(s => s.subtype === 'DIRECT_STOCK' || !s.subtype);
  }, [portfolioData, stocksList]);

  const etfsList = useMemo(() => {
    if (Array.isArray(portfolioData?.etfs)) {
      return portfolioData.etfs;
    }
    return stocksList.filter(s => s.subtype === 'ETF');
  }, [portfolioData, stocksList]);

  const mutualFundsList = useMemo(() => {
    return portfolioData?.mutual_funds || [];
  }, [portfolioData]);

  const bondsList = useMemo(() => {
    return portfolioData?.bonds || [];
  }, [portfolioData]);

  const historicalValuations = useMemo(() => {
    return portfolioData?.historical_valuations || portfolioData?.meta?.historical_valuations || [];
  }, [portfolioData]);

  const transactionsList = useMemo(() => {
    return portfolioData?.transactions || portfolioData?.meta?.transactions || [];
  }, [portfolioData]);

  const analyticsData = useMemo(() => {
    return portfolioData?.analytics || null;
  }, [portfolioData]);

  // Aggregated Summary values
  const summary = portfolioData?.summary || {};
  const totalVal = summary.total_portfolio_value || (stocksList.reduce((s, h) => s + (h.live_value || h.value || 0), 0) + mutualFundsList.reduce((s, m) => s + (m.value || 0), 0) + bondsList.reduce((s, b) => s + (b.value || 0), 0));
  const stocksVal = summary.total_stocks_value || summary.live_stocks_value || stocksList.reduce((s, h) => s + (h.live_value || h.value || 0), 0);
  const directStocksVal = summary.direct_stocks_value || directStocksList.reduce((s, h) => s + (h.live_value || h.value || 0), 0);
  const etfsVal = summary.etfs_value || etfsList.reduce((s, h) => s + (h.live_value || h.value || 0), 0);
  const mfVal = summary.total_mf_value || mutualFundsList.reduce((s, m) => s + (m.value || 0), 0);
  const bondsVal = summary.total_bonds_value || bondsList.reduce((s, b) => s + (b.value || 0), 0);

  const stockGainTotal = summary.unrealized_gain ?? stocksList.reduce((s, h) => s + (h.gain || 0), 0);
  const stockGainPct = summary.unrealized_gain_pct ?? 0;

  return (
    <div className="space-y-6">
      {/* ── HEADER BANNER ── */}
      <PortfolioHeader
        portfolioData={portfolioData}
        onExportCSV={handleExportCSV}
        onExportJSON={handleExportJSON}
        onSave={handleSaveToDatabase}
        onClear={handleClearPortfolio}
        onUploadBroker={handleUploadBrokerSpreadsheet}
        saveStatus={saveStatus}
        isExporting={isExporting}
        isBrokerUploading={isBrokerUploading}
      />

      {brokerNotice && (
        <div className="p-3 bg-info/10 border border-info/30 rounded-xl text-xs text-info flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{brokerNotice.message}</span>
          </div>
          <button onClick={() => setBrokerNotice(null)} className="text-info/70 hover:text-info text-sm">✕</button>
        </div>
      )}

      {/* ── CONDITIONAL VIEW: UPLOAD FORM OR PORTFOLIO DASHBOARD ── */}
      {!portfolioData ? (
        <PortfolioUploader
          onParsed={handleParseStatement}
          onLoadDemo={handleLoadDemo}
          loading={loading}
          error={error}
        />
      ) : (
        <div className="space-y-6">
          {/* ── HERO BALANCE & SUMMARY CARDS ── */}
          <MetricCards
            summary={summary}
            analytics={analyticsData}
            directStocksList={directStocksList}
            etfsList={etfsList}
            mutualFundsList={mutualFundsList}
            bondsList={bondsList}
            totalVal={totalVal}
            stocksVal={stocksVal}
            mfVal={mfVal}
            bondsVal={bondsVal}
            stockGainTotal={stockGainTotal}
            stockGainPct={stockGainPct}
            statementPeriod={portfolioData.statement_period}
          />

          {/* ── NAVIGATION BAR: SEGMENTED PILL TABS + SEARCH ── */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
            {/* Wealthfolio Segmented Pill Tabs */}
            <div className="inline-flex items-center gap-1 bg-muted/60 p-1 rounded-full border border-border/40 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveTab('stocks')}
                className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-200 shrink-0 ${
                  activeTab === 'stocks'
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Stocks & ETFs ({stocksList.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('mutual_funds')}
                className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-200 shrink-0 ${
                  activeTab === 'mutual_funds'
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Mutual Funds ({mutualFundsList.length})
              </button>

              {bondsList.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab('bonds')}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-200 shrink-0 ${
                    activeTab === 'bonds'
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Bonds & SGBs ({bondsList.length})
                </button>
              )}

              <button
                type="button"
                onClick={() => setActiveTab('analytics')}
                className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-200 shrink-0 ${
                  activeTab === 'analytics'
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Analytics & Insights
              </button>
            </div>

            {/* Pill Search Input */}
            {activeTab !== 'analytics' && (
              <div className="relative w-full sm:w-72">
                <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    activeTab === 'stocks'
                      ? 'Search ticker or company...'
                      : activeTab === 'mutual_funds'
                      ? 'Search scheme or folio...'
                      : 'Search security...'
                  }
                  className="w-full bg-card border border-border rounded-full pl-8 pr-3 py-1.5 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-ring transition-colors"
                />
              </div>
            )}
          </div>

          {/* ── TAB CONTENT ── */}
          {activeTab === 'stocks' && (
            <StocksTable
              stocks={stocksList}
              directStocks={directStocksList}
              etfs={etfsList}
              searchQuery={searchQuery}
              onSelectStock={onSelectStock}
              summary={summary}
            />
          )}

          {activeTab === 'mutual_funds' && (
            <MutualFundsTable
              mutualFunds={mutualFundsList}
              searchQuery={searchQuery}
            />
          )}

          {activeTab === 'bonds' && (
            <BondsTable
              bonds={bondsList}
            />
          )}

          {activeTab === 'analytics' && (
            <div className="space-y-6">
              {/* Edge-to-Edge Portfolio Growth Chart */}
              <PortfolioGrowthChart
                historicalValuations={historicalValuations}
                chartMetric={chartMetric}
                onChartMetricChange={setChartMetric}
              />

              {/* Asset Allocation Breakdown */}
              <AllocationBreakdown
                totalVal={totalVal}
                directStocksVal={directStocksVal}
                etfsVal={etfsVal}
                mfVal={mfVal}
                bondsVal={bondsVal}
              />

              {/* Transaction Ledger */}
              <TransactionsLedger
                transactions={transactionsList}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
