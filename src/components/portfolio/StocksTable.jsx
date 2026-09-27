import React, { useState, useMemo } from 'react';
import { ArrowUpDown, ChevronRight } from 'lucide-react';

export default function StocksTable({
  stocks = [],
  directStocks = [],
  etfs = [],
  searchQuery = '',
  onSelectStock = () => {},
  summary = {}
}) {
  const [subfilter, setSubfilter] = useState('all'); // 'all' | 'direct' | 'etf'
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

  const hasBrokerData = useMemo(() => {
    return stocks.some(s => s.has_broker_buy_price);
  }, [stocks]);

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

  // Filter & sort
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
      let va = a[sortField];
      let vb = b[sortField];
      if (sortField === 'value') {
        va = a.live_value ?? a.value ?? 0;
        vb = b.live_value ?? b.value ?? 0;
      } else if (sortField === 'price') {
        va = a.live_price ?? a.price ?? 0;
        vb = b.live_price ?? b.price ?? 0;
      }
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va < vb) return sortDirection === 'asc' ? -1 : 1;
      if (va > vb) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [stocks, directStocks, etfs, subfilter, searchQuery, sortField, sortDirection]);

  return (
    <div className="space-y-4">
      {/* ── SUMMARY HIGHLIGHT STRIP ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Valuation */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold text-muted-foreground tracking-wider uppercase px-0.5">
            Total Stocks & ETFs Valuation
          </div>
          <div className="glass-card p-4 space-y-0.5">
            <div className="font-serif text-xl font-bold text-success">
              ₹{stocksCurrentVal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-muted-foreground">
              {stocks.length} Active Positions
            </div>
          </div>
        </div>

        {/* Card 2: Cost Basis */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold text-muted-foreground tracking-wider uppercase px-0.5">
            Total Invested Cost Basis
          </div>
          <div className="glass-card p-4 space-y-0.5">
            <div className="font-mono text-xl font-bold text-foreground">
              ₹{stocksCostTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-muted-foreground">
              {hasBrokerData ? 'Broker avg buy price' : 'From CAS statement'}
            </div>
          </div>
        </div>

        {/* Card 3: Unrealized Gain */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold text-muted-foreground tracking-wider uppercase px-0.5">
            Unrealized Profit & Return
          </div>
          <div className="glass-card p-4 space-y-0.5">
            <div className={`font-mono text-xl font-bold ${stocksGainTotal >= 0 ? 'text-success' : 'text-destructive'}`}>
              {stocksGainTotal >= 0 ? '+' : ''}₹{Math.abs(stocksGainTotal).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </div>
            <div className={`text-xs font-medium ${stocksGainPct >= 0 ? 'text-success' : 'text-destructive'}`}>
              {stocksGainPct >= 0 ? '+' : ''}{stocksGainPct.toFixed(2)}% overall return
            </div>
          </div>
        </div>
      </div>

      {/* ── SUB-FILTER PILLS BAR ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-0.5">
        <div className="inline-flex items-center gap-1 bg-muted/60 p-1 rounded-full border border-border/40">
          <button
            type="button"
            onClick={() => setSubfilter('all')}
            className={`px-3.5 py-1 text-xs font-semibold rounded-full transition-all duration-200 ${
              subfilter === 'all'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            All Stocks ({stocks.length})
          </button>
          <button
            type="button"
            onClick={() => setSubfilter('direct')}
            className={`px-3.5 py-1 text-xs font-semibold rounded-full transition-all duration-200 flex items-center gap-1.5 ${
              subfilter === 'direct'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-info" />
            <span>Direct Equities ({directStocks.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setSubfilter('etf')}
            className={`px-3.5 py-1 text-xs font-semibold rounded-full transition-all duration-200 flex items-center gap-1.5 ${
              subfilter === 'etf'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-chart-5" />
            <span>ETFs ({etfs.length})</span>
          </button>
        </div>

        <div className="text-xs text-muted-foreground font-mono">
          Showing {filteredStocks.length} of {stocks.length} positions
        </div>
      </div>

      {/* ── HOLDINGS TABLE (Wealthfolio Two-Line Cell Pattern) ── */}
      <div className="overflow-x-auto rounded-xl border border-border/40 bg-card/70 backdrop-blur-xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border/40 bg-muted/30 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold select-none">
              <th
                className="py-3 px-4 cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort('symbol')}
              >
                <div className="flex items-center gap-1.5">
                  <span>Security / Ticker</span>
                  <ArrowUpDown className="w-3 h-3 text-muted-foreground/60" />
                </div>
              </th>
              <th className="py-3 px-4 text-center">Type</th>
              <th
                className="py-3 px-4 text-right cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort('quantity')}
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>Quantity</span>
                  <ArrowUpDown className="w-3 h-3 text-muted-foreground/60" />
                </div>
              </th>
              <th className="py-3 px-4 text-right">
                {hasBrokerData ? 'Avg Buy Price' : 'Statement Price'}
              </th>
              <th className="py-3 px-4 text-right">Live Price</th>
              <th
                className="py-3 px-4 text-right cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort('value')}
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>Holding Value</span>
                  <ArrowUpDown className="w-3 h-3 text-muted-foreground/60" />
                </div>
              </th>
              <th className="py-3 px-4 text-right">
                {hasBrokerData ? 'P&L vs Buy Price' : 'P&L vs Statement'}
              </th>
              <th
                className="py-3 px-4 text-right cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort('weight_pct')}
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>Weight %</span>
                  <ArrowUpDown className="w-3 h-3 text-muted-foreground/60" />
                </div>
              </th>
              <th className="py-3 px-4 text-center">Action</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-border/30 text-xs">
            {filteredStocks.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-muted-foreground">
                  No stocks found matching your criteria.
                </td>
              </tr>
            ) : (
              filteredStocks.map((stock, idx) => {
                const isGain = (stock.gain || 0) >= 0;
                const isETF = stock.subtype === 'ETF';
                const liveVal = stock.live_value ?? stock.value ?? 0;
                const livePr = stock.live_price ?? stock.price ?? 0;

                return (
                  <tr key={idx} className="hover:bg-muted/30 transition-colors duration-150">
                    {/* Position Name / Ticker */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground tracking-wide font-mono">
                          {stock.symbol || 'N/A'}
                        </span>
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate max-w-xs" title={stock.name}>
                        {stock.name}
                      </div>
                      <div className="text-[10px] text-muted-foreground/70 font-mono mt-0.5">
                        {stock.isin}
                      </div>
                    </td>

                    {/* Subtype Badge */}
                    <td className="py-3 px-4 text-center">
                      {isETF ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-chart-5/10 text-chart-5 border border-chart-5/30">
                          ETF
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-info/10 text-info border border-info/30">
                          Direct Stock
                        </span>
                      )}
                    </td>

                    {/* Quantity */}
                    <td className="py-3 px-4 text-right font-mono font-medium text-foreground">
                      {stock.quantity.toLocaleString('en-IN')}
                    </td>

                    {/* Price (Buy Price vs Statement Price) */}
                    <td className="py-3 px-4 text-right font-mono">
                      {stock.has_broker_buy_price && stock.buy_price > 0 ? (
                        <div>
                          <div className="font-semibold text-foreground">
                            ₹{stock.buy_price.toFixed(2)}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            CAS: ₹{stock.price.toFixed(2)}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">
                          ₹{stock.price.toFixed(2)}
                        </span>
                      )}
                    </td>

                    {/* Live Price (Two-line cell) */}
                    <td className="py-3 px-4 text-right font-mono">
                      <div className="font-semibold text-foreground">
                        ₹{livePr.toFixed(2)}
                      </div>
                      {stock.live_change_percent !== undefined && stock.live_change_percent !== 0 && (
                        <div
                          className={`text-[10px] font-medium ${
                            stock.live_change_percent >= 0 ? 'text-success' : 'text-destructive'
                          }`}
                        >
                          {stock.live_change_percent >= 0 ? '+' : ''}{stock.live_change_percent.toFixed(2)}%
                        </div>
                      )}
                    </td>

                    {/* Holding Value */}
                    <td className="py-3 px-4 text-right font-bold text-foreground font-mono">
                      ₹{liveVal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </td>

                    {/* Gain vs Statement (Two-line cell) */}
                    <td className="py-3 px-4 text-right font-mono">
                      {stock.gain !== undefined && stock.gain !== 0 ? (
                        <div className={isGain ? 'text-success' : 'text-destructive'}>
                          <span className="font-semibold">
                            {isGain ? '+' : ''}₹{Math.abs(stock.gain).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                          </span>
                          <div className="text-[10px]">
                            {isGain ? '+' : ''}{(stock.gain_pct || 0).toFixed(2)}%
                          </div>
                          {stock.has_broker_buy_price && (
                            <div className="text-[9px] text-muted-foreground">
                              vs cost
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-[11px]">—</span>
                      )}
                    </td>

                    {/* Weight % (Two-line cell with mini bar) */}
                    <td className="py-3 px-4 text-right font-mono">
                      <div className="font-semibold text-foreground">
                        {(stock.weight_pct || 0).toFixed(2)}%
                      </div>
                      <div className="w-14 h-1 bg-muted rounded-full ml-auto mt-1 overflow-hidden">
                        <div
                          className="h-full bg-chart-1 rounded-full"
                          style={{ width: `${Math.min(stock.weight_pct || 0, 100)}%` }}
                        />
                      </div>
                    </td>

                    {/* 360 Deep Dive Action */}
                    <td className="py-3 px-4 text-center">
                      {stock.symbol ? (
                        <button
                          type="button"
                          onClick={() => onSelectStock && onSelectStock(stock.symbol)}
                          className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-foreground bg-muted hover:bg-muted/80 border border-border/60 rounded-full transition-all duration-150 active:scale-95"
                          title={`Open 360° Analysis for ${stock.symbol}`}
                        >
                          <span>Analyze</span>
                          <ChevronRight className="w-3 h-3 text-muted-foreground" />
                        </button>
                      ) : (
                        <span className="text-muted-foreground/60 text-xs">—</span>
                      )}
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
