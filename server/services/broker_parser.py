#!/usr/bin/env python3
"""
Robust parser for Indian broker holdings spreadsheets (Groww, Zerodha, Upstox, Angel One, Generic CSV/XLSX).
Extracts:
1. Stocks & ETFs: ISIN, stock name, quantity, average buying price, invested buy value, closing value, and P&L.
2. Mutual Funds: Scheme name, AMC, category, subcategory, folio, units, invested value, current value, returns, and XIRR.
Outputs structured JSON to stdout.
"""

import sys
import os
import json
import re
import csv
import warnings
warnings.filterwarnings('ignore')

try:
    import openpyxl
except ImportError:
    openpyxl = None


def normalize_isin(val):
    if not val:
        return None
    s = str(val).strip().upper()
    if re.match(r'^[A-Z]{2}[A-Z0-9]{9}[0-9]$', s):
        return s
    return None


def clean_num(val):
    if val is None or val == '':
        return 0.0
    if isinstance(val, (int, float)):
        return float(val)
    s = str(val).strip().replace(',', '').replace('₹', '').replace(' ', '')
    try:
        return float(s)
    except ValueError:
        return 0.0


def clean_pct(val):
    if val is None or val == '':
        return None
    if isinstance(val, (int, float)):
        return round(float(val), 2)
    s = str(val).strip().replace('%', '').replace(' ', '')
    try:
        return round(float(s), 2)
    except ValueError:
        return None


def identify_columns(headers):
    """
    Identifies column indices for Stocks: ISIN, Name, Symbol, Quantity, Avg Buy Price, Buy Value.
    """
    mapping = {
        'isin': None,
        'name': None,
        'symbol': None,
        'quantity': None,
        'avg_buy_price': None,
        'buy_value': None,
        'closing_price': None,
        'closing_value': None,
        'pnl': None
    }

    lower_headers = [str(h or '').strip().lower() for h in headers]

    for idx, h in enumerate(lower_headers):
        if not h:
            continue
        # ISIN
        if h == 'isin' or 'isin' in h:
            if mapping['isin'] is None:
                mapping['isin'] = idx
        # Quantity
        elif any(k in h for k in ['quantity', 'qty', 'units', 'shares', 'total qty', 'available qty']):
            if mapping['quantity'] is None:
                mapping['quantity'] = idx
        # Avg Buy Price
        elif any(k in h for k in ['average buy price', 'avg. price', 'avg price', 'avg. cost', 'avg cost', 'buy price', 'cost price', 'average price', 'purchase price']):
            if mapping['avg_buy_price'] is None:
                mapping['avg_buy_price'] = idx
        # Buy Value / Invested Value
        elif any(k in h for k in ['buy value', 'invested value', 'total cost', 'invested', 'buy val', 'cost value']):
            if mapping['buy_value'] is None:
                mapping['buy_value'] = idx
        # Stock Name
        elif any(k in h for k in ['stock name', 'company name', 'scrip name', 'security name', 'instrument name', 'name']):
            if mapping['name'] is None:
                mapping['name'] = idx
        # Symbol
        elif any(k in h for k in ['symbol', 'ticker', 'instrument', 'scrip']):
            if mapping['symbol'] is None:
                mapping['symbol'] = idx
        # Closing Price / Current Price / LTP / CMP
        elif any(k in h for k in ['closing price', 'close price', 'current price', 'market price', 'ltp', 'cmp', 'last price', 'latest price', 'cur price', 'current rate']):
            if mapping['closing_price'] is None:
                mapping['closing_price'] = idx
        # Closing Value / Current Value / Holding Value
        elif any(k in h for k in ['closing value', 'close value', 'current value', 'cur. val', 'cur val', 'market value', 'holding value', 'cur value', 'current val', 'total val']):
            if mapping['closing_value'] is None:
                mapping['closing_value'] = idx
        # P&L / Returns / Unrealized Gain
        elif any(k in h for k in ['unrealised p&l', 'unrealized p&l', 'unrealised pnl', 'unrealized pnl', 'p&l', 'pnl', 'returns', 'total return', 'profit/loss', 'gain']):
            if mapping['pnl'] is None:
                mapping['pnl'] = idx

    return mapping


