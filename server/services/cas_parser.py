#!/usr/bin/env python3
"""
cas_parser.py - Robust CLI bridge for parsing CDSL/NSDL/CAMS/KFintech CAS PDFs.
Outputs structured JSON to stdout. Exits with 0 so the parent Node process receives clean JSON.
"""

import sys
import json
import traceback
from decimal import Decimal
import casparser
from casparser.exceptions import IncorrectPasswordError, CASParseError


class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super().default(obj)


def normalize_demat_cas(raw_data):
    """Normalize NSDL/CDSL CAS statement into clean holdings structure."""
    holdings = []
    mutual_funds = []
    bonds = []
    
    accounts = raw_data.get("accounts", [])
    for acc in accounts:
        dp_name = acc.get("name") or "Demat Account"
        acc_type = acc.get("type") or raw_data.get("file_type") or "CDSL"
        dp_id = acc.get("dp_id") or ""
        client_id = acc.get("client_id") or ""
        
        # 1. Equities
        for eq in acc.get("equities", []):
            try:
                qty = float(eq.get("num_shares") or 0)
                price = float(eq.get("price") or 0)
                val = float(eq.get("value") or 0) if eq.get("value") is not None else round(qty * price, 2)
            except (ValueError, TypeError):
                qty, price, val = 0.0, 0.0, 0.0

            symbol = eq.get("symbol") or ""
            name = eq.get("name") or symbol or "Unknown Stock"
            isin = eq.get("isin") or ""

            holdings.append({
                "isin": isin,
                "symbol": symbol,
                "name": name,
                "quantity": qty,
                "price": price,
                "value": val,
                "asset_type": "EQUITY",
                "depository": acc_type,
                "account_name": dp_name,
                "dp_id": dp_id,
                "client_id": client_id
            })

        # 2. Demat Mutual Funds
        for mf in acc.get("mutual_funds", []):
            try:
                units = float(mf.get("balance") or 0)
                nav = float(mf.get("nav") or 0)
                val = float(mf.get("value") or 0) if mf.get("value") is not None else round(units * nav, 2)
            except (ValueError, TypeError):
                units, nav, val = 0.0, 0.0, 0.0

            mutual_funds.append({
                "isin": mf.get("isin") or "",
                "name": mf.get("name") or "Mutual Fund",
                "quantity": units,
                "price": nav,
                "value": val,
                "asset_type": "MUTUAL_FUND",
                "depository": acc_type,
                "account_name": dp_name,
                "folio": mf.get("folio") or ""
            })

        # 3. Bonds / SGBs / Debt
        for bd in acc.get("bonds", []):
            try:
                qty = float(bd.get("num_bonds") or 0)
                val = float(bd.get("value") or 0)
                price = float(bd.get("market_price") or bd.get("face_value") or 0)
            except (ValueError, TypeError):
                qty, val, price = 0.0, 0.0, 0.0

            bonds.append({
                "isin": bd.get("isin") or "",
                "name": bd.get("name") or "Bond/SGB",
                "quantity": qty,
                "price": price,
                "value": val,
                "asset_type": "BOND",
                "depository": acc_type,
                "account_name": dp_name
            })

    total_eq_val = sum(h["value"] for h in holdings)
    total_mf_val = sum(m["value"] for m in mutual_funds)
    total_bd_val = sum(b["value"] for b in bonds)
    total_val = total_eq_val + total_mf_val + total_bd_val

    # Compute portfolio weights for equities
    for h in holdings:
        h["weight_pct"] = round((h["value"] / total_eq_val * 100), 2) if total_eq_val > 0 else 0.0

    return {
        "success": True,
        "file_type": raw_data.get("file_type", "CDSL"),
        "statement_period": raw_data.get("statement_period", {}),
        "investor_info": raw_data.get("investor_info", {}),
        "holdings": holdings,
        "mutual_funds": mutual_funds,
        "bonds": bonds,
        "summary": {
            "total_portfolio_value": round(total_val, 2),
            "total_equities_value": round(total_eq_val, 2),
            "equities_count": len(holdings),
            "total_mf_value": round(total_mf_val, 2),
            "mf_count": len(mutual_funds),
            "total_bonds_value": round(total_bd_val, 2),
            "bonds_count": len(bonds),
            "total_securities_count": len(holdings) + len(mutual_funds) + len(bonds)
        }
    }


