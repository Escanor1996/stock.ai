import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid
} from 'recharts';
import { BarChart3, TrendingUp, CheckCircle, AlertTriangle, ArrowUpRight } from 'lucide-react';

export default function QuarterlyAnalysis({ financials, currencySymbol = "₹ Cr" }) {
  const [viewMode, setViewMode] = useState('abs'); // 'abs' or 'growth'

  if (!financials || financials.length === 0) return null;

  return (
    <div className="glass-card p-6 space-y-6">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-success" />
            <h2 className="text-base font-bold text-foreground tracking-wide">Quarterly Financial Performance & Beat/Miss Analysis</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Historical top-line revenue, net profit after tax (PAT), and operating EBITDA margins.
          </p>
        </div>

        {/* View Switcher Controls */}
        <div className="flex items-center bg-muted/60 p-1 rounded-full border border-border/40 self-start sm:self-auto">
          <button
            onClick={() => setViewMode('abs')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'abs'
                ? 'bg-foreground text-background shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Absolute Values ({currencySymbol})
          </button>
          <button
            onClick={() => setViewMode('growth')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'growth'
                ? 'bg-foreground text-background shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            YoY Growth %
          </button>
        </div>
      </div>

      {/* Financial Bar Chart */}
      <div className="w-full h-72 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={financials} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 0, 0, 0.06)" />
            <XAxis dataKey="quarter" tick={{ fill: '#6f6e69', fontSize: 12 }} />
            <YAxis tick={{ fill: '#6f6e69', fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(51, 59%, 95%)',
                borderColor: 'hsl(51, 21%, 88%)',
                borderRadius: '8px',
                color: '#100f0f',
                fontSize: '12px'
              }}
              formatter={(val, name) => [
                viewMode === 'growth' ? `${val}%` : `${val} ${currencySymbol}`,
                name === 'revenue' ? 'Revenue' : name === 'pat' ? 'PAT (Net Profit)' : name
              ]}
            />
            <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }} />
            <Bar
              dataKey={viewMode === 'growth' ? 'revGrowthYoY' : 'revenue'}
              name={viewMode === 'growth' ? 'Revenue Growth YoY %' : `Revenue (${currencySymbol})`}
              fill="#205ea6"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey={viewMode === 'growth' ? 'patGrowthYoY' : 'pat'}
              name={viewMode === 'growth' ? 'PAT Growth YoY %' : `Net Profit (${currencySymbol})`}
              fill="#4d6d13"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Detailed Financial Data Table */}
      <div className="overflow-x-auto rounded-xl border border-border/40">
        <table className="w-full text-left text-xs text-foreground">
          <thead className="bg-muted/30 text-muted-foreground uppercase font-semibold text-[11px] tracking-wider border-b border-border/40">
            <tr>
              <th className="px-4 py-3">Quarter</th>
              <th className="px-4 py-3">Revenue ({currencySymbol})</th>
              <th className="px-4 py-3">Net Profit ({currencySymbol})</th>
              <th className="px-4 py-3">EBITDA Margin</th>
              <th className="px-4 py-3">EPS</th>
              <th className="px-4 py-3 text-right">Consensus Outcome</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30 font-mono">
            {financials.map((row, idx) => (
              <tr key={idx} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-sans font-semibold text-foreground">{row.quarter}</td>
                <td className="px-4 py-3">
                  <div className="font-semibold">{row.revenue}</div>
                  <div className="text-[10px] text-success font-sans flex items-center gap-0.5">
                    <ArrowUpRight className="w-3 h-3" /> +{row.revGrowthYoY}% YoY
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="font-semibold text-success">{row.pat}</div>
                  <div className="text-[10px] text-success/80 font-sans flex items-center gap-0.5">
                    <ArrowUpRight className="w-3 h-3" /> +{row.patGrowthYoY}% YoY
                  </div>
                </td>
                <td className="px-4 py-3 font-semibold text-foreground">{row.ebitdaMargin}%</td>
                <td className="px-4 py-3 font-semibold text-foreground">₹{row.eps}</td>
                <td className="px-4 py-3 text-right font-sans">
                  {row.beat ? (
                    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-success/10 text-success border border-success/30">
                      <CheckCircle className="w-3 h-3" /> Beat Consensus
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-warning/10 text-warning border border-warning/30">
                      <AlertTriangle className="w-3 h-3" /> In Line
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
