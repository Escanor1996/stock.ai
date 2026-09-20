import React, { useState, useEffect, useRef } from 'react';
import { Search, X, ArrowUpRight, ArrowDownRight, Sparkles, Loader2, TrendingUp } from 'lucide-react';
import { searchStocks } from '../utils/api';

const POPULAR_SEARCH_TICKERS = [
  { symbol: "TMCV", name: "Tata Motors Commercial", sector: "Auto & Mobility" },
  { symbol: "E2E", name: "E2E Networks", sector: "Cloud & AI Infrastructure" },
  { symbol: "INFY", name: "Infosys Limited", sector: "Information Technology" },
  { symbol: "ZOMATO", name: "Zomato Limited", sector: "Consumer Internet" },
  { symbol: "TATAMOTORS", name: "Tata Motors Ltd", sector: "Automotive" },
  { symbol: "RELIANCE", name: "Reliance Industries", sector: "Conglomerate & Energy" },
  { symbol: "NVDA", name: "NVIDIA Corporation", sector: "Semiconductors & AI" },
  { symbol: "SBIN", name: "State Bank of India", sector: "Banking & Finance" },
  { symbol: "NETWEB", name: "Netweb Technologies", sector: "Supercomputing & Servers" },
  { symbol: "WOCKPHARMA", name: "Wockhardt Limited", sector: "Pharma & Healthcare" },
];

