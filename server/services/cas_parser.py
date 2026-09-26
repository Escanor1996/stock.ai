#!/usr/bin/env python3
"""
cas_parser.py - Robust CLI bridge for parsing CDSL/NSDL/CAMS/KFintech CAS PDFs.
Extracts holdings, categorizes into Direct Stocks, ETFs, Mutual Funds, and Bonds/SGBs,
and extracts historical portfolio valuations, asset allocations, and transactions.
Outputs structured JSON to stdout. Exits with 0 so the parent Node process receives clean JSON.
"""

import sys
import json
import re
import traceback
from decimal import Decimal
import casparser
from casparser.exceptions import IncorrectPasswordError, CASParseError
import pypdfium2 as pdfium


class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super().default(obj)


# Common Indian ETF and stock ticker overrides based on ISIN
KNOWN_ISIN_MAP = {
    "INF204KB14I2": {"symbol": "NIFTYBEES", "name": "Nippon India ETF Nifty 50 BeES", "subtype": "ETF"},
    "INF247L01AP3": {"symbol": "MON100", "name": "Motilal Oswal NASDAQ 100 ETF", "subtype": "ETF"},
    "INF204KB19I1": {"symbol": "HNGSNGBEES", "name": "Nippon India ETF Hang Seng BeES", "subtype": "ETF"},
    "INF769K01HP3": {"symbol": "MASPTOP50", "name": "Mirae Asset S&P 500 Top 50 ETF", "subtype": "ETF"},
    "INF204KB17I5": {"symbol": "BANKBEES", "name": "Nippon India ETF Nifty Bank BeES", "subtype": "ETF"},
    "INF204KB14L6": {"symbol": "GOLDBEES", "name": "Nippon India ETF Gold BeES", "subtype": "ETF"},
    "INF204KB18I3": {"symbol": "JUNIORBEES", "name": "Nippon India ETF Nifty Next 50 Junior BeES", "subtype": "ETF"},
    "INF732E01037": {"symbol": "SETFNIF50", "name": "SBI Nifty 50 ETF", "subtype": "ETF"},
    "INF200KA1UT4": {"symbol": "SBIETFIT", "name": "SBI ETF Nifty IT", "subtype": "ETF"},
    "INE255Z01027": {"symbol": "E2E", "name": "E2E Networks Limited", "subtype": "DIRECT_STOCK"},
    "INE301O01023": {"symbol": "NSDL", "name": "National Securities Depository Limited", "subtype": "DIRECT_STOCK"},
    "INE066F01020": {"symbol": "HAL", "name": "Hindustan Aeronautics Limited", "subtype": "DIRECT_STOCK"},
    "INE056I01025": {"symbol": "REFEX", "name": "Refex Industries Limited", "subtype": "DIRECT_STOCK"},
    "INE285K01026": {"symbol": "TECHNOE", "name": "Techno Electric & Engineering Co Ltd", "subtype": "DIRECT_STOCK"},
    "INE251B01027": {"symbol": "ZENTEC", "name": "Zen Technologies Limited", "subtype": "DIRECT_STOCK"},
    "INE1TAE01010": {"symbol": "TMCV", "name": "Tata Motors Limited", "subtype": "DIRECT_STOCK"},
    "INE155A01022": {"symbol": "TMPV", "name": "Tata Motors Passenger Vehicles Limited", "subtype": "DIRECT_STOCK"},
}


def clean_security_name(raw_name):
    """Clean garbage symbols like \x02, trailing # comments, etc."""
    if not raw_name:
        return ""
    name = raw_name.replace("\x02", " ").replace("\r", " ").strip()
    name = re.sub(r"#.*$", "", name)
    name = re.sub(r"-\s*NEW EQUITY SHARES.*$", "", name, flags=re.IGNORECASE)
    name = re.sub(r"NEW EQUITY SHARES.*$", "", name, flags=re.IGNORECASE)
    name = re.sub(r"EQUITY SHARES.*$", "", name, flags=re.IGNORECASE)
    name = re.sub(r"\s+", " ", name).strip()
    return name


