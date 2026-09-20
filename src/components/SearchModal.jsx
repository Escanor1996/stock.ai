import React, { useState, useEffect, useRef } from 'react';
import { Search, X, ArrowUpRight, ArrowDownRight, Sparkles, Loader2 } from 'lucide-react';
import { searchStocks } from '../utils/api';

export default function SearchModal({ isOpen, onClose, onSelectStock }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults([]);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else setQuery('');
      } else if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Debounced search
  useEffect(() => {
    if (!query || query.length < 1) {
      setResults([]);
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await searchStocks(query);
        setResults(res);
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(debounceRef.current);
  }, [query]);

  if (!isOpen) return null;

  const handleSelect = (symbol) => {
    // Strip .NS/.BO suffix for our internal ticker
    const ticker = symbol.replace(/\.(NS|BO)$/, '');
    onSelectStock(ticker);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-start justify-center pt-16 sm:pt-24 px-4 animate-in fade-in duration-200">
      <div className="glass-panel w-full max-w-2xl rounded-2xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        {/* Search Input Bar */}
        <div className="p-4 border-b border-slate-800 flex items-center gap-3 bg-slate-900/90">
          {isSearching ? (
            <Loader2 className="w-5 h-5 text-emerald-400 shrink-0 animate-spin" />
          ) : (
            <Search className="w-5 h-5 text-emerald-400 shrink-0" />
          )}
          <input
            ref={inputRef}
            type="text"
            placeholder="Search any stock — e.g. Tata Motors, INFY, NVDA, Reliance..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full text-sm bg-transparent border-none text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-0"
          />
          {query && (
            <button onClick={() => setQuery('')} className="p-1 text-slate-500 hover:text-slate-200">
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-block text-[10px] uppercase bg-slate-800 text-slate-400 px-2 py-1 rounded border border-slate-700 font-mono">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="overflow-y-auto p-3 divide-y divide-slate-800/60 space-y-1">
          {results.length > 0 ? (
            results.map((stock) => (
              <div
                key={stock.symbol || stock.ticker}
                onClick={() => handleSelect(stock.symbol || stock.ticker)}
                className="p-3 rounded-xl hover:bg-slate-800/80 cursor-pointer transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center font-black text-emerald-400 text-xs group-hover:bg-emerald-500/20 transition-colors border border-slate-700">
                    {(stock.ticker || stock.symbol || '').replace(/\.(NS|BO)$/, '').slice(0, 4)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-100 group-hover:text-emerald-300 transition-colors">
                        {(stock.ticker || stock.symbol || '').replace(/\.(NS|BO)$/, '')}
                      </span>
                      <span className="text-[10px] text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded font-mono border border-slate-800">
                        {stock.exchange || ''}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 truncate max-w-xs">{stock.name}</div>
                    {stock.sector && (
                      <div className="text-[10px] text-slate-500">{stock.sector}{stock.industry ? ` · ${stock.industry}` : ''}</div>
                    )}
                  </div>
                </div>

                {stock.price && (
                  <div className="text-right">
                    <div className="text-sm font-bold font-mono text-slate-100">
                      ₹{stock.price.toLocaleString()}
                    </div>
                    {stock.changePercent != null && (
                      <div
                        className={`text-[11px] font-mono flex items-center justify-end font-semibold ${
                          stock.changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {stock.changePercent >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent?.toFixed(2)}%
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          ) : query && !isSearching ? (
            <div
              onClick={() => handleSelect(query)}
              className="p-4 rounded-xl hover:bg-slate-800/80 cursor-pointer transition-all flex items-center justify-between text-emerald-400 font-medium text-xs"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                <span>Look up ticker: <strong>"{query.toUpperCase()}"</strong></span>
              </div>
              <span className="text-[10px] bg-emerald-500/20 px-2 py-1 rounded text-emerald-300">Fetch Live →</span>
            </div>
          ) : !query ? (
            <div className="p-6 text-center text-slate-500 text-xs">
              Type a company name or ticker symbol to search
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-900/90 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
          <span>Search any NSE, BSE or US stock — powered by live data</span>
          <span className="hidden sm:inline">Press <kbd className="bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700">Ctrl + K</kbd> anytime</span>
        </div>
      </div>
    </div>
  );
}
