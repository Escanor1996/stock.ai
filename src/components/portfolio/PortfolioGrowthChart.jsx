import React, { useMemo } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

export default function PortfolioGrowthChart({
  historicalValuations = [],
  chartMetric = 'value',
  onChartMetricChange = () => {}
}) {
  // Calculate dynamic zero crossing offset for the gradient
  const { zeroOffset, isAllPositive, isAllNegative } = useMemo(() => {
    if (!historicalValuations || historicalValuations.length === 0) {
      return { zeroOffset: 0, isAllPositive: true, isAllNegative: false };
    }
    const values = historicalValuations.map(d => d.value);
    const max = Math.max(...values);
    const min = Math.min(...values);

    if (max <= 0) return { zeroOffset: 0, isAllPositive: false, isAllNegative: true };
    if (min >= 0) return { zeroOffset: 1, isAllPositive: true, isAllNegative: false };

    // Zero-crossing offset
    const offset = max / (max - min);
    return { zeroOffset: Math.max(0, Math.min(1, offset)), isAllPositive: false, isAllNegative: false };
  }, [historicalValuations]);

  if (!historicalValuations || historicalValuations.length === 0) {
    return null;
  }

  // Custom Floating Glass Tooltip
  const CustomChartTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const isPositive = (data.change_rs || 0) >= 0;

      return (
        <div className="glass-card bg-card/95 border border-border/80 p-3.5 shadow-2xl backdrop-blur-xl space-y-1.5 min-w-[200px] text-xs">
          <div className="font-semibold text-foreground flex items-center justify-between border-b border-border/50 pb-1.5">
            <span>{data.month_year}</span>
            <span className="text-[10px] text-muted-foreground font-mono">Statement</span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Portfolio Value:</span>
            <span className="font-bold text-foreground font-mono">
              ₹{(data.value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </span>
          </div>

          {data.change_rs !== undefined && (
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">MoM Expansion:</span>
              <span className={`font-semibold font-mono ${isPositive ? 'text-success' : 'text-destructive'}`}>
                {isPositive ? '+' : ''}₹{Math.abs(data.change_rs).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </span>
            </div>
          )}

          {data.change_pct !== undefined && (
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Monthly Return:</span>
              <span className={`font-semibold font-mono ${data.change_pct >= 0 ? 'text-success' : 'text-destructive'}`}>
                {data.change_pct >= 0 ? '+' : ''}{data.change_pct.toFixed(2)}%
              </span>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-3">
      {/* ── SECTION HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-0.5">
        <div>
          <div className="text-[11px] font-semibold text-muted-foreground tracking-wider uppercase">
            Historical Portfolio Valuation Trend
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            12-month consolidated portfolio expansion trajectory extracted from statement records.
          </div>
        </div>

        {/* Floating Toggle Controls */}
        <div className="inline-flex items-center gap-1 bg-muted/60 p-1 rounded-full border border-border/40 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => onChartMetricChange('value')}
            className={`px-3 py-1 text-xs font-semibold rounded-full transition-all duration-200 ${
              chartMetric === 'value'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Valuation (₹)
          </button>
          <button
            type="button"
            onClick={() => onChartMetricChange('change_pct')}
            className={`px-3 py-1 text-xs font-semibold rounded-full transition-all duration-200 ${
              chartMetric === 'change_pct'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            MoM Return (%)
          </button>
        </div>
      </div>

      {/* ── BORDERLESS CHART CANVAS (Wealthfolio Pattern) ── */}
      <div className="relative h-64 sm:h-72 w-full overflow-hidden rounded-xl bg-gradient-to-t from-[hsl(var(--success)/0.08)] via-[hsl(var(--success)/0.02)] to-transparent border border-border/40">
        <ResponsiveContainer width="100%" height="100%">
          {chartMetric === 'value' ? (
            <AreaChart data={historicalValuations} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="wealthfolioHistoryGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.35} />
                  <stop offset={`${Math.round((zeroOffset || 0.8) * 100)}%`} stopColor="hsl(var(--success))" stopOpacity={0.05} />
                  <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              {/* Minimalist borderless presentation: X & Y axes hidden */}
              <XAxis dataKey="month_year" hide />
              <YAxis domain={['auto', 'auto']} hide />
              <Tooltip content={<CustomChartTooltip />} />
              <Area
                type="monotone"
                dataKey="value"
                stroke="hsl(var(--success))"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#wealthfolioHistoryGradient)"
              />
            </AreaChart>
          ) : (
            <BarChart data={historicalValuations} margin={{ top: 20, right: 10, left: 10, bottom: 10 }}>
              <XAxis dataKey="month_year" hide />
              <YAxis hide />
              <Tooltip content={<CustomChartTooltip />} />
              <Bar dataKey="change_pct" radius={[4, 4, 0, 0]}>
                {historicalValuations.map((entry, index) => (
                  <Cell
                    key={`bar-cell-${index}`}
                    fill={entry.change_pct >= 0 ? 'hsl(var(--success))' : 'hsl(var(--destructive))'}
                  />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>

        {/* Bottom Time Range Indicators */}
        <div className="absolute bottom-2 left-4 right-4 flex items-center justify-between pointer-events-none text-[10px] text-muted-foreground font-mono">
          <span>{historicalValuations[0]?.month_year}</span>
          <span>{historicalValuations[historicalValuations.length - 1]?.month_year}</span>
        </div>
      </div>
    </div>
  );
}
