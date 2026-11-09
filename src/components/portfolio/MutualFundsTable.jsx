import React, { useMemo } from 'react';

export default function MutualFundsTable({
  mutualFunds = [],
  summary = {},
  searchQuery = ''
}) {
  const fmt = (n) => '₹' + Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });

  const mfVal = useMemo(() => mutualFunds.reduce((sum, m) => sum + (m.value || 0), 0), [mutualFunds]);
  const mfCostTotal = useMemo(() => mutualFunds.reduce((sum, m) => sum + (m.cost_basis || 0), 0), [mutualFunds]);
  const mfGainTotal = useMemo(() => mutualFunds.reduce((sum, m) => sum + (m.gain || 0), 0), [mutualFunds]);
  const mfGainPct = mfCostTotal > 0 ? (mfGainTotal / mfCostTotal) * 100 : 0;

  const filteredMutualFunds = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    let res = mutualFunds.filter(m => {
      if (!q) return true;
      return (
        (m.name && m.name.toLowerCase().includes(q)) ||
        (m.folio && m.folio.toLowerCase().includes(q)) ||
        (m.isin && m.isin.toLowerCase().includes(q)) ||
        (m.account_name && m.account_name.toLowerCase().includes(q))
      );
    });
    return [...res].sort((a, b) => (b.value || 0) - (a.value || 0));
  }, [mutualFunds, searchQuery]);

  return (
    <div className="space-y-4">
      {/* ── SUMMARY HEADER CARD ── */}
      <div className="bg-card rounded-xl border border-border/40 p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[11px] font-semibold text-muted-foreground tracking-wider uppercase">
            Mutual Funds ({mutualFunds.length})
          </div>
          {summary.mf_xirr !== undefined && summary.mf_xirr !== null && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-success/10 text-success border border-success/20 font-mono">
              XIRR: +{summary.mf_xirr}%
            </span>
          )}
        </div>

        <div className="font-serif text-2xl font-bold text-foreground mb-4">
          {fmt(mfVal)}
        </div>

        <div className="grid grid-cols-3 gap-4 pt-3 border-t border-border/30">
          <div>
            <div className="text-[11px] text-muted-foreground mb-0.5">Invested value</div>
            <div className="text-sm font-semibold text-foreground font-mono">{fmt(mfCostTotal)}</div>
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground mb-0.5">Source</div>
            <div className="text-sm font-semibold text-foreground">
              {summary.broker_source ? `${summary.broker_source} Statement` : 'CAMS / KFintech CAS'}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground mb-0.5">Total returns</div>
            <div className={`text-sm font-semibold font-mono ${mfGainTotal >= 0 ? 'text-success' : 'text-destructive'}`}>
              {mfGainTotal >= 0 ? '+' : '-'}{fmt(mfGainTotal)} ({mfGainPct.toFixed(2)}%)
            </div>
          </div>
        </div>
      </div>

      {/* ── TABLE ── */}
      <div className="bg-card rounded-xl border border-border/40 overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border/40 bg-muted/20 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              <th className="py-3 px-5">Scheme</th>
              <th className="py-3 px-5 text-right">NAV</th>
              <th className="py-3 px-5 text-right">Returns (%)</th>
              <th className="py-3 px-5 text-right">Current (Invested)</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-border/20">
            {filteredMutualFunds.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-10 text-center text-muted-foreground text-sm">
                  No mutual funds found.
                </td>
              </tr>
            ) : (
              filteredMutualFunds.map((mf, idx) => {
                const isGain = (mf.gain || 0) >= 0;
                const isClosed = (mf.quantity || 0) === 0;

                return (
                  <tr
                    key={idx}
                    className={`hover:bg-muted/30 transition-colors duration-150 ${isClosed ? 'opacity-40' : ''}`}
                  >
                    {/* Scheme */}
                    <td className="py-4 px-5">
                      <div className="font-semibold text-foreground text-sm max-w-md">
                        {mf.name}
                      </div>
                      <div className="flex items-center flex-wrap gap-1.5 mt-1 text-[11px] text-muted-foreground">
                        <span className="font-mono">{mf.quantity.toLocaleString('en-IN', { maximumFractionDigits: 3 })} units</span>
                        {mf.folio && <span>• Folio {mf.folio}</span>}
                        {(mf.broker_category || mf.category) && (
                          <span className="px-1.5 py-0.5 rounded bg-muted/60 text-foreground/80 text-[10px] font-medium border border-border/30">
                            {mf.broker_category || mf.category}{mf.broker_subcategory ? ` • ${mf.broker_subcategory}` : ''}
                          </span>
                        )}
                        {mf.has_broker_data && (
                          <span className="px-1.5 py-0.5 rounded bg-info/10 text-info text-[10px] font-medium border border-info/20">
                            {mf.broker_name || 'Groww'} Verified
                          </span>
                        )}
                      </div>
                    </td>

                    {/* NAV */}
                    <td className="py-4 px-5 text-right">
                      <div className="font-mono text-sm font-medium text-foreground">₹{mf.price.toFixed(2)}</div>
                    </td>

                    {/* Returns (%) */}
                    <td className="py-4 px-5 text-right">
                      {mf.gain !== undefined && mf.cost_basis > 0 ? (
                        <div>
                          <div className={`font-mono text-sm font-medium ${isGain ? 'text-success' : 'text-destructive'}`}>
                            {isGain ? '+' : '-'}{fmt(mf.gain)}
                          </div>
                          <div className="flex items-center justify-end gap-2 mt-0.5">
                            <span className={`text-[11px] font-mono font-medium ${isGain ? 'text-success' : 'text-destructive'}`}>
                              {(mf.gain_pct || 0).toFixed(2)}%
                            </span>
                            {mf.xirr !== undefined && mf.xirr !== null && (
                              <span className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${
                                mf.xirr >= 0 ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                              }`}>
                                XIRR {mf.xirr >= 0 ? '+' : ''}{Number(mf.xirr).toFixed(1)}%
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </td>

                    {/* Current (Invested) */}
                    <td className="py-4 px-5 text-right">
                      <div className="font-mono text-sm font-semibold text-foreground">{fmt(mf.value)}</div>
                      <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
                        {mf.cost_basis ? fmt(mf.cost_basis) : '—'}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