def identify_mf_columns(headers):
    """
    Identifies column indices for Mutual Funds: Scheme Name, AMC, Category, Sub-category,
    Folio No., Source, Units, Invested Value, Current Value, Returns, XIRR, ISIN.
    """
    mapping = {
        'scheme': None,
        'amc': None,
        'category': None,
        'subcategory': None,
        'folio': None,
        'source': None,
        'units': None,
        'invested': None,
        'current_val': None,
        'nav': None,
        'avg_buy_nav': None,
        'returns': None,
        'returns_pct': None,
        'xirr': None,
        'isin': None
    }

    lower_headers = [str(h or '').strip().lower() for h in headers]

    for idx, h in enumerate(lower_headers):
        if not h:
            continue
        # ISIN
        if h == 'isin' or (('isin' in h) and not ('missing' in h)):
            if mapping['isin'] is None: mapping['isin'] = idx
        # Scheme Name
        elif any(k in h for k in ['scheme name', 'fund name', 'scheme', 'scrip name', 'security name', 'fund']):
            if mapping['scheme'] is None: mapping['scheme'] = idx
        # AMC
        elif any(k in h for k in ['amc', 'fund house', 'mutual fund company']):
            if mapping['amc'] is None: mapping['amc'] = idx
        # Sub-category before category check
        elif any(k in h for k in ['sub-category', 'subcategory', 'sub category']):
            if mapping['subcategory'] is None: mapping['subcategory'] = idx
        # Category
        elif any(k in h for k in ['category', 'asset class']):
            if mapping['category'] is None: mapping['category'] = idx
        # Folio Number
        elif any(k in h for k in ['folio no.', 'folio no', 'folio number', 'folio', 'folio_no']):
            if mapping['folio'] is None: mapping['folio'] = idx
        # Source
        elif any(k in h for k in ['source', 'platform']):
            if mapping['source'] is None: mapping['source'] = idx
        # Units / Quantity
        elif any(k in h for k in ['units', 'quantity', 'qty', 'balance units']):
            if mapping['units'] is None: mapping['units'] = idx
        # Invested Value
        elif any(k in h for k in ['invested value', 'invested', 'buy value', 'total cost', 'cost value', 'investment amount']):
            if mapping['invested'] is None: mapping['invested'] = idx
        # Current Value
        elif any(k in h for k in ['current value', 'current portfolio value', 'market value', 'valuation', 'closing value', 'cur. val', 'cur val']):
            if mapping['current_val'] is None: mapping['current_val'] = idx
        # NAV / Current NAV
        elif any(k in h for k in ['current nav', 'closing nav', 'latest nav', 'nav', 'cmp']):
            if mapping['nav'] is None: mapping['nav'] = idx
        # Avg Buy NAV
        elif any(k in h for k in ['avg. nav', 'average nav', 'buy nav', 'purchase nav']):
            if mapping['avg_buy_nav'] is None: mapping['avg_buy_nav'] = idx
        # Returns %
        elif any(k in h for k in ['returns %', 'profit/loss %', 'gain %', 'p&l %']):
            if mapping['returns_pct'] is None: mapping['returns_pct'] = idx
        # Returns / Profit
        elif any(k in h for k in ['returns', 'profit/loss', 'unrealised p&l', 'unrealized p&l', 'p&l', 'gain']):
            if mapping['returns'] is None: mapping['returns'] = idx
        # XIRR
        elif any(k in h for k in ['xirr', 'annualized return', 'cagr']):
            if mapping['xirr'] is None: mapping['xirr'] = idx

    return mapping


