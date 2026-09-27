import React, { useMemo } from 'react';

export default function BondsTable({ bonds = [] }) {
  const bondsVal = useMemo(() => {
    return bonds.reduce((sum, b) => sum + (b.live_value || b.value || 0), 0);
  }, [bonds]);

  const bondsCostTotal = useMemo(() => {
    return bonds.reduce((sum, b) => {
      if (b.has_broker_buy_price) return sum + (b.cost_basis || 0);
      return sum + ((b.price || 0) * (b.quantity || 0));
    }, 0);
  }, [bonds]);

  const bondsGainTotal = useMemo(() => {
    return bonds.reduce((sum, b) => sum + (b.gain || 0), 0);
  }, [bonds]);

  const bondsGainPct = bondsCostTotal > 0 ? (bondsGainTotal / bondsCostTotal) * 100 : 0;

  const hasBrokerData = useMemo(() => {
    return bonds.some(b => b.has_broker_buy_price);
  }, [bonds]);

  if (!bonds || bonds.length === 0) {
    return (
      <div className="rounded-xl border border-border/40 bg-card/70 p-8 text-center text-muted-foreground text-xs">
        No bonds or Sovereign Gold Bonds in this portfolio.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── SUMMARY HIGHLIGHT STRIP ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Valuation */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold text-muted-foreground tracking-wider uppercase px-0.5">
            Total Bonds & SGB Valuation
          </div>
          <div className="glass-card p-4 space-y-0.5">
            <div className="font-serif text-xl font-bold text-success">
              ₹{bondsVal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-muted-foreground">
              {bonds.length} Active Gold & Debt Holdings
            </div>
          </div>
        </div>

        {/* Card 2: Cost Basis */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold text-muted-foreground tracking-wider uppercase px-0.5">
            Total Invested Cost Basis
          </div>
          <div className="glass-card p-4 space-y-0.5">
            <div className="font-mono text-xl font-bold text-foreground">
              ₹{bondsCostTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-muted-foreground">
              {hasBrokerData ? 'Broker avg buy price' : 'Issue / Face Price from CAS'}
            </div>
          </div>
        </div>

        {/* Card 3: Unrealized Gain */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold text-muted-foreground tracking-wider uppercase px-0.5">
            Unrealized Profit & Return
          </div>
          <div className="glass-card p-4 space-y-0.5">
            <div className={`font-mono text-xl font-bold ${bondsGainTotal >= 0 ? 'text-success' : 'text-destructive'}`}>
              {bondsGainTotal >= 0 ? '+' : ''}₹{Math.abs(bondsGainTotal).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </div>
            <div className={`text-xs font-medium ${bondsGainPct >= 0 ? 'text-success' : 'text-destructive'}`}>
              {bondsGainPct >= 0 ? '+' : ''}{bondsGainPct.toFixed(2)}% overall return
            </div>
          </div>
        </div>
      </div>

      {/* ── BONDS & SGB TABLE ── */}
      <div className="overflow-x-auto rounded-xl border border-border/40 bg-card/70 backdrop-blur-xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border/40 bg-muted/30 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              <th className="py-3 px-4">Security Name</th>
              <th className="py-3 px-4 text-center">Type</th>
              <th className="py-3 px-4 text-right">Units / Grams</th>
              <th className="py-3 px-4 text-right">Avg Buy Price</th>
              <th className="py-3 px-4 text-right">Current Price</th>
              <th className="py-3 px-4 text-right">Holding Value</th>
              <th className="py-3 px-4 text-right">Unrealized P&L</th>
              <th className="py-3 px-4 text-right">Weight %</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-border/30 text-xs">
            {bonds.map((bd, idx) => {
              const buyPrice = bd.has_broker_buy_price && bd.buy_price > 0 ? bd.buy_price : bd.price;
              const currentPrice = bd.closing_price || bd.live_price || bd.price || 0;
              const holdingVal = bd.live_value || bd.value || 0;
              const gainVal = bd.gain !== undefined ? bd.gain : (holdingVal - (bd.cost_basis || (buyPrice * bd.quantity)));
              const gainPctVal = bd.gain_pct !== undefined ? bd.gain_pct : (bd.cost_basis > 0 ? (gainVal / bd.cost_basis) * 100 : 0);

              return (
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
                  <td className="py-3.5 px-4 text-right font-mono">
                    {bd.has_broker_buy_price && bd.buy_price > 0 ? (
                      <div>
                        <div className="font-semibold text-foreground">₹{bd.buy_price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        {bd.price > 0 && Math.abs(bd.price - bd.buy_price) > 0.01 && (
                          <div className="text-[10px] text-muted-foreground">CAS: ₹{bd.price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">₹{(bd.price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-medium text-foreground">
                    ₹{currentPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-3.5 px-4 text-right font-bold text-foreground font-mono">
                    ₹{holdingVal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono">
                    {bd.has_broker_buy_price || bd.gain !== undefined ? (
                      <div>
                        <div className={`font-semibold ${gainVal >= 0 ? 'text-success' : 'text-destructive'}`}>
                          {gainVal >= 0 ? '+' : '-'}₹{Math.abs(gainVal).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </div>
                        <div className={`text-[10px] ${gainPctVal >= 0 ? 'text-success' : 'text-destructive'}`}>
                          {gainPctVal >= 0 ? '+' : ''}{gainPctVal.toFixed(2)}%
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-muted-foreground">
                    {(bd.weight_pct || 0).toFixed(2)}%
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