def normalize_mf_cas(raw_data):
    """Normalize CAMS/KFintech MF statement."""
    mutual_funds = []
    for folio in raw_data.get("folios", []):
        folio_num = folio.get("folio", "")
        amc = folio.get("amc", "")
        for scheme in folio.get("schemes", []):
            try:
                units = float(scheme.get("close") or 0)
                val_info = scheme.get("valuation", {})
                nav = float(val_info.get("nav") or 0)
                val = float(val_info.get("value") or 0) if val_info.get("value") is not None else round(units * nav, 2)
            except (ValueError, TypeError):
                units, nav, val = 0.0, 0.0, 0.0

            mutual_funds.append({
                "isin": scheme.get("isin") or "",
                "name": scheme.get("scheme") or "Mutual Fund",
                "quantity": units,
                "price": nav,
                "value": val,
                "asset_type": "MUTUAL_FUND",
                "depository": raw_data.get("file_type", "CAMS"),
                "account_name": amc,
                "folio": folio_num
            })

    total_mf_val = sum(m["value"] for m in mutual_funds)

    return {
        "success": True,
        "file_type": raw_data.get("file_type", "CAMS"),
        "statement_period": raw_data.get("statement_period", {}),
        "investor_info": raw_data.get("investor_info", {}),
        "holdings": [],
        "mutual_funds": mutual_funds,
        "bonds": [],
        "summary": {
            "total_portfolio_value": round(total_mf_val, 2),
            "total_equities_value": 0.0,
            "equities_count": 0,
            "total_mf_value": round(total_mf_val, 2),
            "mf_count": len(mutual_funds),
            "total_bonds_value": 0.0,
            "bonds_count": 0,
            "total_securities_count": len(mutual_funds)
        }
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
            # output="json" converts Pydantic model directly to valid JSON string
            json_str = casparser.read_cas_pdf(pdf_path, pwd, output="json")
            return json.loads(json_str)
        except IncorrectPasswordError as e:
            last_exc = e
            continue
        except Exception as e:
            # Non-password error (file error, format error, etc.)
            raise e

    if last_exc:
        raise last_exc
    raise CASParseError("Could not decrypt statement with provided password.")


def main():
    if len(sys.argv) < 2:
        print(json.dumps({
            "success": False,
            "error_type": "INVALID_ARGUMENTS",
            "message": "Usage: cas_parser.py <pdf_path> [password]"
        }))
        sys.exit(0)

    pdf_path = sys.argv[1]
    password = sys.argv[2] if len(sys.argv) > 2 else ""

    try:
        raw_data = parse_with_password_candidates(pdf_path, password)
        file_type = raw_data.get("file_type", "")

        if file_type in ("CDSL", "NSDL"):
            result = normalize_demat_cas(raw_data)
        elif file_type in ("CAMS", "KFINTECH"):
            result = normalize_mf_cas(raw_data)
        else:
            # Try demat first, fallback to MF
            if "accounts" in raw_data:
                result = normalize_demat_cas(raw_data)
            else:
                result = normalize_mf_cas(raw_data)

        print(json.dumps(result, cls=DecimalEncoder))
        sys.exit(0)

    except IncorrectPasswordError:
        print(json.dumps({
            "success": False,
            "error_type": "INCORRECT_PASSWORD",
            "message": "Incorrect password. For CDSL/NSDL CAS, it is usually your 10-digit PAN in CAPITAL letters (e.g. ABCDE1234F) or Date of Birth (DDMMYYYY)."
        }))
        sys.exit(0)

    except CASParseError as e:
        sys.stderr.write(traceback.format_exc())
        print(json.dumps({
            "success": False,
            "error_type": "PARSE_ERROR",
            "message": f"Unable to parse CAS PDF: {str(e)}"
        }))
        sys.exit(0)

    except Exception as e:
        sys.stderr.write(traceback.format_exc())
        print(json.dumps({
            "success": False,
            "error_type": "UNKNOWN_ERROR",
            "message": f"Statement processing error: {str(e)}"
        }))
        sys.exit(0)


if __name__ == "__main__":
    main()