def detect_broker(sheet_content, file_name=""):
    """Heuristic broker identification from text content or headers."""
    content_str = str(sheet_content).lower() + " " + file_name.lower()
    if 'groww' in content_str or 'stocks_holdings_statement' in content_str or 'mutual_funds_' in content_str or 'holdings statement for stocks' in content_str:
        return 'Groww'
    elif 'coin' in content_str:
        return 'Zerodha Coin'
    elif 'zerodha' in content_str or 'kite' in content_str or 'holdings-' in content_str:
        return 'Zerodha'
    elif 'upstox' in content_str:
        return 'Upstox'
    elif 'angel' in content_str:
        return 'Angel One'
    elif 'dhan' in content_str:
        return 'Dhan'
    return 'Generic Broker'


def detect_table_type(rows, file_name=""):
    """
    Determines if rows represent Mutual Funds or Stocks.
    """
    fn_lower = file_name.lower()
    if 'mutual_fund' in fn_lower or 'mutual-fund' in fn_lower or 'mf_' in fn_lower:
        return 'MUTUAL_FUNDS'
    if 'stocks_holdings' in fn_lower or 'stock_holdings' in fn_lower:
        return 'STOCKS'

    # Check content / headers
    for r in rows[:25]:
        lower_r = [str(c or '').strip().lower() for c in r]
        r_text = " ".join(lower_r)
        if any('scheme name' in h for h in lower_r) and any('folio' in h for h in lower_r):
            return 'MUTUAL_FUNDS'
        if 'folio no.' in r_text or 'folio no' in r_text:
            return 'MUTUAL_FUNDS'
        if 'holdings statement for stocks' in r_text:
            return 'STOCKS'
        if any('isin' in h for h in lower_r) and any('average buy price' in h or 'avg. price' in h for h in lower_r):
            return 'STOCKS'

    return 'STOCKS'


