import React, { useState, useMemo, useRef } from 'react';
import {
  Eye,
  EyeOff,
  TrendingUp,
  TrendingDown,
  Briefcase,
  Layers,
  ChevronRight,
  ArrowUpRight,
  ShieldCheck,
  FileSpreadsheet,
  Download,
  Upload,
  RefreshCw,
  Sparkles,
  PieChart,
  Activity,
  CheckCircle2,
  Wallet
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip
} from 'recharts';

export default function PortfolioDashboard({
  portfolioData = null,
  onNavigateToHoldings = () => {},
  onSelectStock = () => {},
  onUploadBroker = () => {},
  isBrokerUploading = false,
  onUploadEPFO = () => {},
  isEPFOUploading = false,
  onExportCSV = () => {},
  onExportJSON = () => {},
  onLoadDemo = () => {},
  onParseStatement = () => {}
}) {
  // Privacy mask toggle (Wealthfolio signature eye icon)
  const [isPrivate, setIsPrivate] = useState(() => {
    return localStorage.getItem('stock_ai_privacy_mode') === 'true';
  });

  const togglePrivacy = () => {
    setIsPrivate(prev => {
      const next = !prev;
      localStorage.setItem('stock_ai_privacy_mode', String(next));
      return next;
    });
  };

  const fileInputRef = useRef(null);
  const epfoFileInputRef = useRef(null);

  // Helper for masking numbers
  const mask = (valStr) => {
    if (!isPrivate) return valStr;
    return '••••••';
  };

  const formatCurrency = (val, maxDigits = 0) => {
    if (val === undefined || val === null || isNaN(val)) return '₹0';
    if (isPrivate) return '₹••••••';
    return `₹${Math.abs(val).toLocaleString('en-IN', { maximumFractionDigits: maxDigits })}`;
  };

  // Extract collections
  const stocks = useMemo(() => portfolioData?.stocks || portfolioData?.holdings || [], [portfolioData]);
  const directStocks = useMemo(() => {
    if (Array.isArray(portfolioData?.direct_stocks)) return portfolioData.direct_stocks;
    return stocks.filter(s => s.subtype !== 'ETF');
  }, [portfolioData, stocks]);
  const etfs = useMemo(() => {
    if (Array.isArray(portfolioData?.etfs)) return portfolioData.etfs;
    return stocks.filter(s => s.subtype === 'ETF');
  }, [portfolioData, stocks]);
  const mutualFunds = useMemo(() => portfolioData?.mutual_funds || [], [portfolioData]);
  const bonds = useMemo(() => portfolioData?.bonds || [], [portfolioData]);
  const epfoAccounts = useMemo(() => portfolioData?.epfo_accounts || [], [portfolioData]);
  const historical = useMemo(() => portfolioData?.historical_valuations || portfolioData?.meta?.historical_valuations || [], [portfolioData]);
  const summary = portfolioData?.summary || {};
  const analytics = portfolioData?.analytics || null;
  const performance = analytics?.performance || null;

  // Valuation aggregations
  const stocksVal = summary.total_stocks_value || stocks.reduce((s, h) => s + (h.live_value || h.value || 0), 0);
  const mfVal = summary.total_mf_value || mutualFunds.reduce((s, m) => s + (m.value || 0), 0);
  const bondsVal = summary.total_bonds_value || bonds.reduce((s, b) => s + (b.live_value || b.value || 0), 0);
  const epfoVal = summary.total_epfo_value || epfoAccounts.reduce((s, a) => s + (a.total_balance || 0), 0);
  const totalNetWorth = summary.total_portfolio_value || (stocksVal + mfVal + bondsVal + epfoVal);
  const stocksCost = summary.total_stocks_invested || stocks.reduce((s, h) => s + (h.cost_basis || ((h.price || 0) * (h.quantity || 0))), 0);
  const mfCost = mutualFunds.reduce((s, m) => s + (m.cost_basis || (m.value || 0)), 0);
  const bondsCost = summary.total_bonds_invested || bonds.reduce((s, b) => s + (b.cost_basis || ((b.price || 0) * (b.quantity || 0))), 0);
  const totalCostBasis = stocksCost + mfCost + bondsCost;

  const stocksGain = summary.stocks_unrealized_gain !== undefined ? summary.stocks_unrealized_gain : stocks.reduce((s, h) => s + (h.gain || 0), 0);
  const mfGain = mutualFunds.reduce((s, m) => s + (m.gain || 0), 0);
  const bondsGain = summary.bonds_unrealized_gain !== undefined ? summary.bonds_unrealized_gain : bonds.reduce((s, b) => s + (b.gain || 0), 0);
  const totalNetGain = (summary.unrealized_gain !== undefined) ? (summary.unrealized_gain + mfGain) : (stocksGain + mfGain + bondsGain);
  const totalNetGainPct = totalCostBasis > 0 ? (totalNetGain / totalCostBasis) * 100 : 0;

  // Asset allocation percentages
  const stocksPct = totalNetWorth > 0 ? (stocksVal / totalNetWorth) * 100 : 0;
  const mfPct = totalNetWorth > 0 ? (mfVal / totalNetWorth) * 100 : 0;
  const bondsPct = totalNetWorth > 0 ? (bondsVal / totalNetWorth) * 100 : 0;
  const epfoPct = totalNetWorth > 0 ? (epfoVal / totalNetWorth) * 100 : 0;

  // Cross-Asset Top Holdings (ranked by market value across all categories)
  const topHoldings = useMemo(() => {
    const list = [];
    stocks.forEach(s => {
      const val = s.live_value || s.value || 0;
      list.push({
        id: s.isin || s.symbol,
        name: s.name || s.symbol,
        symbol: s.symbol,
        isin: s.isin,
        category: s.subtype === 'ETF' ? 'ETF' : 'Stock',
        badgeClass: s.subtype === 'ETF' ? 'bg-chart-5/10 text-chart-5 border-chart-5/30' : 'bg-info/10 text-info border-info/30',
        value: val,
        cost: s.cost_basis || ((s.price || 0) * (s.quantity || 0)),
        gain: s.gain || 0,
        gainPct: s.gain_pct || 0,
        isClickable: true,
        weightPct: totalNetWorth > 0 ? (val / totalNetWorth) * 100 : 0
      });
    });

    mutualFunds.forEach(m => {
      const val = m.value || 0;
      list.push({
        id: m.isin || m.name,
        name: m.name,
        symbol: m.amfi || 'MF',
        isin: m.isin,
        category: 'Mutual Fund',
        badgeClass: 'bg-primary/10 text-primary border-primary/30',
        value: val,
        cost: m.cost_basis || val,
        gain: m.gain || 0,
        gainPct: m.gain_pct || 0,
        isClickable: false,
        weightPct: totalNetWorth > 0 ? (val / totalNetWorth) * 100 : 0
      });
    });

    bonds.forEach(b => {
      const val = b.live_value || b.value || 0;
      list.push({
        id: b.isin || b.name,
        name: b.name,
        symbol: b.symbol || 'BOND',
        isin: b.isin,
        category: b.subtype === 'SGB' ? 'SGB Gold' : 'Corporate Debt',
        badgeClass: b.subtype === 'SGB' ? 'bg-warning/10 text-warning border-warning/30' : 'bg-muted text-muted-foreground border-border/60',
        value: val,
        cost: b.cost_basis || val,
        gain: b.gain || 0,
        gainPct: b.gain_pct || 0,
        isClickable: false,
        weightPct: totalNetWorth > 0 ? (val / totalNetWorth) * 100 : 0
      });
    });

    return list.sort((a, b) => b.value - a.value).slice(0, 6);
  }, [stocks, mutualFunds, bonds, totalNetWorth]);

  // Asset Movers: Top Profit Driver & Top Drag
  const movers = useMemo(() => {
    const all = [...stocks, ...bonds];
    if (all.length === 0) return { topGain: null, topDrag: null };
    const sortedByGain = [...all].sort((a, b) => (b.gain || 0) - (a.gain || 0));
    const topGain = sortedByGain[0] && (sortedByGain[0].gain || 0) > 0 ? sortedByGain[0] : null;
    const sortedByLoss = [...all].sort((a, b) => (a.gain || 0) - (b.gain || 0));
    const topDrag = sortedByLoss[0] && (sortedByLoss[0].gain || 0) < 0 ? sortedByLoss[0] : null;
    return { topGain, topDrag };
  }, [stocks, bonds]);

  // Accounts rollup
  const accountsRollup = useMemo(() => {
    const list = [];
    const growwTotal = stocksVal + bondsVal;
    if (stocks.length > 0 || bonds.length > 0) {
      list.push({
        name: 'Groww Demat Account',
        subtitle: `CDSL Demat • UCC: ${summary.broker_client_code || '7122269143'}`,
        count: `${stocks.length + bonds.length} Assets (Equities & Gold)`,
        value: growwTotal,
        badge: 'Verified Demat',
        badgeClass: 'bg-success/10 text-success border-success/30',
        targetTab: 'stocks'
      });
    }

    if (mutualFunds.length > 0) {
      list.push({
        name: summary.broker_source ? `${summary.broker_source} Mutual Funds` : 'Mutual Fund Folios',
        subtitle: summary.mf_xirr ? `Portfolio XIRR: +${summary.mf_xirr}% • ${summary.broker_source || 'Broker'} Statement` : 'CAMS / KFintech Statement Verified',
        count: `${mutualFunds.length} Active Schemes`,
        value: mfVal,
        badge: summary.mf_xirr ? `+${summary.mf_xirr}% XIRR` : 'RTA Certified',
        badgeClass: summary.mf_xirr ? 'bg-success/10 text-success border-success/30' : 'bg-info/10 text-info border-info/30',
        targetTab: 'mutual_funds'
      });
    }
    if (epfoAccounts.length > 0) {
      list.push({
        name: 'EPFO Provident Fund',
        subtitle: `${epfoAccounts.length} Member Account${epfoAccounts.length > 1 ? 's' : ''} • Sovereign Backed`,
        count: epfoAccounts.map(a => a.establishment_name).filter(Boolean).slice(0, 2).join(', ') || 'Provident Fund Passbook',
        value: epfoVal,
        badge: 'EPF Fixed Income',
        badgeClass: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
        targetTab: 'epfo'
      });
    }
    return list;
  }, [stocks, bonds, mutualFunds, epfoAccounts, stocksVal, bondsVal, mfVal, epfoVal, summary]);

  // Chart data
  const chartData = useMemo(() => {
    if (!historical || historical.length === 0) return [];
    return historical.map(item => ({
      name: item.month_year || item.month,
      value: item.value
    }));
  }, [historical]);

  // If no portfolio is loaded, show welcoming empty state
  if (!portfolioData) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 space-y-8">
        <div className="text-center space-y-3">
          <div className="inline-flex p-3 rounded-2xl bg-card border border-border/80 shadow-xs mb-2">
            <Wallet className="w-8 h-8 text-foreground" />
          </div>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-foreground">
            Portfolio Intelligence & Net Worth Summary
          </h1>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto">
            Consolidate your Indian stocks, mutual funds, and Sovereign Gold Bonds into an institutional dashboard with 12-month analytics.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="glass-card p-6 space-y-4 hover:border-foreground/30 transition-all">
            <div className="w-10 h-10 rounded-xl bg-muted/60 border border-border/40 flex items-center justify-center text-foreground font-bold">
              <Upload className="w-5 h-5 text-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-base">Import CAS Statement (PDF)</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Upload your official CDSL, NSDL, or CAMS Consolidated Account Statement to extract all holdings and historical valuations.
              </p>
            </div>
            <button
              onClick={() => onNavigateToHoldings('stocks')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 transition-all shadow-xs"
            >
              <span>Upload CAS Statement</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="glass-card p-6 space-y-4 hover:border-foreground/30 transition-all">
            <div className="w-10 h-10 rounded-xl bg-muted/60 border border-border/40 flex items-center justify-center text-foreground font-bold">
              <Sparkles className="w-5 h-5 text-warning" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-base">Explore Instant Demo Portfolio</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Experience the Wealthfolio summary dashboard instantly with pre-loaded demo holdings across stocks, mutual funds, and gold.
              </p>
            </div>
            <button
              onClick={onLoadDemo}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-card border border-border/80 text-foreground hover:bg-muted/80 transition-all shadow-xs"
            >
              <span>Load Sample Portfolio</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── TOP ACTION BAR ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-0.5">
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-card border border-border/60 text-muted-foreground">
            <CheckCircle2 className="w-3 h-3 text-success" />
            <span>Consolidated Net Worth</span>
          </div>
          {summary.broker_source && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-success/10 text-success border border-success/20">
              <span>{summary.broker_source} Verified</span>
            </div>
          )}
        </div>

        {/* Quick Toolbar */}
        <div className="flex items-center gap-2">
          {/* Hidden broker spreadsheet input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                onUploadBroker(e.target.files[0]);
                e.target.value = '';
              }
            }}
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isBrokerUploading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-foreground bg-card hover:bg-muted/80 border border-border/80 rounded-full transition-all duration-150 active:scale-95 shadow-xs disabled:opacity-50"
            title="Upload broker spreadsheet (Groww, Zerodha, Upstox - Stocks or Mutual Funds)"
          >
            {isBrokerUploading ? (
              <RefreshCw className="w-3.5 h-3.5 text-muted-foreground animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5 text-info" />
            )}
            <span>{isBrokerUploading ? 'Importing...' : 'Sync Broker Sheet'}</span>
          </button>
          {/* Hidden EPFO PDF input */}
          <input
            ref={epfoFileInputRef}
            type="file"
            multiple
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                onUploadEPFO(Array.from(e.target.files));
                e.target.value = '';
              }
            }}
          />

          <button
            type="button"
            onClick={() => epfoFileInputRef.current?.click()}
            disabled={isEPFOUploading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-foreground bg-card hover:bg-muted/80 border border-border/80 rounded-full transition-all duration-150 active:scale-95 shadow-xs disabled:opacity-50"
            title="Upload one or more official EPFO Member Passbook PDFs"
          >
            {isEPFOUploading ? (
              <RefreshCw className="w-3.5 h-3.5 text-muted-foreground animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5 text-emerald-600" />
            )}
            <span>{isEPFOUploading ? 'Importing...' : 'Sync EPFO Passbook'}</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateToHoldings('stocks')}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-background bg-foreground hover:bg-foreground/90 rounded-full transition-all duration-150 active:scale-95 shadow-xs"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Detailed Holdings</span>
            <ChevronRight className="w-3 h-3 ml-0.5" />
          </button>
        </div>
      </div>

      {/* ── 1. HERO NET WORTH VALUATION CARD (Wealthfolio Balance Signature) ── */}
      <div className="glass-card p-6 sm:p-8 space-y-4 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-muted-foreground tracking-wider uppercase">
                Total Portfolio Net Worth
              </span>
              <button
                type="button"
                onClick={togglePrivacy}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors"
                title={isPrivate ? 'Unhide numbers' : 'Hide numbers for privacy'}
              >
                {isPrivate ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>

            <div className="font-serif text-3xl sm:text-5xl font-bold tracking-tight text-foreground">
              {formatCurrency(totalNetWorth, 2)}
            </div>

            {/* Performance Strip */}
            <div className="flex items-center flex-wrap gap-2.5 text-xs pt-1">
              <span className={`font-mono font-semibold ${totalNetGain >= 0 ? 'text-success' : 'text-destructive'}`}>
                {totalNetGain >= 0 ? '+' : '-'}₹{mask(Math.abs(totalNetGain).toLocaleString('en-IN', { maximumFractionDigits: 0 }))}
              </span>
              <span className="h-3 w-px bg-border/60" />
              <span className={`font-mono font-semibold ${totalNetGainPct >= 0 ? 'text-success' : 'text-destructive'}`}>
                {totalNetGainPct >= 0 ? '+' : ''}{isPrivate ? '•••' : totalNetGainPct.toFixed(2)}%
              </span>
              <span className="text-muted-foreground">unrealized return</span>

              {performance?.total_growth_pct > 0 && (
                <>
                  <span className="h-3 w-px bg-border/60" />
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-success/10 text-success border border-success/20 font-mono">
                    12M: +{performance.total_growth_pct.toFixed(1)}%
                  </span>
                </>
              )}

              {performance?.cagr_pct > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-info/10 text-info border border-info/20 font-mono">
                  CAGR {performance.cagr_pct.toFixed(1)}%
                </span>
              )}
            </div>
          </div>

          <div className="text-right sm:self-start space-y-1">
            <div className="text-xs text-muted-foreground">
              Total Invested Capital
            </div>
            <div className="font-mono text-lg font-bold text-foreground">
              {formatCurrency(totalCostBasis)}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {stocks.length + mutualFunds.length + bonds.length + epfoAccounts.length} Assets Tracked
            </div>
          </div>
        </div>

        {/* ── MULTI-ASSET PROPORTION BAR ── */}
        <div className="space-y-2 pt-2 border-t border-border/30">
          <div className="w-full h-2 rounded-full overflow-hidden flex bg-muted/60">
            <div
              style={{ width: `${stocksPct}%` }}
              className="bg-info transition-all duration-500"
              title={`Direct Stocks & ETFs: ${stocksPct.toFixed(1)}%`}
            />
            <div
              style={{ width: `${mfPct}%` }}
              className="bg-primary transition-all duration-500"
              title={`Mutual Funds: ${mfPct.toFixed(1)}%`}
            />
            <div
              style={{ width: `${bondsPct}%` }}
              className="bg-warning transition-all duration-500"
              title={`Bonds & SGB: ${bondsPct.toFixed(1)}%`}
            />
            {epfoPct > 0 && (
              <div
                style={{ width: `${epfoPct}%` }}
                className="bg-emerald-600 transition-all duration-500"
                title={`EPFO Provident Fund: ${epfoPct.toFixed(1)}%`}
              />
            )}
          </div>

          {/* Allocation Legend */}
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-0.5 flex-wrap gap-2">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-info" />
                <span>Stocks & ETFs: <strong className="text-foreground font-mono">{stocksPct.toFixed(1)}%</strong></span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-primary" />
                <span>Mutual Funds: <strong className="text-foreground font-mono">{mfPct.toFixed(1)}%</strong></span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-warning" />
                <span>Bonds & SGB: <strong className="text-foreground font-mono">{bondsPct.toFixed(1)}%</strong></span>
              </span>
            </div>
              {epfoVal > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-600" />
                  <span>EPFO: <strong className="text-foreground font-mono">{epfoPct.toFixed(1)}%</strong></span>
                </span>
              )}
            {summary.statement_period?.to && (
              <span className="text-[11px] font-mono text-muted-foreground/80">
                Statement: {summary.statement_period.to}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── 2. THREE MULTI-ASSET CARDS (Quick Drill-Down to Holdings) ── */}
      <div className={`grid grid-cols-1 ${epfoVal > 0 ? 'md:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-3'} gap-4`}>
        {/* Card 1: Direct Stocks & ETFs */}
        <div
          onClick={() => onNavigateToHoldings('stocks')}
          className="glass-card p-5 space-y-3 cursor-pointer hover:border-info/40 transition-all duration-200 group relative"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-info/10 flex items-center justify-center text-info">
                <Briefcase className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-foreground">Stocks & ETFs</span>
            </div>
            <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-info transition-colors" />
          </div>

          <div>
            <div className="font-mono text-2xl font-bold text-foreground">
              {formatCurrency(stocksVal)}
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
              <span>Cost: {formatCurrency(stocksCost)}</span>
              <span>•</span>
              <span className={stocksGain >= 0 ? 'text-success font-medium font-mono' : 'text-destructive font-medium font-mono'}>
                {stocksGain >= 0 ? '+' : ''}{formatCurrency(stocksGain)}
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-border/30 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{stocks.length} Positions ({directStocks.length} Direct, {etfs.length} ETFs)</span>
            <span className="font-mono font-medium text-foreground">{stocksPct.toFixed(1)}% share</span>
          </div>
        </div>

        {/* Card 2: Mutual Funds */}
        <div
          onClick={() => onNavigateToHoldings('mutual_funds')}
          className="glass-card p-5 space-y-3 cursor-pointer hover:border-primary/40 transition-all duration-200 group relative"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <Layers className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-foreground">Mutual Funds</span>
            </div>
            <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>

          <div>
            <div className="font-mono text-2xl font-bold text-foreground">
              {formatCurrency(mfVal)}
            </div>
            <div className="text-xs text-muted-foreground flex items-center flex-wrap gap-1.5 mt-0.5">
              <span>Cost: {formatCurrency(mfCost)}</span>
              <span>•</span>
              <span className={mfGain >= 0 ? 'text-success font-medium font-mono' : 'text-destructive font-medium font-mono'}>
                {mfGain >= 0 ? '+' : ''}{formatCurrency(mfGain)}
              </span>
              {summary.mf_xirr !== undefined && summary.mf_xirr !== null && (
                <>
                  <span>•</span>
                  <span className="text-success font-mono font-semibold">
                    +{summary.mf_xirr}% XIRR
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="pt-2 border-t border-border/30 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{mutualFunds.length} Active Folio Schemes</span>
            <span className="font-mono font-medium text-foreground">{mfPct.toFixed(1)}% share</span>
          </div>
        </div>

        {/* Card 3: Sovereign Gold Bonds & Debt */}
        <div
          onClick={() => onNavigateToHoldings('bonds')}
          className="glass-card p-5 space-y-3 cursor-pointer hover:border-warning/40 transition-all duration-200 group relative"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-warning/10 flex items-center justify-center text-warning">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-foreground">Bonds & SGB Gold</span>
            </div>
            <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-warning transition-colors" />
          </div>

          <div>
            <div className="font-mono text-2xl font-bold text-foreground">
              {formatCurrency(bondsVal)}
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
              <span>Cost: {formatCurrency(bondsCost)}</span>
              <span>•</span>
              <span className={bondsGain >= 0 ? 'text-success font-medium font-mono' : 'text-destructive font-medium font-mono'}>
                {bondsGain >= 0 ? '+' : ''}{formatCurrency(bondsGain)}
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-border/30 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{bonds.length} Holdings (SGB + NCD)</span>
            <span className="font-mono font-medium text-foreground">{bondsPct.toFixed(1)}% share</span>
          </div>
        </div>
        {/* Card 4: EPFO Provident Fund */}
        {epfoVal > 0 && (
          <div
            onClick={() => onNavigateToHoldings('epfo')}
            className="glass-card p-5 space-y-3 cursor-pointer hover:border-emerald-500/40 transition-all duration-200 group relative"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-foreground">EPFO Provident Fund</span>
              </div>
              <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-emerald-600 transition-colors" />
            </div>

            <div>
              <div className="font-mono text-2xl font-bold text-foreground">
                {formatCurrency(epfoVal)}
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                <span>{epfoAccounts.length} Account{epfoAccounts.length > 1 ? 's' : ''}</span>
                <span>•</span>
                <span className="text-emerald-600 font-medium font-mono">
                  Sovereign Guaranteed
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-border/30 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>8.25% p.a. FY24</span>
              <span className="font-mono font-medium text-foreground">{epfoPct.toFixed(1)}% share</span>
            </div>
          </div>
        )}
      </div>

      {/* ── 3. TWO-COLUMN DASHBOARD GRID (Wealthfolio Layout) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ── LEFT COLUMN (7 COLS = ~60%): Growth Curve & Top Holdings ── */}
        <div className="lg:col-span-7 space-y-6">
          {/* 1-Year Valuation Curve */}
          {chartData.length >= 2 && (
            <div className="glass-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-foreground text-sm">1-Year Portfolio Valuation Curve</h3>
                  <p className="text-xs text-muted-foreground">Monthly net worth expansion from official CAS</p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigateToHoldings('analytics')}
                  className="text-xs font-semibold text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
                >
                  <span>Analytics</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="h-52 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="dashboardAreaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4d6d13" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#4d6d13" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="name"
                      stroke="#6f6e69"
                      fontSize={10}
                      tickLine={false}
                      axisLine={{ stroke: 'rgba(0,0,0,0.06)' }}
                    />
                    <YAxis
                      stroke="#6f6e69"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val) => `₹${(val / 100000).toFixed(1)}L`}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const p = payload[0];
                          return (
                            <div className="glass-card p-2.5 text-xs shadow-md border border-border/80">
                              <div className="font-semibold text-foreground">{p.payload.name}</div>
                              <div className="font-mono text-success font-bold mt-0.5">
                                {formatCurrency(p.value, 0)}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#4d6d13"
                      strokeWidth={2}
                      fill="url(#dashboardAreaGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Cross-Asset Top Holdings (Top 6 Positions by Value) */}
          <div className="glass-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-foreground text-sm">Top Holdings by Capital Allocation</h3>
                <p className="text-xs text-muted-foreground">Largest capital commitments across all asset classes</p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateToHoldings('stocks')}
                className="text-xs font-semibold text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
              >
                <span>View all {stocks.length + mutualFunds.length + bonds.length + epfoAccounts.length}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="divide-y divide-border/30">
              {topHoldings.map((h, idx) => (
                <div
                  key={h.id || idx}
                  onClick={() => {
                    if (h.isClickable && h.symbol) {
                      onSelectStock(h.symbol);
                    } else if (h.category === 'Mutual Fund') {
                      onNavigateToHoldings('mutual_funds');
                    } else {
                      onNavigateToHoldings('bonds');
                    }
                  }}
                  className="py-3 flex items-center justify-between gap-3 hover:bg-muted/30 px-2 rounded-lg transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-xs text-muted-foreground w-4">
                      0{idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground text-xs font-mono group-hover:text-primary transition-colors">
                          {h.symbol}
                        </span>
                        <span className={`inline-flex items-center px-2 py-0.2 rounded-full text-[9px] font-semibold border ${h.badgeClass}`}>
                          {h.category}
                        </span>
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate max-w-xs sm:max-w-sm" title={h.name}>
                        {h.name}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0 space-y-0.5">
                    <div className="font-mono font-bold text-xs text-foreground">
                      {formatCurrency(h.value)}
                    </div>
                    <div className="flex items-center justify-end gap-1.5 text-[10px]">
                      <span className="font-mono text-muted-foreground">{h.weightPct.toFixed(1)}%</span>
                      <span>•</span>
                      <span className={`font-mono font-semibold ${h.gain >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {h.gain >= 0 ? '+' : ''}{isPrivate ? '•••' : (h.gainPct || 0).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN (5 COLS = ~40%): Accounts & Performance Snapshot ── */}
        <div className="lg:col-span-5 space-y-6">
          {/* Accounts & Depositories Rollup */}
          <div className="glass-card p-5 space-y-4">
            <div>
              <h3 className="font-semibold text-foreground text-sm">Accounts & Depositories</h3>
              <p className="text-xs text-muted-foreground">Connected brokerages and registered folio holdings</p>
            </div>

            <div className="space-y-2.5">
              {accountsRollup.map((acc, idx) => (
                <div
                  key={idx}
                  onClick={() => onNavigateToHoldings(acc.targetTab)}
                  className="p-3.5 rounded-xl border border-border/40 bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-foreground">{acc.name}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold border ${acc.badgeClass}`}>
                      {acc.badge}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] text-muted-foreground">{acc.count}</span>
                    <span className="font-mono font-bold text-sm text-foreground">
                      {formatCurrency(acc.value)}
                    </span>
                  </div>
                  <div className="text-[10px] text-muted-foreground/80 font-mono truncate">
                    {acc.subtitle}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Performance & Movers */}
          <div className="glass-card p-5 space-y-4">
            <div>
              <h3 className="font-semibold text-foreground text-sm">Asset Movers & Expansion Velocity</h3>
              <p className="text-xs text-muted-foreground">Top profit contributor and drag factors</p>
            </div>

            <div className="space-y-3">
              {/* Top Contributor */}
              {movers.topGain && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-success/5 border border-success/20">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-success">
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span>Top Profit Driver</span>
                    </div>
                    <div className="text-xs font-bold text-foreground font-mono">
                      {movers.topGain.name}
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono">
                      ISIN: {movers.topGain.isin}
                    </div>
                  </div>
                  <div className="text-right font-mono">
                    <div className="text-xs font-bold text-success">
                      +₹{mask(Math.abs(movers.topGain.gain || 0).toLocaleString('en-IN'))}
                    </div>
                    <div className="text-[10px] text-success">
                      +{isPrivate ? '•••' : (movers.topGain.gain_pct || 0).toFixed(1)}%
                    </div>
                  </div>
                </div>
              )}

              {/* Top Drag */}
              {movers.topDrag && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-destructive/5 border border-destructive/20">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-destructive">
                      <TrendingDown className="w-3.5 h-3.5" />
                      <span>Top Holding Drag</span>
                    </div>
                    <div className="text-xs font-bold text-foreground font-mono">
                      {movers.topDrag.name}
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono">
                      ISIN: {movers.topDrag.isin}
                    </div>
                  </div>
                  <div className="text-right font-mono">
                    <div className="text-xs font-bold text-destructive">
                      -₹{mask(Math.abs(movers.topDrag.gain || 0).toLocaleString('en-IN'))}
                    </div>
                    <div className="text-[10px] text-destructive">
                      {isPrivate ? '•••' : (movers.topDrag.gain_pct || 0).toFixed(1)}%
                    </div>
                  </div>
                </div>
              )}

              {/* Expansion Velocity */}
              {performance && (
                <div className="p-3 rounded-xl bg-muted/30 border border-border/40 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Avg Monthly Expansion</span>
                    <span className="font-mono font-bold text-foreground">
                      +₹{mask(Math.abs(performance.avg_monthly_change_rs || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 }))} / mo
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Performance Consistency</span>
                    <span className="font-mono text-foreground font-medium">
                      {performance.positive_months} Up • {performance.negative_months} Down months
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Quick Data Actions */}
          <div className="glass-card p-4 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onExportCSV}
              className="flex-1 py-2 px-3 text-xs font-semibold rounded-lg bg-muted/60 hover:bg-muted text-foreground border border-border/40 transition-colors flex items-center justify-center gap-1.5"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Export CSV</span>
            </button>
            <button
              type="button"
              onClick={onExportJSON}
              className="flex-1 py-2 px-3 text-xs font-semibold rounded-lg bg-muted/60 hover:bg-muted text-foreground border border-border/40 transition-colors flex items-center justify-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Export JSON</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
