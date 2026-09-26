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

export default function PortfolioPage({ onSelectStock }) {
  const [portfolioData, setPortfolioData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Tabs: 'stocks' | 'mutual_funds' | 'bonds' | 'analytics'
  const [activeTab, setActiveTab] = useState('stocks');
  // Chart toggle: 'value' | 'change_pct'
  const [chartMetric, setChartMetric] = useState('value');

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
        const enrichList = (list) => (list || []).map(item => {
          const isin = (item.isin || '').toUpperCase();
          const b = brokerMap.get(isin);
          if (b && b.avg_buy_price > 0) {
            matched++;
            const curPrice = item.live_price ?? item.price ?? 0;
            const buyPrice = b.avg_buy_price;
            const costBasis = b.buy_value || Math.round((item.quantity || 0) * buyPrice * 100) / 100;
            const gain = Math.round((curPrice - buyPrice) * (item.quantity || 0) * 100) / 100;
            const gainPct = buyPrice > 0 ? Math.round(((curPrice - buyPrice) / buyPrice) * 10000) / 100 : 0;
            return {
              ...item,
              buy_price: buyPrice,
              cost_basis: costBasis,
              gain,
              gain_pct: gainPct,
              has_broker_buy_price: true,
              broker_name: res.broker_data.broker || 'Broker'
            };
          }
          return item;
        });

        const newStocks = enrichList(portfolioData.stocks || portfolioData.holdings);
        const newDirect = enrichList(portfolioData.direct_stocks);
        const newEtfs = enrichList(portfolioData.etfs);
        const newBonds = enrichList(portfolioData.bonds);

        const totalCost = newStocks.reduce((sum, h) => sum + (h.has_broker_buy_price ? h.cost_basis : ((h.price || 0) * (h.quantity || 0))), 0);
        const totalLive = portfolioData.summary?.total_stocks_value || newStocks.reduce((sum, h) => sum + (h.live_value || h.value || 0), 0);
        const netGain = Math.round((totalLive - totalCost) * 100) / 100;
        const netGainPct = totalCost > 0 ? Math.round((netGain / totalCost) * 10000) / 100 : 0;

        updatedPortfolio = {
          ...portfolioData,
          stocks: newStocks,
          direct_stocks: newDirect,
          etfs: newEtfs,
          bonds: newBonds,
          summary: {
            ...portfolioData.summary,
            unrealized_gain: netGain,
            unrealized_gain_pct: netGainPct,
            total_stocks_invested: Math.round(totalCost * 100) / 100,
            broker_source: res.broker_data.broker || 'Broker',
            broker_client_code: res.broker_data.client_code,
            broker_enriched_count: matched,
            broker_total_positions: res.broker_data.total_positions
          }
        };
      }

      if (updatedPortfolio) {
        updatePortfolioState(updatedPortfolio);
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
    if (portfolioData?.direct_stocks && portfolioData.direct_stocks.length > 0) {
      return portfolioData.direct_stocks;
    }
    return stocksList.filter(s => s.subtype === 'DIRECT_STOCK' || !s.subtype);
  }, [portfolioData, stocksList]);

  const etfsList = useMemo(() => {
    if (portfolioData?.etfs && portfolioData.etfs.length > 0) {
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