def parse_mutual_funds_rows(rows, file_name=""):
    """
    Parses Mutual Funds statement rows (Groww, Zerodha Coin, Generic).
    Extracts client metadata, portfolio summary (Invested, Value, Returns, XIRR),
    and individual mutual fund folios.
    """
    broker = detect_broker(rows[:10], file_name)
    client_info = {}
    client_code = None
    as_on_date = None
    summary = {}

    # Extract client code from filename if formatted like Mutual_Funds_<UCC>_...
    m_fn_ucc = re.search(r'Mutual_Funds_([A-Z0-9]+)', file_name, re.IGNORECASE)
    if m_fn_ucc:
        client_code = m_fn_ucc.group(1)

    # 1. Extract metadata and summary from pre-table rows
    for idx, r in enumerate(rows[:25]):
        line = " ".join([str(c or '') for c in r])

        # Client Name
        if not client_info.get('name'):
            for c_idx, cell in enumerate(r):
                if str(cell or '').strip() == 'Name' and c_idx + 1 < len(r) and r[c_idx + 1]:
                    client_info['name'] = str(r[c_idx + 1]).strip()
                    break

        # PAN
        if not client_info.get('pan'):
            for c_idx, cell in enumerate(r):
                if str(cell or '').strip() == 'PAN' and c_idx + 1 < len(r) and r[c_idx + 1]:
                    client_info['pan'] = str(r[c_idx + 1]).strip()
                    break

        # Mobile Number
        if not client_info.get('mobile'):
            for c_idx, cell in enumerate(r):
                if 'mobile' in str(cell or '').lower() and c_idx + 1 < len(r) and r[c_idx + 1]:
                    client_info['mobile'] = str(r[c_idx + 1]).strip()
                    break

        # As On Date
        if not as_on_date:
            m_date = re.search(r'HOLDINGS\s+AS\s+ON\s+([0-9]{4}-[0-9]{2}-[0-9]{2}|[0-9]{2}-[0-9]{2}-[0-9]{4})', line, re.I)
            if m_date:
                as_on_date = m_date.group(1)

        # Client code from row
        if not client_code:
            m_code = re.search(r'(?:Unique Client Code|Client ID|UCC|Account No)[:\s]+([A-Z0-9]+)', line, re.I)
            if m_code:
                client_code = m_code.group(1)

        # Summary headers
        lower_r = [str(c or '').strip().lower() for c in r]
        if 'total investments' in lower_r and idx + 1 < len(rows):
            next_r = rows[idx + 1]
            for c_idx, h in enumerate(lower_r):
                if c_idx >= len(next_r):
                    continue
                val = next_r[c_idx]
                if 'total investment' in h:
                    summary['total_invested'] = clean_num(val)
                elif 'current portfolio value' in h or 'current value' in h:
                    summary['current_value'] = clean_num(val)
                elif 'profit/loss %' in h:
                    summary['returns_pct'] = clean_pct(val)
                elif 'profit/loss' in h:
                    summary['returns'] = clean_num(val)
                elif 'xirr' in h:
                    summary['xirr'] = clean_pct(val)

    if client_code and not client_info.get('client_code'):
        client_info['client_code'] = client_code

    # 2. Find header row
    header_idx = None
    col_map = None
    for idx, r in enumerate(rows):
        lower_r = [str(c or '').strip().lower() for c in r]
        if any('scheme' in h for h in lower_r) and any('folio' in h for h in lower_r):
            header_idx = idx
            col_map = identify_mf_columns(r)
            break

    if header_idx is None:
        # Fallback: look for row with scheme or fund name
        for idx, r in enumerate(rows):
            mapping = identify_mf_columns(r)
            if mapping['scheme'] is not None and (mapping['units'] is not None or mapping['invested'] is not None):
                header_idx = idx
                col_map = mapping
                break

    if header_idx is None:
        raise ValueError("Could not find a valid Mutual Funds table header row ('Scheme Name', 'Folio No.', 'Units').")

    # 3. Extract mutual funds
    funds = []
    for r in rows[header_idx + 1:]:
        if not r or not any(r):
            continue

        s_idx = col_map.get('scheme', 0)
        s_name = str(r[s_idx] or '').strip() if s_idx is not None and s_idx < len(r) else ''
        if not s_name or 'total' in s_name.lower() or 'disclaimer' in s_name.lower():
            continue

        units = clean_num(r[col_map['units']]) if col_map.get('units') is not None and col_map['units'] < len(r) else 0.0
        inv = clean_num(r[col_map['invested']]) if col_map.get('invested') is not None and col_map['invested'] < len(r) else 0.0
        cur = clean_num(r[col_map['current_val']]) if col_map.get('current_val') is not None and col_map['current_val'] < len(r) else 0.0
        ret = clean_num(r[col_map['returns']]) if col_map.get('returns') is not None and col_map['returns'] < len(r) else (cur - inv)
        xirr = clean_pct(r[col_map['xirr']]) if col_map.get('xirr') is not None and col_map['xirr'] < len(r) else None

        folio = str(r[col_map['folio']] or '').strip() if col_map.get('folio') is not None and col_map['folio'] < len(r) else ''
        amc = str(r[col_map['amc']] or '').strip() if col_map.get('amc') is not None and col_map['amc'] < len(r) else ''
        cat = str(r[col_map['category']] or '').strip() if col_map.get('category') is not None and col_map['category'] < len(r) else ''
        subcat = str(r[col_map['subcategory']] or '').strip() if col_map.get('subcategory') is not None and col_map['subcategory'] < len(r) else ''
        src = str(r[col_map['source']] or '').strip() if col_map.get('source') is not None and col_map['source'] < len(r) else broker

        isin = None
        if col_map.get('isin') is not None and col_map['isin'] < len(r):
            candidate = normalize_isin(r[col_map['isin']])
            if candidate:
                isin = candidate

        # Derived prices
        price = round(cur / units, 4) if units > 0 and cur > 0 else 0.0
        buy_price = round(inv / units, 4) if units > 0 and inv > 0 else 0.0
        gain_pct = round((ret / inv * 100), 2) if inv > 0 else 0.0

        funds.append({
            'isin': isin or '',
            'name': s_name,
            'amc': amc,
            'category': cat or 'MUTUAL_FUNDS',
            'subcategory': subcat,
            'folio': folio,
            'source': src,
            'quantity': units,
            'cost_basis': round(inv, 2),
            'value': round(cur, 2),
            'price': price,
            'buy_price': buy_price,
            'gain': round(ret, 2),
            'gain_pct': gain_pct,
            'xirr': xirr
        })

    total_inv_calc = sum(f['cost_basis'] for f in funds)
    total_cur_calc = sum(f['value'] for f in funds)
    total_ret_calc = sum(f['gain'] for f in funds)

    final_invested = summary.get('total_invested') if summary.get('total_invested') is not None else total_inv_calc
    final_current = summary.get('current_value') if summary.get('current_value') is not None else total_cur_calc
    final_returns = summary.get('returns') if summary.get('returns') is not None else total_ret_calc
    final_ret_pct = summary.get('returns_pct') if summary.get('returns_pct') is not None else (round((final_returns / final_invested * 100), 2) if final_invested > 0 else 0.0)
    final_xirr = summary.get('xirr')

    return {
        'success': True,
        'broker': broker,
        'statement_type': 'MUTUAL_FUNDS',
        'client_code': client_code,
        'client_info': client_info,
        'as_on_date': as_on_date,
        'total_positions': len(funds),
        'total_invested_value': round(final_invested, 2),
        'total_closing_value': round(final_current, 2),
        'total_unrealised_pnl': round(final_returns, 2),
        'portfolio_xirr': final_xirr,
        'summary': {
            'total_invested': round(final_invested, 2),
            'current_value': round(final_current, 2),
            'returns': round(final_returns, 2),
            'returns_pct': final_ret_pct,
            'xirr': final_xirr,
            'positions_count': len(funds)
        },
        'mutual_funds': funds
    }

