import React, { useMemo } from 'react';
import {
  PieChart, Pie, Cell, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer
} from 'recharts';
import { Sparkles, Cpu } from 'lucide-react';
import PortfolioGrowthChart from './PortfolioGrowthChart';
import TransactionsLedger from './TransactionsLedger';

const fmt = (n) => '₹' + Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const fmtFull = (n) => '₹' + Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });

// ── Shared Tooltip Components ───────────────────────────────────────────────

function DonutTooltip({ active, payload }) {
  if (active && payload && payload.length) {
    const d = payload[0].payload;
    return (
      <div className="bg-card border border-border/60 rounded-lg px-3 py-2 shadow-lg text-xs">
        <div className="font-semibold text-foreground">{d.name}</div>
        <div className="text-muted-foreground font-mono">{fmtFull(d.value)} • {d.pct.toFixed(1)}%</div>
      </div>
    );
  }
  return null;
}

function BarTooltip({ active, payload }) {
  if (active && payload && payload.length) {
    const d = payload[0].payload;
    return (
      <div className="bg-card border border-border/60 rounded-lg px-3 py-2 shadow-lg text-xs">
        <div className="font-semibold text-foreground mb-0.5">{d.name}</div>
        <div className={`font-mono ${d.gain >= 0 ? 'text-success' : 'text-destructive'}`}>
          {d.gain >= 0 ? '+' : '-'}{fmtFull(d.gain)}
        </div>
        <div className={`font-mono text-[11px] ${d.gainPct >= 0 ? 'text-success' : 'text-destructive'}`}>
          ROI: {d.gainPct >= 0 ? '+' : ''}{d.gainPct.toFixed(2)}%
        </div>
      </div>
    );
  }
  return null;
}

// ── Donut + Breakdown Table (Groww pattern) ─────────────────────────────────

