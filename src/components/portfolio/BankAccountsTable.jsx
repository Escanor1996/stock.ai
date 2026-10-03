import React, { useState, useMemo } from 'react';
import {
  Landmark,
  ShieldCheck,
  Calendar,
  ChevronDown,
  ChevronUp,
  UploadCloud,
  RefreshCw,
  Trash2,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  TrendingUp,
  TrendingDown,
  Building,
  CheckCircle2,
  FileText,
  PieChart as PieChartIcon
} from 'lucide-react';
import SpendAnalyser from './SpendAnalyser';

export default function BankAccountsTable({
  bankAccounts = [],
  summary = {},
  onOpenUploadModal = () => {},
  isBankUploading = false,
  onDeleteAccount = () => {},
  initialView = 'accounts'
}) {
  const [viewMode, setViewMode] = useState(initialView || 'accounts');
  const [selectedSpendAccount, setSelectedSpendAccount] = useState('all');
  const [expandedAccount, setExpandedAccount] = useState(null);
  const [txFilters, setTxFilters] = useState({}); // { [accountIndex]: { type: 'all' | 'cr' | 'dr', query: '' } }

  React.useEffect(() => {
    if (initialView) {
      setViewMode(initialView);
    }
  }, [initialView]);
  const fmt = (n) => '₹' + Math.abs(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

  const totalBalance = useMemo(() => {
    if (summary.total_bank_value !== undefined && summary.total_bank_value !== null) {
      return summary.total_bank_value;
    }
    return bankAccounts.reduce((sum, a) => sum + (a.closing_balance || 0), 0);
  }, [bankAccounts, summary]);

  const totalInflows = useMemo(() => {
    if (summary.total_bank_inflows !== undefined && summary.total_bank_inflows !== null) {
      return summary.total_bank_inflows;
    }
    return bankAccounts.reduce((sum, a) => sum + (a.total_credits || 0), 0);
  }, [bankAccounts, summary]);

  const totalOutflows = useMemo(() => {
    if (summary.total_bank_outflows !== undefined && summary.total_bank_outflows !== null) {
      return summary.total_bank_outflows;
    }
    return bankAccounts.reduce((sum, a) => sum + (a.total_debits || 0), 0);
  }, [bankAccounts, summary]);

  const netFlow = totalInflows - totalOutflows;

  const getBankBadgeStyle = (bankName = '', bankCode = '') => {
    const name = (bankName + ' ' + bankCode).toUpperCase();
    if (name.includes('HDFC')) {
      return {
        pill: 'bg-blue-600/10 text-blue-700 dark:text-blue-400 border-blue-500/30',
        dot: 'bg-blue-600'
      };
    }
    if (name.includes('STANDARD CHARTERED') || name.includes('SCB')) {
      return {
        pill: 'bg-emerald-600/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
        dot: 'bg-emerald-600'
      };
    }
    return {
      pill: 'bg-sky-600/10 text-sky-700 dark:text-sky-400 border-sky-500/30',
      dot: 'bg-sky-600'
    };
  };

  const getAccountFilter = (accIdx) => {
    return txFilters[accIdx] || { type: 'all', query: '' };
  };

  const setAccountFilter = (accIdx, patch) => {
    setTxFilters((prev) => ({
      ...prev,
      [accIdx]: {
        ...(prev[accIdx] || { type: 'all', query: '' }),
        ...patch
      }
    }));
  };

  // ── EMPTY STATE ──
  if (!bankAccounts || bankAccounts.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border/40 p-10 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-sky-500/10 text-sky-600 flex items-center justify-center mx-auto border border-sky-500/20">
          <Landmark className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="font-semibold text-foreground text-base">
            No Bank Accounts Connected
          </h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Upload your official bank statement PDF (HDFC Bank, Standard Chartered, or other Indian banks)
            to track your liquid cash reserves, monitor monthly inflows/outflows, and view transaction ledgers.
          </p>
        </div>
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={onOpenUploadModal}
            disabled={isBankUploading}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 transition-all shadow-xs disabled:opacity-50"
          >
            {isBankUploading ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <UploadCloud className="w-3.5 h-3.5" />
            )}
            <span>{isBankUploading ? 'Processing Statement...' : 'Upload Bank Statement (PDF)'}</span>
          </button>
        </div>
        <div className="p-3 bg-muted/30 rounded-lg text-[11px] text-muted-foreground flex items-center justify-center gap-2 max-w-lg mx-auto">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Zero login credentials required. Statements are parsed entirely locally with client password decryption.</span>
        </div>
      </div>
    );
  }

  if (viewMode === 'spend') {
    return (
      <div className="space-y-6">
        {/* ── SUB-HEADER SEGMENTED SWITCHER ── */}
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-1 bg-muted/60 p-1 rounded-full border border-border/40 shadow-xs">
            <button
              type="button"
              onClick={() => { setViewMode('accounts'); setSelectedSpendAccount('all'); }}
              className={`px-3 py-1 text-xs font-semibold rounded-full transition-all ${
                viewMode === 'accounts' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Accounts Overview ({bankAccounts.length})
            </button>
            <button
              type="button"
              onClick={() => setViewMode('spend')}
              className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full transition-all ${
                viewMode === 'spend' ? 'bg-card text-sky-600 dark:text-sky-400 shadow-xs' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <PieChartIcon className="w-3.5 h-3.5" />
              <span>Spend Analyser</span>
            </button>
          </div>
        </div>

        <SpendAnalyser
          bankAccounts={bankAccounts}
          onBackToAccounts={() => { setViewMode('accounts'); setSelectedSpendAccount('all'); }}
          initialAccount={selectedSpendAccount}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── SUB-HEADER SEGMENTED SWITCHER ── */}
      <div className="flex items-center justify-between">
        <div className="inline-flex items-center gap-1 bg-muted/60 p-1 rounded-full border border-border/40 shadow-xs">
          <button
            type="button"
            onClick={() => setViewMode('accounts')}
            className={`px-3 py-1 text-xs font-semibold rounded-full transition-all ${
              viewMode === 'accounts' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Accounts Overview ({bankAccounts.length})
          </button>
          <button
            type="button"
            onClick={() => { setSelectedSpendAccount('all'); setViewMode('spend'); }}
            className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full transition-all ${
              viewMode === 'spend' ? 'bg-card text-sky-600 dark:text-sky-400 shadow-xs' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <PieChartIcon className="w-3.5 h-3.5" />
            <span>Spend Analyser</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => { setSelectedSpendAccount('all'); setViewMode('spend'); }}
          className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-muted/60 hover:bg-muted text-foreground transition-all border border-border/40 shadow-xs"
        >
          <PieChartIcon className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
          <span>Analyse Spends</span>
        </button>
      </div>

      {/* ── SUMMARY HEADER CARD ── */}
      <div className="bg-card rounded-xl border border-border/40 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-600 border border-sky-500/20">
              <Landmark className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-muted-foreground tracking-wider uppercase">
                Liquid Cash &amp; Bank Balances ({bankAccounts.length} Account{bankAccounts.length > 1 ? 's' : ''})
              </div>
              <div className="text-xs text-muted-foreground">
                Consolidated liquid balances across active savings &amp; current accounts
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/30">
              <CheckCircle2 className="w-3 h-3 text-sky-600" />
              <span>Liquid Reserve • Instant Access</span>
            </span>
            <button
              type="button"
              onClick={() => { setSelectedSpendAccount('all'); setViewMode('spend'); }}
              className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-foreground bg-muted hover:bg-muted/80 border border-border rounded-full transition-all duration-150 active:scale-95 shadow-xs"
              title="Open Spend Analyser"
            >
              <PieChartIcon className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              <span>Spend Analyser</span>
            </button>
            <button
              type="button"
              onClick={onOpenUploadModal}
              disabled={isBankUploading}
              className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-foreground bg-muted hover:bg-muted/80 border border-border rounded-full transition-all duration-150 active:scale-95 disabled:opacity-50"
              title="Add or update a bank statement"
            >
              {isBankUploading ? (
                <RefreshCw className="w-3 h-3 animate-spin text-muted-foreground" />
              ) : (
                <Plus className="w-3 h-3 text-sky-600" />
              )}
              <span>{isBankUploading ? 'Parsing...' : '+ Add / Update Statement'}</span>
            </button>
          </div>
        </div>

        {/* Hero Liquid Balance */}
        <div className="font-serif text-3xl font-bold text-foreground">
          {fmt(totalBalance)}
        </div>

        {/* 4-Card Metric Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-3 border-t border-border/30">
          <div>
            <div className="text-[11px] text-muted-foreground mb-0.5">Total Liquid Balance</div>
            <div className="text-sm font-semibold text-foreground font-mono">{fmt(totalBalance)}</div>
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground mb-0.5">Total Inflows (Credits)</div>
            <div className="text-sm font-semibold text-emerald-600 font-mono flex items-center gap-1">
              <ArrowDownRight className="w-3.5 h-3.5 shrink-0" />
              <span>{fmt(totalInflows)}</span>
            </div>
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground mb-0.5">Total Outflows (Debits)</div>
            <div className="text-sm font-semibold text-destructive font-mono flex items-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
              <span>{fmt(totalOutflows)}</span>
            </div>
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground mb-0.5">Net Statement Flow</div>
            <div className={`text-sm font-semibold font-mono flex items-center gap-1 ${netFlow >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
              {netFlow >= 0 ? <TrendingUp className="w-3.5 h-3.5 shrink-0" /> : <TrendingDown className="w-3.5 h-3.5 shrink-0" />}
              <span>{netFlow >= 0 ? '+' : '-'}{fmt(Math.abs(netFlow))}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── ACCOUNTS LIST ── */}
      <div className="space-y-4">
        {bankAccounts.map((acc, idx) => {
          const isExpanded = expandedAccount === idx;
          const badge = getBankBadgeStyle(acc.bank_name, acc.bank_code);
          const transactions = acc.transactions || [];
          const filterState = getAccountFilter(idx);

          // Filter transactions
          const filteredTxns = transactions.filter((tx) => {
            if (filterState.type === 'cr' && tx.type !== 'CR') return false;
            if (filterState.type === 'dr' && tx.type !== 'DR') return false;
            if (filterState.query.trim()) {
              const q = filterState.query.toLowerCase();
              const matchNarration = (tx.narration || '').toLowerCase().includes(q);
              const matchRef = (tx.ref_no || '').toLowerCase().includes(q);
              const matchDate = (tx.date || '').toLowerCase().includes(q);
              if (!matchNarration && !matchRef && !matchDate) return false;
            }
            return true;
          });

          const monthlyCashflow = acc.monthly_cashflow || [];

          return (
            <div
              key={acc.account_number || idx}
              className="bg-card rounded-xl border border-border/40 overflow-hidden shadow-xs"
            >
              {/* Card Header Row */}
              <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Bank Badge */}
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badge.pill}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                      <span>{acc.bank_name || 'Bank Account'}</span>
                    </span>
                    <span className="font-semibold text-foreground text-sm">
                      {acc.account_type || 'Savings Account'}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-muted text-muted-foreground border border-border/60">
                      {acc.masked_account_number || acc.account_number}
                    </span>
                    {acc.ifsc && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono text-muted-foreground bg-muted border border-border/60">
                        IFSC: {acc.ifsc}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono flex-wrap">
                    {acc.account_holder && (
                      <span className="font-semibold text-foreground">
                        {acc.account_holder}
                      </span>
                    )}
                    {acc.branch && (
                      <>
                        <span>&bull;</span>
                        <span>{acc.branch}</span>
                      </>
                    )}
                    {acc.statement_date && (
                      <>
                        <span>&bull;</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>As on {acc.statement_date}</span>
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Right Balance & Actions */}
                <div className="flex items-center justify-between md:justify-end gap-5 shrink-0">
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Closing Balance</div>
                    <div className="font-mono font-bold text-lg text-foreground">
                      {fmt(acc.closing_balance)}
                    </div>
                  </div>

                  {transactions.length > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedSpendAccount(acc.account_number || acc.masked_account_number || 'all');
                          setViewMode('spend');
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-muted/60 hover:bg-muted text-muted-foreground hover:text-sky-600 transition-colors border border-border/40"
                        title="Analyze spending for this account"
                      >
                        <PieChartIcon className="w-3.5 h-3.5 text-sky-600" />
                        <span className="hidden sm:inline">Analyze</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setExpandedAccount(isExpanded ? null : idx)}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        title={isExpanded ? 'Collapse transaction ledger' : 'Expand transaction ledger'}
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`Are you sure you want to remove ${acc.bank_name || 'this bank account'} (${acc.masked_account_number || acc.account_number})?`)) {
                        onDeleteAccount(acc.account_number || acc.masked_account_number);
                      }
                    }}
                    className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    title="Remove this account"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Account Quick Metrics Strip */}
              <div className="px-5 py-2.5 bg-muted/20 border-t border-border/30 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Opening Bal: </span>
                  <span className="font-mono font-semibold text-foreground">{fmt(acc.opening_balance)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Total Inflows: </span>
                  <span className="font-mono font-semibold text-emerald-600">+{fmt(acc.total_credits)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Total Outflows: </span>
                  <span className="font-mono font-semibold text-destructive">-{fmt(acc.total_debits)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Net Period Flow: </span>
                  <span className={`font-mono font-semibold ${acc.net_cashflow >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                    {acc.net_cashflow >= 0 ? '+' : '-'}{fmt(Math.abs(acc.net_cashflow))}
                  </span>
                </div>
              </div>

              {/* ── EXPANDABLE TRANSACTION LEDGER ── */}
              {isExpanded && (
                <div className="p-5 border-t border-border/40 space-y-4 bg-muted/5 animate-in fade-in duration-150">
                  {/* Monthly Cashflow Visual Strip */}
                  {monthlyCashflow.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Monthly Cashflow Breakdown
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                        {monthlyCashflow.map((m, mIdx) => (
                          <div
                            key={mIdx}
                            className="p-2.5 rounded-lg bg-card border border-border/40 space-y-1.5"
                          >
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-foreground">{m.month}</span>
                              <span className={`font-mono text-[11px] font-semibold ${m.net >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                                {m.net >= 0 ? '+' : ''}{fmt(m.net)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                              <span className="text-emerald-600">In: {fmt(m.inflow)}</span>
                              <span className="text-destructive">Out: {fmt(m.outflow)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Filter Toolbar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2">
                    <div className="relative flex-1 max-w-sm">
                      <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={filterState.query}
                        onChange={(e) => setAccountFilter(idx, { query: e.target.value })}
                        placeholder="Search description, ref no, or date..."
                        className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-border/60 bg-background text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    </div>

                    <div className="inline-flex items-center gap-1 bg-muted/60 p-0.5 rounded-full border border-border/40 self-start sm:self-auto">
                      <button
                        type="button"
                        onClick={() => setAccountFilter(idx, { type: 'all' })}
                        className={`px-3 py-1 text-xs font-semibold rounded-full transition-all duration-150 ${
                          filterState.type === 'all'
                            ? 'bg-card text-foreground shadow-xs'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        All ({transactions.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setAccountFilter(idx, { type: 'cr' })}
                        className={`px-3 py-1 text-xs font-semibold rounded-full transition-all duration-150 ${
                          filterState.type === 'cr'
                            ? 'bg-card text-emerald-600 shadow-xs'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        Credits (+)
                      </button>
                      <button
                        type="button"
                        onClick={() => setAccountFilter(idx, { type: 'dr' })}
                        className={`px-3 py-1 text-xs font-semibold rounded-full transition-all duration-150 ${
                          filterState.type === 'dr'
                            ? 'bg-card text-destructive shadow-xs'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        Debits (-)
                      </button>
                    </div>
                  </div>

                  {/* Transactions Table */}
                  <div className="overflow-x-auto rounded-xl border border-border/40 bg-card">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-border/40 bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Description / Narration</th>
                          <th className="py-2.5 px-3">Ref No</th>
                          <th className="py-2.5 px-3 text-center">Type</th>
                          <th className="py-2.5 px-3 text-right">Amount</th>
                          <th className="py-2.5 px-3 text-right">Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/20">
                        {filteredTxns.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-xs text-muted-foreground">
                              No transactions match the filter criteria.
                            </td>
                          </tr>
                        ) : (
                          filteredTxns.map((t, tIdx) => {
                            const isCr = t.type === 'CR';
                            return (
                              <tr key={tIdx} className="hover:bg-muted/30 transition-colors">
                                <td className="py-2 px-3 font-mono whitespace-nowrap text-muted-foreground">
                                  {t.date}
                                </td>
                                <td className="py-2 px-3 font-medium text-foreground max-w-md truncate">
                                  {t.narration}
                                </td>
                                <td className="py-2 px-3 font-mono text-[11px] text-muted-foreground truncate max-w-xs">
                                  {t.ref_no || '-'}
                                </td>
                                <td className="py-2 px-3 text-center whitespace-nowrap">
                                  <span
                                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold font-mono ${
                                      isCr
                                        ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30'
                                        : 'bg-destructive/10 text-destructive border border-destructive/30'
                                    }`}
                                  >
                                    {isCr ? 'CR' : 'DR'}
                                  </span>
                                </td>
                                <td
                                  className={`py-2 px-3 font-mono font-semibold text-right whitespace-nowrap ${
                                    isCr ? 'text-emerald-600' : 'text-destructive'
                                  }`}
                                >
                                  {isCr ? '+' : '-'}{fmt(t.amount)}
                                </td>
                                <td className="py-2 px-3 font-mono font-medium text-right text-foreground whitespace-nowrap">
                                  {fmt(t.balance)}
                                </td>
                              </tr>
                            );
                          })
                        )}
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