KNOWN_ISIN_MAP = {
    "INE0HOQ01053": {"symbol": "GROWW", "name": "Billionbrains Garage (Groww)", "subtype": "DIRECT_STOCK"},
    "INE742F01042": {"symbol": "ADANIPORTS", "name": "Adani Ports & SEZ Ltd", "subtype": "DIRECT_STOCK"},
    "INE00WC01027": {"symbol": "AFFLE", "name": "Affle 3I Limited", "subtype": "DIRECT_STOCK"},
    "INE049B01025": {"symbol": "WOCKPHARMA", "name": "Wockhardt Limited", "subtype": "DIRECT_STOCK"},
    "INE249Z01020": {"symbol": "MAZDOCK", "name": "Mazagon Dock Shipbuilders Ltd", "subtype": "DIRECT_STOCK"},
    "INE918Z01012": {"symbol": "KAYNES", "name": "Kaynes Technology India Ltd", "subtype": "DIRECT_STOCK"},
    "INE455K01017": {"symbol": "POLYCAB", "name": "Polycab India Limited", "subtype": "DIRECT_STOCK"},
    "INE251B01027": {"symbol": "ZENTEC", "name": "Zen Technologies Limited", "subtype": "DIRECT_STOCK"},
    "INE1TAE01010": {"symbol": "TATAMOTORS", "name": "Tata Motors Limited", "subtype": "DIRECT_STOCK"},
    "INE056I01025": {"symbol": "REFEX", "name": "Refex Industries Limited", "subtype": "DIRECT_STOCK"},
    "INE255Z01027": {"symbol": "E2E", "name": "E2E Networks Limited", "subtype": "DIRECT_STOCK"},
    "INE285K01026": {"symbol": "TECHNOE", "name": "Techno Electric & Engineering Co Ltd", "subtype": "DIRECT_STOCK"},
    "INF204KB14I2": {"symbol": "NIFTYBEES", "name": "Nippon India ETF Nifty 50 BeES", "subtype": "ETF"},
    "INF204KB19I1": {"symbol": "HNGSNGBEES", "name": "Nippon India ETF Hang Seng BeES", "subtype": "ETF"},
    "INF247L01AP3": {"symbol": "MON100", "name": "Motilal Oswal NASDAQ 100 ETF", "subtype": "ETF"},
}