def classify_holding(item, is_demat_mf=False):
    """
    Classify into (category, subcategory, clean_symbol, clean_name).
    Category: 'STOCKS' | 'MUTUAL_FUNDS' | 'BONDS_DEBT'
    Subcategory: 'DIRECT_STOCK' | 'ETF' | 'MUTUAL_FUND' | 'SGB' | 'BOND'
    """
    isin = (item.get("isin") or "").upper().strip()
    raw_name = item.get("name") or ""
    raw_symbol = item.get("symbol") or ""
    clean_name = clean_security_name(raw_name)
    name_upper = raw_name.upper()
    symbol_upper = raw_symbol.upper()

    # Check known ISIN lookup first
    if isin in KNOWN_ISIN_MAP:
        mapped = KNOWN_ISIN_MAP[isin]
        return "STOCKS", mapped["subtype"], mapped["symbol"], mapped["name"]

    # Sovereign Gold Bonds
    if isin.startswith("IN0") or "SGB" in name_upper or "SOVEREIGN GOLD" in name_upper or "GOVT OF INDIA" in name_upper:
        return "BONDS_DEBT", "SGB", raw_symbol or "SGB", clean_name or "Sovereign Gold Bond"

    # Corporate Debt / Bonds / NCDs
    if "BOND" in name_upper or "NCD" in name_upper or re.search(r"\b\d{1,2}\.\d{1,2}\s+\d{8}\b", name_upper):
        return "BONDS_DEBT", "BOND", raw_symbol or "BOND", clean_name or "Bond / NCD"

    # ETF detection (either in demat mutual funds or equities with ETF keywords)
    etf_keywords = ["ETF", "BEES", "N100", "TOP 50", "NASDAQ 100", "S&P 500 TOP", "INDEX FUND - ETF"]
    if is_demat_mf or any(k in name_upper for k in etf_keywords) or any(k in symbol_upper for k in ["BEES", "ETF"]):
        # Extract plausible symbol for ETF
        sym = raw_symbol
        if not sym:
            if "NIFTY 50 BEES" in name_upper or "NIFTYBEES" in name_upper:
                sym = "NIFTYBEES"
            elif "NASDAQ 100" in name_upper or "N100" in name_upper:
                sym = "MON100"
            elif "HANG SENG" in name_upper:
                sym = "HNGSNGBEES"
            elif "S&P 500" in name_upper:
                sym = "MASPTOP50"
            elif "BANK BEES" in name_upper or "BANKBEES" in name_upper:
                sym = "BANKBEES"
            elif "GOLD BEES" in name_upper or "GOLDBEES" in name_upper:
                sym = "GOLDBEES"
            else:
                sym = isin
        return "STOCKS", "ETF", sym, clean_name

    # Folio Mutual Funds
    if item.get("asset_type") == "MUTUAL_FUND" or "folio" in item or isin.startswith("INF"):
        return "MUTUAL_FUNDS", "MUTUAL_FUND", raw_symbol or "", clean_name

    # Default: Direct equity stock
    sym = raw_symbol
    if not sym and isin.startswith("INE"):
        # Attempt to extract ticker from first word of clean name
        first_word = clean_name.split()[0] if clean_name else ""
        if len(first_word) >= 3 and first_word.isalpha():
            sym = first_word.upper()

    return "STOCKS", "DIRECT_STOCK", sym, clean_name


