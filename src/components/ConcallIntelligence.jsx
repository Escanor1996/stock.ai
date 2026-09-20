import React from 'react';
import { MessageSquareText, Award, CheckCircle, Target, Sparkles, TrendingUp } from 'lucide-react';

export default function ConcallIntelligence({ concall, walkTheTalkScore }) {
  if (!concall) return null;

  return (
    <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <MessageSquareText className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-slate-100 tracking-wide">Concall Intelligence & "Walk-The-Talk" Guidance Score</h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            AI synthesis of earnings call commentary and tracking of management guidance vs actual execution over 8+ quarters.
          </p>
        </div>

        <div className="flex items-center gap-3 bg-slate-900/90 px-4 py-2 rounded-xl border border-slate-800">
          <Award className="w-4 h-4 text-emerald-400" />
          <span className="text-xs text-slate-400">Credibility Index:</span>
          <span className="text-lg font-extrabold text-emerald-400">{walkTheTalkScore}/100</span>
        </div>
      </div>

      {/* Highlights & Sentiment */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Sentiment Card */}
        <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Management Tone</span>
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
          <div className="my-3">
            <div className="text-sm font-bold text-slate-300">{concall.latestQuarter}</div>
            <div className="text-lg font-extrabold text-emerald-400 mt-1">{concall.sentimentScore}</div>
          </div>
          <span className="text-[11px] text-slate-500">Extracted from 45-min audio Q&A</span>
        </div>

        {/* AI Key Insights Bullet Points */}
        <div className="md:col-span-2 bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-2.5">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> Executive Strategic Guidance & Takeaways
          </h4>
          <ul className="space-y-1.5 text-xs text-slate-300">
            {concall.keyHighlights.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* "Walk the Talk" Guidance Tracker Table */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
          <Target className="w-3.5 h-3.5 text-emerald-400" /> Historical Guidance vs Actual Delivery
        </h4>
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/90 text-slate-400 uppercase font-semibold text-[11px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-4 py-2.5">Quarter</th>
                <th className="px-4 py-2.5">Management Promised Target</th>
                <th className="px-4 py-2.5">Actual Delivered Result</th>
                <th className="px-4 py-2.5 text-right">Execution Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {concall.guidanceHistory.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-800/40">
                  <td className="px-4 py-3 font-sans font-semibold text-slate-100">{item.quarter}</td>
                  <td className="px-4 py-3 font-sans text-slate-300">{item.promised}</td>
                  <td className="px-4 py-3 font-semibold text-emerald-400 font-sans">{item.delivered}</td>
                  <td className="px-4 py-3 text-right font-sans">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      <CheckCircle className="w-3 h-3" /> {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
