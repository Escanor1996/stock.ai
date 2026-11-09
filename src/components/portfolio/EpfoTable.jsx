import React, { useState, useMemo, useRef } from 'react';
import {
  ShieldCheck,
  Building2,
  Calendar,
  ChevronDown,
  ChevronUp,
  UploadCloud,
  RefreshCw,
  Wallet,
  Landmark,
  FileText,
  Trash2,
  Info
} from 'lucide-react';
export default function EpfoTable({
  epfoAccounts = [],
  summary = {},
  onUploadEPFO = () => {},
  isEPFOUploading = false,
  onDeleteAccount = () => {}
}) {
  const fileInputRef = useRef(null);
  const [expandedAccount, setExpandedAccount] = useState(null);

  const fmt = (n) => '₹' + Math.abs(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

  const totalBalance = useMemo(() => {
    if (summary.total_epfo_value !== undefined && summary.total_epfo_value !== null) {
      return summary.total_epfo_value;
    }
    return epfoAccounts.reduce((sum, a) => sum + (a.total_balance || 0), 0);
  }, [epfoAccounts, summary]);

  const totalEmployeeShare = useMemo(() => {
    return epfoAccounts.reduce((sum, a) => sum + (a.employee_share || 0), 0);
  }, [epfoAccounts]);

  const totalEmployerShare = useMemo(() => {
    return epfoAccounts.reduce((sum, a) => sum + (a.employer_share || 0), 0);
  }, [epfoAccounts]);

  const totalPensionBalance = useMemo(() => {
    return epfoAccounts.reduce((sum, a) => sum + (a.pension_balance || 0), 0);
  }, [epfoAccounts]);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      onUploadEPFO(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  if (!epfoAccounts || epfoAccounts.length === 0) {
    return (
      <div className="space-y-4">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={handleFileChange}
        />
        <div className="bg-card rounded-xl border border-border/40 p-10 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto">
            <Landmark className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="font-semibold text-foreground text-base">No EPFO Accounts Connected</h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Upload your official EPFO Member Passbook PDF(s) to track your Employees' Provident Fund balance, employer contributions, and EPS pension rights. You can select multiple PDFs at once to consolidate passbooks from different employers.
            </p>
          </div>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isEPFOUploading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 transition-all shadow-xs disabled:opacity-50"
            >
              {isEPFOUploading ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <UploadCloud className="w-3.5 h-3.5" />
              )}
              <span>{isEPFOUploading ? 'Parsing Passbooks...' : 'Upload EPFO Passbooks (PDF)'}</span>
            </button>
          </div>
          <div className="p-3 bg-muted/30 rounded-lg text-[11px] text-muted-foreground flex items-center justify-center gap-2 max-w-lg mx-auto">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Zero credentials needed. Only your downloaded member passbook PDF is processed locally.</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* ── SUMMARY HEADER CARD ── */}
      <div className="bg-card rounded-xl border border-border/40 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              <Landmark className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-muted-foreground tracking-wider uppercase">
                EPFO Provident Fund ({epfoAccounts.length} Account{epfoAccounts.length > 1 ? 's' : ''})
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/30">
              <ShieldCheck className="w-3 h-3" />
              <span>Sovereign Backed • 8.25% p.a.</span>
            </span>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isEPFOUploading}
              className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-foreground bg-muted hover:bg-muted/80 border border-border rounded-full transition-all duration-150 active:scale-95 disabled:opacity-50"
              title="Upload one or more EPFO Member Passbook PDFs (select multiple files to merge all employer accounts)"
            >
              {isEPFOUploading ? (
                <RefreshCw className="w-3 h-3 animate-spin text-muted-foreground" />
              ) : (
                <UploadCloud className="w-3 h-3 text-emerald-600" />
              )}
              <span>{isEPFOUploading ? 'Parsing...' : '+ Add / Update Passbook(s)'}</span>
            </button>
          </div>
        </div>

        <div className="font-serif text-3xl font-bold text-foreground">
          {fmt(totalBalance)}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-3 border-t border-border/30">
          <div>
            <div className="text-[11px] text-muted-foreground mb-0.5">Employee Share (EE)</div>
            <div className="text-sm font-semibold text-foreground font-mono">{fmt(totalEmployeeShare)}</div>
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground mb-0.5">Employer Share (ER)</div>
            <div className="text-sm font-semibold text-foreground font-mono">{fmt(totalEmployerShare)}</div>
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground mb-0.5">Pension Corpus (EPS)</div>
            <div className="text-sm font-semibold text-foreground font-mono">{fmt(totalPensionBalance)}</div>
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground mb-0.5">Source &amp; Security</div>
            <div className="text-sm font-semibold text-foreground flex items-center gap-1">
              <span>Member Passbook</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── ACCOUNTS LIST ── */}
      <div className="space-y-4">
        {epfoAccounts.map((acc, idx) => {
          const isExpanded = expandedAccount === idx;
          const transactions = acc.transactions || [];

          return (
            <div key={idx} className="bg-card rounded-xl border border-border/40 overflow-hidden">
              <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-foreground text-sm">
                      {acc.establishment_name || 'EPFO Establishment'}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-muted text-muted-foreground border border-border/60">
                      {acc.member_id}
                    </span>
                    {acc.member_name && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-600 border border-emerald-500/30">
                        {acc.member_name}
                      </span>
                    )}
                    {acc.uan && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono text-muted-foreground bg-muted border border-border/60">
                        UAN: {acc.uan}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
                    {acc.statement_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>As on {acc.statement_date}</span>
                      </span>
                    )}
                    <span>•</span>
                    <span>{acc.source || 'EPFO Passbook'}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-6 shrink-0">
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Account Balance</div>
                    <div className="font-mono font-bold text-lg text-foreground">
                      {fmt(acc.total_balance)}
                    </div>
                  </div>

                  {transactions.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setExpandedAccount(isExpanded ? null : idx)}
                      className="p-1.5 rounded-lg hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground"
                      title={isExpanded ? 'Collapse monthly contributions' : 'View monthly contributions'}
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`Are you sure you want to remove the passbook account for ${acc.establishment_name || acc.member_id}?`)) {
                        onDeleteAccount(acc.member_id);
                      }
                    }}
                    className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    title="Remove this account"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Share Breakdown Strip */}
              <div className="px-5 py-3 bg-muted/20 border-t border-border/30 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Employee: </span>
                  <span className="font-mono font-semibold text-foreground">{fmt(acc.employee_share)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Employer: </span>
                  <span className="font-mono font-semibold text-foreground">{fmt(acc.employer_share)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">EPS Pension: </span>
                  <span className="font-mono font-semibold text-foreground">{fmt(acc.pension_balance)}</span>
                </div>
              </div>

              {/* Expandable Transactions Ledger */}
              {isExpanded && transactions.length > 0 && (
                <div className="border-t border-border/40 p-4 space-y-3 bg-card/50">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                      Contribution Ledger ({transactions.length} Records)
                    </h4>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-border/30 text-[10px] text-muted-foreground uppercase font-semibold">
                          <th className="py-2 px-3">Date / Month</th>
                          <th className="py-2 px-3 text-right">Wage (INR)</th>
                          <th className="py-2 px-3 text-right">EE Share</th>
                          <th className="py-2 px-3 text-right">ER Share</th>
                          <th className="py-2 px-3 text-right">EPS Pension</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/20 font-mono">
                        {transactions.map((tx, tIdx) => (
                          <tr key={tIdx} className="hover:bg-muted/30">
                            <td className="py-2 px-3 text-foreground font-sans">
                              {tx.month || tx.date || `Entry ${tIdx + 1}`}
                            </td>
                            <td className="py-2 px-3 text-right text-muted-foreground">
                              {tx.wage ? fmt(tx.wage) : '—'}
                            </td>
                            <td className="py-2 px-3 text-right text-foreground font-semibold">
                              {fmt(tx.epf_employee || tx.employee_share || 0)}
                            </td>
                            <td className="py-2 px-3 text-right text-foreground">
                              {fmt(tx.epf_employer || tx.employer_share || 0)}
                            </td>
                            <td className="py-2 px-3 text-right text-muted-foreground">
                              {fmt(tx.eps_pension || tx.pension_balance || 0)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