def extract_historical_and_transactions(pdf_path, password=""):
    """
    Extract 12-month historical portfolio valuation, asset allocations,
    and period transactions directly from the CAS PDF using pypdfium2.
    """
    historical_valuations = []
    asset_allocation = []
    transactions = []

    try:
        pdf = pdfium.PdfDocument(pdf_path, password=password)
    except Exception as e:
        sys.stderr.write(f"PDF transaction extraction skipped: {e}\n")
        return historical_valuations, asset_allocation, transactions

    # 1. Parse Historical Valuations and Asset Allocation (usually page 2 or 3)
    for p_idx in range(min(5, len(pdf))):
        try:
            text = pdf[p_idx].get_textpage().get_text_range()
        except Exception:
            continue

        if "Consolidated Portfolio Valuation for Year" in text:
            lines = text.split("\n")
            month_regex = re.compile(
                r"^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})\s+([\d,]+\.\d{2})(?:\s+([\-\d,]+\.\d{2})\s+([\-\d,]+\.\d{2}))?"
            )
            for l in lines:
                m = month_regex.match(l.strip())
                if m:
                    historical_valuations.append({
                        "month_year": f"{m.group(1)} {m.group(2)}",
                        "month": m.group(1),
                        "year": int(m.group(2)),
                        "value": float(m.group(3).replace(",", "")),
                        "change_rs": float(m.group(4).replace(",", "")) if m.group(4) else 0.0,
                        "change_pct": float(m.group(5).replace(",", "")) if m.group(5) else 0.0,
                    })

            asset_regex = re.compile(
                r"^(Debts|Equity|Mutual Fund Folios|Mutual Funds Held in Demat Form|Others)\s+([\d,]+\.\d{2})\s+([\d\.]+)"
            )
            for l in lines:
                m = asset_regex.match(l.strip())
                if m:
                    asset_allocation.append({
                        "asset_class": m.group(1),
                        "value": float(m.group(2).replace(",", "")),
                        "percentage": float(m.group(3)),
                    })
            break

    # 2. Parse Transactions across all pages
    isin_regex = re.compile(r"^(IN[A-Z0-9]{10})")
    date_regex = re.compile(r"^\d{2}-\d{2}-\d{4}")

    current_demat_isin = None
    current_demat_name = ""
    current_mf_isin = None
    current_mf_name = ""

    for p_idx in range(len(pdf)):
        try:
            text = pdf[p_idx].get_textpage().get_text_range()
        except Exception:
            continue

        if "STATEMENT OF TRANSACTIONS" not in text:
            continue

        is_mf_section = (
            "MUTUAL FUND UNITS HELD WITH MF/RTA" in text
            or "Date Transaction Description" in text
        )
        lines = [l.strip() for l in text.split("\n") if l.strip()]

        for i, l in enumerate(lines):
            # Demat Section
            if not is_mf_section:
                m_isin = isin_regex.match(l)
                if m_isin:
                    current_demat_isin = m_isin.group(1)
                    name_parts = []
                    for k in range(i + 1, min(i + 4, len(lines))):
                        if (
                            not date_regex.match(lines[k])
                            and not isin_regex.match(lines[k])
                            and "PAYOUT" not in lines[k]
                            and "SETT" not in lines[k]
                        ):
                            name_parts.append(lines[k])
                    current_demat_name = clean_security_name(" ".join(name_parts))

                if date_regex.match(l) and current_demat_isin:
                    tokens = l.split()
                    if len(tokens) >= 5:
                        dt = tokens[0]
                        try:
                            credit = float(tokens[2]) if tokens[2] != "--" else 0.0
                            debit = float(tokens[3]) if tokens[3] != "--" else 0.0
                            cl_bal = float(tokens[4]) if tokens[4] != "--" else 0.0

                            txn_type = "BUY" if credit > 0 else "SELL"
                            qty = credit if credit > 0 else debit

                            transactions.append({
                                "date": dt,
                                "isin": current_demat_isin,
                                "name": current_demat_name or current_demat_isin,
                                "type": txn_type,
                                "units": qty,
                                "amount": None,
                                "nav": None,
                                "balance": cl_bal,
                                "category": "STOCKS",
                            })
                        except (ValueError, IndexError):
                            pass

            # Mutual Fund Section
            else:
                if "ISIN :" in l:
                    m_isin_mf = re.search(r"ISIN\s*:\s*(IN[A-Z0-9]{10})", l)
                    if m_isin_mf:
                        current_mf_isin = m_isin_mf.group(1)
                        if i > 0 and "STATEMENT" not in lines[i - 1]:
                            current_mf_name = clean_security_name(lines[i - 1])

                if date_regex.match(l) and current_mf_isin:
                    tokens = l.split()
                    if len(tokens) >= 7:
                        dt = tokens[0]
                        try:
                            units = float(tokens[-4])
                            price = float(tokens[-5])
                            nav = float(tokens[-6])
                            amt = float(tokens[-7])
                            desc = " ".join(tokens[1:-7])

                            txn_type = "PURCHASE" if amt > 0 or units > 0 else "REDEMPTION"

                            transactions.append({
                                "date": dt,
                                "isin": current_mf_isin,
                                "name": current_mf_name or current_mf_isin,
                                "type": txn_type,
                                "units": abs(units),
                                "amount": abs(amt),
                                "nav": nav,
                                "balance": None,
                                "category": "MUTUAL_FUNDS",
                                "description": desc,
                            })
                        except (ValueError, IndexError):
                            pass

    return historical_valuations, asset_allocation, transactions


