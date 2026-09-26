import React from 'react';

export default function MetricCards({
  summary = {},
  analytics = null,
  directStocksList = [],
  etfsList = [],
  mutualFundsList = [],
  bondsList = [],
  totalVal = 0,
  stocksVal = 0,
  mfVal = 0,
  bondsVal = 0,
  stockGainTotal = 0,
  stockGainPct = 0,
  statementPeriod = {}
}) {
  const performance = analytics?.performance;
  const isNetPositive = performance ? performance.total_growth_rs >= 0 : stockGainTotal >= 0;

  return (
    <div className="space-y-6">
      {/* ── HERO VALUATION DISPLAY (Wealthfolio Balance Pattern) ── */}
      <div className="space-y-2">
        <div className="text-[11px] font-semibold text-muted-foreground tracking-wider uppercase">
          Total Portfolio Valuation
        </div>

        <div className="flex flex-col sm:flex-row sm:items-baseline gap-2 sm:gap-4">
          <div className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            ₹{totalVal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>

          {/* Performance Strip */}
          <div className="flex items-center flex-wrap gap-2 text-xs">
            {performance ? (
              <>
                <span className={`font-mono font-semibold ${isNetPositive ? 'text-success' : 'text-destructive'}`}>
                  {isNetPositive ? '+' : '-'}₹{Math.abs(performance.total_growth_rs).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </span>
                <span className="h-3.5 w-px bg-border" />
                <span className={`font-mono font-semibold ${isNetPositive ? 'text-success' : 'text-destructive'}`}>
                  {isNetPositive ? '+' : ''}{performance.total_growth_pct.toFixed(2)}%
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-success/10 text-success border border-success/20">
                  12M Growth
                </span>
                {performance.cagr_pct > 0 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-info/10 text-info border border-info/20">
                    CAGR {performance.cagr_pct.toFixed(1)}%
                  </span>
                )}
              </>
            ) : (
              <>
                <span className={`font-mono font-semibold ${stockGainTotal >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {stockGainTotal >= 0 ? '+' : '-'}₹{Math.abs(stockGainTotal).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </span>
                <span className="h-3.5 w-px bg-border" />
                <span className={`font-mono font-semibold ${stockGainTotal >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {stockGainTotal >= 0 ? '+' : ''}{stockGainPct.toFixed(2)}%
                </span>
                <span className="text-muted-foreground">
                  {summary.broker_source ? `vs ${summary.broker_source} buy price` : 'vs statement'}
                </span>
              </>
            )}

            {statementPeriod?.to && (
              <span className="text-muted-foreground text-[11px] ml-auto sm:ml-2">
                As on {statementPeriod.to}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── 4-COLUMN SUMMARY CARDS (Header Outside Body Pattern) ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Card 1: Stocks & ETFs */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold text-muted-foreground tracking-wider uppercase px-0.5">
            Stocks & ETFs
          </div>
          <div className="glass-card p-4 space-y-1">
            <div className="text-lg font-bold font-mono text-foreground">
              ₹{stocksVal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              {summary.total_stocks_invested ? (
                <span>Cost: ₹{Math.round(summary.total_stocks_invested).toLocaleString('en-IN')} • {directStocksList.length + etfsList.length} Positions</span>
              ) : (
                <span>{directStocksList.length} Direct • {etfsList.length} ETFs</span>
              )}
            </div>
          </div>
        </div>

        {/* Card 2: Mutual Funds */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold text-muted-foreground tracking-wider uppercase px-0.5">
            Mutual Funds
          </div>
          <div className="glass-card p-4 space-y-1">
            <div className="text-lg font-bold font-mono text-foreground">
              ₹{mfVal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              {mutualFundsList.length} Active Folios
            </div>
          </div>
        </div>

        {/* Card 3: Bonds & SGBs */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold text-muted-foreground tracking-wider uppercase px-0.5">
            Bonds & SGBs
          </div>
          <div className="glass-card p-4 space-y-1">
            <div className="text-lg font-bold font-mono text-foreground">
              ₹{bondsVal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              {bondsList.length} Gold & Debt Holdings
            </div>
          </div>
        </div>

        {/* Card 4: Performance / Inflow */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold text-muted-foreground tracking-wider uppercase px-0.5">
            {performance ? 'Monthly Avg Expansion' : (summary.broker_source ? `${summary.broker_source} P&L` : 'Equities P&L')}
          </div>
          <div className="glass-card p-4 space-y-1">
            {(() => {
              const avgMonthly = Math.round(performance?.avg_monthly_change_rs || 0);
              const isAvgPositive = avgMonthly >= 0;
              const cardPositive = performance ? isAvgPositive : stockGainTotal >= 0;
              return (
                <>
                  <div className={`text-lg font-bold font-mono ${cardPositive ? 'text-success' : 'text-destructive'}`}>
                    {performance
                      ? `${isAvgPositive ? '+' : '-'}₹${Math.abs(avgMonthly).toLocaleString('en-IN')}`
                      : `${stockGainTotal >= 0 ? '+' : '-'}₹${Math.abs(stockGainTotal).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {performance
                      ? `${performance.positive_months} Up • ${performance.negative_months} Down months`
                      : `${stockGainPct.toFixed(2)}% net change`}
                  </div>
                </>
              );
            })()}
            </div>
          </div>
        </div>
      </div>
  );
}
