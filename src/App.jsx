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
  Building2,
  Zap,
  RotateCw,
  Compass,
  ArrowUpRight,
  ArrowDownRight,
  ExternalLink,
  ChevronRight,
  Briefcase
} from 'lucide-react';
import { fetchStockData, fetchAIScore, fetchAIVerdict } from './utils/api';
import ScoreGauge from './components/ScoreGauge';
import StockChart from './components/StockChart';
import QuarterlyAnalysis from './components/QuarterlyAnalysis';
import Watchlist from './components/Watchlist';
import Portfolio from './components/Portfolio';
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
  const [activeTab, setActiveTab] = useState('portfolio'); // 'analysis', 'watchlist', 'portfolio'
  const [watchlist, setWatchlist] = useState(['E2E', 'TMCV', 'TATAMOTORS', 'INFY', 'ZOMATO', 'NETWEB', 'NVDA']);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [currentStock, setCurrentStock] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isScoreLoading, setIsScoreLoading] = useState(false);
  const [isVerdictLoading, setIsVerdictLoading] = useState(false);

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
      setIsScoreLoading(false);
      setIsVerdictLoading(false);
      try {
        const data = await fetchStockData(currentSymbol);
        if (active) setCurrentStock(data);
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setIsLoading(false);
      }
    };
    loadStock();
    return () => { active = false; };
  }, [currentSymbol]);

  const handleGenerateAIScore = async () => {
    setIsScoreLoading(true);
    try {
      const scoreData = await fetchAIScore(currentSymbol, true);
      setCurrentStock(prev => ({
        ...prev,
        hasAIAnalysis: true,
        aiScore: scoreData.score,
        aiCategory: scoreData.score >= 80 ? 'Exceptional' : scoreData.score >= 60 ? 'Strong' : 'Needs Attention',
        score: scoreData.score,
        scoreCategory: scoreData.score >= 80 ? 'Exceptional' : scoreData.score >= 60 ? 'Strong' : 'Needs Attention',
        parameterScores: scoreData.parameterScores || prev.parameterScores || {},
        scoreEngine: scoreData.engine,
        engine: scoreData.engine || prev.engine,
      }));
    } catch (err) {
      console.error("AI score fetch failed:", err);
      alert("Failed to calculate AI Score. Please try again.");
    } finally {
      setIsScoreLoading(false);
    }
  };

  const handleGenerateAIVerdict = async () => {
    setIsVerdictLoading(true);
    try {
      const verdictData = await fetchAIVerdict(currentSymbol, true);
      setCurrentStock(prev => ({
        ...prev,
        hasAIVerdict: true,
        aiVerdict: verdictData.verdict,
        bullPoints: verdictData.bullPoints || [],
        bearPoints: verdictData.bearPoints || [],
        futurePoints: verdictData.futurePoints || [],
        governanceNotes: verdictData.governanceNotes || '',
        verdictEngine: verdictData.engine,
        engine: verdictData.engine || prev.engine,
      }));
    } catch (err) {
      console.error("AI verdict fetch failed:", err);
      alert("Failed to generate AI Verdict. Please try again.");
    } finally {
      setIsVerdictLoading(false);
    }
  };

  const isInWatchlist = currentStock ? watchlist.includes(currentStock.symbol) : false;
  const isPositive = currentStock ? currentStock.change >= 0 : false;

  // Popular stock shortcut buttons
  const popularTickers = ["E2E", "TMCV", "TATAMOTORS", "INFY", "ZOMATO", "SBIN", "AAPL", "NVDA", "NETWEB", "RELIANCE"];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-success selection:text-background relative" style={{ backgroundColor: '#fffcf0', color: '#100f0f' }}>
      {/* Ambient warm radial glow at top matching Wealthfolio */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_40%_at_50%_-15%,hsl(var(--card)/0.8),transparent)]" />

      {/* Global Navbar */}
      <header className="sticky top-0 z-40 bg-background/85 backdrop-blur-xl border-b border-border/40 px-4 lg:px-8 py-2.5 flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <div className="flex items-center gap-3 cursor-pointer shrink-0" onClick={() => setActiveTab('portfolio')}>
          <div className="w-9 h-9 rounded-xl bg-card border border-border/60 flex items-center justify-center text-foreground font-black shadow-xs">
            <Zap className="w-4 h-4 text-foreground" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-serif font-bold tracking-tight text-foreground">
                stock<span className="text-muted-foreground font-normal">.ai</span>
              </span>
              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/50 tracking-wider">
                v1.1
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground font-medium">Enterprise Equity Intelligence</span>
          </div>
        </div>

        {/* Global Search Center Bar */}
        <div className="flex-1 max-w-2xl mx-2 md:mx-6">
          <button
            onClick={() => setIsSearchModalOpen(true)}
            className="w-full flex items-center justify-between px-3.5 py-1.5 text-xs bg-card hover:bg-card/80 border border-border/60 hover:border-border rounded-full text-foreground transition-all shadow-xs group cursor-pointer"
          >
            <div className="flex items-center gap-2.5 truncate">
              <Search className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground shrink-0" />
              <span className="text-muted-foreground font-medium truncate">Search stocks or tickers (e.g. TMCV, E2E, INFY, Reliance, Zomato)...</span>
            </div>
            <kbd className="hidden sm:inline-block text-[10px] font-mono font-bold uppercase bg-muted text-muted-foreground px-2 py-0.5 rounded-full border border-border/60 shrink-0 ml-2">
              Ctrl + K
            </kbd>
          </button>
        </div>

        {/* Right Navigation Quick Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setActiveTab('portfolio')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 border transition-all ${
              activeTab === 'portfolio'
                ? 'bg-card text-foreground border-border/80 shadow-xs'
                : 'bg-muted/60 text-muted-foreground border-border/40 hover:text-foreground hover:bg-muted'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Portfolio</span>
          </button>
          <button
            onClick={() => setActiveTab('watchlist')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 border transition-all ${
              activeTab === 'watchlist'
                ? 'bg-card text-foreground border-border/80 shadow-xs'
                : 'bg-muted/60 text-muted-foreground border-border/40 hover:text-foreground hover:bg-muted'
            }`}
          >
            <Star className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Watchlist</span>
            <span className="px-1.5 py-0.2 rounded-full bg-card text-[10px] font-mono font-semibold">
              {watchlist.length}
            </span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-6 space-y-6 relative z-10">
        {/* Navigation Tabs Bar & Trending Tickers */}
        <div className="flex items-center justify-between border-b border-border/40 pb-3 gap-4 overflow-x-auto no-scrollbar">
          <div className="inline-flex items-center gap-1 bg-muted/60 p-1 rounded-full border border-border/40 shrink-0">
            <button
              onClick={() => setActiveTab('portfolio')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 ${
                activeTab === 'portfolio'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span>Portfolio</span>
            </button>

            <button
              onClick={() => setActiveTab('watchlist')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 ${
                activeTab === 'watchlist'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Star className="w-3.5 h-3.5" />
              <span>Watchlist ({watchlist.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('analysis')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 ${
                activeTab === 'analysis'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>360° Deep Dive</span>
            </button>
          </div>

          {/* Quick Trending Tickers Bar */}
          <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground min-w-max">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Trending:</span>
            <div className="flex items-center gap-1.5">
              {popularTickers.slice(0, 6).map((sym) => (
                <button
                  key={sym}
                  onClick={() => handleSelectStock(sym)}
                  className={`px-2.5 py-1 rounded-full font-mono text-[11px] font-semibold border transition-all ${
                    currentSymbol === sym && activeTab === 'analysis'
                      ? 'bg-foreground text-background border-foreground'
                      : 'bg-card/70 hover:bg-card text-muted-foreground border-border/40 hover:text-foreground'
                  }`}
                >
                  {sym}
                </button>
              ))}
            </div>
          </div>
        </div>
        {/* Tab Views */}
        {activeTab === 'portfolio' ? (
          <Portfolio
            onSelectStock={handleSelectStock}
          />
        ) : activeTab === 'watchlist' ? (
          <Watchlist
            watchlist={watchlist}
            onRemoveFromWatchlist={handleRemoveFromWatchlist}
            onAddToWatchlist={handleAddToWatchlist}
            onSelectStock={handleSelectStock}
          />
        ) : isLoading || !currentStock ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="w-10 h-10 border-4 border-foreground border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm font-bold text-muted-foreground animate-pulse">Fetching live data for {currentSymbol}...</p>
          </div>
        ) : (
          <ErrorBoundary>
          {/* Main 360° Deep Dive Analysis View */}
          <div className="space-y-6">
            {/* Stock Banner Header */}
            <div className="glass-card p-6 space-y-4 relative overflow-hidden">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="font-serif text-2xl font-bold text-foreground tracking-tight">
                      {currentStock.name}
                    </h1>
                    <span className="text-xs font-mono font-semibold bg-muted text-foreground px-2.5 py-1 rounded-full border border-border/60">
                      {currentStock.symbol} : {currentStock.exchange}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>Sector: {currentStock.sector}</span>
                  </p>
                </div>

                {/* Stock Price & Watchlist Button */}
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-3xl font-bold font-mono text-foreground">
                      ₹{currentStock.price.toLocaleString()}
                    </div>
                    <div
                      className={`text-xs font-semibold font-mono flex items-center justify-end ${
                        isPositive ? 'text-success' : 'text-destructive'
                      }`}
                    >
                      {isPositive ? <ArrowUpRight className="w-4 h-4 mr-0.5" /> : <ArrowDownRight className="w-4 h-4 mr-0.5" />}
                      {isPositive ? '+' : ''}{currentStock.change} ({currentStock.changePercent}%)
                    </div>
                  </div>

                  <button
                    onClick={() => toggleWatchlist(currentStock.symbol)}
                    className={`px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-2 transition-all border ${
                      isInWatchlist
                        ? 'bg-warning/10 text-warning border-warning/30'
                        : 'bg-muted hover:bg-muted/80 text-foreground border-border/60'
                    }`}
                  >
                    <Star className={`w-3.5 h-3.5 ${isInWatchlist ? 'fill-warning text-warning' : ''}`} />
                    <span>{isInWatchlist ? 'Saved in Watchlist' : 'Add to Watchlist'}</span>
                  </button>
                </div>
              </div>

              {/* Ratios Metrics Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 pt-4 border-t border-border/40 text-xs">
                <div className="glass-card p-3 space-y-0.5">
                  <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Market Cap</span>
                  <span className="font-bold font-mono text-foreground">{currentStock.marketCap}</span>
                </div>
                <div className="glass-card p-3 space-y-0.5">
                  <span className="text-muted-foreground block text-[10px] uppercase font-semibold">P/E Ratio</span>
                  <span className="font-bold font-mono text-success">{currentStock.peRatio}x</span>
                </div>
                <div className="glass-card p-3 space-y-0.5">
                  <span className="text-muted-foreground block text-[10px] uppercase font-semibold">ROE %</span>
                  <span className="font-bold font-mono text-success">{currentStock.roe}</span>
                </div>
                <div className="glass-card p-3 space-y-0.5">
                  <span className="text-muted-foreground block text-[10px] uppercase font-semibold">ROCE %</span>
                  <span className="font-bold font-mono text-foreground">{currentStock.roce}</span>
                </div>
                <div className="glass-card p-3 space-y-0.5">
                  <span className="text-muted-foreground block text-[10px] uppercase font-semibold">EV / EBITDA</span>
                  <span className="font-bold font-mono text-foreground">{currentStock.evEbitda}x</span>
                </div>
                <div className="glass-card p-3 space-y-0.5">
                  <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Debt / Equity</span>
                  <span className="font-bold font-mono text-foreground">{currentStock.debtToEquity}</span>
                </div>
              </div>
            </div>
            {/* Main Stock Chart */}
            <StockChart symbol={currentStock.symbol} currentPrice={currentStock.price} />

            {/* Quarterly Analysis Section (Recent Financials) */}
            <QuarterlyAnalysis financials={currentStock.quarterlyFinancials} />

            {/* 360° Score Matrix Dual Engine Card */}
            <ScoreGauge
              stock={currentStock}
              onTriggerScore={handleGenerateAIScore}
              isScoreLoading={isScoreLoading}
            />

            {/* AI Verdict & Drivers Card */}
            <div className="glass-card p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-info" />
                  <h3 className="font-serif text-base font-bold text-foreground">stock.ai Fin-LLM 360° Verdict</h3>
                  {currentStock.engine && (
                    <span className="text-[10px] uppercase font-mono font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/50">
                      {currentStock.engine}
                    </span>
                  )}
                </div>
                <button
                  onClick={handleGenerateAIVerdict}
                  disabled={isVerdictLoading}
                  className="px-4 py-2 bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50 text-xs font-semibold rounded-full flex items-center gap-2 transition-all shadow-xs"
                >
                  {isVerdictLoading ? (
                    <><div className="w-3.5 h-3.5 border-2 border-background border-t-transparent rounded-full animate-spin"></div> Synthesizing Verdict...</>
                  ) : currentStock.aiVerdict ? (
                    <><RotateCw className="w-3.5 h-3.5" /> Regenerate Verdict</>
                  ) : (
                    <><Zap className="w-3.5 h-3.5" /> Generate AI Verdict</>
                  )}
                </button>
              </div>
              <p className="text-xs sm:text-sm text-foreground leading-relaxed bg-card/60 p-4 rounded-xl border border-border/40">
                {currentStock.aiVerdict || (
                  <span className="text-muted-foreground italic">
                    No AI verdict generated yet for this stock. Click "Generate AI Verdict" above to synthesize a qualitative thesis, governance notes & catalysts.
                  </span>
                )}
              </p>
              {currentStock.governanceNotes && (
                <div className="bg-info/5 p-3.5 rounded-xl border border-info/20 flex items-start gap-2.5 text-xs text-foreground">
                  <ShieldCheck className="w-4 h-4 text-info shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-info mr-1.5">Corporate Governance:</span>
                    <span>{currentStock.governanceNotes}</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                {/* Bull Points */}
                <div className="bg-success/5 p-4 rounded-xl border border-success/20 space-y-2">
                  <h4 className="text-xs font-bold text-success uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4" /> Key Bullish Catalysts
                  </h4>
                  <ul className="space-y-1.5 text-xs text-foreground">
                    {currentStock.bullPoints && currentStock.bullPoints.length > 0 ? (
                      currentStock.bullPoints.map((pt, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-success font-bold">•</span>
                          <span>{pt}</span>
                        </li>
                      ))
                    ) : (
                      <li className="text-muted-foreground italic">Click "Generate AI Analysis" to extract key catalysts.</li>
                    )}
                  </ul>
                </div>

                {/* Bear Points */}
                <div className="bg-destructive/5 p-4 rounded-xl border border-destructive/20 space-y-2">
                  <h4 className="text-xs font-bold text-destructive uppercase tracking-wider flex items-center gap-1.5">
                    <ArrowDownRight className="w-4 h-4" /> Risk Factors & Cautionary Notes
                  </h4>
                  <ul className="space-y-1.5 text-xs text-foreground">
                    {currentStock.bearPoints && currentStock.bearPoints.length > 0 ? (
                      currentStock.bearPoints.map((pt, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-destructive font-bold">•</span>
                          <span>{pt}</span>
                        </li>
                      ))
                    ) : (
                      <li className="text-muted-foreground italic">Click "Generate AI Analysis" to compute risk factors.</li>
                    )}
                  </ul>
                </div>

                {/* Future Potential Points */}
                <div className="bg-chart-4/5 p-4 rounded-xl border border-chart-4/20 space-y-2">
                  <h4 className="text-xs font-bold text-chart-4 uppercase tracking-wider flex items-center gap-1.5">
                    <Compass className="w-4 h-4" /> Future Potential & Runway
                  </h4>
                  <ul className="space-y-1.5 text-xs text-foreground">
                    {currentStock.futurePoints && currentStock.futurePoints.length > 0 ? (
                      currentStock.futurePoints.map((pt, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-chart-4 font-bold">•</span>
                          <span>{pt}</span>
                        </li>
                      ))
                    ) : (
                      <li className="text-muted-foreground italic">Click "Generate AI Analysis" to extract secular growth runway.</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>



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
      <footer className="border-t border-border/40 py-6 px-4 text-center text-xs text-muted-foreground space-y-2 bg-card/20 relative z-10">
        <p className="font-medium text-foreground">
          stock.ai — 360° AI Equity Research & Financial Intelligence Platform
        </p>
        <p className="text-[11px] max-w-xl mx-auto">
          Disclaimer: Information provided for educational and analytical purposes only. Not SEBI registered investment advice.
        </p>
      </footer>
    </div>
  );
}