def normalize_demat_cas(raw_data, pdf_path=None, password=""):
    """Normalize NSDL/CDSL CAS statement into clean, categorized holdings and historical analytics."""
    stocks = []
    mutual_funds = []
    bonds = []

    accounts = raw_data.get("accounts", [])
    for acc in accounts:
        dp_name = acc.get("name") or "Demat Account"
        acc_type = acc.get("type") or raw_data.get("file_type") or "CDSL"
        dp_id = acc.get("dp_id") or ""
        client_id = acc.get("client_id") or ""

        # 1. Equities Section in Account
        for eq in acc.get("equities", []):
            try:
                qty = float(eq.get("num_shares") or 0)
                price = float(eq.get("price") or 0)
                val = (
                    float(eq.get("value") or 0)
                    if eq.get("value") is not None
                    else round(qty * price, 2)
                )
            except (ValueError, TypeError):
                qty, price, val = 0.0, 0.0, 0.0

            cat, subcat, sym, name = classify_holding(eq, is_demat_mf=False)

            item_data = {
                "isin": eq.get("isin") or "",
                "symbol": sym,
                "name": name or eq.get("name") or sym or "Unknown Asset",
                "quantity": qty,
                "price": price,
                "value": val,
                "category": cat,
                "subtype": subcat,
                "asset_type": "EQUITY" if cat == "STOCKS" else ("BOND" if cat == "BONDS_DEBT" else "MUTUAL_FUND"),
                "depository": acc_type,
                "account_name": dp_name,
                "dp_id": dp_id,
                "client_id": client_id,
            }

            if cat == "STOCKS":
                stocks.append(item_data)
            elif cat == "BONDS_DEBT":
                bonds.append(item_data)
            else:
                mutual_funds.append(item_data)

        # 2. Mutual Funds in Account (Demat ETFs or AMC Folios)
        is_demat_account = "DEMAT" in acc_type.upper()
        for mf in acc.get("mutual_funds", []):
            try:
                units = float(mf.get("balance") or 0)
                nav = float(mf.get("nav") or 0)
                val = (
                    float(mf.get("value") or 0)
                    if mf.get("value") is not None
                    else round(units * nav, 2)
                )
                cost = float(mf.get("total_cost") or 0) if mf.get("total_cost") is not None else 0.0
            except (ValueError, TypeError):
                units, nav, val, cost = 0.0, 0.0, 0.0, 0.0

            cat, subcat, sym, name = classify_holding(mf, is_demat_mf=is_demat_account)

            gain = round(val - cost, 2) if cost > 0 else 0.0
            gain_pct = round((gain / cost) * 100, 2) if cost > 0 else 0.0

            item_data = {
                "isin": mf.get("isin") or "",
                "symbol": sym,
                "name": name or mf.get("name") or "Mutual Fund",
                "quantity": units,
                "price": nav,
                "value": val,
                "cost_basis": cost,
                "gain": gain,
                "gain_pct": gain_pct,
                "category": cat,
                "subtype": subcat,
                "asset_type": "EQUITY" if cat == "STOCKS" else "MUTUAL_FUND",
                "depository": acc_type,
                "account_name": dp_name,
                "folio": mf.get("folio") or "",
                "amfi": mf.get("amfi") or "",
            }

            if cat == "STOCKS":
                stocks.append(item_data)
            elif cat == "BONDS_DEBT":
                bonds.append(item_data)
            else:
                mutual_funds.append(item_data)

        # 3. Bonds / SGBs / Debt in Account
        for bd in acc.get("bonds", []):
            try:
                qty = float(bd.get("num_bonds") or 0)
                val = float(bd.get("value") or 0)
                price = float(bd.get("market_price") or bd.get("face_value") or 0)
            except (ValueError, TypeError):
                qty, val, price = 0.0, 0.0, 0.0

            name = clean_security_name(bd.get("name") or "Bond/SGB")
            subcat = "SGB" if ("SGB" in name.upper() or (bd.get("isin") or "").startswith("IN0")) else "BOND"

            bonds.append({
                "isin": bd.get("isin") or "",
                "symbol": bd.get("symbol") or subcat,
                "name": name,
                "quantity": qty,
                "price": price,
                "value": val,
                "category": "BONDS_DEBT",
                "subtype": subcat,
                "asset_type": "BOND",
                "depository": acc_type,
                "account_name": dp_name,
            })

    # Historical Valuations and Transactions extraction from PDF
    historical_valuations, asset_allocation, transactions = [], [], []
    if pdf_path:
        historical_valuations, asset_allocation, transactions = extract_historical_and_transactions(
            pdf_path, password
        )

    # Calculate Totals & Weights
    direct_stocks = [s for s in stocks if s.get("subtype") == "DIRECT_STOCK"]
    etfs = [s for s in stocks if s.get("subtype") == "ETF"]

    total_stocks_val = sum(s["value"] for s in stocks)
    direct_stocks_val = sum(s["value"] for s in direct_stocks)
    etfs_val = sum(s["value"] for s in etfs)
    total_mf_val = sum(m["value"] for m in mutual_funds)
    total_bd_val = sum(b["value"] for b in bonds)
    total_val = total_stocks_val + total_mf_val + total_bd_val

    # Portfolio weights for all stocks
    for s in stocks:
        s["weight_pct"] = round((s["value"] / total_stocks_val * 100), 2) if total_stocks_val > 0 else 0.0
        s["total_weight_pct"] = round((s["value"] / total_val * 100), 2) if total_val > 0 else 0.0

    # Portfolio weights for mutual funds
    for m in mutual_funds:
        m["weight_pct"] = round((m["value"] / total_mf_val * 100), 2) if total_mf_val > 0 else 0.0
        m["total_weight_pct"] = round((m["value"] / total_val * 100), 2) if total_val > 0 else 0.0

    # Portfolio weights for bonds
    for b in bonds:
        b["weight_pct"] = round((b["value"] / total_bd_val * 100), 2) if total_bd_val > 0 else 0.0
        b["total_weight_pct"] = round((b["value"] / total_val * 100), 2) if total_val > 0 else 0.0

    return {
        "success": True,
        "file_type": raw_data.get("file_type", "CDSL"),
        "statement_period": raw_data.get("statement_period", {}),
        "investor_info": raw_data.get("investor_info", {}),
        "holdings": stocks,  # backward compatibility: all stocks (direct + etf)
        "stocks": stocks,
        "direct_stocks": direct_stocks,
        "etfs": etfs,
        "mutual_funds": mutual_funds,
        "bonds": bonds,
        "historical_valuations": historical_valuations,
        "asset_allocation": asset_allocation,
        "transactions": transactions,
        "summary": {
            "total_portfolio_value": round(total_val, 2),
            "total_stocks_value": round(total_stocks_val, 2),
            "stocks_count": len(stocks),
            "direct_stocks_value": round(direct_stocks_val, 2),
            "direct_stocks_count": len(direct_stocks),
            "etfs_value": round(etfs_val, 2),
            "etfs_count": len(etfs),
            "total_mf_value": round(total_mf_val, 2),
            "mf_count": len(mutual_funds),
            "total_bonds_value": round(total_bd_val, 2),
            "bonds_count": len(bonds),
            "total_securities_count": len(stocks) + len(mutual_funds) + len(bonds),
        },
    }


