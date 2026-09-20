import React, { useState, useEffect, useRef } from 'react';
import {
  Upload,
  FileText,
  Lock,
  Eye,
  EyeOff,
  Download,
  FileSpreadsheet,
  FileCode,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  AlertTriangle,
  Info,
  ChevronRight,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ShieldCheck,
  Building,
  PieChart,
  Trash2,
  Sparkles,
  HelpCircle
} from 'lucide-react';
import {
  uploadCASFile,
  fetchSamplePortfolio,
  savePortfolio,
  fetchSavedPortfolio,
  clearSavedPortfolio,
  exportPortfolioCSV
} from '../utils/api';

const LOCAL_STORAGE_KEY = 'stock_ai_cached_portfolio';

export default function Portfolio({ onSelectStock }) {
  const [portfolioData, setPortfolioData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [enrichPrices, setEnrichPrices] = useState(true);
  const [selectedFile, setSelectedFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [activeTab, setActiveTab] = useState('equities'); // 'equities' | 'mutual_funds' | 'bonds'
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState('value'); // 'value' | 'symbol' | 'weight_pct' | 'gain' | 'quantity'
  const [sortDirection, setSortDirection] = useState('desc');
  const [saveStatus, setSaveStatus] = useState(null); // 'saving' | 'saved' | null
  const [isExporting, setIsExporting] = useState(false);
  
  const fileInputRef = useRef(null);

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

    // Fallback: check SQLite database for saved portfolio
    fetchSavedPortfolio()
      .then(res => {
        if (res?.data?.holdings && res.data.holdings.length > 0) {
          const loaded = {
            success: true,
            file_type: res.data.meta?.file_type || 'CDSL',
            statement_period: res.data.meta?.statement_period || {},
            investor_info: res.data.meta?.investor_info || {},
            holdings: res.data.holdings,
            mutual_funds: [],
            bonds: [],
            summary: res.data.meta?.summary || {
              total_portfolio_value: res.data.holdings.reduce((s, h) => s + (h.value || 0), 0),
              equities_count: res.data.holdings.length
            }
          };
          setPortfolioData(loaded);
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

  // Drag & drop handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        setSelectedFile(file);
        setError(null);
      } else {
        setError('Please upload a valid PDF file.');
      }
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setError(null);
    }
  };

  // Submit and Parse
  const handleParseSubmit = async (e) => {
    e?.preventDefault();
    if (!selectedFile) {
      setError('Please select a CAS PDF file first.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await uploadCASFile(selectedFile, password.trim().toUpperCase(), enrichPrices);
      if (res && res.success) {
        updatePortfolioState(res);
        setSelectedFile(null);
        setPassword('');
      } else {
        setError(res?.error || 'Failed to parse statement.');
      }
    } catch (err) {
      setError(err.message || 'Error uploading or parsing CAS statement.');
    } finally {
      setLoading(false);
    }
  };

  // Load Demo Portfolio
  const handleLoadSample = async () => {
    setLoading(true);
    setError(null);
    try {
      const sample = await fetchSamplePortfolio();
      updatePortfolioState(sample);
    } catch (err) {
      setError('Failed to load demo portfolio: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Save to SQLite
  const handleSaveToDatabase = async () => {
    if (!portfolioData || !portfolioData.holdings) return;
    setSaveStatus('saving');
    try {
      await savePortfolio(portfolioData.holdings, {
        file_type: portfolioData.file_type,
        statement_period: portfolioData.statement_period,
        investor_info: portfolioData.investor_info,
        summary: portfolioData.summary
      });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      alert('Failed to save to database: ' + err.message);
      setSaveStatus(null);
    }
  };

  // Reset / Clear
  const handleClearPortfolio = async () => {
    if (!window.confirm('Are you sure you want to clear the active portfolio?')) return;
    updatePortfolioState(null);
    setSelectedFile(null);
    setPassword('');
    setError(null);
    try {
      await clearSavedPortfolio();
    } catch (_) {}
  };

  // Export CSV
  const handleExportCSV = async () => {
    if (!portfolioData || !portfolioData.holdings) return;
    setIsExporting(true);
    try {
      await exportPortfolioCSV(portfolioData.holdings, portfolioData.summary);
    } catch (err) {
      alert('Export failed: ' + err.message);
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

  // Sorting
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Filter & Sort Holdings
  const filteredHoldings = (portfolioData?.holdings || []).filter(h => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (h.symbol && h.symbol.toLowerCase().includes(q)) ||
      (h.name && h.name.toLowerCase().includes(q)) ||
      (h.isin && h.isin.toLowerCase().includes(q))
    );
  }).sort((a, b) => {
    let aVal = a[sortField];
    let bVal = b[sortField];

    if (sortField === 'value') {
      aVal = a.live_value || a.value || 0;
      bVal = b.live_value || b.value || 0;
    } else if (sortField === 'symbol') {
      aVal = a.symbol || a.name || '';
      bVal = b.symbol || b.name || '';
      return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }

    if (aVal === bVal) return 0;
    return sortDirection === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
  });

  // Calculate live values
  const summary = portfolioData?.summary || {};
  const totalVal = summary.total_portfolio_value || 0;
  const equitiesVal = summary.live_equities_value || summary.total_equities_value || 0;
  const unrealizedGain = summary.unrealized_gain || 0;
  const unrealizedGainPct = summary.unrealized_gain_pct || 0;

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* ── HEADER BANNER ──────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-slate-950 p-6 rounded-2xl border border-slate-800 shadow-2xl relative overflow-hidden backdrop-blur-xl">
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="space-y-1 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-white">Stock Portfolio Exporter</h1>
                <span className="px-2 py-0.5 text-xs font-semibold bg-emerald-950/80 border border-emerald-500/30 text-emerald-400 rounded-full">
                  CDSL / NSDL CAS
                </span>
                {portfolioData?.is_sample && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-full">
                    Demo Mode
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Import official Consolidated Account Statement (CAS) PDF, track holdings, and export formatted reports.
              </p>
            </div>
          </div>
        </div>

        {portfolioData && (
          <div className="flex items-center flex-wrap gap-2.5 z-10">
            <button
              onClick={handleExportCSV}
              disabled={isExporting}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-emerald-300 bg-emerald-950/50 hover:bg-emerald-900/50 border border-emerald-500/40 rounded-xl transition-all shadow-lg shadow-emerald-950/30 hover:shadow-emerald-900/40 active:scale-95 disabled:opacity-50"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={handleExportJSON}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-cyan-300 bg-cyan-950/50 hover:bg-cyan-900/50 border border-cyan-500/40 rounded-xl transition-all shadow-lg active:scale-95"
            >
              <FileCode className="w-4 h-4" />
              <span>Export JSON</span>
            </button>
            <button
              onClick={handleSaveToDatabase}
              disabled={saveStatus === 'saving'}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-all active:scale-95 disabled:opacity-50"
            >
              {saveStatus === 'saved' ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400">Saved</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Save to DB</span>
                </>
              )}
            </button>
            <button
              onClick={handleClearPortfolio}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-rose-400 bg-rose-950/30 hover:bg-rose-900/40 border border-rose-500/30 rounded-xl transition-all active:scale-95"
              title="Clear active portfolio"
            >
              <Trash2 className="w-4 h-4" />
              <span>Reset</span>
            </button>
          </div>
        )}
      </div>

      {/* ── CONDITIONAL VIEW: UPLOAD FORM OR PORTFOLIO DASHBOARD ── */}
      {!portfolioData ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Upload Box */}
          <div className="lg:col-span-2 space-y-4">
            <div
              className={`border-2 border-dashed rounded-2xl p-8 transition-all backdrop-blur-xl ${
                dragActive
                  ? 'border-emerald-500 bg-emerald-500/5'
                  : 'border-slate-800 hover:border-slate-700 bg-slate-900/50'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={handleFileChange}
              />

              <div className="flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Upload className="w-8 h-8" />
                </div>

                <div>
                  <h3 className="text-base font-semibold text-white">
                    {selectedFile ? selectedFile.name : 'Upload your Demat CAS PDF'}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-md">
                    {selectedFile
                      ? `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB • Ready to unlock`
                      : 'Drag and drop your official CDSL or NSDL monthly e-CAS PDF here, or click browse.'}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-all"
                  >
                    {selectedFile ? 'Change File' : 'Browse Computer'}
                  </button>
                  {selectedFile && (
                    <button
                      type="button"
                      onClick={() => setSelectedFile(null)}
                      className="px-3 py-2 text-xs font-medium text-rose-400 bg-rose-950/20 hover:bg-rose-900/30 border border-rose-900/40 rounded-xl"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>

              {/* Password & Settings (Shown when file selected or always ready) */}
              <div className="mt-8 pt-6 border-t border-slate-800/80 max-w-md mx-auto space-y-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-slate-400" />
                      PDF Password (PAN in UPPERCASE)
                    </label>
                    <span className="text-[10px] text-slate-500">e.g. ABCDE1234F</span>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value.toUpperCase())}
                      placeholder="ENTER YOUR PAN (OR DOB DDMMYYYY)"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 uppercase font-mono tracking-wider"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between py-1">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 select-none">
                    <input
                      type="checkbox"
                      checked={enrichPrices}
                      onChange={(e) => setEnrichPrices(e.target.checked)}
                      className="w-4 h-4 rounded bg-slate-950 border-slate-800 text-emerald-500 focus:ring-0 focus:ring-offset-0"
                    />
                    <span>Enrich holdings with live market prices</span>
                  </label>
                  <span className="text-[10px] px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-md border border-emerald-500/20">
                    Yahoo Finance
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleParseSubmit}
                  disabled={loading || !selectedFile}
                  className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition-all shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.99]"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Decrypting & Parsing CAS Statement...</span>
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4" />
                      <span>Unlock & Import Portfolio</span>
                    </>
                  )}
                </button>
              </div>

              {error && (
                <div className="mt-4 p-3 bg-rose-950/40 border border-rose-500/40 rounded-xl text-rose-300 text-xs flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Import Error: </span>
                    {error}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Side Info & Demo Box */}
          <div className="space-y-4">
            {/* Quick Demo Option */}
            <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl backdrop-blur-xl space-y-3">
              <div className="flex items-center gap-2 text-white font-semibold text-sm">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>Instant Demo Preview</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Want to test the portfolio table, live profit/loss calculations, and CSV/JSON export tools right now without uploading your real CAS?
              </p>
              <button
                type="button"
                onClick={handleLoadSample}
                disabled={loading}
                className="w-full py-2.5 px-3 text-xs font-medium text-emerald-300 bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-500/30 rounded-xl transition-all flex items-center justify-center gap-2 active:scale-95"
              >
                <TrendingUp className="w-4 h-4" />
                <span>Load Sample Indian Portfolio</span>
              </button>
            </div>

            {/* How to get CAS Guide */}
            <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl backdrop-blur-xl space-y-3">
              <div className="flex items-center gap-2 text-white font-semibold text-sm">
                <HelpCircle className="w-4 h-4 text-cyan-400" />
                <span>Where to get your CAS PDF?</span>
              </div>
              <ul className="text-xs text-slate-400 space-y-2.5 list-disc pl-4">
                <li>
                  <strong className="text-slate-200">Email:</strong> Search your inbox for <code className="text-emerald-400">"CDSL e-CAS"</code> or <code className="text-emerald-400">"NSDL CAS"</code>. Sent monthly.
                </li>
                <li>
                  <strong className="text-slate-200">Brokers:</strong> In Zerodha Console, Groww, Upstox, or Angel One under Statements &rarr; CAS.
                </li>
                <li>
                  <strong className="text-slate-200">Default Password:</strong> Your 10-character PAN card number in all uppercase letters (e.g. <span className="font-mono text-slate-300">ABCDE1234F</span>).
                </li>
              </ul>
            </div>

            {/* Privacy Guarantee */}
            <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl backdrop-blur-xl space-y-2">
              <div className="flex items-center gap-2 text-slate-200 font-semibold text-xs">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Privacy & Security Guarantee</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Your uploaded file is processed locally and immediately wiped from the server temp disk upon decryption. Your data never leaves your environment.
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* ── ACTIVE PORTFOLIO VIEW ────────────────────────────────────────── */
        <div className="space-y-6">
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Total Value */}
            <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl backdrop-blur-xl space-y-1">
              <div className="text-xs text-slate-400 flex items-center justify-between">
                <span>Total Portfolio Value</span>
                <PieChart className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-xl font-bold text-white tracking-tight">
                ₹{totalVal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                <span>Statement Period:</span>
                <span className="text-slate-400 font-medium">{portfolioData.statement_period?.to || 'Latest'}</span>
              </div>
            </div>

            {/* Equities Holding */}
            <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl backdrop-blur-xl space-y-1">
              <div className="text-xs text-slate-400 flex items-center justify-between">
                <span>Equities Value</span>
                <Building className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-xl font-bold text-white tracking-tight">
                ₹{equitiesVal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-emerald-400 font-medium">
                {portfolioData.holdings?.length || 0} Listed Companies
              </div>
            </div>

            {/* Unrealized Gain */}
            <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl backdrop-blur-xl space-y-1">
              <div className="text-xs text-slate-400 flex items-center justify-between">
                <span>P&L vs Statement</span>
                {unrealizedGain >= 0 ? (
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-rose-400" />
                )}
              </div>
              <div className={`text-xl font-bold tracking-tight ${unrealizedGain >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {unrealizedGain >= 0 ? '+' : ''}₹{unrealizedGain.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </div>
              <div className={`text-[11px] font-medium ${unrealizedGain >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {unrealizedGain >= 0 ? '+' : ''}{unrealizedGainPct.toFixed(2)}% net change
              </div>
            </div>

            {/* Depository / Investor */}
            <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl backdrop-blur-xl space-y-1">
              <div className="text-xs text-slate-400 flex items-center justify-between">
                <span>Depository Source</span>
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-base font-bold text-white tracking-tight truncate">
                {portfolioData.file_type || 'CDSL'} Statement
              </div>
              <div className="text-[11px] text-slate-400 truncate">
                {portfolioData.investor_info?.name || 'Authorized Account'}
              </div>
            </div>
          </div>

          {/* Search, Filter & Tab Navigation */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/40 p-4 rounded-2xl border border-slate-800">
            {/* Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-950/80 rounded-xl border border-slate-800">
              <button
                onClick={() => setActiveTab('equities')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === 'equities'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Equities ({portfolioData.holdings?.length || 0})
              </button>
              {portfolioData.mutual_funds?.length > 0 && (
                <button
                  onClick={() => setActiveTab('mutual_funds')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    activeTab === 'mutual_funds'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Mutual Funds ({portfolioData.mutual_funds.length})
                </button>
              )}
              {portfolioData.bonds?.length > 0 && (
                <button
                  onClick={() => setActiveTab('bonds')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    activeTab === 'bonds'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Bonds / SGBs ({portfolioData.bonds.length})
                </button>
              )}
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search stocks by name or ticker..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3.5 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Holdings Table */}
          {activeTab === 'equities' && (
            <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/70 text-[11px] uppercase tracking-wider text-slate-400 select-none">
                    <th
                      className="py-3 px-4 font-semibold cursor-pointer hover:text-white"
                      onClick={() => handleSort('symbol')}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Security / Ticker</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-600" />
                      </div>
                    </th>
                    <th
                      className="py-3 px-4 font-semibold text-right cursor-pointer hover:text-white"
                      onClick={() => handleSort('quantity')}
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        <span>Quantity</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-600" />
                      </div>
                    </th>
                    <th className="py-3 px-4 font-semibold text-right">
                      Statement Price
                    </th>
                    <th className="py-3 px-4 font-semibold text-right">
                      Live Price
                    </th>
                    <th
                      className="py-3 px-4 font-semibold text-right cursor-pointer hover:text-white"
                      onClick={() => handleSort('value')}
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        <span>Holding Value</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-600" />
                      </div>
                    </th>
                    <th
                      className="py-3 px-4 font-semibold text-right cursor-pointer hover:text-white"
                      onClick={() => handleSort('weight_pct')}
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        <span>Weight %</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-600" />
                      </div>
                    </th>
                    <th className="py-3 px-4 font-semibold text-center">
                      360° Analysis
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {filteredHoldings.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        No securities found matching "{searchQuery}"
                      </td>
                    </tr>
                  ) : (
                    filteredHoldings.map((stock, idx) => {
                      const displayPrice = stock.live_price || stock.price || 0;
                      const displayValue = stock.live_value || stock.value || 0;
                      const gain = stock.gain || 0;
                      const gainPct = stock.gain_pct || 0;

                      return (
                        <tr
                          key={stock.isin || idx}
                          className="hover:bg-slate-800/40 transition-colors group"
                        >
                          {/* Symbol & Name */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-start gap-2.5">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-white text-sm tracking-wide">
                                    {stock.symbol || 'STOCK'}
                                  </span>
                                  {stock.depository && (
                                    <span className="px-1.5 py-0.5 text-[9px] font-semibold bg-slate-800 text-slate-400 rounded">
                                      {stock.depository}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-400 truncate max-w-xs mt-0.5" title={stock.name}>
                                  {stock.name}
                                </div>
                                <div className="text-[10px] text-slate-600 font-mono">
                                  {stock.isin}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Quantity */}
                          <td className="py-3.5 px-4 text-right font-medium text-slate-200">
                            {stock.quantity.toLocaleString('en-IN')}
                          </td>

                          {/* Statement Price */}
                          <td className="py-3.5 px-4 text-right text-slate-400 font-mono">
                            ₹{stock.price ? stock.price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                          </td>

                          {/* Live Price & Change */}
                          <td className="py-3.5 px-4 text-right font-mono">
                            <div className="text-white font-medium">
                              ₹{displayPrice ? displayPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                            </div>
                            {stock.live_price && stock.price && stock.live_price !== stock.price && (
                              <div className={`text-[10px] flex items-center justify-end gap-0.5 ${gain >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {gain >= 0 ? '+' : ''}{gainPct.toFixed(2)}%
                              </div>
                            )}
                          </td>

                          {/* Holding Value */}
                          <td className="py-3.5 px-4 text-right font-mono">
                            <div className="font-bold text-white text-sm">
                              ₹{displayValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                            </div>
                            {gain !== 0 && (
                              <div className={`text-[10px] ${gain >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {gain >= 0 ? '+' : ''}₹{gain.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                              </div>
                            )}
                          </td>

                          {/* Weight % */}
                          <td className="py-3.5 px-4 text-right font-mono">
                            <div className="font-semibold text-slate-200">
                              {(stock.weight_pct || 0).toFixed(2)}%
                            </div>
                            <div className="w-16 h-1.5 bg-slate-800 rounded-full ml-auto mt-1 overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 rounded-full"
                                style={{ width: `${Math.min(stock.weight_pct || 0, 100)}%` }}
                              />
                            </div>
                          </td>

                          {/* 360 Deep Dive Action */}
                          <td className="py-3.5 px-4 text-center">
                            {stock.symbol ? (
                              <button
                                onClick={() => onSelectStock && onSelectStock(stock.symbol)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/30 rounded-lg transition-all active:scale-95"
                                title={`Open 360° Analysis for ${stock.symbol}`}
                              >
                                <span>Analyze</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <span className="text-slate-600 text-xs">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Mutual Funds Table */}
          {activeTab === 'mutual_funds' && (
            <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/70 text-[11px] uppercase tracking-wider text-slate-400">
                    <th className="py-3 px-4 font-semibold">Scheme Name</th>
                    <th className="py-3 px-4 font-semibold">Folio / Demat</th>
                    <th className="py-3 px-4 font-semibold text-right">Units</th>
                    <th className="py-3 px-4 font-semibold text-right">NAV</th>
                    <th className="py-3 px-4 font-semibold text-right">Current Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {portfolioData.mutual_funds.map((mf, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-white">{mf.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{mf.isin}</div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">
                        {mf.folio || mf.account_name || '—'}
                      </td>
                      <td className="py-3.5 px-4 text-right text-slate-200 font-mono">
                        {mf.quantity.toFixed(3)}
                      </td>
                      <td className="py-3.5 px-4 text-right text-slate-300 font-mono">
                        ₹{mf.price.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-white font-mono">
                        ₹{mf.value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Bonds Table */}
          {activeTab === 'bonds' && (
            <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/70 text-[11px] uppercase tracking-wider text-slate-400">
                    <th className="py-3 px-4 font-semibold">Security Name</th>
                    <th className="py-3 px-4 font-semibold text-right">Quantity</th>
                    <th className="py-3 px-4 font-semibold text-right">Price</th>
                    <th className="py-3 px-4 font-semibold text-right">Holding Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {portfolioData.bonds.map((bd, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-white">{bd.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{bd.isin}</div>
                      </td>
                      <td className="py-3.5 px-4 text-right text-slate-200 font-mono">
                        {bd.quantity}
                      </td>
                      <td className="py-3.5 px-4 text-right text-slate-300 font-mono">
                        ₹{bd.price.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-white font-mono">
                        ₹{bd.value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
