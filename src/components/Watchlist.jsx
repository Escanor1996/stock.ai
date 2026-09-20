import React, { useState, useEffect } from 'react';
import {
  Star,
  Search,
  Plus,
  Trash2,
  ArrowUpRight,
  ArrowDownRight,
  BarChart2,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { fetchStockData } from '../utils/api';

export default function Watchlist({ watchlist, onRemoveFromWatchlist, onAddToWatchlist, onSelectStock }) {
  const [customTickerInput, setCustomTickerInput] = useState('');
  const [stocksData, setStocksData] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const loadAll = async () => {
      setLoading(true);
      const dataMap = {};
      try {
        await Promise.all(
          watchlist.map(async (symbol) => {
            try {
              const data = await fetchStockData(symbol);
              dataMap[symbol] = data;
            } catch (e) {
              console.error(`Failed to load ${symbol}:`, e);
            }
          })
        );
        if (active) setStocksData(dataMap);
      } catch (err) {
        console.error("Watchlist load error:", err);
      } finally {
        if (active) setLoading(false);
      }
    };
    loadAll();
    return () => { active = false; };
  }, [watchlist]);

  const handleAddSubmit = (e) => {
    e.preventDefault();
    if (!customTickerInput.trim()) return;
    onAddToWatchlist(customTickerInput.trim().toUpperCase());
    setCustomTickerInput('');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Quick Add Bar */}
      <div className="glass-panel rounded-2xl p-6 border border-zinc-800 bg-black flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 text-emerald-400 fill-emerald-400" />
            <h2 className="text-lg font-bold text-slate-100 uppercase tracking-widest font-mono">
              My Watchlist
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Track real-time price movements, deterministic static fundamentals, and AI 360° research across saved assets.
          </p>
        </div>

        {/* Quick Add Form */}
        <form onSubmit={handleAddSubmit} className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search ticker (e.g. TMCV, E2E, INFY)..."
              value={customTickerInput}
              onChange={(e) => setCustomTickerInput(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-black border border-zinc-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/40 border border-emerald-500/50 text-emerald-400 text-xs font-bold font-mono uppercase rounded-xl flex items-center gap-1.5 transition-all shadow-[0_0_15px_rgba(16,185,129,0.15)]"
          >
            <Plus className="w-4 h-4" /> Add Stock
          </button>
        </form>
      </div>

      {/* Watchlist Grid */}
      {watchlist.length === 0 ? (
        <div className="glass-panel rounded-2xl p-12 text-center border border-zinc-800 bg-black space-y-3">
          <Star className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-300">Your Watchlist is Empty</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Use the search bar above or the global search modal to add stocks to track.
          </p>
        </div>
      ) : loading ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-3">
          <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs text-slate-400 font-mono">Loading watchlist data & scores...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {watchlist.map((symbol) => {
            const stock = stocksData[symbol];
            if (!stock) return null;
            const isPositive = (stock.change ?? 0) >= 0;

            return (
              <div
                key={symbol}
                className="glass-panel glass-panel-hover rounded-2xl p-5 border border-zinc-800 bg-black hover:border-emerald-500/50 flex flex-col justify-between space-y-4 group relative transition-all duration-300 shadow-[0_4px_20px_rgba(0,0,0,0.5)] hover:shadow-[0_0_20px_rgba(16,185,129,0.1)]"
              >
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-black text-slate-100 group-hover:text-emerald-400 transition-colors font-mono tracking-tight">
                        {stock.symbol}
                      </span>
                      <span className="text-[10px] text-zinc-400 px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 font-mono">
                        {stock.exchange}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-400 font-medium truncate max-w-[190px]">
                      {stock.name}
                    </div>
                  </div>

                  <button
                    onClick={() => onRemoveFromWatchlist(symbol)}
                    title="Remove from watchlist"
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Price & Day Change */}
                <div className="flex items-baseline justify-between">
                  <div>
                    <span className="text-2xl font-extrabold text-slate-100 font-mono">
                      ₹{Number(stock.price || 0).toLocaleString()}
                    </span>
                  </div>
                  <div
                    className={`flex items-center text-xs font-bold font-mono px-2.5 py-1 rounded-lg ${
                      isPositive
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}
                  >
                    {isPositive ? <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" /> : <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />}
                    {isPositive ? '+' : ''}{stock.changePercent ?? 0}%
                  </div>
                </div>

                {/* Dual Score Badges Row (Static & AI Side-by-Side) */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-800/80 text-xs">
                  {/* Static Financial Score */}
                  <div className="p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-[10px] text-zinc-400 font-semibold uppercase tracking-wider mb-1">
                      <span className="flex items-center gap-1">
                        <BarChart2 className="w-3 h-3 text-emerald-400" /> Static
                      </span>
                      <span className="text-zinc-500 font-mono text-[9px]">
                        {stock.staticCategory || 'Pure'}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-base font-black text-emerald-400 font-mono">
                        {stock.staticScore ?? stock.score ?? '—'}
                      </span>
                      <span className="text-[9px] text-zinc-500 font-mono">/ 100</span>
                    </div>
                  </div>

                  {/* AI 360° Qualitative Score */}
                  <div className="p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-[10px] text-indigo-300 font-semibold uppercase tracking-wider mb-1">
                      <span className="flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-indigo-400" /> AI 360°
                      </span>
                      <span className="text-zinc-500 font-mono text-[9px]">
                        {stock.hasAIAnalysis ? (stock.aiCategory || 'AI') : 'Pending'}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      {stock.hasAIAnalysis ? (
                        <>
                          <span className="text-base font-black text-indigo-300 font-mono">
                            {stock.aiScore}
                          </span>
                          <span className="text-[9px] text-zinc-500 font-mono">/ 100</span>
                        </>
                      ) : (
                        <span className="text-xs text-zinc-500 font-medium italic">Pending</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* View 360 Analysis Button */}
                <button
                  onClick={() => onSelectStock(stock.symbol)}
                  className="w-full py-2 bg-zinc-900 hover:bg-emerald-500/10 hover:text-emerald-400 text-zinc-300 text-[11px] uppercase tracking-wider font-bold rounded-xl border border-zinc-800 hover:border-emerald-500/40 flex items-center justify-center gap-1.5 transition-all"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> View 360° Deep Dive
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