def parse_table_rows(rows, file_name=""):
    """
    Parses Stocks / Bonds holdings table rows (Groww, Zerodha, Upstox, Angel One, Dhan, Generic).
    """
    broker = detect_broker(rows[:10], file_name)
    client_code = None
    invested_summary = None
    closing_summary = None
    pnl_summary = None

    # Search for client code or summary headers in metadata rows
    for r in rows[:12]:
        row_str = " ".join([str(c or '') for c in r])
        m_code = re.search(r'(?:Unique Client Code|Client ID|UCC|Account No)[:\s]+([A-Z0-9]+)', row_str, re.IGNORECASE)
        if m_code:
            client_code = m_code.group(1)
        m_inv = re.search(r'(?:Invested Value|Total Investment)[:\s]+([\d,\.]+)', row_str, re.IGNORECASE)
        if m_inv:
            invested_summary = clean_num(m_inv.group(1))
        m_close = re.search(r'(?:Closing Value|Current Value|Total Current Value)[:\s]+([\d,\.]+)', row_str, re.IGNORECASE)
        if m_close:
            closing_summary = clean_num(m_close.group(1))
        m_pnl = re.search(r'(?:Unrealised P&L|Unrealized P&L|Total P&L)[:\s]+([\d,\.\-]+)', row_str, re.IGNORECASE)
        if m_pnl:
            pnl_summary = clean_num(m_pnl.group(1))

    # Find the header row by searching for ISIN or Symbol keywords
    header_row_idx = None
    col_mapping = None

    for idx, r in enumerate(rows):
        mapping = identify_columns(r)
        # Must at least have ISIN or (symbol/name and avg_buy_price)
        if (mapping['isin'] is not None and mapping['avg_buy_price'] is not None) or \
           (mapping['isin'] is not None and mapping['quantity'] is not None):
            header_row_idx = idx
            col_mapping = mapping
            break

    if header_row_idx is None:
        # Fallback: scan for any row with 'ISIN'
        for idx, r in enumerate(rows):
            for c_idx, cell in enumerate(r):
                if str(cell or '').strip().upper() == 'ISIN':
                    header_row_idx = idx
                    col_mapping = identify_columns(r)
                    break
            if header_row_idx is not None:
                break

    if header_row_idx is None:
        raise ValueError("Could not find a valid table header row with 'ISIN' or 'Average buy price' in spreadsheet.")

    # Extract holdings
    holdings = []
    seen_isins = set()

    for r in rows[header_row_idx + 1:]:
        if not r or not any(r):
            continue

        isin_val = r[col_mapping['isin']] if col_mapping['isin'] is not None and col_mapping['isin'] < len(r) else None
        valid_isin = normalize_isin(isin_val)
        if not valid_isin:
            # Check if any cell in row looks like an ISIN
            for cell in r:
                candidate = normalize_isin(cell)
                if candidate:
                    valid_isin = candidate
                    break

        if not valid_isin:
            continue

        if valid_isin in seen_isins:
            continue
        seen_isins.add(valid_isin)

        # Quantity
        qty = 0.0
        if col_mapping['quantity'] is not None and col_mapping['quantity'] < len(r):
            qty = clean_num(r[col_mapping['quantity']])

        # Avg buy price
        avg_price = 0.0
        if col_mapping['avg_buy_price'] is not None and col_mapping['avg_buy_price'] < len(r):
            avg_price = clean_num(r[col_mapping['avg_buy_price']])

        # Buy value
        buy_val = 0.0
        if col_mapping['buy_value'] is not None and col_mapping['buy_value'] < len(r):
            buy_val = clean_num(r[col_mapping['buy_value']])
        if buy_val <= 0 and qty > 0 and avg_price > 0:
            buy_val = round(qty * avg_price, 2)
        elif avg_price <= 0 and qty > 0 and buy_val > 0:
            avg_price = round(buy_val / qty, 2)

        # Closing Price / Current Price / LTP
        closing_price = 0.0
        if col_mapping['closing_price'] is not None and col_mapping['closing_price'] < len(r):
            closing_price = clean_num(r[col_mapping['closing_price']])

        # Closing Value / Current Value
        closing_val = 0.0
        if col_mapping['closing_value'] is not None and col_mapping['closing_value'] < len(r):
            closing_val = clean_num(r[col_mapping['closing_value']])
        if closing_val <= 0 and closing_price > 0 and qty > 0:
            closing_val = round(qty * closing_price, 2)
        elif closing_price <= 0 and closing_val > 0 and qty > 0:
            closing_price = round(closing_val / qty, 2)

        # P&L / Returns
        pnl_val = None
        if col_mapping['pnl'] is not None and col_mapping['pnl'] < len(r):
            raw_pnl = r[col_mapping['pnl']]
            if raw_pnl is not None and str(raw_pnl).strip() != '':
                pnl_val = clean_num(raw_pnl)
        if pnl_val is None and closing_val > 0 and buy_val > 0:
            pnl_val = round(closing_val - buy_val, 2)

        # Name & Symbol
        name = ""
        if col_mapping['name'] is not None and col_mapping['name'] < len(r):
            name = str(r[col_mapping['name']] or '').strip()

        subtype = None
        if valid_isin in KNOWN_ISIN_MAP:
            symbol = KNOWN_ISIN_MAP[valid_isin]["symbol"]
            if not name or "BILLION" in name.upper():
                name = KNOWN_ISIN_MAP[valid_isin]["name"]
            subtype = KNOWN_ISIN_MAP[valid_isin].get("subtype")
        else:
            symbol = ""
            if col_mapping['symbol'] is not None and col_mapping['symbol'] < len(r):
                symbol = str(r[col_mapping['symbol']] or '').strip().upper()

            if not symbol and name:
                # Clean up symbol from name if uppercase
                parts = name.split()
                if len(parts) > 0 and parts[0].isalnum() and parts[0].isupper():
                    symbol = parts[0]
        holdings.append({
            'isin': valid_isin,
            'name': name,
            'symbol': symbol,
            'subtype': subtype,
            'quantity': qty,
            'avg_buy_price': round(avg_price, 2),
            'buy_value': round(buy_val, 2),
            'closing_price': round(closing_price, 2) if closing_price > 0 else None,
            'closing_value': round(closing_val, 2) if closing_val > 0 else None,
            'pnl': round(pnl_val, 2) if pnl_val is not None else None
        })

    total_buy_val = sum(h['buy_value'] for h in holdings)
    total_close_val = sum(h['closing_value'] or 0 for h in holdings)
    total_pnl_val = sum(h['pnl'] or 0 for h in holdings)

    return {
        'success': True,
        'broker': broker,
        'statement_type': 'STOCKS',
        'client_code': client_code,
        'total_positions': len(holdings),
        'total_invested_value': round(invested_summary or total_buy_val, 2),
        'total_closing_value': round(closing_summary or total_close_val, 2),
        'total_unrealised_pnl': round(pnl_summary if pnl_summary is not None else total_pnl_val, 2),
        'holdings': holdings
    }


