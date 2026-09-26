import React, { useMemo } from 'react';

export default function MutualFundsTable({
  mutualFunds = [],
  searchQuery = ''
}) {
  const mfVal = useMemo(() => {
    return mutualFunds.reduce((sum, m) => sum + (m.value || 0), 0);
  }, [mutualFunds]);

  const mfCostTotal = useMemo(() => {
    return mutualFunds.reduce((sum, m) => sum + (m.cost_basis || 0), 0);
  }, [mutualFunds]);

  const mfGainTotal = useMemo(() => {
    return mutualFunds.reduce((sum, m) => sum + (m.gain || 0), 0);
  }, [mutualFunds]);

  const mfGainPct = mfCostTotal > 0 ? (mfGainTotal / mfCostTotal) * 100 : 0;

  // Filtered
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
    <div className="space-y-5">
      {/* ── SUMMARY HIGHLIGHT STRIP (Header Outside Body Pattern) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Valuation */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold text-muted-foreground tracking-wider uppercase px-0.5">
            Total Mutual Fund Valuation
          </div>
          <div className="glass-card p-4 space-y-0.5">
            <div className="font-serif text-xl font-bold text-success">
              ₹{mfVal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-muted-foreground">
              {mutualFunds.length} Active Folios / Schemes
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
              ₹{mfCostTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-muted-foreground">
              Extracted from official CAS statement
            </div>
          </div>
        </div>

        {/* Card 3: Unrealized Gain */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold text-muted-foreground tracking-wider uppercase px-0.5">
            Unrealized Profit & Return
          </div>
          <div className="glass-card p-4 space-y-0.5">
            <div className={`font-mono text-xl font-bold ${mfGainTotal >= 0 ? 'text-success' : 'text-destructive'}`}>
              {mfGainTotal >= 0 ? '+' : ''}₹{Math.abs(mfGainTotal).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </div>
            <div className={`text-xs font-medium ${mfGainPct >= 0 ? 'text-success' : 'text-destructive'}`}>
              {mfGainPct >= 0 ? '+' : ''}{mfGainPct.toFixed(2)}% overall return
            </div>
          </div>
        </div>
      </div>

      {/* ── MUTUAL FUNDS TABLE ── */}
      <div className="overflow-x-auto rounded-xl border border-border/40 bg-card/70 backdrop-blur-xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border/40 bg-muted/30 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              <th className="py-3 px-4">Scheme / AMC</th>
              <th className="py-3 px-4">Folio Number</th>
              <th className="py-3 px-4 text-right">Units</th>
              <th className="py-3 px-4 text-right">Current NAV</th>
              <th className="py-3 px-4 text-right">Invested Cost</th>
              <th className="py-3 px-4 text-right">Current Valuation</th>
              <th className="py-3 px-4 text-right">Unrealized Gain</th>
              <th className="py-3 px-4 text-right">Weight %</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-border/30 text-xs">
            {filteredMutualFunds.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-muted-foreground">
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
                    {/* Scheme & AMC (Two-line cell) */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-foreground max-w-sm">
                        {mf.name}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                        ISIN: {mf.isin} {mf.amc ? `• ${mf.amc}` : ''}
                      </div>
                    </td>

                    {/* Folio */}
                    <td className="py-3.5 px-4 text-muted-foreground font-mono text-[11px]">
                      {mf.folio || mf.account_name || '—'}
                    </td>

                    {/* Units */}
                    <td className="py-3.5 px-4 text-right text-foreground font-mono font-medium">
                      {mf.quantity.toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                    </td>

                    {/* NAV */}
                    <td className="py-3.5 px-4 text-right text-muted-foreground font-mono">
                      ₹{mf.price.toFixed(2)}
                    </td>

                    {/* Invested Cost */}
                    <td className="py-3.5 px-4 text-right text-muted-foreground font-mono">
                      {mf.cost_basis ? `₹${mf.cost_basis.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '—'}
                    </td>

                    {/* Current Value */}
                    <td className="py-3.5 px-4 text-right font-bold text-foreground font-mono">
                      ₹{mf.value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </td>

                    {/* Unrealized Gain (Two-line cell) */}
                    <td className="py-3.5 px-4 text-right font-mono">
                      {mf.gain !== undefined && mf.cost_basis > 0 ? (
                        <div className={isGain ? 'text-success' : 'text-destructive'}>
                          <span className="font-semibold">
                            {isGain ? '+' : ''}₹{Math.abs(mf.gain).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                          </span>
                          <div className="text-[10px]">
                            {isGain ? '+' : ''}{(mf.gain_pct || 0).toFixed(2)}%
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-[11px]">—</span>
                      )}
                    </td>

                    {/* Weight */}
                    <td className="py-3.5 px-4 text-right font-mono text-muted-foreground">
                      {(mf.weight_pct || 0).toFixed(2)}%
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
