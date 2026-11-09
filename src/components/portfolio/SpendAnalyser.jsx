import React, { useState, useMemo } from 'react';
import {
  PieChart as RechartsPie,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer
} from 'recharts';
import {
  ArrowLeft,
  Calendar,
  Landmark,
  TrendingDown,
  Flame,
  PieChart,
  ShoppingBag,
  CreditCard,
  Utensils,
  Zap,
  Send,
  Plane,
  Coins,
  Search,
  Filter,
  ArrowUpDown,
  Building,
  SlidersHorizontal,
  ChevronRight,
  Info
} from 'lucide-react';
import {
  CATEGORIES,
  computeSpendingAnalytics,
  formatDisplayDate
} from '../../utils/spendCategorizer';

const fmt = (n) => '₹' + Math.abs(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const fmtFull = (n) => '₹' + Math.abs(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const CATEGORY_ICONS = {
  'Investments & Wealth': Coins,
  'Credit Card & Loans': CreditCard,
  'Food & Dining': Utensils,
  'Utilities & Housing': Zap,
  'Personal Transfers': Send,
  'Travel & Commute': Plane,
  'Shopping & Services': ShoppingBag,
  'Other / Miscellaneous': SlidersHorizontal
};

function DonutCustomTooltip({ active, payload }) {
  if (active && payload && payload.length) {
    const d = payload[0].payload;
    return (
      <div className="bg-card border border-border/80 rounded-xl p-3 shadow-xl text-xs space-y-1 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
          <span className="font-semibold text-foreground">{d.name}</span>
        </div>
        <div className="text-foreground font-mono font-medium">{fmtFull(d.amount)}</div>
        <div className="text-[11px] text-muted-foreground font-mono">
          {d.percentage}% of total • {d.count} transactions
        </div>
      </div>
    );
  }
  return null;
}

function BarCustomTooltip({ active, payload }) {
  if (active && payload && payload.length) {
    const d = payload[0].payload;
    return (
      <div className="bg-card border border-border/80 rounded-xl p-3 shadow-xl text-xs space-y-1 backdrop-blur-md">
        <div className="font-semibold text-foreground">{d.displayDate}</div>
        <div className="text-rose-600 dark:text-rose-400 font-mono font-bold text-sm">
          {fmtFull(d.amount)}
        </div>
        <div className="text-[11px] text-muted-foreground flex items-center justify-between gap-3 pt-1 border-t border-border/40">
          <span>{d.count} transactions</span>
          <span className="font-medium text-foreground truncate max-w-[140px]">{d.primary_merchant}</span>
        </div>
      </div>
    );
  }
  return null;
}

export default function SpendAnalyser({
  bankAccounts = [],
  onBackToAccounts = () => {},
  initialAccount = 'all',
  initialPeriod = 'all'
}) {
  const [selectedAccount, setSelectedAccount] = useState(initialAccount);
  const [selectedPeriod, setSelectedPeriod] = useState(initialPeriod);
  const [selectedCategoryPill, setSelectedCategoryPill] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('amount_desc'); // 'amount_desc' | 'date_desc' | 'date_asc'

  // Compute spend analytics using client-side engine
  const analytics = useMemo(() => {
    return computeSpendingAnalytics(bankAccounts, selectedPeriod, selectedAccount);
  }, [bankAccounts, selectedPeriod, selectedAccount]);

  const {
    total_outflow,
    investment_outflow,
    pure_living_expenses,
    daily_burn_rate,
    total_debit_transactions,
    top_category,
    categories,
    top_merchants,
    archetype_50_30_20,
    daily_spends,
    available_months,
    available_accounts,
    filtered_transactions
  } = analytics;

  // Filter and sort ledger transactions
  const displayedTransactions = useMemo(() => {
    let list = [...(filtered_transactions || [])];

    // Category filter pill
    if (selectedCategoryPill !== 'all') {
      list = list.filter(t => t.category === selectedCategoryPill);
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(t =>
        (t.merchant && t.merchant.toLowerCase().includes(q)) ||
        (t.cleanNarration && t.cleanNarration.toLowerCase().includes(q)) ||
        (t.category && t.category.toLowerCase().includes(q)) ||
        (t.bankName && t.bankName.toLowerCase().includes(q)) ||
        (t.amount && String(t.amount).includes(q))
      );
    }

    // Sorting
    list.sort((a, b) => {
      if (sortBy === 'amount_desc') return b.amount - a.amount;
      if (sortBy === 'date_desc') {
        const tA = a.parsedDate?.getTime() || 0;
        const tB = b.parsedDate?.getTime() || 0;
        return tB - tA;
      }
      if (sortBy === 'date_asc') {
        const tA = a.parsedDate?.getTime() || 0;
        const tB = b.parsedDate?.getTime() || 0;
        return tA - tB;
      }
      return 0;
    });

    return list;
  }, [filtered_transactions, selectedCategoryPill, searchQuery, sortBy]);

  // Donut Center Total
  const donutData = categories.map(c => ({
    name: c.name,
    amount: c.amount,
    count: c.count,
    color: c.color,
    percentage: c.percentage,
    value: c.amount
  }));

  return (
    <div className="space-y-6">
      {/* ── TOP TOOLBAR & CONTROLS ── */}
      <div className="bg-card rounded-xl border border-border/40 p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToAccounts}
            className="p-2 rounded-lg bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-all border border-border/40"
            title="Back to Accounts Overview"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                Spend Intelligence
              </span>
              <span className="text-xs text-muted-foreground">
                • {total_debit_transactions} debit transactions analysed
              </span>
            </div>
            <h2 className="text-lg font-bold text-foreground tracking-tight mt-0.5">
              Bank Spend Analyser
            </h2>
          </div>
        </div>

        {/* Filter Selectors */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Account Filter */}
          <div className="relative">
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="appearance-none pl-8 pr-8 py-1.5 text-xs font-medium rounded-lg bg-muted/60 border border-border/40 text-foreground hover:bg-muted focus:outline-hidden focus:ring-1 focus:ring-sky-500 cursor-pointer"
            >
              {available_accounts.map(acc => (
                <option key={acc.id} value={acc.id}>
                  {acc.label}
                </option>
              ))}
            </select>
            <Landmark className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <ChevronRight className="w-3 h-3 text-muted-foreground absolute right-2.5 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none" />
          </div>

          {/* Period Filter */}
          <div className="relative">
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="appearance-none pl-8 pr-8 py-1.5 text-xs font-medium rounded-lg bg-muted/60 border border-border/40 text-foreground hover:bg-muted focus:outline-hidden focus:ring-1 focus:ring-sky-500 cursor-pointer"
            >
              <option value="all">All Statement Periods</option>
              {available_months.map(m => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <Calendar className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <ChevronRight className="w-3 h-3 text-muted-foreground absolute right-2.5 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none" />
          </div>

          {/* Reset Filters Button if applied */}
          {(selectedAccount !== 'all' || selectedPeriod !== 'all' || selectedCategoryPill !== 'all' || searchQuery) && (
            <button
              type="button"
              onClick={() => {
                setSelectedAccount('all');
                setSelectedPeriod('all');
                setSelectedCategoryPill('all');
                setSearchQuery('');
              }}
              className="px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-lg transition-all"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* ── 4-CARD HERO KPI STRIP ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Outflow */}
        <div className="bg-card rounded-xl border border-border/40 p-4 relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Total Outflows</span>
            <div className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-foreground tracking-tight">
              {fmtFull(total_outflow)}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1.5">
              <span className="font-semibold text-foreground font-mono">{total_debit_transactions}</span> debit transactions across statement(s)
            </div>
          </div>
          <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-rose-500/5 rounded-full blur-xl pointer-events-none" />
        </div>

        {/* Card 2: Pure Living Expenses */}
        <div className="bg-card rounded-xl border border-border/40 p-4 relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Pure Living Expenses</span>
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Utensils className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400 tracking-tight">
              {fmtFull(pure_living_expenses)}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              Excludes <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">{fmt(investment_outflow)}</span> in wealth & savings
            </div>
          </div>
          <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-amber-500/5 rounded-full blur-xl pointer-events-none" />
        </div>

        {/* Card 3: Top Category */}
        <div className="bg-card rounded-xl border border-border/40 p-4 relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Top Spending Bucket</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-base font-bold text-foreground truncate">
              {top_category ? top_category.name : '—'}
            </div>
            <div className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
              {top_category ? fmtFull(top_category.amount) : '₹0.00'}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              {top_category ? `${top_category.percentage}% share of total spend` : 'No debits found'}
            </div>
          </div>
          <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
        </div>

        {/* Card 4: Daily Burn Velocity */}
        <div className="bg-card rounded-xl border border-border/40 p-4 relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Daily Expense Velocity</span>
            <div className="w-7 h-7 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-foreground tracking-tight">
              {fmtFull(daily_burn_rate)}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              Average daily living burn over selected period
            </div>
          </div>
          <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-sky-500/5 rounded-full blur-xl pointer-events-none" />
        </div>
      </div>

      {/* ── VISUAL ANALYTICS GRID (2 COLUMNS) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Spending by Category Donut Chart (5 cols) */}
        <div className="lg:col-span-5 bg-card rounded-xl border border-border/40 p-5 space-y-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Spending by Category</h3>
              <p className="text-xs text-muted-foreground">Distribution across taxonomy buckets</p>
            </div>
            <PieChart className="w-4 h-4 text-muted-foreground" />
          </div>

          {/* Donut Chart Container */}
          <div className="relative mx-auto flex items-center justify-center" style={{ width: 220, height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPie>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={95}
                  paddingAngle={3}
                  dataKey="amount"
                  stroke="none"
                >
                  {donutData.map((entry, idx) => (
                    <Cell key={`cell-${idx}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip content={<DonutCustomTooltip />} />
              </RechartsPie>
            </ResponsiveContainer>
            {/* Center Label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
              <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Outflow</span>
              <span className="text-sm font-bold font-mono text-foreground">{fmt(total_outflow)}</span>
            </div>
          </div>

          {/* Compact Category Table */}
          <div className="space-y-1.5 pt-2 border-t border-border/40 max-h-56 overflow-y-auto pr-1">
            {categories.map((cat) => {
              const Icon = CATEGORY_ICONS[cat.name] || SlidersHorizontal;
              const isSelected = selectedCategoryPill === cat.name;
              return (
                <button
                  type="button"
                  key={cat.name}
                  onClick={() => setSelectedCategoryPill(isSelected ? 'all' : cat.name)}
                  className={`w-full flex items-center justify-between p-2 rounded-lg text-xs transition-all text-left ${
                    isSelected
                      ? 'bg-muted border border-border font-medium text-foreground'
                      : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                    <Icon className="w-3.5 h-3.5 shrink-0 opacity-70" />
                    <span className="truncate">{cat.name}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-muted border border-border/40 text-muted-foreground">
                      {cat.count}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 font-mono text-right">
                    <span className="font-semibold text-foreground">{fmt(cat.amount)}</span>
                    <span className="text-[11px] text-muted-foreground w-10 text-right">{cat.percentage}%</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Daily Spending Spikes Bar Chart (7 cols) */}
        <div className="lg:col-span-7 bg-card rounded-xl border border-border/40 p-5 space-y-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Daily Spending Spikes</h3>
              <p className="text-xs text-muted-foreground">Cash velocity and expenditure spikes over statement window</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-[11px] font-mono text-muted-foreground">
                <span className="w-2.5 h-2.5 rounded-xs bg-rose-500/80 inline-block" /> Spikes (INR)
              </span>
            </div>
          </div>

          {/* Bar Chart Container */}
          <div className="w-full h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={daily_spends} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border/40" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  stroke="currentColor"
                  className="text-muted-foreground"
                  tickLine={false}
                  axisLine={{ stroke: 'currentColor', className: 'text-border/40' }}
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  stroke="currentColor"
                  className="text-muted-foreground font-mono"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => '₹' + (val >= 1000 ? `${Math.round(val / 1000)}k` : val)}
                />
                <RechartsTooltip content={<BarCustomTooltip />} />
                <Bar
                  dataKey="amount"
                  fill="#f43f5e"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                  className="hover:opacity-85 transition-opacity"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Quick takeaway note */}
          <div className="p-3 bg-muted/40 rounded-lg text-xs text-muted-foreground flex items-center gap-2.5">
            <Info className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
            <span>
              Spikes correspond to big-ticket investments (Groww, Kuvera) and credit card bill payoffs. Discretionary food and commute stay below ₹500/day.
            </span>
          </div>
        </div>
      </div>

      {/* ── 50/30/20 FINANCIAL ARCHETYPE CARD ── */}
      <div className="bg-card rounded-xl border border-border/40 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">50 / 30 / 20 Budget Lens</h3>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                Wealth-First Profile
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Evaluating your actual cash distribution against standard personal finance benchmarks
            </p>
          </div>
          <div className="text-xs text-muted-foreground font-mono">
            Benchmark: 50% Needs • 30% Wants • 20% Wealth
          </div>
        </div>

        {/* Archetype Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
          {/* Needs */}
          <div className="p-3.5 rounded-xl bg-muted/40 border border-border/30 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-foreground">Needs & Bills</span>
              <span className="font-mono text-purple-600 dark:text-purple-400 font-bold">
                {archetype_50_30_20.needs.percentage}%
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div
                className="bg-purple-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, archetype_50_30_20.needs.percentage)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
              <span>{fmtFull(archetype_50_30_20.needs.amount)}</span>
              <span>Target: ≤50%</span>
            </div>
          </div>

          {/* Wants */}
          <div className="p-3.5 rounded-xl bg-muted/40 border border-border/30 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-foreground">Wants & Dining</span>
              <span className="font-mono text-amber-600 dark:text-amber-400 font-bold">
                {archetype_50_30_20.wants.percentage}%
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div
                className="bg-amber-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, archetype_50_30_20.wants.percentage)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
              <span>{fmtFull(archetype_50_30_20.wants.amount)}</span>
              <span>Target: ≤30%</span>
            </div>
          </div>

          {/* Investments */}
          <div className="p-3.5 rounded-xl bg-muted/40 border border-border/30 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-foreground">Wealth & Savings</span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                {archetype_50_30_20.investments.percentage}%
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, archetype_50_30_20.investments.percentage)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
              <span>{fmtFull(archetype_50_30_20.investments.amount)}</span>
              <span>Target: ≥20%</span>
            </div>
          </div>

          {/* Transfers */}
          <div className="p-3.5 rounded-xl bg-muted/40 border border-border/30 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-foreground">Personal Transfers</span>
              <span className="font-mono text-blue-600 dark:text-blue-400 font-bold">
                {archetype_50_30_20.transfers.percentage}%
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, archetype_50_30_20.transfers.percentage)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
              <span>{fmtFull(archetype_50_30_20.transfers.amount)}</span>
              <span>Peer Transfers</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── TOP MERCHANTS & FREQUENT PAYEES STRIP ── */}
      <div className="bg-card rounded-xl border border-border/40 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Top Frequent Payees & Merchants</h3>
            <p className="text-xs text-muted-foreground">Most significant outflow destinations by total volume</p>
          </div>
          <span className="text-xs font-mono text-muted-foreground">Top {top_merchants.length} Payees</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
          {top_merchants.map((merch) => {
            const Icon = CATEGORY_ICONS[merch.category] || SlidersHorizontal;
            return (
              <div
                key={merch.name}
                className="p-3.5 rounded-xl bg-muted/30 border border-border/40 hover:border-border transition-all flex flex-col justify-between space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-foreground truncate" title={merch.name}>
                      {merch.name}
                    </h4>
                    <span className="text-[10px] text-muted-foreground block truncate">
                      {merch.category}
                    </span>
                  </div>
                  <span className="px-1.5 py-0.5 rounded-md bg-muted text-[10px] font-mono text-muted-foreground shrink-0 border border-border/40">
                    {merch.count} txns
                  </span>
                </div>

                <div className="pt-1 border-t border-border/30 flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">
                    Avg: <span className="font-mono">{fmt(merch.avg_amount)}</span>
                  </span>
                  <span className="text-sm font-bold font-mono text-foreground">
                    {fmt(merch.amount)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── CATEGORIZED OUTFLOW LEDGER (FILTERABLE & SEARCHABLE) ── */}
      <div className="bg-card rounded-xl border border-border/40 p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Categorized Outflow Ledger</h3>
            <p className="text-xs text-muted-foreground">
              Audited transaction history with normalized payees ({displayedTransactions.length} items)
            </p>
          </div>

          {/* Search & Sort Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search payees, narration..."
                className="pl-8 pr-3 py-1.5 text-xs rounded-lg bg-muted/60 border border-border/40 text-foreground placeholder:text-muted-foreground hover:bg-muted focus:outline-hidden focus:ring-1 focus:ring-sky-500 w-44 sm:w-56"
              />
            </div>

            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="appearance-none pl-8 pr-8 py-1.5 text-xs font-medium rounded-lg bg-muted/60 border border-border/40 text-foreground hover:bg-muted focus:outline-hidden focus:ring-1 focus:ring-sky-500 cursor-pointer"
              >
                <option value="amount_desc">Highest Spend First</option>
                <option value="date_desc">Newest Date First</option>
                <option value="date_asc">Oldest Date First</option>
              </select>
              <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <ChevronRight className="w-3 h-3 text-muted-foreground absolute right-2.5 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 no-scrollbar">
          <button
            type="button"
            onClick={() => setSelectedCategoryPill('all')}
            className={`px-3 py-1 text-xs font-medium rounded-full shrink-0 transition-all ${
              selectedCategoryPill === 'all'
                ? 'bg-foreground text-background font-semibold shadow-xs'
                : 'bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            All Categories ({filtered_transactions.length})
          </button>
          {categories.map((c) => {
            const isSelected = selectedCategoryPill === c.name;
            return (
              <button
                type="button"
                key={c.name}
                onClick={() => setSelectedCategoryPill(isSelected ? 'all' : c.name)}
                className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full shrink-0 transition-all border ${
                  isSelected
                    ? 'bg-muted border-foreground/30 text-foreground font-semibold'
                    : 'border-transparent bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                <span>{c.name}</span>
                <span className="text-[10px] opacity-70">({c.count})</span>
              </button>
            );
          })}
        </div>

        {/* Transactions Table */}
        <div className="overflow-x-auto rounded-lg border border-border/40">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] font-semibold border-b border-border/40 tracking-wider">
              <tr>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Merchant / Payee</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Account</th>
                <th className="py-2.5 px-3">Original Narration</th>
                <th className="py-2.5 px-3 text-right">Debit (INR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20 text-foreground">
              {displayedTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground text-xs">
                    No transactions match your search and filter criteria.
                  </td>
                </tr>
              ) : (
                displayedTransactions.map((tx, idx) => (
                  <tr key={`${tx.date}-${tx.amount}-${idx}`} className="hover:bg-muted/30 transition-colors">
                    <td className="py-2.5 px-3 font-mono whitespace-nowrap text-muted-foreground">
                      {tx.displayDate || tx.date}
                    </td>
                    <td className="py-2.5 px-3 font-medium whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: tx.color }} />
                        <span className="text-foreground">{tx.merchant}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium border ${tx.badgeClass}`}>
                        {tx.category}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-muted-foreground font-mono text-[11px]">
                      {tx.bankName} {tx.maskedAccount}
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground max-w-xs truncate text-[11px]" title={tx.cleanNarration || tx.narration}>
                      {tx.cleanNarration || tx.narration}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">
                      - {fmtFull(tx.amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