def normalize_mf_cas(raw_data, pdf_path=None, password=""):
    """Normalize CAMS/KFintech MF statement."""
    mutual_funds = []
    transactions = []

    for folio in raw_data.get("folios", []):
        folio_num = folio.get("folio", "")
        amc = folio.get("amc", "")
        for scheme in folio.get("schemes", []):
            try:
                units = float(scheme.get("close") or 0)
                val_info = scheme.get("valuation", {})
                nav = float(val_info.get("nav") or 0)
                val = (
                    float(val_info.get("value") or 0)
                    if val_info.get("value") is not None
                    else round(units * nav, 2)
                )
                cost = float(val_info.get("cost") or 0) if val_info.get("cost") is not None else 0.0
            except (ValueError, TypeError):
                units, nav, val, cost = 0.0, 0.0, 0.0, 0.0

            gain = round(val - cost, 2) if cost > 0 else 0.0
            gain_pct = round((gain / cost) * 100, 2) if cost > 0 else 0.0

            isin = scheme.get("isin") or ""
            name = clean_security_name(scheme.get("scheme") or "Mutual Fund")

            mutual_funds.append({
                "isin": isin,
                "symbol": "",
                "name": name,
                "quantity": units,
                "price": nav,
                "value": val,
                "cost_basis": cost,
                "gain": gain,
                "gain_pct": gain_pct,
                "category": "MUTUAL_FUNDS",
                "subtype": "MUTUAL_FUND",
                "asset_type": "MUTUAL_FUND",
                "depository": raw_data.get("file_type", "CAMS"),
                "account_name": amc,
                "folio": folio_num,
                "amfi": scheme.get("amfi") or "",
            })

            # Check native transactions in scheme
            for tx in scheme.get("transactions", []):
                try:
                    tx_amt = float(tx.get("amount") or 0)
                    tx_units = float(tx.get("units") or 0)
                    transactions.append({
                        "date": str(tx.get("date")),
                        "isin": isin,
                        "name": name,
                        "type": "PURCHASE" if tx_amt > 0 else "REDEMPTION",
                        "units": abs(tx_units),
                        "amount": abs(tx_amt),
                        "nav": float(tx.get("nav") or 0),
                        "balance": float(tx.get("balance") or 0),
                        "category": "MUTUAL_FUNDS",
                        "description": tx.get("description") or "",
                    })
                except Exception:
                    pass

    total_mf_val = sum(m["value"] for m in mutual_funds)
    for m in mutual_funds:
        m["weight_pct"] = round((m["value"] / total_mf_val * 100), 2) if total_mf_val > 0 else 0.0
        m["total_weight_pct"] = m["weight_pct"]

    return {
        "success": True,
        "file_type": raw_data.get("file_type", "CAMS"),
        "statement_period": raw_data.get("statement_period", {}),
        "investor_info": raw_data.get("investor_info", {}),
        "holdings": [],
        "stocks": [],
        "direct_stocks": [],
        "etfs": [],
        "mutual_funds": mutual_funds,
        "bonds": [],
        "historical_valuations": [],
        "asset_allocation": [{"asset_class": "Mutual Fund Folios", "value": round(total_mf_val, 2), "percentage": 100.0}],
        "transactions": transactions,
        "summary": {
            "total_portfolio_value": round(total_mf_val, 2),
            "total_stocks_value": 0.0,
            "stocks_count": 0,
            "direct_stocks_value": 0.0,
            "direct_stocks_count": 0,
            "etfs_value": 0.0,
            "etfs_count": 0,
            "total_mf_value": round(total_mf_val, 2),
            "mf_count": len(mutual_funds),
            "total_bonds_value": 0.0,
            "bonds_count": 0,
            "total_securities_count": len(mutual_funds),
        },
    }


