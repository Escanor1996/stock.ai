import React, { useState, useMemo } from 'react';

export default function TransactionsLedger({ transactions = [] }) {
  const [filter, setFilter] = useState('all'); // 'all' | 'buy' | 'sell'

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      if (filter === 'buy') return t.type === 'BUY' || t.type === 'PURCHASE';
      if (filter === 'sell') return t.type === 'SELL' || t.type === 'REDEMPTION';
      return true;
    });
  }, [transactions, filter]);

  if (!transactions || transactions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* ── SECTION HEADER & FILTER PILLS ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-0.5">
        <div>
          <div className="text-[11px] font-semibold text-muted-foreground tracking-wider uppercase">
            Statement Period Transaction Audit Ledger
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Historical buy, sell, SIP purchase, and redemption operations parsed from CAS.
          </div>
        </div>

        {/* Filter Pills */}
        <div className="inline-flex items-center gap-1 bg-muted/60 p-1 rounded-full border border-border/40 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-3 py-1 text-xs font-semibold rounded-full transition-all duration-200 ${
              filter === 'all'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            All ({transactions.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('buy')}
            className={`px-3 py-1 text-xs font-semibold rounded-full transition-all duration-200 ${
              filter === 'buy'
                ? 'bg-card text-success shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Purchases / Inflows
          </button>
          <button
            type="button"
            onClick={() => setFilter('sell')}
            className={`px-3 py-1 text-xs font-semibold rounded-full transition-all duration-200 ${
              filter === 'sell'
                ? 'bg-card text-destructive shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Redemptions / Outflows
          </button>
        </div>
      </div>

      {/* ── TRANSACTIONS TABLE ── */}
      <div className="overflow-x-auto rounded-xl border border-border/40 bg-card/70 backdrop-blur-xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border/40 bg-muted/30 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              <th className="py-3 px-4">Date</th>
              <th className="py-3 px-4 text-center">Type</th>
              <th className="py-3 px-4">Security / Scheme</th>
              <th className="py-3 px-4 text-center">Category</th>
              <th className="py-3 px-4 text-right">Units / Shares</th>
              <th className="py-3 px-4 text-right">Price / NAV</th>
              <th className="py-3 px-4 text-right">Amount (₹)</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-border/30 text-xs">
            {filteredTransactions.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-muted-foreground">
                  No transactions found for this filter.
                </td>
              </tr>
            ) : (
              filteredTransactions.map((tx, idx) => {
                const isBuy = tx.type === 'BUY' || tx.type === 'PURCHASE';

                return (
                  <tr key={idx} className="hover:bg-muted/30 transition-colors duration-150">
                    {/* Date */}
                    <td className="py-3 px-4 text-foreground font-mono text-[11px]">
                      {tx.date}
                    </td>

                    {/* Action Type Badge (Wealthfolio Badge pattern) */}
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                          isBuy
                            ? 'bg-success/10 text-success border border-success/30'
                            : 'bg-destructive/10 text-destructive border border-destructive/30'
                        }`}
                      >
                        {tx.type}
                      </span>
                    </td>

                    {/* Security / Scheme (Two-line cell) */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-foreground max-w-xs truncate" title={tx.name}>
                        {tx.name}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono">
                        {tx.isin} {tx.description ? `• ${tx.description}` : ''}
                      </div>
                    </td>

                    {/* Category */}
                    <td className="py-3 px-4 text-center">
                      <span className="text-[11px] text-muted-foreground font-mono">
                        {tx.category || 'DEMAT'}
                      </span>
                    </td>

                    {/* Units */}
                    <td className="py-3 px-4 text-right font-mono text-foreground font-medium">
                      {tx.units ? tx.units.toLocaleString('en-IN', { maximumFractionDigits: 3 }) : '—'}
                    </td>

                    {/* Price / NAV */}
                    <td className="py-3 px-4 text-right font-mono text-muted-foreground">
                      {tx.nav ? `₹${tx.nav.toFixed(2)}` : '—'}
                    </td>

                    {/* Amount */}
                    <td className="py-3 px-4 text-right font-mono font-semibold">
                      {tx.amount ? (
                        <span className={isBuy ? 'text-success' : 'text-destructive'}>
                          {isBuy ? '+' : '-'}₹{tx.amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
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
