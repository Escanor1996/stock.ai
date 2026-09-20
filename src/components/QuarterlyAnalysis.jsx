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
    <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-6">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-slate-100 tracking-wide">Quarterly Financial Performance & Beat/Miss Analysis</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Historical top-line revenue, net profit after tax (PAT), and operating EBITDA margins.
          </p>
        </div>

        {/* View Switcher Controls */}
        <div className="flex items-center bg-slate-900/90 p-1 rounded-xl border border-slate-800 self-start sm:self-auto">
          <button
            onClick={() => setViewMode('abs')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'abs'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Absolute Values ({currencySymbol})
          </button>
          <button
            onClick={() => setViewMode('growth')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'growth'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-slate-200'
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
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
            <XAxis dataKey="quarter" tick={{ fill: '#94a3b8', fontSize: 12 }} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0f172a',
                borderColor: '#334155',
                borderRadius: '8px',
                color: '#f8fafc',
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
              fill="#06b6d4"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey={viewMode === 'growth' ? 'patGrowthYoY' : 'pat'}
              name={viewMode === 'growth' ? 'PAT Growth YoY %' : `Net Profit (${currencySymbol})`}
              fill="#10b981"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Detailed Financial Data Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-900/90 text-slate-400 uppercase font-semibold text-[11px] tracking-wider border-b border-slate-800">
            <tr>
              <th className="px-4 py-3">Quarter</th>
              <th className="px-4 py-3">Revenue ({currencySymbol})</th>
              <th className="px-4 py-3">Net Profit ({currencySymbol})</th>
              <th className="px-4 py-3">EBITDA Margin</th>
              <th className="px-4 py-3">EPS</th>
              <th className="px-4 py-3 text-right">Consensus Outcome</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {financials.map((row, idx) => (
              <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                <td className="px-4 py-3 font-sans font-semibold text-slate-100">{row.quarter}</td>
                <td className="px-4 py-3">
                  <div className="font-semibold">{row.revenue}</div>
                  <div className="text-[10px] text-emerald-400 font-sans flex items-center gap-0.5">
                    <ArrowUpRight className="w-3 h-3" /> +{row.revGrowthYoY}% YoY
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="font-semibold text-emerald-400">{row.pat}</div>
                  <div className="text-[10px] text-emerald-500/80 font-sans flex items-center gap-0.5">
                    <ArrowUpRight className="w-3 h-3" /> +{row.patGrowthYoY}% YoY
                  </div>
                </td>
                <td className="px-4 py-3 font-semibold text-slate-200">{row.ebitdaMargin}%</td>
                <td className="px-4 py-3 font-semibold text-slate-200">₹{row.eps}</td>
                <td className="px-4 py-3 text-right font-sans">
                  {row.beat ? (
                    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      <CheckCircle className="w-3 h-3" /> Beat Consensus
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/30">
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
