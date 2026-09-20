import React from 'react';
import { Award, ShieldCheck, Zap, TrendingUp } from 'lucide-react';

export default function ScoreGauge({ score, category, stock }) {
  // Determine color theme based on 0-100 score
  const getScoreTheme = (val) => {
    if (val >= 80) {
      return {
        stroke: '#06b6d4', // cyan
        text: 'text-emerald-400',
        bg: 'from-emerald-500/20 to-blue-600/10',
        badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        glow: 'glow-cyan',
        label: 'Exceptional'
      };
    } else if (val >= 65) {
      return {
        stroke: '#10b981', // emerald
        text: 'text-emerald-400',
        bg: 'from-emerald-500/20 to-teal-600/10',
        badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        glow: 'glow-emerald',
        label: 'Strong'
      };
    } else if (val >= 50) {
      return {
        stroke: '#f59e0b', // amber
        text: 'text-amber-400',
        bg: 'from-amber-500/20 to-yellow-600/10',
        badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        glow: 'glow-amber',
        label: 'Moderate'
      };
    } else {
      return {
        stroke: '#f43f5e', // rose
        text: 'text-rose-400',
        bg: 'from-rose-500/20 to-red-600/10',
        badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
        glow: 'glow-rose',
        label: 'High Risk'
      };
    }
  };

  const theme = getScoreTheme(score);
  const strokeDashoffset = 440 - (440 * score) / 100;

  return (
    <div className="glass-panel rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between border border-slate-800">
      {/* Subtle Background Glow */}
      <div className={`absolute -top-12 -right-12 w-48 h-48 rounded-full bg-gradient-to-br ${theme.bg} blur-3xl opacity-60 pointer-events-none`}></div>

      {/* Header Label */}
      <div className="flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 text-emerald-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">stock.ai 360° Score</span>
        </div>
        <span className={`text-xs px-3 py-1 rounded-full font-medium border ${theme.badge}`}>
          {category || theme.label}
        </span>
      </div>

      {/* Main Wheel & Score Display */}
      <div className="flex flex-col md:flex-row items-center justify-around my-6 gap-6 z-10">
        <div className="relative w-44 h-44 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 160 160">
            {/* Background Ring */}
            <circle
              cx="80"
              cy="80"
              r="70"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="12"
              fill="transparent"
            />
            {/* Progress Arc */}
            <circle
              cx="80"
              cy="80"
              r="70"
              stroke={theme.stroke}
              strokeWidth="12"
              strokeLinecap="round"
              fill="transparent"
              strokeDasharray="440"
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-1000 ease-out"
            />
          </svg>

          {/* Centered Score */}
          <div className="absolute flex flex-col items-center justify-center text-center">
            <span className={`text-4xl font-extrabold ${theme.text} tracking-tight`}>
              {score}
            </span>
            <span className="text-[10px] text-slate-400 font-medium uppercase tracking-widest mt-0.5">out of 100</span>
          </div>
        </div>

        {/* Side Fundamental Pillars */}
        <div className="flex flex-col gap-3 w-full md:w-auto">
          {/* Capital Efficiency (ROE & ROCE) */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 min-w-[210px]">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs text-slate-400 font-medium">Capital Efficiency</div>
                <div className="text-sm font-bold text-slate-100">
                  {stock?.roe != null && stock.roe !== 'N/A' ? `ROE ${stock.roe}` : 'ROE N/A'}
                  {stock?.roce != null && stock.roce !== 'N/A' && (
                    <span className="text-xs font-normal text-slate-400 ml-1.5">· ROCE {stock.roce}</span>
                  )}
                </div>
              </div>
            </div>
            <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">Active</span>
          </div>

          {/* Solvency & Valuation (D/E & P/E) */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 min-w-[210px]">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs text-slate-400 font-medium">Solvency & Valuation</div>
                <div className="text-sm font-bold text-slate-100">
                  {stock?.debtToEquity != null ? `D/E ${stock.debtToEquity}` : 'D/E N/A'}
                  {stock?.peRatio ? (
                    <span className="text-xs font-normal text-slate-400 ml-1.5">{`· P/E ${stock.peRatio}x`}</span>
                  ) : null}
                </div>
              </div>
            </div>
            <span className="text-xs font-semibold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">Live</span>
          </div>
        </div>
      </div>

      {/* Percentile Rank Banner */}
      <div className="z-10 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
        <span className="flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
          Outperforms <strong className="text-slate-200">89%</strong> of sector peers
        </span>
        <span className="text-[11px] text-slate-500">Updated Real-Time</span>
      </div>
    </div>
  );
}
