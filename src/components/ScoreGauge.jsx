import React from 'react';
import { Award, ShieldCheck, Sparkles, TrendingUp, Cpu, BarChart2 } from 'lucide-react';

export default function ScoreGauge({ stock, onTriggerAI, isAILoading }) {
  if (!stock) return null;

  const staticScore = stock.staticScore ?? stock.score ?? 50;
  const staticCategory = stock.staticCategory ?? stock.scoreCategory ?? 'Moderate';

  const hasAI = Boolean(stock.hasAIAnalysis && stock.aiScore != null);
  const aiScore = stock.aiScore;
  const aiCategory = stock.aiCategory || 'Pending';

  const getTheme = (val) => {
    if (val >= 80) {
      return {
        stroke: '#06b6d4', // cyan
        text: 'text-cyan-400',
        bg: 'from-cyan-500/20 to-blue-600/10',
        badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
        label: 'Exceptional'
      };
    } else if (val >= 65) {
      return {
        stroke: '#10b981', // emerald
        text: 'text-emerald-400',
        bg: 'from-emerald-500/20 to-teal-600/10',
        badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        label: 'Strong'
      };
    } else if (val >= 50) {
      return {
        stroke: '#f59e0b', // amber
        text: 'text-amber-400',
        bg: 'from-amber-500/20 to-yellow-600/10',
        badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        label: 'Moderate'
      };
    } else {
      return {
        stroke: '#f43f5e', // rose
        text: 'text-rose-400',
        bg: 'from-rose-500/20 to-red-600/10',
        badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
        label: 'High Risk'
      };
    }
  };

  const staticTheme = getTheme(staticScore);
  const staticOffset = 314 - (314 * staticScore) / 100;

  const aiTheme = hasAI ? getTheme(aiScore) : null;
  const aiOffset = hasAI ? 314 - (314 * aiScore) / 100 : 314;

  return (
    <div className="glass-panel rounded-2xl p-5 border border-slate-800 relative overflow-hidden flex flex-col justify-between">
      {/* Background Accent Glow */}
      <div className={`absolute -top-12 -right-12 w-64 h-64 rounded-full bg-gradient-to-br ${staticTheme.bg} blur-3xl opacity-40 pointer-events-none`}></div>

      {/* Header */}
      <div className="flex items-center justify-between z-10 border-b border-slate-800/80 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 text-emerald-400" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">
            stock.ai 360° Score Matrix
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400">Dual-Engine Model</span>
        </div>
      </div>

      {/* Side-by-Side Dual Gauges */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-2 z-10">
        
        {/* Left Gauge: Deterministic Financial Score */}
        <div className="bg-slate-900/70 rounded-xl p-4 border border-slate-800/90 flex flex-col items-center text-center relative group">
          <div className="flex items-center justify-between w-full mb-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <BarChart2 className="w-3.5 h-3.5 text-emerald-400" /> Static Financial
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${staticTheme.badge}`}>
              {staticCategory}
            </span>
          </div>

          <div className="relative w-32 h-32 my-2 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
              <circle
                cx="60"
                cy="60"
                r="50"
                stroke="rgba(255,255,255,0.07)"
                strokeWidth="10"
                fill="transparent"
              />
              <circle
                cx="60"
                cy="60"
                r="50"
                stroke={staticTheme.stroke}
                strokeWidth="10"
                strokeLinecap="round"
                fill="transparent"
                strokeDasharray="314"
                strokeDashoffset={staticOffset}
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className={`text-3xl font-black ${staticTheme.text}`}>
                {staticScore}
              </span>
              <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">out of 100</span>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 mt-1 leading-snug">
            100% deterministic score based on ROE, ROCE, margin growth & leverage.
          </p>
        </div>

        {/* Right Gauge: AI 360° Qualitative Score */}
        <div className="bg-slate-900/70 rounded-xl p-4 border border-slate-800/90 flex flex-col items-center text-center relative group">
          <div className="flex items-center justify-between w-full mb-1">
            <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> AI 360° Verdict
            </span>
            {hasAI ? (
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${aiTheme.badge}`}>
                {aiCategory}
              </span>
            ) : (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold border border-slate-700 text-slate-400 bg-slate-800/80">
                Awaiting
              </span>
            )}
          </div>

          {hasAI ? (
            <div className="relative w-32 h-32 my-2 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  stroke="rgba(255,255,255,0.07)"
                  strokeWidth="10"
                  fill="transparent"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  stroke={aiTheme.stroke}
                  strokeWidth="10"
                  strokeLinecap="round"
                  fill="transparent"
                  strokeDasharray="314"
                  strokeDashoffset={aiOffset}
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center">
                <span className={`text-3xl font-black ${aiTheme.text}`}>
                  {aiScore}
                </span>
                <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">out of 100</span>
              </div>
            </div>
          ) : (
            <div className="relative w-32 h-32 my-2 flex items-center justify-center border-2 border-dashed border-slate-800 rounded-full">
              <div className="flex flex-col items-center justify-center p-2 text-center">
                <Cpu className="w-6 h-6 text-slate-600 mb-1" />
                <span className="text-[10px] text-slate-400 font-semibold leading-tight">Click Generate Below</span>
              </div>
            </div>
          )}

          <div className="flex items-center gap-1.5 mt-1">
            {hasAI && stock.engine && (
              <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded border ${stock.engine.includes('Gemini') ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' : 'bg-slate-800 text-slate-300 border-slate-700'}`}>
                {stock.engine}
              </span>
            )}
            <span className="text-[11px] text-slate-400 leading-snug">
              {hasAI ? 'Includes Future Potential (20%) & Governance (20%).' : 'Awaiting LLM multi-pillar synthesis.'}
            </span>
          </div>
        </div>
      </div>

      {/* Real Fundamental Sub-Pillars */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 z-10">
        {/* Capital Efficiency */}
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/50 border border-slate-800/80">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] text-slate-400 font-medium">Capital Efficiency</div>
              <div className="text-xs font-bold text-slate-200">
                {stock?.roe != null && stock.roe !== 'N/A' ? `ROE ${stock.roe}` : 'ROE N/A'}
                {stock?.roce != null && stock.roce !== 'N/A' && (
                  <span className="text-[11px] font-normal text-slate-400 ml-1.5">· ROCE {stock.roce}</span>
                )}
              </div>
            </div>
          </div>
          <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">Active</span>
        </div>

        {/* Solvency & Valuation */}
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/50 border border-slate-800/80">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] text-slate-400 font-medium">Solvency & Valuation</div>
              <div className="text-xs font-bold text-slate-200">
                {stock?.debtToEquity != null ? `D/E ${stock.debtToEquity}` : 'D/E N/A'}
                {stock?.peRatio ? (
                  <span className="text-[11px] font-normal text-slate-400 ml-1.5">{`· P/E ${stock.peRatio}x`}</span>
                ) : null}
              </div>
            </div>
          </div>
          <span className="text-[10px] font-semibold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">Live</span>
        </div>
      </div>
    </div>
  );
}
