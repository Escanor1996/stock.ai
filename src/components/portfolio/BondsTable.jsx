import React, { useMemo } from 'react';

export default function BondsTable({ bonds = [] }) {
  const fmt = (n) => '₹' + Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });

  const bondsVal = useMemo(() => bonds.reduce((sum, b) => sum + (b.live_value || b.value || 0), 0), [bonds]);
  const bondsCostTotal = useMemo(() => {
    return bonds.reduce((sum, b) => {
      if (b.has_broker_buy_price) return sum + (b.cost_basis || 0);
      return sum + ((b.price || 0) * (b.quantity || 0));
    }, 0);
  }, [bonds]);
  const bondsGainTotal = useMemo(() => bonds.reduce((sum, b) => sum + (b.gain || 0), 0), [bonds]);
  const bondsGainPct = bondsCostTotal > 0 ? (bondsGainTotal / bondsCostTotal) * 100 : 0;

  if (!bonds || bonds.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border/40 p-10 text-center text-muted-foreground text-sm">
        No bonds or Sovereign Gold Bonds in this portfolio.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── SUMMARY HEADER CARD ── */}
      <div className="bg-card rounded-xl border border-border/40 p-5">
        <div className="text-[11px] font-semibold text-muted-foreground tracking-wider uppercase mb-3">
          Bonds &amp; SGB ({bonds.length})
        </div>

        <div className="font-serif text-2xl font-bold text-foreground mb-4">
          {fmt(bondsVal)}
        </div>

        <div className="grid grid-cols-3 gap-4 pt-3 border-t border-border/30">
          <div>
            <div className="text-[11px] text-muted-foreground mb-0.5">Invested value</div>
            <div className="text-sm font-semibold text-foreground font-mono">{fmt(bondsCostTotal)}</div>
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground mb-0.5">1D returns</div>
            <div className="text-sm font-semibold text-muted-foreground font-mono">₹0.00 (0.00%)</div>
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground mb-0.5">Total returns</div>
            <div className={`text-sm font-semibold font-mono ${bondsGainTotal >= 0 ? 'text-success' : 'text-destructive'}`}>
              {bondsGainTotal >= 0 ? '+' : '-'}{fmt(bondsGainTotal)} ({bondsGainPct.toFixed(2)}%)
            </div>
          </div>
        </div>
      </div>

      {/* ── TABLE ── */}
      <div className="bg-card rounded-xl border border-border/40 overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border/40 bg-muted/20 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              <th className="py-3 px-5">Security</th>
              <th className="py-3 px-5 text-right">Market price</th>
              <th className="py-3 px-5 text-right">Returns (%)</th>
              <th className="py-3 px-5 text-right">Current (Invested)</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-border/20">
            {bonds.map((bd, idx) => {
              const buyPrice = bd.has_broker_buy_price && bd.buy_price > 0 ? bd.buy_price : bd.price;
              const currentPrice = bd.closing_price || bd.live_price || bd.price || 0;
              const holdingVal = bd.live_value || bd.value || 0;
              const costBasis = bd.cost_basis || (buyPrice * (bd.quantity || 0));
              const gainVal = bd.gain !== undefined ? bd.gain : (holdingVal - costBasis);
              const gainPctVal = bd.gain_pct !== undefined ? bd.gain_pct : (costBasis > 0 ? (gainVal / costBasis) * 100 : 0);
              const isGain = gainVal >= 0;

              return (
                <tr key={idx} className="hover:bg-muted/30 transition-colors duration-150">
                  {/* Security */}
                  <td className="py-4 px-5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground text-sm">{bd.name}</span>
                      <span className={`shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded uppercase ${
                        bd.subtype === 'SGB'
                          ? 'bg-warning/10 text-warning border border-warning/30'
                          : 'bg-muted text-muted-foreground border border-border'
                      }`}>
                        {bd.subtype === 'SGB' ? 'SGB' : 'Debt'}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                      {bd.quantity} units • Avg. {fmt(buyPrice)}
                    </div>
                  </td>

                  {/* Market Price */}
                  <td className="py-4 px-5 text-right">
                    <div className="font-mono text-sm font-medium text-foreground">{fmt(currentPrice)}</div>
                    <div className="text-[11px] text-muted-foreground font-mono mt-0.5">0.00 (0.00%)</div>
                  </td>

                  {/* Returns */}
                  <td className="py-4 px-5 text-right">
                    {bd.has_broker_buy_price || bd.gain !== undefined ? (
                      <div>
                        <div className={`font-mono text-sm font-medium ${isGain ? 'text-success' : 'text-destructive'}`}>
                          {isGain ? '+' : '-'}{fmt(gainVal)}
                        </div>
                        <div className={`text-[11px] font-mono font-medium mt-0.5 ${isGain ? 'text-success' : 'text-destructive'}`}>
                          {gainPctVal.toFixed(2)}%
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </td>

                  {/* Current (Invested) */}
                  <td className="py-4 px-5 text-right">
                    <div className="font-mono text-sm font-semibold text-foreground">{fmt(holdingVal)}</div>
                    <div className="text-[11px] text-muted-foreground font-mono mt-0.5">{fmt(costBasis)}</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
