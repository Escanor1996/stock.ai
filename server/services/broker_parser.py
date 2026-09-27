#!/usr/bin/env python3
"""
Robust parser for Indian broker holdings spreadsheets (Groww, Zerodha, Upstox, Angel One, Generic CSV/XLSX).
Extracts ISIN, stock name, quantity, average buying price, and invested buy value.
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


def identify_columns(headers):
    """
    Identifies column indices for ISIN, Name, Symbol, Quantity, Avg Buy Price, Buy Value.
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


def detect_broker(sheet_content, file_name=""):
    """Heuristic broker identification from text content or headers."""
    content_str = str(sheet_content).lower() + " " + file_name.lower()
    if 'groww' in content_str or 'stocks_holdings_statement' in content_str or 'holdings statement for stocks' in content_str:
        return 'Groww'
    elif 'zerodha' in content_str or 'kite' in content_str or 'holdings-' in content_str:
        return 'Zerodha'
    elif 'upstox' in content_str:
        return 'Upstox'
    elif 'angel' in content_str:
        return 'Angel One'
    elif 'dhan' in content_str:
        return 'Dhan'
    return 'Generic Broker'


def parse_xlsx(file_path):
    if not openpyxl:
        raise RuntimeError("openpyxl is not installed in the Python environment")

    with open(file_path, 'rb') as f:
        wb = openpyxl.load_workbook(f, data_only=True)
        sheet = wb.active

        # Read rows
        all_rows = []
        for r in range(1, min(sheet.max_row + 1, 500)):
            row_vals = [sheet.cell(r, c).value for c in range(1, min(sheet.max_column + 1, 30))]
            all_rows.append(row_vals)

        wb.close()
    return parse_table_rows(all_rows, os.path.basename(file_path))


def parse_csv(file_path):
    all_rows = []
    encodings = ['utf-8', 'utf-8-sig', 'latin-1', 'cp1252']
    
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

    return parse_table_rows(all_rows, os.path.basename(file_path))


def parse_table_rows(rows, file_name=""):
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
        'client_code': client_code,
        'total_positions': len(holdings),
        'total_invested_value': round(invested_summary or total_buy_val, 2),
        'total_closing_value': round(closing_summary or total_close_val, 2),
        'total_unrealised_pnl': round(pnl_summary if pnl_summary is not None else total_pnl_val, 2),
        'holdings': holdings
    }


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
