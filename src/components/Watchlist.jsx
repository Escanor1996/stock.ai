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
      <div className="glass-card p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-warning fill-warning" />
            <h2 className="font-serif text-lg font-bold text-foreground tracking-tight">
              My Watchlist
            </h2>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/50 font-mono">
              {watchlist.length} Assets
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Institutional tabular overview of live pricing, deterministic scores, and AI evaluations.
          </p>
        </div>

        {/* Quick Add Form */}
        <form onSubmit={handleAddSubmit} className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 sm:w-80">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Add ticker (e.g. TMCV, E2E, INFY)..."
              value={customTickerInput}
              onChange={(e) => setCustomTickerInput(e.target.value)}
              className="w-full pl-9 pr-3.5 py-1.5 text-xs bg-card border border-border rounded-full text-foreground placeholder-muted-foreground focus:outline-none focus:border-ring font-mono"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-1.5 bg-foreground text-background text-xs font-semibold rounded-full hover:bg-foreground/90 transition-all flex items-center gap-1.5 shadow-xs shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>
        </form>
      </div>

      {/* Sorting Control Pills Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs">
        <div className="inline-flex flex-wrap items-center gap-1 bg-muted/60 p-1 rounded-full border border-border/40">
          <span className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wider px-2">Quick Sort:</span>
          
          <button
            onClick={() => setQuickSort('default')}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all duration-200 ${
              sortField === 'default'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Default
          </button>

          <button
            onClick={() => setQuickSort('staticScore', 'desc')}
            className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 transition-all duration-200 ${
              sortField === 'staticScore' && sortDirection === 'desc'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <BarChart2 className="w-3 h-3" />
            <span>Highest Static Score</span>
          </button>

          <button
            onClick={() => setQuickSort('aiScore', 'desc')}
            className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 transition-all duration-200 ${
              sortField === 'aiScore' && sortDirection === 'desc'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Sparkles className="w-3 h-3 text-info" />
            <span>Highest AI Score</span>
          </button>

          <button
            onClick={() => setQuickSort('price', 'desc')}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all duration-200 ${
              sortField === 'price' && sortDirection === 'desc'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Price: High → Low
          </button>

          <button
            onClick={() => setQuickSort('price', 'asc')}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all duration-200 ${
              sortField === 'price' && sortDirection === 'asc'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Price: Low → High
          </button>

          <button
            onClick={() => setQuickSort('changePercent', 'desc')}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all duration-200 ${
              sortField === 'changePercent'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Top Gainers
          </button>
        </div>

        <span className="text-[11px] text-muted-foreground font-mono hidden sm:inline">
          Tip: Click table headers or rows for deep dive
        </span>
      </div>

      {/* Watchlist Table */}
      {watchlist.length === 0 ? (
        <div className="glass-card p-12 text-center space-y-3">
          <Star className="w-8 h-8 text-muted-foreground mx-auto" />
          <h3 className="font-serif text-base font-semibold text-foreground">Your Watchlist is Empty</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Use the search bar above or the global search modal to add stocks to track.
          </p>
        </div>
      ) : loading ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-3 glass-card">
          <div className="w-8 h-8 border-2 border-foreground border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs text-muted-foreground font-mono">Loading watchlist data & scores...</span>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/40 bg-card/70 backdrop-blur-xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-muted/40 text-muted-foreground font-semibold text-[11px] uppercase tracking-wider border-b border-border/40 select-none">
                <th className="py-3 px-4 font-mono">#</th>
                
                <th className="py-3 px-4 font-mono cursor-pointer hover:text-foreground group">
                  Asset
                </th>

                <th
                  onClick={() => handleSort('price')}
                  className="py-3 px-4 font-mono cursor-pointer hover:text-foreground group text-right"
                >
                  Price {renderSortIndicator('price')}
                </th>

                <th
                  onClick={() => handleSort('changePercent')}
                  className="py-3 px-4 font-mono cursor-pointer hover:text-foreground group text-right"
                >
                  24h Change {renderSortIndicator('changePercent')}
                </th>

                <th
                  onClick={() => handleSort('staticScore')}
                  className="py-3 px-4 font-mono cursor-pointer hover:text-foreground group text-center"
                >
                  Static Score {renderSortIndicator('staticScore')}
                </th>

                <th
                  onClick={() => handleSort('aiScore')}
                  className="py-3 px-4 font-mono cursor-pointer hover:text-foreground group text-center"
                >
                  AI 360° Score {renderSortIndicator('aiScore')}
                </th>

                <th className="py-3 px-4 font-mono text-right">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-border/30">
              {sortedWatchlist.map((symbol, idx) => {
                const stock = stocksData[symbol];
                if (!stock) return null;
                const isPositive = (stock.change ?? 0) >= 0;

                return (
                  <tr
                    key={symbol}
                    onClick={() => onSelectStock(stock.symbol)}
                    className="hover:bg-muted/30 cursor-pointer transition-colors group relative"
                  >
                    {/* Index */}
                    <td className="py-3.5 px-4 font-mono text-muted-foreground text-[11px]">
                      {idx + 1}
                    </td>

                    {/* Stock Info */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-muted border border-border/60 flex items-center justify-center font-mono font-bold text-foreground group-hover:border-border transition-colors">
                          {stock.symbol.slice(0, 2)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-foreground font-mono tracking-tight text-sm">
                              {stock.symbol}
                            </span>
                            <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted border border-border/40 font-mono">
                              {stock.exchange}
                            </span>
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate max-w-[200px] lg:max-w-[260px]">
                            {stock.name}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Price */}
                    <td className="py-3.5 px-4 text-right font-mono text-sm font-semibold text-foreground">
                      ₹{Number(stock.price || 0).toLocaleString()}
                    </td>

                    {/* Day Change */}
                    <td className="py-3.5 px-4 text-right">
                      <span
                        className={`inline-flex items-center text-xs font-semibold font-mono px-2 py-0.5 rounded-full ${
                          isPositive
                            ? 'bg-success/10 text-success border border-success/30'
                            : 'bg-destructive/10 text-destructive border border-destructive/30'
                        }`}
                      >
                        {isPositive ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownRight className="w-3 h-3 mr-0.5" />}
                        {isPositive ? '+' : ''}{stock.changePercent ?? 0}%
                      </span>
                    </td>

                    {/* Static Financial Score */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="inline-flex flex-col items-center">
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-bold font-mono text-success">
                            {stock.staticScore ?? stock.score ?? '—'}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">/100</span>
                        </div>
                        <span className="text-[9px] font-medium text-muted-foreground">
                          {stock.staticCategory || 'Pure'}
                        </span>
                      </div>
                    </td>

                    {/* AI 360° Score */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="inline-flex flex-col items-center">
                        {stock.hasAIAnalysis && stock.aiScore != null ? (
                          <>
                            <div className="flex items-center gap-1">
                              <span className="text-sm font-bold font-mono text-info">
                                {stock.aiScore}
                              </span>
                              <span className="text-[10px] text-muted-foreground font-mono">/100</span>
                            </div>
                            <span className="text-[9px] font-semibold text-info">
                              {stock.aiCategory || 'AI'}
                            </span>
                          </>
                        ) : (
                          <span className="text-[11px] text-muted-foreground italic font-mono">
                            Pending
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Action buttons */}
                    <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => onSelectStock(stock.symbol)}
                          className="px-3 py-1 bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold rounded-full border border-border/60 flex items-center gap-1 transition-all"
                        >
                          <span>Deep Dive</span>
                          <ChevronRight className="w-3 h-3 text-muted-foreground" />
                        </button>

                        <button
                          onClick={() => onRemoveFromWatchlist(symbol)}
                          title="Remove from watchlist"
                          className="p-1.5 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
