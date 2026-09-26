import React, { useMemo } from 'react';

export default function AllocationBreakdown({
  totalVal = 1,
  directStocksVal = 0,
  etfsVal = 0,
  mfVal = 0,
  bondsVal = 0
}) {
  const safeTotal = totalVal > 0 ? totalVal : 1;

  const categories = useMemo(() => {
    return [
      {
        id: 'mf',
        name: 'Mutual Funds',
        value: mfVal,
        pct: (mfVal / safeTotal) * 100,
        colorClass: 'bg-chart-1',
        dotColorClass: 'bg-chart-1'
      },
      {
        id: 'direct',
        name: 'Direct Equities',
        value: directStocksVal,
        pct: (directStocksVal / safeTotal) * 100,
        colorClass: 'bg-chart-2',
        dotColorClass: 'bg-chart-2'
      },
      {
        id: 'etf',
        name: 'ETFs',
        value: etfsVal,
        pct: (etfsVal / safeTotal) * 100,
        colorClass: 'bg-chart-4',
        dotColorClass: 'bg-chart-4'
      },
      {
        id: 'bonds',
        name: 'Bonds & SGBs',
        value: bondsVal,
        pct: (bondsVal / safeTotal) * 100,
        colorClass: 'bg-chart-3',
        dotColorClass: 'bg-chart-3'
      }
    ];
  }, [safeTotal, mfVal, directStocksVal, etfsVal, bondsVal]);

  return (
    <div className="space-y-3">
      {/* ── SECTION HEADER ── */}
      <div className="px-0.5">
        <div className="text-[11px] font-semibold text-muted-foreground tracking-wider uppercase">
          Asset Class Allocation Breakdown
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          Consolidated distribution across Mutual Funds, Direct Stocks, ETFs, and Sovereign Debt.
        </div>
      </div>

      <div className="glass-card p-5 space-y-4">
        {/* ── STACKED HORIZONTAL BAR (Wealthfolio Pattern) ── */}
        <div className="w-full h-2.5 rounded-full bg-muted overflow-hidden flex shadow-inner">
          {categories.map((cat) => (
            cat.pct > 0 && (
              <div
                key={cat.id}
                className={`h-full ${cat.colorClass} transition-all duration-300`}
                style={{ width: `${cat.pct}%` }}
                title={`${cat.name}: ${cat.pct.toFixed(1)}%`}
              />
            )
          ))}
        </div>

        {/* ── LEGEND GRID ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="p-3 bg-muted/40 border border-border/40 rounded-lg space-y-1"
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className={`w-2 h-2 rounded-full ${cat.dotColorClass}`} />
                <span className="truncate">{cat.name}</span>
              </div>
              <div className="font-mono text-sm font-bold text-foreground">
                ₹{cat.value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </div>
              <div className="text-[11px] text-muted-foreground font-mono">
                {cat.pct.toFixed(1)}% of portfolio
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
