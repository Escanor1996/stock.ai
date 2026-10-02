import React, { useState, useMemo } from 'react';
import { ChevronRight, ArrowUpDown, Sparkles, Cpu } from 'lucide-react';

const getScoreTheme = (score) => {
  if (score >= 80) {
    return {
      text: 'text-info',
      bg: 'bg-info/10',
      border: 'border-info/30',
      label: 'Exceptional'
    };
  } else if (score >= 65) {
    return {
      text: 'text-success',
      bg: 'bg-success/10',
      border: 'border-success/30',
      label: 'Strong'
    };
  } else if (score >= 50) {
    return {
      text: 'text-warning',
      bg: 'bg-warning/10',
      border: 'border-warning/30',
      label: 'Moderate'
    };
  } else {
    return {
      text: 'text-destructive',
      bg: 'bg-destructive/10',
      border: 'border-destructive/30',
      label: 'High Risk'
    };
  }
};

export default function StocksTable({
  stocks = [],
  directStocks = [],
  etfs = [],
  searchQuery = '',
  onSelectStock = () => {},
  summary = {}
}) {
  const [subfilter, setSubfilter] = useState('all');
  const [sortField, setSortField] = useState('value');
  const [sortDirection, setSortDirection] = useState('desc');

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const fmt = (n) => '₹' + Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });

  const stocksCurrentVal = useMemo(() => {
    return stocks.reduce((sum, s) => sum + (s.live_value || s.value || 0), 0);
  }, [stocks]);

  const stocksCostTotal = useMemo(() => {
    return stocks.reduce((sum, s) => {
      if (s.has_broker_buy_price) return sum + (s.cost_basis || 0);
      return sum + ((s.price || 0) * (s.quantity || 0));
    }, 0);
  }, [stocks]);

  const stocksGainTotal = stocksCurrentVal - stocksCostTotal;
  const stocksGainPct = stocksCostTotal > 0 ? (stocksGainTotal / stocksCostTotal) * 100 : 0;

  const filteredStocks = useMemo(() => {
    let source = stocks;
    if (subfilter === 'direct') source = directStocks;
    else if (subfilter === 'etf') source = etfs;

    const q = searchQuery.toLowerCase().trim();
    let res = source.filter(s => {
      if (!q) return true;
      return (
        (s.symbol && s.symbol.toLowerCase().includes(q)) ||
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.isin && s.isin.toLowerCase().includes(q))
      );
    });

    return [...res].sort((a, b) => {
      let va, vb;
      if (sortField === 'value') {
        va = a.live_value ?? a.value ?? 0;
        vb = b.live_value ?? b.value ?? 0;
      } else if (sortField === 'price') {
        va = a.live_price ?? a.price ?? 0;
        vb = b.live_price ?? b.price ?? 0;
      } else if (sortField === 'gain_pct') {
        va = a.gain_pct ?? 0;
        vb = b.gain_pct ?? 0;
      } else if (sortField === 'score') {
        va = a.score ?? 0;
        vb = b.score ?? 0;
      } else {
        va = a[sortField];
        vb = b[sortField];
      }
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va < vb) return sortDirection === 'asc' ? -1 : 1;
      if (va > vb) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [stocks, directStocks, etfs, subfilter, searchQuery, sortField, sortDirection]);

  const { avgScore, aiCount, algoCount } = useMemo(() => {
    const scored = stocks.filter(s => s.score != null);
    if (scored.length === 0) return { avgScore: null, aiCount: 0, algoCount: 0 };
    const sum = scored.reduce((acc, s) => acc + s.score, 0);
    const ai = scored.filter(s => s.is_ai_score).length;
    return {
      avgScore: Math.round(sum / scored.length),
      aiCount: ai,
      algoCount: scored.length - ai
    };
  }, [stocks]);

  return (
    <div className="space-y-4">
      {/* ── SUMMARY HEADER CARD ── */}
      <div className="bg-card rounded-xl border border-border/40 p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="text-[11px] font-semibold text-muted-foreground tracking-wider uppercase">
              Holdings ({stocks.length})
            </div>
            {avgScore != null && (
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold font-mono border ${getScoreTheme(avgScore).bg} ${getScoreTheme(avgScore).text} ${getScoreTheme(avgScore).border}`}
                title={`${aiCount} AI-evaluated, ${algoCount} Algo-evaluated`}
              >
                <Sparkles className="w-2.5 h-2.5 text-info" />
                <span>Quality {avgScore}</span>
              </span>
            )}
          </div>
          {/* Sub-filter pills */}
          <div className="inline-flex items-center gap-0.5 bg-muted/50 p-0.5 rounded-full">
            {[
              { key: 'all', label: `All (${stocks.length})` },
              { key: 'direct', label: `Direct (${directStocks.length})` },
              { key: 'etf', label: `ETFs (${etfs.length})` },
            ].map(f => (
              <button
                key={f.key}
                type="button"
                onClick={() => setSubfilter(f.key)}
                className={`px-3 py-1 text-[11px] font-semibold rounded-full transition-all ${
                  subfilter === f.key
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="font-serif text-2xl font-bold text-foreground mb-4">
          {fmt(stocksCurrentVal)}
        </div>

        <div className="grid grid-cols-3 gap-4 pt-3 border-t border-border/30">
          <div>
            <div className="text-[11px] text-muted-foreground mb-0.5">Invested value</div>
            <div className="text-sm font-semibold text-foreground font-mono">{fmt(stocksCostTotal)}</div>
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground mb-0.5">1D returns</div>
            <div className="text-sm font-semibold text-muted-foreground font-mono">₹0.00 (0.00%)</div>
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground mb-0.5">Total returns</div>
            <div className={`text-sm font-semibold font-mono ${stocksGainTotal >= 0 ? 'text-success' : 'text-destructive'}`}>
              {stocksGainTotal >= 0 ? '+' : '-'}{fmt(stocksGainTotal)} ({stocksGainPct.toFixed(2)}%)
            </div>
          </div>
        </div>
      </div>

      {/* ── HOLDINGS TABLE ── */}
      <div className="bg-card rounded-xl border border-border/40 overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border/40 bg-muted/20 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold select-none">
              <th
                className="py-3 px-5 cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort('symbol')}
              >
                <div className="flex items-center gap-1">
                  <span>Company</span>
                  <ArrowUpDown className="w-3 h-3 text-muted-foreground/50" />
                </div>
              </th>
              <th
                className="py-3 px-4 text-center cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort('score')}
              >
                <div className="flex items-center justify-center gap-1">
                  <span>Score</span>
                  <ArrowUpDown className="w-3 h-3 text-muted-foreground/50" />
                </div>
              </th>
              <th
                className="py-3 px-5 text-right cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort('price')}
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Market price (1D%)</span>
                  <ArrowUpDown className="w-3 h-3 text-muted-foreground/50" />
                </div>
              </th>
              <th
                className="py-3 px-5 text-right cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort('gain_pct')}
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Returns (%)</span>
                  <ArrowUpDown className="w-3 h-3 text-muted-foreground/50" />
                </div>
              </th>
              <th
                className="py-3 px-5 text-right cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort('value')}
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Current (Invested)</span>
                  <ArrowUpDown className="w-3 h-3 text-muted-foreground/50" />
                </div>
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-border/20">
            {filteredStocks.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-10 text-center text-muted-foreground text-sm">
                  No stocks found matching your criteria.
                </td>
              </tr>
            ) : (
              filteredStocks.map((stock, idx) => {
                const isGain = (stock.gain || 0) >= 0;
                const liveVal = stock.live_value ?? stock.value ?? 0;
                const livePr = stock.live_price ?? stock.price ?? 0;
                const buyPrice = stock.has_broker_buy_price && stock.buy_price > 0 ? stock.buy_price : stock.price;
                const costBasis = stock.cost_basis || (buyPrice * (stock.quantity || 0));
                const isETF = stock.subtype === 'ETF';
                const oneDayPct = stock.live_change_percent || 0;
                const scoreTheme = stock.score != null ? getScoreTheme(stock.score) : null;

                return (
                  <tr
                    key={idx}
                    onClick={() => stock.symbol && onSelectStock(stock.symbol)}
                    className="hover:bg-muted/30 transition-colors duration-150 cursor-pointer group"
                  >
                    {/* Company */}
                    <td className="py-4 px-5">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground text-sm truncate">
                              {stock.name || stock.symbol}
                            </span>
                            {isETF && (
                              <span className="shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded bg-chart-5/10 text-chart-5 border border-chart-5/30 uppercase">
                                ETF
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                            {stock.quantity} shares • Avg. {fmt(buyPrice)}
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground/0 group-hover:text-muted-foreground/60 transition-colors ml-3 shrink-0" />
                      </div>
                    </td>

                    {/* Score (AI vs Algo) */}
                    <td className="py-4 px-4 text-center" onClick={(e) => {
                      // Don't navigate if clicking on tooltip or badge
                      e.stopPropagation();
                      if (stock.symbol) onSelectStock(stock.symbol);
                    }}>
                      {stock.score != null ? (
                        <div
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold font-mono border transition-transform hover:scale-105 ${scoreTheme.bg} ${scoreTheme.text} ${scoreTheme.border}`}
                          title={stock.is_ai_score ? `AI 360° Score (${stock.score_engine || 'Gemini'})` : `Algorithm Score (${stock.score_engine || 'stock.ai Model'})`}
                        >
                          {stock.is_ai_score ? (
                            <Sparkles className="w-3 h-3 text-info shrink-0" />
                          ) : (
                            <Cpu className="w-3 h-3 text-muted-foreground shrink-0" />
                          )}
                          <span>{stock.score}</span>
                          <span className="text-[9px] font-sans font-semibold uppercase opacity-75 tracking-wider">
                            {stock.is_ai_score ? 'AI' : 'Algo'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs font-mono">—</span>
                      )}
                    </td>

                    {/* Market price (1D%) */}
                    <td className="py-4 px-5 text-right">
                      <div className="font-mono text-sm font-medium text-foreground">{fmt(livePr)}</div>
                      <div className={`text-[11px] font-mono mt-0.5 ${oneDayPct > 0 ? 'text-success' : oneDayPct < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {oneDayPct >= 0 ? '+' : ''}{oneDayPct.toFixed(2)}%
                      </div>
                    </td>

                    {/* Returns (%) */}
                    <td className="py-4 px-5 text-right">
                      {stock.gain !== undefined ? (
                        <div>
                          <div className={`font-mono text-sm font-medium ${isGain ? 'text-success' : 'text-destructive'}`}>
                            {isGain ? '+' : '-'}{fmt(stock.gain)}
                          </div>
                          <div className={`text-[11px] font-mono font-medium mt-0.5 ${isGain ? 'text-success' : 'text-destructive'}`}>
                            {(stock.gain_pct || 0).toFixed(2)}%
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </td>

                    {/* Current (Invested) */}
                    <td className="py-4 px-5 text-right">
                      <div className="font-mono text-sm font-semibold text-foreground">{fmt(liveVal)}</div>
                      <div className="text-[11px] text-muted-foreground font-mono mt-0.5">{fmt(costBasis)}</div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
