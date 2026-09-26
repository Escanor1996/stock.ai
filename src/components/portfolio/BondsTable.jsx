import React from 'react';

export default function BondsTable({ bonds = [] }) {
  if (!bonds || bonds.length === 0) {
    return (
      <div className="rounded-xl border border-border/40 bg-card/70 p-8 text-center text-muted-foreground text-xs">
        No bonds or Sovereign Gold Bonds in this portfolio.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border/40 bg-card/70 backdrop-blur-xl">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-border/40 bg-muted/30 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
            <th className="py-3 px-4">Security Name</th>
            <th className="py-3 px-4 text-center">Type</th>
            <th className="py-3 px-4 text-right">Units / Grams</th>
            <th className="py-3 px-4 text-right">Issue / Face Price</th>
            <th className="py-3 px-4 text-right">Holding Value</th>
            <th className="py-3 px-4 text-right">Weight %</th>
          </tr>
        </thead>

        <tbody className="divide-y divide-border/30 text-xs">
          {bonds.map((bd, idx) => (
            <tr key={idx} className="hover:bg-muted/30 transition-colors duration-150">
              <td className="py-3.5 px-4">
                <div className="font-semibold text-foreground">{bd.name}</div>
                <div className="text-[10px] text-muted-foreground font-mono mt-0.5">{bd.isin}</div>
              </td>
              <td className="py-3.5 px-4 text-center">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                    bd.subtype === 'SGB'
                      ? 'bg-warning/10 text-warning border border-warning/30'
                      : 'bg-muted text-muted-foreground border border-border'
                  }`}
                >
                  {bd.subtype === 'SGB' ? 'Sovereign Gold Bond' : 'Corporate Debt'}
                </span>
              </td>
              <td className="py-3.5 px-4 text-right text-foreground font-mono font-medium">
                {bd.quantity}
              </td>
              <td className="py-3.5 px-4 text-right text-muted-foreground font-mono">
                ₹{bd.price.toFixed(2)}
              </td>
              <td className="py-3.5 px-4 text-right font-bold text-foreground font-mono">
                ₹{bd.value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </td>
              <td className="py-3.5 px-4 text-right font-mono text-muted-foreground">
                {(bd.weight_pct || 0).toFixed(2)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
