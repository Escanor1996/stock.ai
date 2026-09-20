import React from 'react';
import { Layers, CheckCircle2 } from 'lucide-react';

export default function PeerComparison({ peers, currentSymbol }) {
  if (!peers || peers.length === 0) return null;

  return (
    <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <Layers className="w-5 h-5 text-emerald-400" />
        <div>
          <h2 className="text-base font-bold text-slate-100 tracking-wide">Sector Peer Valuation & Growth Matrix</h2>
          <p className="text-xs text-slate-400">Comparing financial multiples, return metrics, and stock.ai health ratings.</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-900/90 text-slate-400 uppercase font-semibold text-[11px] tracking-wider border-b border-slate-800">
            <tr>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">360° Score</th>
              <th className="px-4 py-3">P/E Ratio</th>
              <th className="px-4 py-3">EV/EBITDA</th>
              <th className="px-4 py-3">ROE %</th>
              <th className="px-4 py-3 text-right">YoY Rev Growth</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {peers.map((peer, idx) => {
              const isSelected = peer.symbol === currentSymbol;
              return (
                <tr
                  key={idx}
                  className={`transition-colors ${
                    isSelected ? 'bg-emerald-500/10 font-bold border-l-4 border-emerald-400' : 'hover:bg-slate-800/40'
                  }`}
                >
                  <td className="px-4 py-3 font-sans font-semibold text-slate-100 flex items-center gap-2">
                    {peer.name} ({peer.symbol})
                    {isSelected && (
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-sans">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-sans font-bold text-emerald-400">
                    {peer.score}/100
                  </td>
                  <td className="px-4 py-3">{peer.pe}x</td>
                  <td className="px-4 py-3">{peer.evEbitda}x</td>
                  <td className="px-4 py-3 text-emerald-400">{peer.roe}%</td>
                  <td className="px-4 py-3 text-right text-emerald-400">+{peer.revGrowth}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
