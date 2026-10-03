/**
 * Spend Categorizer & Analytics Engine for Bank Accounts
 * Handles merchant normalization, taxonomy classification, and spending analytics.
 */

export const CATEGORIES = [
  {
    id: 'investments',
    name: 'Investments & Wealth',
    color: '#10b981', // Emerald
    badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
    patterns: [
      /\bGROWW\b/i, /\bKUVERA\b/i, /\bZERODHA\b/i, /\bUPSTOX\b/i, /MUTUAL\s*FUND/i,
      /AXIS\s*MUTUAL/i, /\bMIRAE\b/i, /\bNPS\b/i, /\bPPF\b/i, /\bSECURITIES\b/i,
      /HDFC\s*MF/i, /ICICI\s*PRUDENTIAL/i, /\bNIPPON\b/i, /SBI\s*MUTUAL/i,
      /PARAG\s*PARIKH/i, /UTI\s*MUTUAL/i
    ]
  },
  {
    id: 'credit_card',
    name: 'Credit Card & Loans',
    color: '#8b5cf6', // Violet
    badgeClass: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20',
    patterns: [
      /PZ\s*HDFC\s*CC/i, /PZHDFCCCBILLPAYUPI/i, /PZCREDITCARD/i, /PZCREDITCARDUPI/i,
      /CREDIT\s*CARD/i, /CC\s*BILLPAY/i, /\bCRED\b/i, /\bLOAN\b/i, /\bEMI\b/i
    ]
  },
  {
    id: 'food_dining',
    name: 'Food & Dining',
    color: '#f59e0b', // Amber
    badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
    patterns: [
      /MIDTOWN\s*FOODS/i, /EMBER\s*CRUST/i, /DAKSHIN\s*DELIGHTS/i, /\bSWIGGY\b/i,
      /\bZOMATO\b/i, /\bRESTAURANT\b/i, /\bCAFE\b/i, /\bBAKERY\b/i, /\bFOOD\b/i,
      /\bPIZZA\b/i, /\bBURGER\b/i, /\bCHAI\b/i, /\bCOFFEE\b/i
    ]
  },
  {
    id: 'utilities',
    name: 'Utilities & Housing',
    color: '#06b6d4', // Cyan
    badgeClass: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/20',
    patterns: [
      /PZELECTRICITY/i, /\bELECTRICITY\b/i, /MYXENIUS/i, /RADIUS\s*SYNERGIES/i,
      /\bBESCOM\b/i, /\bTNEB\b/i, /\bWATER\b/i, /\bGAS\b/i, /\bAIRTEL\b/i,
      /\bJIO\b/i, /\bBROADBAND\b/i, /\bBILL\b/i
    ]
  },
  {
    id: 'transfers',
    name: 'Personal Transfers',
    color: '#3b82f6', // Blue
    badgeClass: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
    patterns: [
      /\bSANCHAIKA\b/i, /\bCHAKRABORT\b/i, /\bKAUSTAV\b/i, /\bPASWAN\b/i,
      /TRANSFER\s*TO/i, /\bFAMILY\b/i
    ]
  },
  {
    id: 'travel',
    name: 'Travel & Commute',
    color: '#f43f5e', // Rose
    badgeClass: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20',
    patterns: [
      /AISHA\s*GUEST\s*HOUSE/i, /\bHOTEL\b/i, /GUEST\s*HOUSE/i, /\bUBER\b/i,
      /\bOLA\b/i, /\bIRCTC\b/i, /\bFLIGHT\b/i, /\bINDIGO\b/i, /MAKEMYTRIP/i,
      /\bFUEL\b/i, /\bPETROL\b/i
    ]
  },
  {
    id: 'shopping',
    name: 'Shopping & Services',
    color: '#64748b', // Slate
    badgeClass: 'bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/20',
    patterns: [
      /\bAMAZON\b/i, /\bFLIPKART\b/i, /\bMYNTRA\b/i, /PAX\s*INNOVATION/i,
      /\bRAZORPAY\b/i, /\bPAYTM\b/i, /RELIANCE\s*RETAIL/i, /\bSTORE\b/i,
      /\bMART\b/i, /\bGROCERY\b/i, /\bBLINKIT\b/i, /\bZEPTO\b/i, /\bINSTAMART\b/i,
      /CP\s*WEQ/i
    ]
  },
  {
    id: 'other',
    name: 'Other / Miscellaneous',
    color: '#94a3b8',
    badgeClass: 'bg-neutral-500/10 text-neutral-700 dark:text-neutral-400 border-neutral-500/20',
    patterns: []
  }
];

