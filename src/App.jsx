import React, { useState, useEffect } from 'react';
import {
  Search,
  Star,
  Activity,
  ShieldCheck,
  TrendingUp,
  BarChart3,
  MessageSquareText,
  Sparkles,
  Layers,
  Building2,
  Zap,
  RotateCw,
  Compass,
  ArrowUpRight,
  ArrowDownRight,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { fetchStockData, fetchAIAnalysis } from './utils/api';
import ScoreGauge from './components/ScoreGauge';
import StockChart from './components/StockChart';
import RadarChartComponent from './components/RadarChart';
import QuarterlyAnalysis from './components/QuarterlyAnalysis';
import PeerComparison from './components/PeerComparison';
import Watchlist from './components/Watchlist';
import SearchModal from './components/SearchModal';

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) return <div className="p-10 text-red-500 font-mono text-xs"><h1 className="text-xl">Crash</h1><pre>{this.state.error.toString()}</pre><pre>{this.state.error.stack}</pre></div>;
    return this.props.children;
  }
}

export default function App() {
  const [currentSymbol, setCurrentSymbol] = useState('E2E');
  const [activeTab, setActiveTab] = useState('watchlist'); // 'analysis', 'watchlist', 'peers', 'governance'
  const [watchlist, setWatchlist] = useState(['E2E', 'TMCV', 'TATAMOTORS', 'INFY', 'ZOMATO', 'NETWEB', 'NVDA']);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [currentStock, setCurrentStock] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAILoading, setIsAILoading] = useState(false);

  // Load saved watchlist
  useEffect(() => {
    const saved = localStorage.getItem('stock_ai_watchlist') || localStorage.getItem('equisense_watchlist');
    if (saved) {
      try {
        setWatchlist(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse stored watchlist", e);
      }
    }
  }, []);

  const saveWatchlist = (newList) => {
    setWatchlist(newList);
    localStorage.setItem('stock_ai_watchlist', JSON.stringify(newList));
  };

  const handleAddToWatchlist = (symbol) => {
    if (!watchlist.includes(symbol)) {
      saveWatchlist([...watchlist, symbol]);
    }
  };

  const handleRemoveFromWatchlist = (symbol) => {
    saveWatchlist(watchlist.filter((s) => s !== symbol));
  };

  const toggleWatchlist = (symbol) => {
    if (watchlist.includes(symbol)) {
      handleRemoveFromWatchlist(symbol);
    } else {
      handleAddToWatchlist(symbol);
    }
  };

  const handleSelectStock = (symbol) => {
    setCurrentSymbol(symbol.toUpperCase());
    setActiveTab('analysis');
  };

  useEffect(() => {
    let active = true;
    const loadStock = async () => {
      setIsLoading(true);
      setIsAILoading(true);
      try {
        const data = await fetchStockData(currentSymbol);
        if (active) setCurrentStock(data);
        // We don't fetch AI analysis automatically anymore
        // The user must click the button to trigger it.
        if (active) setIsAILoading(false);

      } catch (err) {
        console.error(err);
      } finally {
        if (active) setIsLoading(false);
      }
    };
    loadStock();
    return () => { active = false; };
  }, [currentSymbol]);

  const handleGenerateAI = async () => {
    setIsAILoading(true);
    try {
      const aiData = await fetchAIAnalysis(currentSymbol, true);
      setCurrentStock(prev => ({
        ...prev,
        hasAIAnalysis: true,
        aiScore: aiData.score,
        aiCategory: aiData.score >= 80 ? 'Exceptional' : aiData.score >= 60 ? 'Strong' : 'Needs Attention',
        score: aiData.score,
        scoreCategory: aiData.score >= 80 ? 'Exceptional' : aiData.score >= 60 ? 'Strong' : 'Needs Attention',
        aiVerdict: aiData.verdict,
        bullPoints: aiData.bullPoints || [],
        bearPoints: aiData.bearPoints || [],
        futurePoints: aiData.futurePoints || [],
        parameterScores: aiData.parameterScores || {},
        governanceNotes: aiData.governanceNotes || '',
        engine: aiData.engine,
        radarScores: aiData.parameterScores ? [
          { category: 'Capital Efficiency', score: aiData.parameterScores.capitalEfficiency ?? 50 },
          { category: 'Growth Momentum', score: aiData.parameterScores.growth ?? 50 },
          { category: 'Solvency & Health', score: aiData.parameterScores.solvency ?? 50 },
          { category: 'Valuation Safety', score: aiData.parameterScores.valuation ?? 50 },
          { category: 'Corp Governance', score: aiData.parameterScores.corporateGovernance ?? 75 },
          { category: 'Future Potential', score: aiData.parameterScores.futurePotential ?? 75 },
        ] : prev.radarScores
      }));
    } catch (err) {
      console.error("AI fetch failed:", err);
      alert("Failed to generate AI analysis. Please try again.");
    } finally {
      setIsAILoading(false);
    }
  };

  const isInWatchlist = currentStock ? watchlist.includes(currentStock.symbol) : false;
  const isPositive = currentStock ? currentStock.change >= 0 : false;

  // Popular stock shortcut buttons
  const popularTickers = ["E2E", "TMCV", "TATAMOTORS", "INFY", "ZOMATO", "SBIN", "AAPL", "NVDA", "NETWEB", "RELIANCE"];

  return (
    <div className="min-h-screen bg-black text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-white">
      {/* Global Navbar */}
      <header className="sticky top-0 z-40 bg-zinc-950/90 backdrop-blur-md border-b border-slate-800/80 px-4 lg:px-8 py-3 flex items-center justify-between">
        {/* Brand Logo */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('watchlist')}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-emerald-500/25">
            <Zap className="w-6 h-6 fill-slate-950" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-black tracking-tight bg-gradient-to-r from-white via-slate-100 to-emerald-300 bg-clip-text text-transparent">
                stock<span className="text-emerald-400">.ai</span>
              </span>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 tracking-wider">
                360° AI
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-medium">Enterprise Equity Intelligence</span>
          </div>
        </div>

        {/* Global Search Trigger Bar */}
        <button
          onClick={() => setIsSearchModalOpen(true)}
          className="flex items-center justify-between w-64 lg:w-96 px-3.5 py-2 text-xs bg-slate-900/90 border border-slate-800 hover:border-emerald-500/50 rounded-xl text-slate-400 transition-all shadow-inner group"
        >
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-emerald-400 group-hover:text-emerald-300" />
            <span className="truncate">Search TMCV, E2E, Infosys, Zomato, Reliance...</span>
          </div>
          <kbd className="hidden sm:inline-block text-[10px] font-mono uppercase bg-slate-800 text-slate-400 px-2 py-0.5 rounded border border-slate-700">
            Ctrl + K
          </kbd>
        </button>

        {/* Right Watchlist Quick Counter */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab('watchlist')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all ${
              activeTab === 'watchlist'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-md shadow-amber-500/10'
                : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
            }`}
          >
            <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
            <span className="hidden sm:inline">Watchlist</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] text-amber-300 font-mono">
              {watchlist.length}
            </span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-6 space-y-6">
        {/* Navigation Tabs Bar */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-2 min-w-max">
            <button
              onClick={() => setActiveTab('analysis')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                activeTab === 'analysis'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <Activity className="w-4 h-4" /> 360° Deep Dive
            </button>

            <button
              onClick={() => setActiveTab('watchlist')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                activeTab === 'watchlist'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <Star className="w-4 h-4" /> Watchlist ({watchlist.length})
            </button>

            <button
              onClick={() => setActiveTab('peers')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                activeTab === 'peers'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <Layers className="w-4 h-4" /> Peer Comparison
            </button>
          </div>

          <div className="hidden md:flex items-center gap-2 text-xs text-slate-400">
            <span>stock.ai URL:</span>
            <code className="bg-slate-900 px-2.5 py-1 rounded border border-slate-800 text-emerald-400 font-mono">
              stock.ai/company/{currentStock?.symbol || currentSymbol}
            </code>
          </div>
        </div>

        {/* Tab Views */}
        {isLoading || !currentStock ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm font-bold text-slate-400 animate-pulse">Fetching live data for {currentSymbol}...</p>
          </div>
        ) : activeTab === 'watchlist' ? (
          <Watchlist
            watchlist={watchlist}
            onRemoveFromWatchlist={handleRemoveFromWatchlist}
            onAddToWatchlist={handleAddToWatchlist}
            onSelectStock={handleSelectStock}
          />
        ) : activeTab === 'peers' ? (
          <PeerComparison peers={currentStock.peers} currentSymbol={currentStock.symbol} />
        ) : (
          <ErrorBoundary>
          {/* Main 360° Deep Dive Analysis View */}
          <div className="space-y-6">
            {/* Stock Banner Header */}
            <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4 relative overflow-hidden">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-black text-slate-100 tracking-tight">
                      {currentStock.name}
                    </h1>
                    <span className="text-xs font-mono font-bold bg-slate-800 text-emerald-400 px-2.5 py-1 rounded-lg border border-slate-700">
                      {currentStock.symbol} : {currentStock.exchange}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Sector: {currentStock.sector}</span>
                  </p>
                </div>

                {/* Stock Price & Watchlist Button */}
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-3xl font-extrabold font-mono text-slate-100">
                      ₹{currentStock.price.toLocaleString()}
                    </div>
                    <div
                      className={`text-xs font-bold font-mono flex items-center justify-end ${
                        isPositive ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {isPositive ? <ArrowUpRight className="w-4 h-4 mr-0.5" /> : <ArrowDownRight className="w-4 h-4 mr-0.5" />}
                      {isPositive ? '+' : ''}{currentStock.change} ({currentStock.changePercent}%)
                    </div>
                  </div>

                  <button
                    onClick={() => toggleWatchlist(currentStock.symbol)}
                    className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all border ${
                      isInWatchlist
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-700'
                    }`}
                  >
                    <Star className={`w-4 h-4 ${isInWatchlist ? 'fill-amber-400 text-amber-400' : ''}`} />
                    {isInWatchlist ? 'Saved in Watchlist' : 'Add to Watchlist'}
                  </button>
                </div>
              </div>

              {/* Ratios Metrics Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 pt-4 border-t border-slate-800/80 text-xs">
                <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block text-[10px] uppercase">Market Cap</span>
                  <span className="font-bold font-mono text-slate-200">{currentStock.marketCap}</span>
                </div>
                <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block text-[10px] uppercase">P/E Ratio</span>
                  <span className="font-bold font-mono text-emerald-400">{currentStock.peRatio}x</span>
                </div>
                <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block text-[10px] uppercase">ROE %</span>
                  <span className="font-bold font-mono text-emerald-400">{currentStock.roe}</span>
                </div>
                <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block text-[10px] uppercase">ROCE %</span>
                  <span className="font-bold font-mono text-slate-200">{currentStock.roce}</span>
                </div>
                <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block text-[10px] uppercase">EV / EBITDA</span>
                  <span className="font-bold font-mono text-slate-200">{currentStock.evEbitda}x</span>
                </div>
                <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block text-[10px] uppercase">Debt / Equity</span>
                  <span className="font-bold font-mono text-slate-200">{currentStock.debtToEquity}</span>
                </div>
              </div>
            </div>
            {/* Main Stock Chart */}
            <StockChart symbol={currentStock.symbol} currentPrice={currentStock.price} />

            {/* Quarterly Analysis Section (Recent Financials) */}
            <QuarterlyAnalysis financials={currentStock.quarterlyFinancials} />

            {/* Top Grid: 360° Gauge (Left) + 6-Axis Spider Radar (Right) */}
            {/* Top Grid: 360° Gauge (Left) + 6-Axis Spider Radar (Right) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ScoreGauge
                stock={currentStock}
                onTriggerAI={handleGenerateAI}
                isAILoading={isAILoading}
              />
              <RadarChartComponent data={currentStock.radarScores} />
            </div>

            {/* AI Verdict & Drivers Card */}
            <div className="glass-panel rounded-2xl p-6 border border-zinc-800 bg-black space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-base font-bold text-slate-100">stock.ai Fin-LLM 360° Verdict</h3>
                  {currentStock.engine && (
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${currentStock.engine.includes('Gemini') ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                      {currentStock.engine}
                    </span>
                  )}
                </div>
                <button
                  onClick={handleGenerateAI}
                  disabled={isAILoading}
                  className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-500 hover:to-blue-500 disabled:opacity-50 text-slate-100 text-xs font-bold rounded-xl flex items-center gap-2 transition-all shadow-md shadow-emerald-500/20"
                >
                  {isAILoading ? (
                    <><div className="w-4 h-4 border-2 border-slate-100 border-t-transparent rounded-full animate-spin"></div> Analyzing...</>
                  ) : currentStock.hasAIAnalysis ? (
                    <><RotateCw className="w-4 h-4" /> Regenerate AI Analysis</>
                  ) : (
                    <><Zap className="w-4 h-4" /> Generate AI Analysis</>
                  )}
                </button>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed bg-zinc-900/60 p-4 rounded-xl border border-zinc-800/80">
                {currentStock.aiVerdict || (
                  <span className="text-slate-400 italic">
                    No AI analysis generated yet for this stock. Click "Generate AI Analysis" above to generate a 360° verdict and fundamental catalysts.
                  </span>
                )}
              </p>
              {currentStock.governanceNotes && (
                <div className="bg-indigo-950/20 p-3.5 rounded-xl border border-indigo-500/20 flex items-start gap-2.5 text-xs text-indigo-200">
                  <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-indigo-300 mr-1.5">Corporate Governance:</span>
                    <span>{currentStock.governanceNotes}</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                {/* Bull Points */}
                <div className="bg-emerald-950/20 p-4 rounded-xl border border-emerald-500/20 space-y-2">
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4" /> Key Bullish Catalysts
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-300">
                    {currentStock.bullPoints && currentStock.bullPoints.length > 0 ? (
                      currentStock.bullPoints.map((pt, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-emerald-400 font-bold">•</span>
                          <span>{pt}</span>
                        </li>
                      ))
                    ) : (
                      <li className="text-slate-500 italic">Click "Generate AI Analysis" to extract key catalysts.</li>
                    )}
                  </ul>
                </div>

                {/* Bear Points */}
                <div className="bg-rose-950/20 p-4 rounded-xl border border-rose-500/20 space-y-2">
                  <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                    <ArrowDownRight className="w-4 h-4" /> Risk Factors & Cautionary Notes
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-300">
                    {currentStock.bearPoints && currentStock.bearPoints.length > 0 ? (
                      currentStock.bearPoints.map((pt, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-rose-400 font-bold">•</span>
                          <span>{pt}</span>
                        </li>
                      ))
                    ) : (
                      <li className="text-slate-500 italic">Click "Generate AI Analysis" to compute risk factors.</li>
                    )}
                  </ul>
                </div>

                {/* Future Potential Points */}
                <div className="bg-cyan-950/20 p-4 rounded-xl border border-cyan-500/20 space-y-2">
                  <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Compass className="w-4 h-4" /> Future Potential & Runway
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-300">
                    {currentStock.futurePoints && currentStock.futurePoints.length > 0 ? (
                      currentStock.futurePoints.map((pt, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-cyan-400 font-bold">•</span>
                          <span>{pt}</span>
                        </li>
                      ))
                    ) : (
                      <li className="text-slate-500 italic">Click "Generate AI Analysis" to extract secular growth runway.</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>



            {/* Peer Comparison Matrix */}
            <PeerComparison peers={currentStock.peers} currentSymbol={currentStock.symbol} />
          </div>
          </ErrorBoundary>
        )}
      </main>

      {/* Global Search Modal */}
      <SearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        onSelectStock={handleSelectStock}
      />

      {/* Global Footer */}
      <footer className="border-t border-slate-800/80 py-6 px-4 text-center text-xs text-slate-500 space-y-2">
        <p className="font-medium text-slate-400">
          stock.ai — 360° AI Equity Research & Financial Intelligence Platform
        </p>
        <p className="text-[11px] max-w-xl mx-auto">
          Disclaimer: Information provided for educational and analytical purposes only. Not SEBI registered investment advice.
        </p>
      </footer>
    </div>
  );
}