def parse_xlsx(file_path):
    if not openpyxl:
        raise RuntimeError("openpyxl is not installed in the Python environment")

    file_name = os.path.basename(file_path)
    with open(file_path, 'rb') as f:
        wb = openpyxl.load_workbook(f, data_only=True)

        results = []
        for sheet_name in wb.sheetnames:
            sheet = wb[sheet_name]
            all_rows = []
            for r in range(1, min(sheet.max_row + 1, 500)):
                row_vals = [sheet.cell(r, c).value for c in range(1, min(sheet.max_column + 1, 30))]
                if any(row_vals):
                    all_rows.append(row_vals)

            if not all_rows:
                continue

            t_type = detect_table_type(all_rows, file_name)
            if t_type == 'MUTUAL_FUNDS':
                try:
                    res = parse_mutual_funds_rows(all_rows, file_name)
                    results.append(res)
                except Exception:
                    pass
            else:
                try:
                    res = parse_table_rows(all_rows, file_name)
                    results.append(res)
                except Exception:
                    pass

        wb.close()

    if not results:
        raise ValueError("Could not extract any valid holdings or mutual funds from Excel workbook.")

    if len(results) == 1:
        return results[0]

    # If both stocks and mutual funds are present across sheets, combine them
    mf_res = next((r for r in results if r.get('statement_type') == 'MUTUAL_FUNDS'), None)
    stock_res = next((r for r in results if r.get('statement_type') == 'STOCKS'), None)

    if mf_res and stock_res:
        return {
            'success': True,
            'broker': mf_res.get('broker') or stock_res.get('broker'),
            'statement_type': 'COMBINED',
            'client_code': mf_res.get('client_code') or stock_res.get('client_code'),
            'client_info': mf_res.get('client_info'),
            'as_on_date': mf_res.get('as_on_date'),
            'total_positions': stock_res.get('total_positions', 0) + mf_res.get('total_positions', 0),
            'total_invested_value': round(stock_res.get('total_invested_value', 0) + mf_res.get('total_invested_value', 0), 2),
            'total_closing_value': round(stock_res.get('total_closing_value', 0) + mf_res.get('total_closing_value', 0), 2),
            'total_unrealised_pnl': round(stock_res.get('total_unrealised_pnl', 0) + mf_res.get('total_unrealised_pnl', 0), 2),
            'portfolio_xirr': mf_res.get('portfolio_xirr'),
            'holdings': stock_res.get('holdings', []),
            'mutual_funds': mf_res.get('mutual_funds', []),
            'mf_summary': mf_res.get('summary', {}),
            'stocks_summary': {
                'total_positions': stock_res.get('total_positions', 0),
                'total_invested_value': stock_res.get('total_invested_value', 0),
                'total_closing_value': stock_res.get('total_closing_value', 0),
                'total_unrealised_pnl': stock_res.get('total_unrealised_pnl', 0)
            }
        }

    return results[0]