export const CATEGORY_MAP = new Map(CATEGORIES.map(c => [c.name, c]));

const ALIAS_RULES = [
  { pattern: /GROWW/i, alias: 'Groww Invest Tech' },
  { pattern: /KUVERA/i, alias: 'Kuvera' },
  { pattern: /(?:PZ\s*HDFC\s*CC|PZHDFCCCBILLPAYUPI|PZCREDITCARD|CREDIT\s*CARD)/i, alias: 'HDFC Credit Card Bill' },
  { pattern: /MIDTOWN\s*FOODS/i, alias: 'Midtown Foods' },
  { pattern: /RADIUS\s*SYNERGIES/i, alias: 'Radius Synergies (Electricity)' },
  { pattern: /(?:SANCHAIKA|CHAKRABORT)/i, alias: 'Sanchaika Chakraborty' },
  { pattern: /EMBER\s*CRUST/i, alias: 'Ember Crust' },
  { pattern: /DAKSHIN\s*DELIGHTS/i, alias: 'Dakshin Delights' },
  { pattern: /PZELECTRICITY/i, alias: 'PZ Electricity' },
  { pattern: /AISHA\s*GUEST\s*HOUSE/i, alias: 'Aisha Guest House' },
  { pattern: /PAX\s*INNOVATION/i, alias: 'Pax Innovation' },
  { pattern: /PASWAN/i, alias: 'Shatrudhan Paswan' },
  { pattern: /CP\s*WEQ/i, alias: 'CP WEQ' }
];

const SCRUB_PATTERNS = [
  /Opening\s*Balance\s*:.*$/i,
  /Closing\s*Balance\s*:.*$/i,
  /Limit\s*:.*$/i,
  /Txn\s*Date\b.*$/i,
  /Page\s+\d+\s+of\s+\d+.*$/i,
  /Login\s+to\s+online\s+Banking.*$/i,
  /Stay\s+updated\s+with\s+important\s+updates.*$/i,
  /Report\s+irregularities\s+in\s+your\s+statement.*$/i,
  /register\s+nominee\s+in\s+your\s+accounts.*$/i,
  /Please\s+ensure\s+your\s+latest\s+email.*$/i,
  /Register\s+now\s+to\s+nev.*$/i,
  /empty\s*note\b/i,
  /Value\s+Date\b.*$/i,
  /Value\s+Dt\s+\d{2}[/-]\d{2}[/-]\d{2,4}/i
];

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Removes residual statement header lines and promotional noise.
 */
export function scrubNarration(raw) {
  if (!raw) return '';
  let text = String(raw);
  text = text.replace(/\bPayme\s+nt\b/gi, 'Payment');
  text = text.replace(/\bP\s+aid\b/gi, 'Paid');
  for (const p of SCRUB_PATTERNS) {
    text = text.replace(p, '');
  }
  text = text.replace(/\s+/g, ' ').trim();
  text = text.replace(/[\s\-_/]+$/, '').trim();
  return text;
}

/**
 * Extracts and normalizes merchant / payee name from transaction narration.
 */
