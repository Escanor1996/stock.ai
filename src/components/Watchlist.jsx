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
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronRight
} from 'lucide-react';
import { fetchStockData } from '../utils/api';

export default function Watchlist({ watchlist, onRemoveFromWatchlist, onAddToWatchlist, onSelectStock }) {
  const [customTickerInput, setCustomTickerInput] = useState('');
  const [stocksData, setStocksData] = useState({});
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState('default'); // 'default' | 'staticScore' | 'aiScore' | 'price' | 'changePercent'
  const [sortDirection, setSortDirection] = useState('desc'); // 'asc' | 'desc'

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

  const handleSort = (field) => {
    if (sortField === field) {
      if (sortDirection === 'desc') setSortDirection('asc');
      else {
        setSortField('default');
        setSortDirection('desc');
      }
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const setQuickSort = (field, dir = 'desc') => {
    setSortField(field);
    setSortDirection(dir);
  };

  // Sort watchlist entries
  const sortedWatchlist = [...watchlist].sort((a, b) => {
    if (sortField === 'default') return 0;
    const stockA = stocksData[a] || {};
    const stockB = stocksData[b] || {};

    let valA = 0;
    let valB = 0;

    if (sortField === 'staticScore') {
      valA = stockA.staticScore ?? stockA.score ?? 0;
      valB = stockB.staticScore ?? stockB.score ?? 0;
    } else if (sortField === 'aiScore') {
      valA = stockA.aiScore ?? -1;
      valB = stockB.aiScore ?? -1;
    } else if (sortField === 'price') {
      valA = Number(stockA.price || 0);
      valB = Number(stockB.price || 0);
    } else if (sortField === 'changePercent') {
      valA = Number(stockA.changePercent || 0);
      valB = Number(stockB.changePercent || 0);
    }

    if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const renderSortIndicator = (field) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-zinc-600 group-hover:text-zinc-400 ml-1 inline" />;
    }
    return sortDirection === 'desc' ? (
      <ArrowDown className="w-3 h-3 text-emerald-400 ml-1 inline" />
    ) : (
      <ArrowUp className="w-3 h-3 text-emerald-400 ml-1 inline" />
    );
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
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono font-bold">
              {watchlist.length} Assets
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Institutional tabular overview of live pricing, deterministic scores, and AI evaluations.
          </p>
        </div>

        {/* Quick Add Form — properly aligned and proportioned */}
        <form onSubmit={handleAddSubmit} className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 sm:w-80">
            <Search className="w-4 h-4 text-emerald-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Add ticker to watchlist (e.g. TMCV, E2E, INFY)..."
              value={customTickerInput}
              onChange={(e) => setCustomTickerInput(e.target.value)}
              className="w-full pl-10 pr-3.5 py-2 text-xs bg-zinc-900/90 border border-zinc-800 rounded-xl text-slate-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500 font-mono shadow-inner"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold font-mono uppercase rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-emerald-500/20 shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Add
          </button>
        </form>
      </div>

      {/* Sorting Control Pills Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-zinc-500 text-[11px] font-semibold uppercase tracking-wider">Quick Sort:</span>
          
          <button
            onClick={() => setQuickSort('default')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              sortField === 'default'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm shadow-emerald-500/20'
                : 'bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 border border-zinc-800'
            }`}
          >
            Default
          </button>

          <button
            onClick={() => setQuickSort('staticScore', 'desc')}
            className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-all ${
              sortField === 'staticScore' && sortDirection === 'desc'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm shadow-emerald-500/20'
                : 'bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 border border-zinc-800'
            }`}
          >
            <BarChart2 className="w-3 h-3" /> Highest Static Score
          </button>

          <button
            onClick={() => setQuickSort('aiScore', 'desc')}
            className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-all ${
              sortField === 'aiScore' && sortDirection === 'desc'
                ? 'bg-indigo-500 text-white font-bold shadow-sm shadow-indigo-500/20'
                : 'bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 border border-zinc-800'
            }`}
          >
            <Sparkles className="w-3 h-3 text-indigo-400" /> Highest AI Score
          </button>

          <button
            onClick={() => setQuickSort('price', 'desc')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              sortField === 'price' && sortDirection === 'desc'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm shadow-emerald-500/20'
                : 'bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 border border-zinc-800'
            }`}
          >
            Price: High $\rightarrow$ Low
          </button>

          <button
            onClick={() => setQuickSort('price', 'asc')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              sortField === 'price' && sortDirection === 'asc'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm shadow-emerald-500/20'
                : 'bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 border border-zinc-800'
            }`}
          >
            Price: Low $\rightarrow$ High
          </button>

          <button
            onClick={() => setQuickSort('changePercent', 'desc')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              sortField === 'changePercent'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm shadow-emerald-500/20'
                : 'bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 border border-zinc-800'
            }`}
          >
            Top Gainers
          </button>
        </div>

        <span className="text-[11px] text-zinc-500 font-mono hidden sm:inline">
          Tip: Click table headers or rows for deep dive
        </span>
      </div>

      {/* Watchlist Table */}
      {watchlist.length === 0 ? (
        <div className="glass-panel rounded-2xl p-12 text-center border border-zinc-800 bg-black space-y-3">
          <Star className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-300">Your Watchlist is Empty</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Use the search bar above or the global search modal to add stocks to track.
          </p>
        </div>
      ) : loading ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-3 glass-panel rounded-2xl border border-zinc-800">
          <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs text-slate-400 font-mono">Loading watchlist data & scores...</span>
        </div>
      ) : (
        <div className="glass-panel rounded-2xl border border-zinc-800 bg-black overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-zinc-950/80 text-zinc-400 font-semibold text-[11px] tracking-wider border-b border-zinc-800 select-none">
                  <th className="py-3.5 px-4 font-mono uppercase">#</th>
                  
                  <th className="py-3.5 px-4 font-mono uppercase cursor-pointer hover:text-slate-200 group">
                    Asset
                  </th>

                  <th
                    onClick={() => handleSort('price')}
                    className="py-3.5 px-4 font-mono uppercase cursor-pointer hover:text-slate-200 group text-right"
                  >
                    Price {renderSortIndicator('price')}
                  </th>

                  <th
                    onClick={() => handleSort('changePercent')}
                    className="py-3.5 px-4 font-mono uppercase cursor-pointer hover:text-slate-200 group text-right"
                  >
                    24h Change {renderSortIndicator('changePercent')}
                  </th>

                  <th
                    onClick={() => handleSort('staticScore')}
                    className="py-3.5 px-4 font-mono uppercase cursor-pointer hover:text-slate-200 group text-center"
                  >
                    Static Score {renderSortIndicator('staticScore')}
                  </th>

                  <th
                    onClick={() => handleSort('aiScore')}
                    className="py-3.5 px-4 font-mono uppercase cursor-pointer hover:text-slate-200 group text-center"
                  >
                    AI 360° Score {renderSortIndicator('aiScore')}
                  </th>

                  <th className="py-3.5 px-4 font-mono uppercase text-right">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-zinc-900/80 font-sans">
                {sortedWatchlist.map((symbol, idx) => {
                  const stock = stocksData[symbol];
                  if (!stock) return null;
                  const isPositive = (stock.change ?? 0) >= 0;

                  return (
                    <tr
                      key={symbol}
                      onClick={() => onSelectStock(stock.symbol)}
                      className="hover:bg-zinc-900/60 cursor-pointer transition-colors group relative"
                    >
                      {/* Index */}
                      <td className="py-4 px-4 font-mono text-zinc-600 text-[11px]">
                        {idx + 1}
                      </td>

                      {/* Stock Info */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center font-mono font-bold text-slate-200 group-hover:border-emerald-500/40 group-hover:text-emerald-400 transition-colors">
                            {stock.symbol.slice(0, 2)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-black text-slate-100 font-mono tracking-tight text-sm group-hover:text-emerald-400 transition-colors">
                                {stock.symbol}
                              </span>
                              <span className="text-[10px] text-zinc-500 px-1.5 py-0.2 rounded bg-zinc-900 border border-zinc-800 font-mono">
                                {stock.exchange}
                              </span>
                            </div>
                            <div className="text-[11px] text-zinc-400 truncate max-w-[200px] lg:max-w-[260px]">
                              {stock.name}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Price */}
                      <td className="py-4 px-4 text-right font-mono text-sm font-bold text-slate-100">
                        ₹{Number(stock.price || 0).toLocaleString()}
                      </td>

                      {/* Day Change */}
                      <td className="py-4 px-4 text-right">
                        <span
                          className={`inline-flex items-center text-xs font-bold font-mono px-2.5 py-1 rounded-md ${
                            isPositive
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {isPositive ? <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" /> : <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />}
                          {isPositive ? '+' : ''}{stock.changePercent ?? 0}%
                        </span>
                      </td>

                      {/* Static Financial Score */}
                      <td className="py-4 px-4 text-center">
                        <div className="inline-flex flex-col items-center">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-black font-mono text-emerald-400">
                              {stock.staticScore ?? stock.score ?? '—'}
                            </span>
                            <span className="text-[10px] text-zinc-500 font-mono">/100</span>
                          </div>
                          <span className="text-[9px] font-medium text-zinc-400">
                            {stock.staticCategory || 'Pure'}
                          </span>
                        </div>
                      </td>

                      {/* AI 360° Score */}
                      <td className="py-4 px-4 text-center">
                        <div className="inline-flex flex-col items-center">
                          {stock.hasAIAnalysis && stock.aiScore != null ? (
                            <>
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-black font-mono text-indigo-300">
                                  {stock.aiScore}
                                </span>
                                <span className="text-[10px] text-zinc-500 font-mono">/100</span>
                              </div>
                              <span className="text-[9px] font-bold text-indigo-400">
                                {stock.aiCategory || 'AI'}
                              </span>
                            </>
                          ) : (
                            <span className="text-[11px] text-zinc-500 italic font-mono">
                              Pending
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Action buttons */}
                      <td className="py-4 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => onSelectStock(stock.symbol)}
                            className="px-2.5 py-1.5 bg-zinc-900 hover:bg-emerald-500/10 hover:text-emerald-400 text-zinc-300 text-[11px] font-semibold rounded-lg border border-zinc-800 hover:border-emerald-500/40 flex items-center gap-1 transition-all"
                          >
                            <span>Deep Dive</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => onRemoveFromWatchlist(symbol)}
                            title="Remove from watchlist"
                            className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
