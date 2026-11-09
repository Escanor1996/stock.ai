import React, { useMemo } from 'react';
import { BarChart3, ArrowUpRight, ArrowDownRight } from 'lucide-react';

export default function QuarterlyAnalysis({ financials = [], currencySymbol = "₹ Cr" }) {
  // Only show the last 8 quarters, sorted latest on top
  const recentQuarters = useMemo(() => {
    if (!financials || financials.length === 0) return [];
    return [...financials].slice(-8).reverse();
  }, [financials]);

  if (recentQuarters.length === 0) return null;

  return (
    <div className="glass-card p-5 sm:p-6 space-y-3 flex flex-col justify-between">
      {/* Section Header */}
      <div className="flex items-center justify-between gap-3 border-b border-border/40 pb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <BarChart3 className="w-5 h-5 text-success" />
          <h3 className="text-base font-bold text-foreground tracking-wide">
            Quarterly Financials
          </h3>
          <span className="text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/50">
            Last {recentQuarters.length} Quarters
          </span>
        </div>
        <span className="text-[11px] text-muted-foreground font-mono hidden sm:inline">
          {currencySymbol}
        </span>
      </div>

      {/* Financial Data Table (Table Only, No Chart) */}
      <div className="overflow-x-auto rounded-xl border border-border/40 flex-1">
        <table className="w-full text-left text-xs text-foreground">
          <thead className="bg-muted/30 text-muted-foreground uppercase font-semibold text-[10px] tracking-wider border-b border-border/40">
            <tr>
              <th className="px-3 py-2 text-left">Quarter</th>
              <th className="px-3 py-2 text-right">Revenue</th>
              <th className="px-3 py-2 text-right">Net Profit</th>
              <th className="px-3 py-2 text-right">OPM %</th>
              <th className="px-3 py-2 text-right">EPS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/20 font-mono text-xs">
            {recentQuarters.map((row, idx) => {
              const revGrowth = Number(row.revGrowthYoY);
              const patGrowth = Number(row.patGrowthYoY);
              return (
                <tr key={idx} className="hover:bg-muted/20 transition-colors">
                  <td className="px-3 py-2 font-sans font-semibold text-foreground whitespace-nowrap">
                    {row.quarter}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <div className="font-semibold text-foreground">
                      {typeof row.revenue === 'number' ? row.revenue.toLocaleString('en-IN') : row.revenue}
                    </div>
                    {!isNaN(revGrowth) && revGrowth !== 0 && (
                      <div className={`text-[10px] font-sans flex items-center justify-end gap-0.5 ${revGrowth >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {revGrowth >= 0 ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
                        <span>{revGrowth >= 0 ? '+' : ''}{revGrowth.toFixed(1)}%</span>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <div className="font-semibold text-foreground">
                      {typeof row.pat === 'number' ? row.pat.toLocaleString('en-IN') : row.pat}
                    </div>
                    {!isNaN(patGrowth) && patGrowth !== 0 && (
                      <div className={`text-[10px] font-sans flex items-center justify-end gap-0.5 ${patGrowth >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {patGrowth >= 0 ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
                        <span>{patGrowth >= 0 ? '+' : ''}{patGrowth.toFixed(1)}%</span>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap font-medium text-foreground">
                    {row.ebitdaMargin != null ? `${Number(row.ebitdaMargin).toFixed(1)}%` : '—'}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap font-medium text-foreground">
                    {row.eps != null ? `₹${Number(row.eps).toFixed(2)}` : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