export function extractMerchant(narration) {
  const clean = (narration || '').trim();
  for (const rule of ALIAS_RULES) {
    if (rule.pattern.test(clean)) {
      return rule.alias;
    }
  }
  // HDFC UPI format: UPI-<Merchant>-<VPA>-...
  const hdfcMatch = clean.match(/^UPI-([^@-]+?)-(?:[A-Za-z0-9._]+@|pty|ybl|paytm)/i);
  if (hdfcMatch) {
    return hdfcMatch[1].trim();
  }
  // SCB UPI format: UPI/<REF>/ <MERCHANT> /...
  const scbMatch = clean.match(/^UPI\/\d+\/\s*([^/]+?)\s*\//);
  if (scbMatch) {
    return scbMatch[1].trim();
  }
  // NEFT format: NEFT <REF> <NAME>
  const neftMatch = clean.match(/^NEFT\s+(?:[A-Z0-9]+\s+)?([A-Za-z0-9\s]+?)(?:-|\s+AXIS|\s+HDFC|$)/i);
  if (neftMatch) {
    return neftMatch[1].trim();
  }
  return clean.length > 30 ? clean.slice(0, 30).trim() : (clean || 'Unknown Merchant');
}

/**
 * Categorizes a transaction into standardized spend taxonomy.
 */
export function categorizeTransaction(tx) {
  const narration = typeof tx === 'string' ? tx : (tx?.narration || '');
  const type = (tx?.type || 'DR').toUpperCase();

  const merchant = extractMerchant(narration);

  if (type === 'CR') {
    return {
      categoryId: 'income',
      category: 'Income & Deposits',
      color: '#22c55e',
      badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
      merchant
    };
  }

  for (const cat of CATEGORIES) {
    for (const pat of cat.patterns) {
      if (pat.test(narration)) {
        return {
          categoryId: cat.id,
          category: cat.name,
          color: cat.color,
          badgeClass: cat.badgeClass,
          merchant
        };
      }
    }
  }

  const other = CATEGORIES.find(c => c.id === 'other');
  return {
    categoryId: 'other',
    category: other.name,
    color: other.color,
    badgeClass: other.badgeClass,
    merchant
  };
}

/**
 * Parses flexible bank date formats into JS Date object.
 */
export function parseTxDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  // DD/MM/YYYY or DD-MM-YYYY
  let m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (m) {
    let day = parseInt(m[1], 10);
    let month = parseInt(m[2], 10) - 1;
    let year = parseInt(m[3], 10);
    if (year < 100) year += 2000;
    return new Date(year, month, day);
  }
  // DD Mon YYYY (e.g. "29 Jul 2026", "10 Aug 2026")
  m = s.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})$/);
  if (m) {
    let day = parseInt(m[1], 10);
    let monStr = m[2].slice(0, 3).toLowerCase();
    let month = MONTH_NAMES.findIndex(x => x.toLowerCase() === monStr);
    let year = parseInt(m[3], 10);
    if (month !== -1) return new Date(year, month, day);
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Formats date into 'Mon YYYY' period key (e.g. 'Sep 2026').
 */
export function formatMonthKey(raw) {
  const d = parseTxDate(raw);
  if (!d) return 'Unknown';
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Formats date for display in ledger table (e.g. '01 Sep 2026').
 */
export function formatDisplayDate(raw) {
  const d = parseTxDate(raw);
  if (!d) return String(raw || '');
  const day = String(d.getDate()).padStart(2, '0');
  const mon = MONTH_NAMES[d.getMonth()];
  const yr = d.getFullYear();
  return `${day} ${mon} ${yr}`;
}

/**
 * Formats short date for chart axis (e.g. '01 Sep').
 */
export function formatChartDate(raw) {
  const d = parseTxDate(raw);
  if (!d) return String(raw || '');
  const day = String(d.getDate()).padStart(2, '0');
  const mon = MONTH_NAMES[d.getMonth()];
  return `${day} ${mon}`;
}

/**
 * Computes end-to-end spending analytics across single or multi-account portfolios.
 * Handles client-side period & account filters seamlessly.
 */
export function computeSpendingAnalytics(bankAccounts = [], dateFilter = 'all', accountFilter = 'all') {
  const accountsList = Array.isArray(bankAccounts) ? bankAccounts : [];

  // 1. Gather all transactions with account context
  const rawDebits = [];
  const accountOptions = [{ id: 'all', label: `All Accounts (${accountsList.length})` }];
  const monthSet = new Set();

  for (const acc of accountsList) {
    const accNumber = String(acc.account_number || acc.masked_account_number || 'ACC');
    const accLabel = `${acc.bank_name || 'Bank'} ${acc.masked_account_number || ''}`.trim();
    accountOptions.push({
      id: accNumber,
      label: accLabel,
      bank: acc.bank_name || 'Bank',
      masked: acc.masked_account_number || ''
    });

    const txs = Array.isArray(acc.transactions) ? acc.transactions : [];
    for (const t of txs) {
      if ((t.type || '').toUpperCase() === 'DR' && (Number(t.amount) || 0) > 0) {
        const mKey = formatMonthKey(t.date);
        if (mKey !== 'Unknown') {
          monthSet.add(mKey);
        }
        rawDebits.push({
          ...t,
          accountNumber: accNumber,
          accountLabel: accLabel,
          bankName: acc.bank_name || 'Bank',
          maskedAccount: acc.masked_account_number || ''
        });
      }
    }
  }

  // Chronologically sorted distinct months
  const availableMonths = Array.from(monthSet).sort((a, b) => {
    const [ma, ya] = a.split(' ');
    const [mb, yb] = b.split(' ');
    const da = new Date(parseInt(ya, 10), MONTH_NAMES.indexOf(ma), 1);
    const db = new Date(parseInt(yb, 10), MONTH_NAMES.indexOf(mb), 1);
    return db - da;
  });

  // 2. Filter debits by account and date
  const filteredDebits = rawDebits.filter(tx => {
    // Account filter
    if (accountFilter !== 'all' && tx.accountNumber !== accountFilter && tx.maskedAccount !== accountFilter) {
      return false;
    }
    // Period filter
    if (dateFilter !== 'all') {
      const mKey = formatMonthKey(tx.date);
      if (mKey !== dateFilter) {
        return false;
      }
    }
    return true;
  });

  // 3. Enrich transactions with classification and clean narration
  const enrichedDebits = filteredDebits.map(t => {
    const cleanNarr = scrubNarration(t.narration);
    const classification = categorizeTransaction(cleanNarr);
    return {
      ...t,
      cleanNarration: cleanNarr,
      category: t.category || classification.category,
      categoryId: classification.categoryId,
      color: t.color || classification.color,
      badgeClass: classification.badgeClass,
      merchant: t.merchant || classification.merchant,
      parsedDate: parseTxDate(t.date),
      displayDate: formatDisplayDate(t.date),
      amount: Math.round(Number(t.amount) * 100) / 100
    };
  });

  // Sort descending by date, then amount
  enrichedDebits.sort((a, b) => {
    const timeA = a.parsedDate?.getTime() || 0;
    const timeB = b.parsedDate?.getTime() || 0;
    if (timeB !== timeA) return timeB - timeA;
    return b.amount - a.amount;
  });

  const totalOutflow = Math.round(enrichedDebits.reduce((sum, t) => sum + t.amount, 0) * 100) / 100;

  if (totalOutflow === 0 || enrichedDebits.length === 0) {
    return {
      total_outflow: 0,
      investment_outflow: 0,
      pure_living_expenses: 0,
      daily_burn_rate: 0,
      total_debit_transactions: 0,
      top_category: null,
      categories: [],
      top_merchants: [],
      archetype_50_30_20: {
        needs: { amount: 0, percentage: 0 },
        wants: { amount: 0, percentage: 0 },
        investments: { amount: 0, percentage: 0 },
        transfers: { amount: 0, percentage: 0 }
      },
      daily_spends: [],
      available_months: availableMonths,
      available_accounts: accountOptions,
      filtered_transactions: []
    };
  }

  // 4. Category and Merchant aggregations
  const catMap = new Map();
  const merchMap = new Map();
  const dailySpendsMap = new Map();

  for (const t of enrichedDebits) {
    // Categories
    const cName = t.category || 'Other / Miscellaneous';
    const cColor = t.color || '#94a3b8';
    const cBadge = t.badgeClass || '';
    if (!catMap.has(cName)) {
      catMap.set(cName, {
        name: cName,
        amount: 0,
        count: 0,
        color: cColor,
        badgeClass: cBadge
      });
    }
    const catEntry = catMap.get(cName);
    catEntry.amount = Math.round((catEntry.amount + t.amount) * 100) / 100;
    catEntry.count += 1;

    // Merchants
    const mName = t.merchant || 'Unknown';
    if (!merchMap.has(mName)) {
      merchMap.set(mName, {
        name: mName,
        amount: 0,
        count: 0,
        category: cName,
        color: cColor
      });
    }
    const merchEntry = merchMap.get(mName);
    merchEntry.amount = Math.round((merchEntry.amount + t.amount) * 100) / 100;
    merchEntry.count += 1;

    // Daily spending points (for Recharts)
    const dayKey = t.displayDate;
    if (!dailySpendsMap.has(dayKey)) {
      dailySpendsMap.set(dayKey, {
        date: formatChartDate(t.date),
        displayDate: dayKey,
        timestamp: t.parsedDate?.getTime() || 0,
        amount: 0,
        count: 0,
        merchants: {}
      });
    }
    const dayEntry = dailySpendsMap.get(dayKey);
    dayEntry.amount = Math.round((dayEntry.amount + t.amount) * 100) / 100;
    dayEntry.count += 1;
    dayEntry.merchants[mName] = (dayEntry.merchants[mName] || 0) + t.amount;
  }

  // Format categories list with shares
  const categories = Array.from(catMap.values())
    .sort((a, b) => b.amount - a.amount)
    .map(c => ({
      ...c,
      percentage: totalOutflow > 0 ? Math.round((c.amount / totalOutflow) * 1000) / 10 : 0
    }));

  const topCategory = categories.length > 0 ? categories[0] : null;

  // Top Merchants with average transaction size
  const topMerchants = Array.from(merchMap.values())
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8)
    .map(m => ({
      ...m,
      avg_amount: m.count > 0 ? Math.round((m.amount / m.count) * 100) / 100 : m.amount
    }));

  // Daily points sorted chronologically ascending for line/bar chart
  const dailySpends = Array.from(dailySpendsMap.values())
    .sort((a, b) => a.timestamp - b.timestamp)
    .map(item => {
      // Find highest spending merchant for tooltip preview
      const topMerchEntry = Object.entries(item.merchants).sort((a, b) => b[1] - a[1])[0];
      return {
        date: item.date,
        displayDate: item.displayDate,
        amount: item.amount,
        count: item.count,
        primary_merchant: topMerchEntry ? topMerchEntry[0] : 'Various'
      };
    });

  // Calculate Living Expenses and Burn Rate
  const investmentOutflow = catMap.get('Investments & Wealth')?.amount || 0;
  const pureLivingExpenses = Math.round((totalOutflow - investmentOutflow) * 100) / 100;

  // Determine span days for burn rate:
  // If filter is specific month, use 31 (or days in month), otherwise calculate span between first and last txn
  let numDays = 31;
  if (dailySpends.length >= 2) {
    const firstTs = dailySpends[0].timestamp;
    const lastTs = dailySpends[dailySpends.length - 1].timestamp;
    const spanDays = Math.max(1, Math.round((lastTs - firstTs) / (1000 * 60 * 60 * 24)) + 1);
    numDays = (spanDays >= 28 && spanDays <= 31) ? 31 : spanDays;
  }
  const dailyBurnRate = Math.round((pureLivingExpenses / (numDays || 31)) * 100) / 100;

  // 50/30/20 Archetype Lens
  const needsAmt = Math.round(((catMap.get('Credit Card & Loans')?.amount || 0) + (catMap.get('Utilities & Housing')?.amount || 0)) * 100) / 100;
  const wantsAmt = Math.round(((catMap.get('Food & Dining')?.amount || 0) + (catMap.get('Travel & Commute')?.amount || 0) + (catMap.get('Shopping & Services')?.amount || 0) + (catMap.get('Other / Miscellaneous')?.amount || 0)) * 100) / 100;
  const transfersAmt = Math.round((catMap.get('Personal Transfers')?.amount || 0) * 100) / 100;

  const archetype = {
    needs: {
      amount: needsAmt,
      percentage: totalOutflow > 0 ? Math.round((needsAmt / totalOutflow) * 1000) / 10 : 0
    },
    wants: {
      amount: wantsAmt,
      percentage: totalOutflow > 0 ? Math.round((wantsAmt / totalOutflow) * 1000) / 10 : 0
    },
    investments: {
      amount: investmentOutflow,
      percentage: totalOutflow > 0 ? Math.round((investmentOutflow / totalOutflow) * 1000) / 10 : 0
    },
    transfers: {
      amount: transfersAmt,
      percentage: totalOutflow > 0 ? Math.round((transfersAmt / totalOutflow) * 1000) / 10 : 0
    }
  };

  return {
    total_outflow: totalOutflow,
    investment_outflow: investmentOutflow,
    pure_living_expenses: pureLivingExpenses,
    daily_burn_rate: dailyBurnRate,
    total_debit_transactions: enrichedDebits.length,
    top_category: topCategory,
    categories,
    top_merchants: topMerchants,
    archetype_50_30_20: archetype,
    daily_spends: dailySpends,
    available_months: availableMonths,
    available_accounts: accountOptions,
    filtered_transactions: enrichedDebits
  };
}