function DonutSection({ title, data, centerLabel }) {
  if (!data || data.length === 0) return null;

  return (
    <div className="bg-card rounded-xl border border-border/40 p-5">
      <h3 className="text-base font-semibold text-foreground mb-4">{title}</h3>

      {/* Donut Chart */}
      <div className="relative mx-auto" style={{ width: 200, height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              dataKey="value"
              paddingAngle={2}
              stroke="none"
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<DonutTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="text-[11px] text-muted-foreground leading-tight">{centerLabel}</div>
          </div>
        </div>
      </div>

      {/* Breakdown Table */}
      <div className="mt-5 space-y-0">
        {/* Header */}
        <div className="grid grid-cols-[1fr_auto_auto] gap-3 pb-2 border-b border-border/30 text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
          <span>Assets</span>
          <span className="text-right w-32">Current (Allocation)</span>
          <span className="text-right w-28">Returns (%)</span>
        </div>
        {/* Rows */}
        {data.map((item, i) => {
          const isGain = item.gain >= 0;
          return (
            <div key={i} className="grid grid-cols-[1fr_auto_auto] gap-3 py-3 border-b border-border/20 last:border-0 items-start">
              <div className="flex items-start gap-2.5">
                <div className="w-1 h-9 rounded-full mt-0.5 shrink-0" style={{ backgroundColor: item.color }} />
                <div>
                  <div className="text-sm font-medium text-foreground">{item.name}</div>
                  <div className="text-[11px] text-muted-foreground">{item.label}</div>
                </div>
              </div>
              <div className="text-right w-32">
                <div className="text-sm font-medium text-foreground font-mono">{fmtFull(item.value)}</div>
                <div className="text-[11px] text-muted-foreground">{item.pct.toFixed(2)}%</div>
              </div>
              <div className="text-right w-28">
                {item.has_return === false ? (
                  <div className="text-sm font-medium font-mono text-muted-foreground">—</div>
                ) : (
                  <>
                    <div className={`text-sm font-medium font-mono ${isGain ? 'text-success' : 'text-destructive'}`}>
                      {isGain ? '+' : '-'}{fmtFull(item.gain)}
                    </div>
                    <div className={`text-[11px] font-mono ${isGain ? 'text-success' : 'text-destructive'}`}>
                      ({isGain ? '+' : ''}{item.gainPct.toFixed(2)}%)
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Analytics Dashboard ────────────────────────────────────────────────

export default function AnalyticsDashboard({
  stocksList = [],
  directStocksList = [],
  etfsList = [],
  mutualFundsList = [],
  bondsList = [],
  epfoAccounts = [],
  totalVal = 0,
  directStocksVal = 0,
  etfsVal = 0,
  mfVal = 0,
  bondsVal = 0,
  epfoVal = 0,
  summary = {},
  historicalValuations = [],
  transactionsList = [],
  chartMetric = 'value',
  onChartMetricChange = () => {}
}) {
  const safeTotal = totalVal > 0 ? totalVal : 1;

  // Helper: compute gain/cost for a list of holdings
  const computeGain = (list) => {
    const gain = list.reduce((s, h) => s + (h.gain || 0), 0);
    const cost = list.reduce((s, h) => {
      if (h.has_broker_buy_price) return s + (h.cost_basis || 0);
      return s + ((h.price || 0) * (h.quantity || 0));
    }, 0);
    return { gain, cost, gainPct: cost > 0 ? (gain / cost) * 100 : 0 };
  };

  // ── ASSET ALLOCATION (Stocks combined / MFs / Gold & Debt) ──
  const assetAllocation = useMemo(() => {
    const items = [];
    const stocksTotal = (directStocksVal || 0) + (etfsVal || 0);
    if (stocksTotal > 0) {
      const { gain, gainPct } = computeGain(stocksList);
      items.push({
        name: 'Stocks', value: stocksTotal, label: `${stocksList.length} stocks`,
        pct: (stocksTotal / safeTotal) * 100, gain, gainPct, color: '#4393E5'
      });
    }
    if (mfVal > 0) {
      const mfGain = mutualFundsList.reduce((s, m) => s + (m.gain || 0), 0);
      const mfCost = mutualFundsList.reduce((s, m) => s + (m.cost_basis || 0), 0);
      items.push({
        name: 'Mutual Funds', value: mfVal, label: `${mutualFundsList.length} schemes`,
        pct: (mfVal / safeTotal) * 100, gain: mfGain,
        gainPct: mfCost > 0 ? (mfGain / mfCost) * 100 : 0, color: '#06B6D4'
      });
    }
    if (bondsVal > 0) {
      const { gain, gainPct } = computeGain(bondsList);
      items.push({
        name: 'Gold & Silver', value: bondsVal, label: `${bondsList.length} holdings`,
        pct: (bondsVal / safeTotal) * 100, gain, gainPct, color: '#F59E0B'
      });
    }
    if (epfoVal > 0) {
      items.push({
        name: 'EPF',
        value: epfoVal,
        label: `${epfoAccounts.length} account${epfoAccounts.length > 1 ? 's' : ''}`,
        pct: (epfoVal / safeTotal) * 100,
        gain: 0,
        gainPct: 0,
        has_return: false,
        color: '#10b981'
      });
    }
    return items;
  }, [stocksList, mutualFundsList, bondsList, epfoAccounts, directStocksVal, etfsVal, mfVal, bondsVal, epfoVal, safeTotal]);

  // ── STRATEGY LENS (Direct / ETFs / Active MFs / Gold Hedge) ──
  const strategyLens = useMemo(() => {
    const items = [];
    if (directStocksVal > 0) {
      const { gain, gainPct } = computeGain(directStocksList);
      items.push({
        name: 'Direct Stock Picking', value: directStocksVal, label: `${directStocksList.length} stocks`,
        pct: (directStocksVal / safeTotal) * 100, gain, gainPct, color: '#4393E5'
      });
    }
    if (etfsVal > 0) {
      const { gain, gainPct } = computeGain(etfsList);
      items.push({
        name: 'Passive Index ETFs', value: etfsVal, label: `${etfsList.length} ETFs`,
        pct: (etfsVal / safeTotal) * 100, gain, gainPct, color: '#8B5CF6'
      });
    }
    if (mfVal > 0) {
      const mfGain = mutualFundsList.reduce((s, m) => s + (m.gain || 0), 0);
      const mfCost = mutualFundsList.reduce((s, m) => s + (m.cost_basis || 0), 0);
      items.push({
        name: 'Active Managed MFs', value: mfVal, label: `${mutualFundsList.length} schemes`,
        pct: (mfVal / safeTotal) * 100, gain: mfGain,
        gainPct: mfCost > 0 ? (mfGain / mfCost) * 100 : 0, color: '#06B6D4'
      });
    }
    if (bondsVal > 0) {
      const { gain, gainPct } = computeGain(bondsList);
      items.push({
        name: 'Commodity/Gold Hedge', value: bondsVal, label: `${bondsList.length} holdings`,
        pct: (bondsVal / safeTotal) * 100, gain, gainPct, color: '#F59E0B'
      });
    }
    if (epfoVal > 0) {
      items.push({
        name: 'Provident Fund (EPFO)',
        value: epfoVal,
        label: `${epfoAccounts.length} account${epfoAccounts.length > 1 ? 's' : ''}`,
        pct: (epfoVal / safeTotal) * 100,
        gain: 0,
        gainPct: 0,
        has_return: false,
        color: '#10b981'
      });
    }
    return items;
  }, [directStocksList, etfsList, mutualFundsList, bondsList, epfoAccounts, directStocksVal, etfsVal, mfVal, bondsVal, epfoVal, safeTotal]);

  // ── P&L BAR CHART DATA ──
  const plData = useMemo(() => {
    return strategyLens.map(s => ({
      name: s.name.split(' ')[0], // Short label: "Direct", "Passive", "Active", "Commodity"
      fullName: s.name,
      gain: s.gain,
      gainPct: s.gainPct,
      color: s.color
    }));
  }, [strategyLens]);
  // ── PORTFOLIO QUALITY & AI HEALTH MATRIX ──
  const qualityMatrix = useMemo(() => {
    const scoredStocks = stocksList.filter(s => s.score != null);
    if (scoredStocks.length === 0) return null;

    const totalScoredVal = scoredStocks.reduce((sum, s) => sum + (s.live_value || s.value || 0), 0);
    const weightedScore = totalScoredVal > 0
      ? Math.round(scoredStocks.reduce((sum, s) => sum + (s.score * (s.live_value || s.value || 0)), 0) / totalScoredVal)
      : Math.round(scoredStocks.reduce((sum, s) => sum + s.score, 0) / scoredStocks.length);

    let exceptionalVal = 0, strongVal = 0, moderateVal = 0, riskVal = 0;
    let aiCount = 0, algoCount = 0;

    for (const s of scoredStocks) {
      const val = s.live_value || s.value || 0;
      if (s.is_ai_score) aiCount++;
      else algoCount++;

      if (s.score >= 80) exceptionalVal += val;
      else if (s.score >= 65) strongVal += val;
      else if (s.score >= 50) moderateVal += val;
      else riskVal += val;
    }

    const safeVal = totalScoredVal > 0 ? totalScoredVal : 1;
    const tierPcts = {
      exceptional: (exceptionalVal / safeVal) * 100,
      strong: (strongVal / safeVal) * 100,
      moderate: (moderateVal / safeVal) * 100,
      risk: (riskVal / safeVal) * 100
    };

    const label = weightedScore >= 80 ? 'Exceptional Institutional Quality'
      : weightedScore >= 65 ? 'Strong Balanced Quality'
      : weightedScore >= 50 ? 'Moderate Defensive Grade'
      : 'High Risk / Review Required';

    const color = weightedScore >= 80 ? '#205ea6'
      : weightedScore >= 65 ? '#4d6d13'
      : weightedScore >= 50 ? '#ad8301'
      : '#af3029';

    return {
      weightedScore,
      label,
      color,
      totalScoredVal,
      tierPcts,
      aiCount,
      algoCount,
      totalStocks: scoredStocks.length
    };
  }, [stocksList]);

  // ── TOP 10 HOLDINGS ──
  const top10 = useMemo(() => {
    const all = [
      ...stocksList.map(s => ({
        name: s.name || s.symbol, symbol: s.symbol,
        value: s.live_value ?? s.value ?? 0, gain: s.gain || 0,
        type: s.subtype === 'ETF' ? 'ETF' : 'Stock',
        score: s.score,
        is_ai_score: s.is_ai_score
      })),
      ...mutualFundsList.map(m => ({
        name: m.name, symbol: null,
        value: m.value || 0, gain: m.gain || 0, type: 'MF'
      })),
      ...bondsList.map(b => ({
        name: b.name, symbol: null,
        value: b.live_value ?? b.value ?? 0, gain: b.gain || 0,
        type: b.subtype === 'SGB' ? 'SGB' : 'Bond'
      }))
    ];
    const sorted = all.sort((a, b) => b.value - a.value).slice(0, 10);
    const maxVal = sorted.length > 0 ? sorted[0].value : 1;
    let cumPct = 0;
    return sorted.map(h => {
      const pct = (h.value / safeTotal) * 100;
      cumPct += pct;
      return { ...h, pct, cumPct, barWidth: (h.value / maxVal) * 100 };
    });
  }, [stocksList, mutualFundsList, bondsList, safeTotal]);

  const TYPE_COLORS = { Stock: '#4393E5', ETF: '#8B5CF6', MF: '#06B6D4', SGB: '#F59E0B', Bond: '#9CA3AF' };

  return (
    <div className="space-y-6">
      {/* ── PORTFOLIO QUALITY & AI HEALTH SCORE MATRIX ── */}
      {qualityMatrix && (
        <div className="bg-card rounded-xl border border-border/40 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/30">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <Sparkles className="w-4 h-4 text-info" />
                <h3 className="text-base font-semibold text-foreground">
                  Portfolio Quality & Health Matrix
                </h3>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-info/10 text-info border border-info/30 uppercase tracking-wider font-mono">
                  {qualityMatrix.aiCount} AI Evaluated • {qualityMatrix.algoCount} Algo
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Capital-weighted equity health score combining Fin-LLM qualitative analysis & fundamental balance sheet metrics.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0 self-start sm:self-auto">
              <div className="text-right">
                <div className="font-serif text-3xl font-bold font-mono text-foreground flex items-center justify-end gap-1.5">
                  <span style={{ color: qualityMatrix.color }}>{qualityMatrix.weightedScore}</span>
                  <span className="text-sm font-sans font-normal text-muted-foreground">/ 100</span>
                </div>
                <div className="text-[11px] font-semibold" style={{ color: qualityMatrix.color }}>
                  {qualityMatrix.label}
                </div>
              </div>
            </div>
          </div>

          {/* Segmented Quality Progress Bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1.5">
              <span>Capital Distribution by Quality Tier</span>
              <span className="font-mono">
                {qualityMatrix.tierPcts.exceptional.toFixed(0)}% Exceptional • {qualityMatrix.tierPcts.strong.toFixed(0)}% Strong
              </span>
            </div>
            <div className="w-full h-3 rounded-full bg-muted/50 overflow-hidden flex shadow-inner">
              {qualityMatrix.tierPcts.exceptional > 0 && (
                <div
                  className="h-full bg-info transition-all duration-500"
                  style={{ width: `${qualityMatrix.tierPcts.exceptional}%` }}
                  title={`Exceptional (80-100): ${qualityMatrix.tierPcts.exceptional.toFixed(1)}%`}
                />
              )}
              {qualityMatrix.tierPcts.strong > 0 && (
                <div
                  className="h-full bg-success transition-all duration-500"
                  style={{ width: `${qualityMatrix.tierPcts.strong}%` }}
                  title={`Strong (65-79): ${qualityMatrix.tierPcts.strong.toFixed(1)}%`}
                />
              )}
              {qualityMatrix.tierPcts.moderate > 0 && (
                <div
                  className="h-full bg-warning transition-all duration-500"
                  style={{ width: `${qualityMatrix.tierPcts.moderate}%` }}
                  title={`Moderate (50-64): ${qualityMatrix.tierPcts.moderate.toFixed(1)}%`}
                />
              )}
              {qualityMatrix.tierPcts.risk > 0 && (
                <div
                  className="h-full bg-destructive transition-all duration-500"
                  style={{ width: `${qualityMatrix.tierPcts.risk}%` }}
                  title={`High Risk (<50): ${qualityMatrix.tierPcts.risk.toFixed(1)}%`}
                />
              )}
            </div>

            {/* Quality Legend */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 pt-3 border-t border-border/20 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-info shrink-0" />
                <div>
                  <div className="font-medium text-foreground">Exceptional (≥80)</div>
                  <div className="text-[11px] text-muted-foreground font-mono">{qualityMatrix.tierPcts.exceptional.toFixed(1)}% capital</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-success shrink-0" />
                <div>
                  <div className="font-medium text-foreground">Strong (65-79)</div>
                  <div className="text-[11px] text-muted-foreground font-mono">{qualityMatrix.tierPcts.strong.toFixed(1)}% capital</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-warning shrink-0" />
                <div>
                  <div className="font-medium text-foreground">Moderate (50-64)</div>
                  <div className="text-[11px] text-muted-foreground font-mono">{qualityMatrix.tierPcts.moderate.toFixed(1)}% capital</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-destructive shrink-0" />
                <div>
                  <div className="font-medium text-foreground">High Risk (&lt;50)</div>
                  <div className="text-[11px] text-muted-foreground font-mono">{qualityMatrix.tierPcts.risk.toFixed(1)}% capital</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ROW 1: ASSET ALLOCATION + STRATEGY LENS (Side by Side) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DonutSection
          title="Asset allocation"
          data={assetAllocation}
          centerLabel="Asset allocation"
        />
        <DonutSection
          title="Strategy & investment lens"
          data={strategyLens}
          centerLabel="Strategy lens"
        />
      </div>

      {/* ── ROW 2: ASSET CLASS P&L COMPARISON ── */}
      {plData.length > 0 && (
        <div className="bg-card rounded-xl border border-border/40 p-5">
          <h3 className="text-base font-semibold text-foreground mb-1">Asset class P&L comparison</h3>
          <p className="text-xs text-muted-foreground mb-5">Unrealized gains (₹) and ROI (%) by investment strategy</p>

          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={plData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                axisLine={{ stroke: 'var(--border)', opacity: 0.4 }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => {
                  const abs = Math.abs(v);
                  if (abs >= 100000) return `${v < 0 ? '-' : ''}₹${(abs / 100000).toFixed(1)}L`;
                  if (abs >= 1000) return `${v < 0 ? '-' : ''}₹${(abs / 1000).toFixed(0)}K`;
                  return `₹${v}`;
                }}
              />
              <Tooltip content={<BarTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.2 }} />
              <Bar dataKey="gain" radius={[6, 6, 0, 0]} maxBarSize={64}>
                {plData.map((entry, i) => (
                  <Cell key={i} fill={entry.gain >= 0 ? 'var(--success)' : 'var(--destructive)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* P&L Summary Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-border/30">
            {strategyLens.map((s, i) => (
              <div key={i} className="text-center">
                <div className="text-[11px] text-muted-foreground mb-0.5">{s.name}</div>
                <div className={`text-sm font-semibold font-mono ${s.gain >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {s.gain >= 0 ? '+' : ''}{s.gainPct.toFixed(2)}% ROI
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── ROW 3: TOP 10 HOLDINGS CONCENTRATION ── */}
      {top10.length > 0 && (
        <div className="bg-card rounded-xl border border-border/40 p-5">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-base font-semibold text-foreground">Top 10 holdings concentration</h3>
            <div className="text-xs text-muted-foreground font-mono">
              Top 10 = {top10.length > 0 ? top10[top10.length - 1].cumPct.toFixed(1) : 0}% of portfolio
            </div>
          </div>
          <p className="text-xs text-muted-foreground mb-5">Capital allocation by position size — higher concentration increases risk</p>

          <div className="space-y-0 divide-y divide-border/20">
            {/* Header */}
            <div className="grid grid-cols-[2rem_1fr_6rem_8rem_5rem] gap-3 pb-2 text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
              <span>#</span>
              <span>Holding</span>
              <span className="text-center">Score</span>
              <span className="text-right">Value</span>
              <span className="text-right">Weight</span>
            </div>
            {/* Rows */}
            {top10.map((h, i) => (
              <div key={i} className="grid grid-cols-[2rem_1fr_6rem_8rem_5rem] gap-3 py-3 items-center">
                <span className="text-xs text-muted-foreground font-mono">{i + 1}</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground truncate">{h.name}</span>
                    <span
                      className="shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded uppercase"
                      style={{ backgroundColor: `${TYPE_COLORS[h.type]}15`, color: TYPE_COLORS[h.type], border: `1px solid ${TYPE_COLORS[h.type]}30` }}
                    >
                      {h.type}
                    </span>
                  </div>
                  {/* Inline progress bar */}
                  <div className="w-full h-1.5 bg-muted rounded-full mt-1.5 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${h.barWidth}%`, backgroundColor: TYPE_COLORS[h.type] || '#4393E5' }}
                    />
                  </div>
                </div>
                {/* Score Pill */}
                <div className="text-center">
                  {h.score != null ? (
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono border ${
                        h.score >= 80 ? 'bg-info/10 text-info border-info/30'
                        : h.score >= 65 ? 'bg-success/10 text-success border-success/30'
                        : h.score >= 50 ? 'bg-warning/10 text-warning border-warning/30'
                        : 'bg-destructive/10 text-destructive border-destructive/30'
                      }`}
                      title={h.is_ai_score ? 'AI 360° Score' : 'Algorithm Score'}
                    >
                      {h.is_ai_score ? <Sparkles className="w-2.5 h-2.5 text-info" /> : <Cpu className="w-2.5 h-2.5 text-muted-foreground" />}
                      <span>{h.score}</span>
                    </span>
                  ) : (
                    <span className="text-[11px] text-muted-foreground font-mono">—</span>
                  )}
                </div>
                <div className="text-right font-mono text-sm font-medium text-foreground">
                  {fmtFull(h.value)}
                </div>
                <div className="text-right font-mono text-sm font-medium text-foreground">
                  {h.pct.toFixed(2)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── ROW 4: PORTFOLIO GROWTH CHART ── */}
      <PortfolioGrowthChart
        historicalValuations={historicalValuations}
        chartMetric={chartMetric}
        onChartMetricChange={onChartMetricChange}
      />

      {/* ── ROW 5: TRANSACTION LEDGER ── */}
      <TransactionsLedger transactions={transactionsList} />
    </div>
  );
}