export default function SearchModal({ isOpen, onClose, onSelectStock }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedIndex(-1);
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults([]);
      setSelectedIndex(-1);
    }
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      } else if (e.key === 'Escape' && isOpen) {
        onClose();
      } else if (isOpen && results.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (selectedIndex >= 0 && selectedIndex < results.length) {
            handleSelect(results[selectedIndex].symbol || results[selectedIndex].ticker);
          } else if (query.trim()) {
            handleSelect(query.trim());
          }
        }
      } else if (isOpen && e.key === 'Enter' && query.trim()) {
        e.preventDefault();
        handleSelect(query.trim());
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, results, selectedIndex, query]);

  // Debounced search
  useEffect(() => {
    if (!query || query.length < 1) {
      setResults([]);
      setSelectedIndex(-1);
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await searchStocks(query);
        setResults(res || []);
        setSelectedIndex(0);
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(debounceRef.current);
  }, [query]);

  if (!isOpen) return null;

  const handleSelect = (symbol) => {
    if (!symbol) return;
    const ticker = symbol.replace(/\.(NS|BO)$/, '').toUpperCase();
    onSelectStock(ticker);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-start justify-center pt-12 sm:pt-20 px-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl overflow-hidden flex flex-col max-h-[82vh] transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Header Bar — perfectly centered and proportioned */}
        <div className="px-4 py-3.5 border-b border-zinc-800/90 flex items-center gap-3 bg-zinc-900/90">
          {isSearching ? (
            <Loader2 className="w-5 h-5 text-emerald-400 shrink-0 animate-spin" />
          ) : (
            <Search className="w-5 h-5 text-emerald-400 shrink-0" />
          )}

          <input
            ref={inputRef}
            type="text"
            placeholder="Search stock by company name or ticker (e.g. Tata Motors, INFY, NVDA, Zomato)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full text-sm font-medium bg-transparent border-none text-slate-100 placeholder-zinc-500 focus:outline-none focus:ring-0 p-0 leading-normal font-sans"
          />

          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 text-zinc-400 hover:text-zinc-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          <kbd className="hidden sm:inline-block text-[10px] uppercase bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded border border-zinc-700 font-mono font-bold shrink-0">
            ESC
          </kbd>
        </div>

        {/* Results & Quick Select Section */}
        <div className="overflow-y-auto p-3 space-y-1 divide-y divide-zinc-900">
          {results.length > 0 ? (
            results.map((stock, idx) => {
              const isSelected = selectedIndex === idx;
              const cleanSym = (stock.ticker || stock.symbol || '').replace(/\.(NS|BO)$/, '');

              return (
                <div
                  key={stock.symbol || stock.ticker || idx}
                  onClick={() => handleSelect(cleanSym)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`p-3 rounded-xl cursor-pointer transition-all flex items-center justify-between group ${
                    isSelected
                      ? 'bg-zinc-900 border border-emerald-500/40 shadow-sm'
                      : 'hover:bg-zinc-900/80 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-mono font-black text-xs border transition-colors ${
                        isSelected
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-zinc-900 text-slate-300 border-zinc-800 group-hover:border-zinc-700'
                      }`}
                    >
                      {cleanSym.slice(0, 3)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-100 group-hover:text-emerald-300 transition-colors">
                          {cleanSym}
                        </span>
                        {stock.exchange && (
                          <span className="text-[10px] text-zinc-400 bg-zinc-900 px-1.5 py-0.2 rounded font-mono border border-zinc-800">
                            {stock.exchange}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-zinc-400 truncate max-w-sm">
                        {stock.name}
                      </div>
                      {stock.sector && (
                        <div className="text-[10px] text-zinc-500">
                          {stock.sector}
                          {stock.industry ? ` · ${stock.industry}` : ''}
                        </div>
                      )}
                    </div>
                  </div>

                  {stock.price != null && (
                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold font-mono text-slate-100">
                        ₹{Number(stock.price).toLocaleString()}
                      </div>
                      {stock.changePercent != null && (
                        <div
                          className={`text-[11px] font-mono flex items-center justify-end font-semibold ${
                            stock.changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {stock.changePercent >= 0 ? (
                            <ArrowUpRight className="w-3 h-3" />
                          ) : (
                            <ArrowDownRight className="w-3 h-3" />
                          )}
                          {stock.changePercent >= 0 ? '+' : ''}
                          {stock.changePercent.toFixed(2)}%
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          ) : query && !isSearching ? (
            <div
              onClick={() => handleSelect(query)}
              className="p-4 rounded-xl hover:bg-zinc-900/80 cursor-pointer transition-all flex items-center justify-between text-emerald-400 font-medium text-xs border border-dashed border-emerald-500/30"
            >
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-4 h-4" />
                <span>
                  Query live exchange ticker: <strong>"{query.toUpperCase()}"</strong>
                </span>
              </div>
              <span className="text-[10px] font-bold bg-emerald-500/20 px-2.5 py-1 rounded-md text-emerald-300">
                Analyze →
              </span>
            </div>
          ) : !query ? (
            /* Space Utilization: Instant trending stock recommendations */
            <div className="p-3 space-y-3">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-400 uppercase tracking-wider px-1">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                <span>Quick Access & Trending Indian Stocks</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {POPULAR_SEARCH_TICKERS.map((item) => (
                  <div
                    key={item.symbol}
                    onClick={() => handleSelect(item.symbol)}
                    className="p-2.5 rounded-xl bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800/80 hover:border-emerald-500/40 cursor-pointer transition-all flex items-center justify-between group"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-200 text-xs group-hover:text-emerald-400 transition-colors">
                          {item.symbol}
                        </span>
                        <span className="text-[10px] text-zinc-500 truncate max-w-[140px]">
                          {item.name}
                        </span>
                      </div>
                      <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                        {item.sector}
                      </div>
                    </div>
                    <ArrowUpRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-emerald-400 transition-colors shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer info bar */}
        <div className="px-4 py-2.5 bg-zinc-900/90 border-t border-zinc-800 text-[11px] text-zinc-400 flex items-center justify-between">
          <span>Search verified across NSE, BSE and global tickers</span>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline">
              Navigate with <kbd className="bg-zinc-800 text-zinc-300 px-1 py-0.5 rounded border border-zinc-700">↑</kbd> <kbd className="bg-zinc-800 text-zinc-300 px-1 py-0.5 rounded border border-zinc-700">↓</kbd> <kbd className="bg-zinc-800 text-zinc-300 px-1 py-0.5 rounded border border-zinc-700">↵</kbd>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