def parse_with_password_candidates(pdf_path, base_password):
    """Try variations of password (exact, stripped, uppercase, lowercase)."""
    candidates = []
    if base_password:
        raw = base_password
        candidates.append(raw)
        if raw.strip() not in candidates:
            candidates.append(raw.strip())
        if raw.upper() not in candidates:
            candidates.append(raw.upper())
        if raw.strip().upper() not in candidates:
            candidates.append(raw.strip().upper())
        if raw.lower() not in candidates:
            candidates.append(raw.lower())
        if raw.strip().lower() not in candidates:
            candidates.append(raw.strip().lower())
    else:
        candidates.append("")

    last_exc = None
    for pwd in candidates:
        try:
            json_str = casparser.read_cas_pdf(pdf_path, pwd, output="json")
            return json.loads(json_str), pwd
        except IncorrectPasswordError as e:
            last_exc = e
            continue
        except Exception as e:
            raise e

    if last_exc:
        raise last_exc
    raise CASParseError("Could not decrypt statement with provided password.")


def main():
    if len(sys.argv) < 2:
        print(json.dumps({
            "success": False,
            "error_type": "INVALID_ARGUMENTS",
            "message": "Usage: cas_parser.py <pdf_path> [password]",
        }))
        sys.exit(0)

    pdf_path = sys.argv[1]
    password = sys.argv[2] if len(sys.argv) > 2 else ""

    try:
        raw_data, resolved_pwd = parse_with_password_candidates(pdf_path, password)
        file_type = raw_data.get("file_type", "")

        if file_type in ("CDSL", "NSDL"):
            result = normalize_demat_cas(raw_data, pdf_path, resolved_pwd)
        elif file_type in ("CAMS", "KFINTECH"):
            result = normalize_mf_cas(raw_data, pdf_path, resolved_pwd)
        else:
            if "accounts" in raw_data:
                result = normalize_demat_cas(raw_data, pdf_path, resolved_pwd)
            else:
                result = normalize_mf_cas(raw_data, pdf_path, resolved_pwd)

        print(json.dumps(result, cls=DecimalEncoder))
        sys.exit(0)

    except IncorrectPasswordError:
        print(json.dumps({
            "success": False,
            "error_type": "INCORRECT_PASSWORD",
            "message": "Incorrect password. For CDSL/NSDL CAS, it is usually your 10-digit PAN in CAPITAL letters (e.g. ABCDE1234F) or Date of Birth (DDMMYYYY).",
        }))
        sys.exit(0)

    except CASParseError as e:
        sys.stderr.write(traceback.format_exc())
        print(json.dumps({
            "success": False,
            "error_type": "PARSE_ERROR",
            "message": f"Unable to parse CAS PDF: {str(e)}",
        }))
        sys.exit(0)

    except Exception as e:
        sys.stderr.write(traceback.format_exc())
        print(json.dumps({
            "success": False,
            "error_type": "UNKNOWN_ERROR",
            "message": f"Statement processing error: {str(e)}",
        }))
        sys.exit(0)


if __name__ == "__main__":
    main()