def parse_csv(file_path):
    all_rows = []
    encodings = ['utf-8', 'utf-8-sig', 'latin-1', 'cp1252']
    file_name = os.path.basename(file_path)

    for enc in encodings:
        try:
            with open(file_path, 'r', encoding=enc) as f:
                reader = csv.reader(f)
                for row in reader:
                    all_rows.append(row)
            break
        except UnicodeDecodeError:
            all_rows = []
            continue

    if not all_rows:
        raise ValueError("Could not decode CSV file with supported encodings")

    t_type = detect_table_type(all_rows, file_name)
    if t_type == 'MUTUAL_FUNDS':
        return parse_mutual_funds_rows(all_rows, file_name)
    return parse_table_rows(all_rows, file_name)


def main():
    if len(sys.argv) < 2:
        print(json.dumps({
            'success': False,
            'error': 'Usage: broker_parser.py <spreadsheet_path (.xlsx/.xls/.csv)>'
        }))
        sys.exit(1)

    file_path = sys.argv[1]
    if not os.path.exists(file_path):
        print(json.dumps({
            'success': False,
            'error': f"File not found: {file_path}"
        }))
        sys.exit(1)

    import zipfile
    try:
        if zipfile.is_zipfile(file_path):
            data = parse_xlsx(file_path)
        else:
            data = parse_csv(file_path)

        print(json.dumps(data))
        sys.exit(0)
    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': str(e)
        }))
        sys.exit(1)


if __name__ == '__main__':
    main()
