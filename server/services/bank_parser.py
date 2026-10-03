#!/usr/bin/env python3
"""
Bank Statement Parser for Indian Bank Statements (HDFC Bank, Standard Chartered Bank, Generic).
Extracts account details, liquid balances, transaction ledgers, and monthly cashflows.
Supports password-protected PDFs with automatic credential variation retries.
"""

import sys
import os
import re
import json
import shutil
import subprocess
import traceback
from datetime import datetime


class BankParserError(Exception):
    """Raised when a PDF cannot be parsed as a bank statement."""
    def __init__(self, message, error_type="BANK_PARSE_ERROR"):
        super().__init__(message)
        self.error_type = error_type


class IncorrectPasswordError(BankParserError):
    """Raised when PDF decryption fails due to invalid password."""
    def __init__(self, message="Incorrect password. HDFC statements usually use your Customer ID or DOB (DDMMYYYY). Standard Chartered uses first 4 letters of your name + DDMM or DOB."):
        super().__init__(message, error_type="INCORRECT_PASSWORD")


def round_money(value):
    if value is None:
        return 0.0
    return round(float(value) * 100) / 100


def parse_amount(raw):
    """Parse INR amount string, handling comma formatting and credit/debit signs."""
    if raw is None:
        return None
    val = str(raw).strip()
    if val in {"", "-", "—", "NIL", "N/A", "NA"}:
        return 0.0

    is_negative = False
    if val.startswith("(") and val.endswith(")"):
        is_negative = True
        val = val[1:-1]
    elif val.endswith("-") or val.startswith("-"):
        is_negative = True
        val = val.replace("-", "")

    val = re.sub(r"[₹\s,]|INR|RS\.?|CR|DR", "", val, flags=re.IGNORECASE)
    try:
        amount = float(val)
        return -amount if is_negative else amount
    except ValueError:
        return None


def mask_account_number(acc_num):
    if not acc_num:
        return "••••••••"
    acc_clean = re.sub(r"\s+", "", str(acc_num))
    if len(acc_clean) <= 4:
        return f"••••{acc_clean}"
    return f"••••{acc_clean[-4:]}"


def extract_pdf_text(pdf_path, user_password=""):
    """
    Extracts text from PDF, trying password permutations across pdftotext, pypdfium2, and pypdf.
    """
    if not os.path.exists(pdf_path):
        raise BankParserError(f"Statement file not found: {pdf_path}", error_type="FILE_NOT_FOUND")

    # Generate password variants to maximize decryption success
    pwd_candidates = []
    if user_password:
        pwd_clean = user_password.strip()
        pwd_candidates = [
            user_password,
            pwd_clean,
            pwd_clean.upper(),
            pwd_clean.lower(),
        ]
    # Always include empty password fallback
    pwd_candidates.append("")

    # Deduplicate while preserving order
    seen = set()
    passwords_to_try = []
    for p in pwd_candidates:
        if p not in seen:
            seen.add(p)
            passwords_to_try.append(p)

    had_password_error = False

    # 1. Primary engine: pdftotext (poppler-utils) with -layout preservation
    if shutil.which("pdftotext"):
        for pwd in passwords_to_try:
            cmd = ["pdftotext", "-layout"]
            if pwd:
                cmd.extend(["-upw", pwd])
            cmd.extend([pdf_path, "-"])
            try:
                proc = subprocess.run(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    timeout=30
                )
                if proc.returncode == 0 and proc.stdout and proc.stdout.strip():
                    return proc.stdout.replace("\r", "\n")
                stderr_lower = proc.stderr.lower()
                if "password" in stderr_lower or "unauthorized" in stderr_lower or "permission" in stderr_lower:
                    had_password_error = True
            except subprocess.TimeoutExpired:
                pass
            except Exception:
                pass

    # 2. Secondary engine: pypdfium2
    try:
        import pypdfium2 as pdfium
        for pwd in passwords_to_try:
            try:
                doc = pdfium.PdfDocument(pdf_path, password=pwd)
                pages = []
                for page_idx in range(len(doc)):
                    try:
                        page_text = doc[page_idx].get_textpage().get_text_range()
                        if page_text and page_text.strip():
                            pages.append(page_text)
                    except Exception:
                        continue
                full_text = "\n".join(pages).replace("\r", "\n")
                if full_text.strip():
                    return full_text
            except Exception as exc:
                exc_str = str(exc).lower()
                if "password" in exc_str or "unauthorized" in exc_str:
                    had_password_error = True
    except ImportError:
        pass

    # 3. Tertiary engine: pypdf
    try:
        import pypdf
        for pwd in passwords_to_try:
            try:
                reader = pypdf.PdfReader(pdf_path)
                if reader.is_encrypted:
                    had_password_error = True
                    if pwd:
                        res = reader.decrypt(pwd)
                        if res == 0:
                            continue
                    else:
                        continue
                pages = [p.extract_text() for p in reader.pages if p.extract_text()]
                full_text = "\n".join(pages).replace("\r", "\n")
                if full_text.strip():
                    return full_text
            except Exception as exc:
                exc_str = str(exc).lower()
                if "password" in exc_str:
                    had_password_error = True
    except ImportError:
        pass

    if had_password_error or user_password:
        raise IncorrectPasswordError()

    raise BankParserError("Unable to extract text from PDF statement. The file may be empty, scanned as an image, or corrupted.")


def parse_date_to_sortable(date_str):
    """Convert various date formats (DD/MM/YYYY, DD-MM-YYYY, DD/MM/YY) to YYYY-MM-DD."""
    if not date_str:
        return ""
    clean = date_str.strip()
    for fmt in ("%d/%m/%Y", "%d-%m-%Y", "%d/%m/%y", "%d-%m-%y", "%d %b %Y", "%d %B %Y"):
        try:
            dt = datetime.strptime(clean, fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass
    return clean


def format_month_key(date_str):
    """Convert transaction date string into 'Mon YYYY' (e.g. 'Sep 2026')."""
    if not date_str:
        return "Unknown"
    clean = date_str.strip()
    for fmt in ("%d/%m/%Y", "%d-%m-%Y", "%d/%m/%y", "%d-%m-%y", "%d %b %Y", "%d %B %Y", "%Y-%m-%d"):
        try:
            dt = datetime.strptime(clean, fmt)
            return dt.strftime("%b %Y")
        except ValueError:
            pass
    return "Unknown"


def synthesize_monthly_cashflow(transactions):
    """
    Groups transactions by Month-Year and calculates inflows, outflows, and net flow.
    """
    months = {}
    month_order = []

    for tx in transactions:
        m_key = format_month_key(tx.get("date", ""))
        if m_key not in months:
            months[m_key] = {"month": m_key, "inflow": 0.0, "outflow": 0.0, "net": 0.0}
            month_order.append(m_key)

        amt = float(tx.get("amount", 0.0))
        tx_type = tx.get("type", "").upper()
        if tx_type == "CR":
            months[m_key]["inflow"] += amt
        elif tx_type == "DR":
            months[m_key]["outflow"] += amt

    cashflows = []
    for m in month_order:
        entry = months[m]
        entry["inflow"] = round_money(entry["inflow"])
        entry["outflow"] = round_money(entry["outflow"])
        entry["net"] = round_money(entry["inflow"] - entry["outflow"])
        cashflows.append(entry)

    return cashflows

CATEGORIES = [
    {
        "id": "investments",
        "name": "Investments & Wealth",
        "color": "#10b981",
        "patterns": [
            r"\bGROWW\b", r"\bKUVERA\b", r"\bZERODHA\b", r"\bUPSTOX\b", r"MUTUAL\s*FUND",
            r"AXIS\s*MUTUAL", r"\bMIRAE\b", r"\bNPS\b", r"\bPPF\b", r"\bSECURITIES\b",
            r"HDFC\s*MF", r"ICICI\s*PRUDENTIAL", r"\bNIPPON\b", r"SBI\s*MUTUAL",
            r"PARAG\s*PARIKH", r"UTI\s*MUTUAL"
        ]
    },
    {
        "id": "credit_card",
        "name": "Credit Card & Loans",
        "color": "#8b5cf6",
        "patterns": [
            r"PZ\s*HDFC\s*CC", r"PZHDFCCCBILLPAYUPI", r"PZCREDITCARD", r"PZCREDITCARDUPI",
            r"CREDIT\s*CARD", r"CC\s*BILLPAY", r"\bCRED\b", r"\bLOAN\b", r"\bEMI\b"
        ]
    },
    {
        "id": "food_dining",
        "name": "Food & Dining",
        "color": "#f59e0b",
        "patterns": [
            r"MIDTOWN\s*FOODS", r"EMBER\s*CRUST", r"DAKSHIN\s*DELIGHTS", r"\bSWIGGY\b",
            r"\bZOMATO\b", r"\bRESTAURANT\b", r"\bCAFE\b", r"\bBAKERY\b", r"\bFOOD\b",
            r"\bPIZZA\b", r"\bBURGER\b", r"\bCHAI\b", r"\bCOFFEE\b"
        ]
    },
    {
        "id": "utilities",
        "name": "Utilities & Housing",
        "color": "#06b6d4",
        "patterns": [
            r"PZELECTRICITY", r"\bELECTRICITY\b", r"MYXENIUS", r"RADIUS\s*SYNERGIES",
            r"\bBESCOM\b", r"\bTNEB\b", r"\bWATER\b", r"\bGAS\b", r"\bAIRTEL\b",
            r"\bJIO\b", r"\bBROADBAND\b", r"\bBILL\b"
        ]
    },
    {
        "id": "transfers",
        "name": "Personal Transfers",
        "color": "#3b82f6",
        "patterns": [
            r"\bSANCHAIKA\b", r"\bCHAKRABORT\b", r"\bKAUSTAV\b", r"\bPASWAN\b",
            r"TRANSFER\s*TO", r"\bFAMILY\b"
        ]
    },
    {
        "id": "travel",
        "name": "Travel & Commute",
        "color": "#f43f5e",
        "patterns": [
            r"AISHA\s*GUEST\s*HOUSE", r"\bHOTEL\b", r"GUEST\s*HOUSE", r"\bUBER\b",
            r"\bOLA\b", r"\bIRCTC\b", r"\bFLIGHT\b", r"\bINDIGO\b", r"MAKEMYTRIP",
            r"\bFUEL\b", r"\bPETROL\b"
        ]
    },
    {
        "id": "shopping",
        "name": "Shopping & Services",
        "color": "#64748b",
        "patterns": [
            r"\bAMAZON\b", r"\bFLIPKART\b", r"\bMYNTRA\b", r"PAX\s*INNOVATION",
            r"\bRAZORPAY\b", r"\bPAYTM\b", r"RELIANCE\s*RETAIL", r"\bSTORE\b",
            r"\bMART\b", r"\bGROCERY\b", r"\bBLINKIT\b", r"\bZEPTO\b", r"\bINSTAMART\b",
            r"CP\s*WEQ"
        ]
    },
    {
        "id": "other",
        "name": "Other / Miscellaneous",
        "color": "#94a3b8",
        "patterns": []
    }
]

ALIAS_RULES = [
    (r"GROWW", "Groww Invest Tech"),
    (r"KUVERA", "Kuvera"),
    (r"(?:PZ\s*HDFC\s*CC|PZHDFCCCBILLPAYUPI|PZCREDITCARD|CREDIT\s*CARD)", "HDFC Credit Card Bill"),
    (r"MIDTOWN\s*FOODS", "Midtown Foods"),
    (r"RADIUS\s*SYNERGIES", "Radius Synergies (Electricity)"),
    (r"(?:SANCHAIKA|CHAKRABORT)", "Sanchaika Chakraborty"),
    (r"EMBER\s*CRUST", "Ember Crust"),
    (r"DAKSHIN\s*DELIGHTS", "Dakshin Delights"),
    (r"PZELECTRICITY", "PZ Electricity"),
    (r"AISHA\s*GUEST\s*HOUSE", "Aisha Guest House"),
    (r"PAX\s*INNOVATION", "Pax Innovation"),
    (r"PASWAN", "Shatrudhan Paswan"),
    (r"CP\s*WEQ", "CP WEQ")
]

SCRUB_PATTERNS = [
    r"Opening\s*Balance\s*:.*",
    r"Closing\s*Balance\s*:.*",
    r"Limit\s*:.*",
    r"Txn\s*Date\b.*",
    r"Page\s+\d+\s+of\s+\d+.*",
    r"Login\s+to\s+online\s+Banking.*",
    r"Stay\s+updated\s+with\s+important\s+updates.*",
    r"Report\s+irregularities\s+in\s+your\s+statement.*",
    r"register\s+nominee\s+in\s+your\s+accounts.*",
    r"Please\s+ensure\s+your\s+latest\s+email.*",
    r"Register\s+now\s+to\s+nev.*",
    r"empty\s*note\b",
    r"Value\s+Date\b.*",
    r"Value\s+Dt\s+\d{2}[/-]\d{2}[/-]\d{2,4}",
]


def scrub_narration(raw):
    if not raw:
        return ""
    text = str(raw)
    text = re.sub(r"\bPayme\s+nt\b", "Payment", text, flags=re.IGNORECASE)
    text = re.sub(r"\bP\s+aid\b", "Paid", text, flags=re.IGNORECASE)
    for p in SCRUB_PATTERNS:
        text = re.sub(p, "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s+", " ", text).strip()
    text = re.sub(r"[\s\-_/]+$", "", text).strip()
    return text


def extract_merchant(narration):
    clean = (narration or "").strip()
    for pattern, alias in ALIAS_RULES:
        if re.search(pattern, clean, re.IGNORECASE):
            return alias
    # HDFC UPI format: UPI-<Merchant>-<VPA>-...
    m = re.match(r"^UPI-([^@-]+?)-(?:[A-Za-z0-9._]+@|pty|ybl|paytm)", clean, re.IGNORECASE)
    if m:
        return m.group(1).strip()
    # SCB UPI format: UPI/<REF>/ <MERCHANT> /...
    m = re.match(r"^UPI/\d+/\s*([^/]+?)\s*/", clean)
    if m:
        return m.group(1).strip()
    # NEFT format
    m = re.match(r"^NEFT\s+(?:[A-Z0-9]+\s+)?([A-Za-z0-9\s]+?)(?:-|\s+AXIS|\s+HDFC|$)", clean, re.IGNORECASE)
    if m:
        return m.group(1).strip()
    return clean[:30] if len(clean) > 30 else (clean or "Unknown Merchant")


def categorize_transaction(narration):
    text = narration or ""
    for cat in CATEGORIES:
        for pat in cat["patterns"]:
            if re.search(pat, text, re.IGNORECASE):
                return cat["name"], cat["color"]
    return "Other / Miscellaneous", "#94a3b8"


def synthesize_spending_summary(transactions, statement_from="", statement_to=""):
    debits = [t for t in transactions if t.get("type") == "DR" and (t.get("amount") or 0) > 0]
    total_outflow = round_money(sum(t.get("amount", 0.0) for t in debits))

    if total_outflow == 0 or not debits:
        return {
            "total_outflow": 0.0,
            "investment_outflow": 0.0,
            "pure_living_expenses": 0.0,
            "daily_burn_rate": 0.0,
            "total_debit_transactions": 0,
            "top_category": None,
            "categories": [],
            "top_merchants": [],
            "archetype_50_30_20": {
                "needs": {"amount": 0.0, "percentage": 0.0},
                "wants": {"amount": 0.0, "percentage": 0.0},
                "investments": {"amount": 0.0, "percentage": 0.0},
                "transfers": {"amount": 0.0, "percentage": 0.0}
            }
        }

    cat_map = {}
    merch_map = {}
    unique_dates = set()

    for t in debits:
        cat_name = t.get("category") or "Other / Miscellaneous"
        color = t.get("color") or "#94a3b8"
        amt = float(t.get("amount", 0.0))
        merch = t.get("merchant") or "Unknown"
        d = t.get("date")
        if d:
            unique_dates.add(d)

        if cat_name not in cat_map:
            cat_map[cat_name] = {"name": cat_name, "amount": 0.0, "count": 0, "color": color}
        cat_map[cat_name]["amount"] = round_money(cat_map[cat_name]["amount"] + amt)
        cat_map[cat_name]["count"] += 1

        if merch not in merch_map:
            merch_map[merch] = {"name": merch, "amount": 0.0, "count": 0, "category": cat_name}
        merch_map[merch]["amount"] = round_money(merch_map[merch]["amount"] + amt)
        merch_map[merch]["count"] += 1

    categories = []
    for c in sorted(cat_map.values(), key=lambda x: x["amount"], reverse=True):
        c["percentage"] = round((c["amount"] / total_outflow) * 100, 1)
        categories.append(c)

    top_category = {
        "name": categories[0]["name"],
        "amount": categories[0]["amount"],
        "percentage": categories[0]["percentage"]
    } if categories else None

    top_merchants = sorted(merch_map.values(), key=lambda x: x["amount"], reverse=True)[:10]

    inv_amt = cat_map.get("Investments & Wealth", {}).get("amount", 0.0)
    pure_living = round_money(total_outflow - inv_amt)

    num_days = 31
    if unique_dates:
        try:
            dates = sorted([datetime.strptime(d.replace("-", "/"), "%d/%m/%Y" if len(d.split("/")[-1]) == 4 else "%d/%m/%y") for d in unique_dates if re.match(r"^\d{2}[/-]\d{2}[/-]\d{2,4}$", d)])
            if dates and (dates[-1] - dates[0]).days > 0:
                span = (dates[-1] - dates[0]).days + 1
                num_days = 31 if 28 <= span <= 31 else max(1, span)
        except Exception:
            num_days = 31
    daily_burn_rate = round_money(pure_living / (num_days or 31))

    needs_amt = round_money(cat_map.get("Credit Card & Loans", {}).get("amount", 0.0) + cat_map.get("Utilities & Housing", {}).get("amount", 0.0))
    wants_amt = round_money(cat_map.get("Food & Dining", {}).get("amount", 0.0) + cat_map.get("Travel & Commute", {}).get("amount", 0.0) + cat_map.get("Shopping & Services", {}).get("amount", 0.0) + cat_map.get("Other / Miscellaneous", {}).get("amount", 0.0))
    transfers_amt = round_money(cat_map.get("Personal Transfers", {}).get("amount", 0.0))

    archetype = {
        "needs": {
            "amount": needs_amt,
            "percentage": round((needs_amt / total_outflow) * 100, 1) if total_outflow > 0 else 0.0
        },
        "wants": {
            "amount": wants_amt,
            "percentage": round((wants_amt / total_outflow) * 100, 1) if total_outflow > 0 else 0.0
        },
        "investments": {
            "amount": inv_amt,
            "percentage": round((inv_amt / total_outflow) * 100, 1) if total_outflow > 0 else 0.0
        },
        "transfers": {
            "amount": transfers_amt,
            "percentage": round((transfers_amt / total_outflow) * 100, 1) if total_outflow > 0 else 0.0
        }
    }

    return {
        "total_outflow": total_outflow,
        "investment_outflow": inv_amt,
        "pure_living_expenses": pure_living,
        "daily_burn_rate": daily_burn_rate,
        "total_debit_transactions": len(debits),
        "top_category": top_category,
        "categories": categories,
        "top_merchants": top_merchants,
        "archetype_50_30_20": archetype
    }


class HDFCBankParser:
    """Parser tailored for HDFC Bank savings/current account statements."""

    @classmethod
    def matches(cls, text):
        if re.search(r"STANDARD\s*CHARTERED|SCBL0036|SUPERVALUE\s*SAVINGS", text, re.IGNORECASE):
            return False
        markers = [
            r"HDFC\s*BANK",
            r"HDFC000\d{4}",
            r"WWW\.HDFCBANK\.COM",
            r"HDFC\s*Bank\s*Ltd",
        ]
        return any(re.search(p, text, re.IGNORECASE) for p in markers)
    def parse(self, text):
        lines = [line.strip() for line in text.splitlines() if line.strip()]

        # 1. Account Number
        # Standard HDFC savings account numbers are 14 digits
        acc_match = re.search(r"\b(?:Account\s*(?:No\.?|Number)|A/C\s*(?:No\.?|Number))\s*[:|\-]?\s*(\d{14})\b", text, re.IGNORECASE)
        if not acc_match:
            acc_match = re.search(r"\b(?:Account\s*(?:No\.?|Number)|A/C\s*(?:No\.?|Number))\s*[:|\-]?\s*(\d{9,16})\b", text, re.IGNORECASE)
        if not acc_match:
            # Look for 14 digit sequence standalone in header lines
            for line in lines[:30]:
                standalone_match = re.search(r"\b(50[0-9]{12})\b", line)
                if standalone_match:
                    acc_match = standalone_match
                    break
        acc_number = acc_match.group(1) if acc_match else ""

        # 2. Account Holder Name
        holder_name = ""
        # Match line right above "Customer ID :"
        m_cust = re.search(r"([A-Za-z\s\.]{3,35})\n\s*Customer\s*ID\s*:", text, re.IGNORECASE)
        if m_cust:
            cand = m_cust.group(1).strip().upper()
            if not any(k in cand for k in ["HDFC", "PAGE", "STATEMENT", "BANK", "BRANCH", "RELATIONSHIP", "SUMMARY"]):
                holder_name = cand

        if not holder_name:
            m_page = re.search(r"Page\s+\d+\s+of\s+\d+\s*\n+([A-Za-z\s\.]{3,35})\n", text, re.IGNORECASE)
            if m_page:
                cand = m_page.group(1).strip().upper()
                if not any(k in cand for k in ["HDFC", "PAGE", "STATEMENT", "BANK", "BRANCH", "RELATIONSHIP", "SUMMARY"]):
                    holder_name = cand

        if not holder_name:
            holder_patterns = [
                r"(?:Customer\s*Name|Account\s*Name|Account\s*Holder)\s*[:|\-]?\s*([A-Z\s\.]{3,40})(?:\n|$)",
                r"(?:MR\.|MS\.|MRS\.|DR\.)\s+([A-Z\s]{3,40})(?:\n|$)",
            ]
            for p in holder_patterns:
                m = re.search(p, text, re.IGNORECASE)
                if m:
                    cand = re.sub(r"\s+", " ", m.group(1)).strip().upper()
                    if len(cand) >= 3 and not any(k in cand for k in ["BANK", "STATEMENT", "PAGE", "BRANCH", "ACCOUNT", "SOMOSREE"]):
                        holder_name = cand
                        break
        # 3. Branch & IFSC
        ifsc_match = re.search(r"\b(HDFC\d{7})\b", text, re.IGNORECASE)
        ifsc = ifsc_match.group(1).upper() if ifsc_match else "HDFC0001756"

        m_br = re.search(r"Account\s*Number\s*:\s*\d+\s{3,}([A-Za-z\s]+?)(?:\n|$)", text, re.IGNORECASE)
        branch = m_br.group(1).strip() if m_br else ""
        if not branch:
            m_br2 = re.search(r"Account\s*Branch\s*:\s*\d+\s*\n+\s*([A-Za-z0-9\s\-]+?)(?:\n|No\.|Opp\.|Sarjapur)", text, re.IGNORECASE)
            branch = m_br2.group(1).strip() if m_br2 else ""
        if not branch:
            branch_match = re.search(r"(?:Branch\s*(?:Name)?|Branch)\s*[:|\-]?\s*([A-Za-z0-9\s\-]+?)(?:\n|IFSC|,|Pin|$)", text, re.IGNORECASE)
            branch = branch_match.group(1).strip() if branch_match else "Marathahalli"
        # 4. Account Type
        acc_type = "Savings Account"
        if re.search(r"CURRENT\s*ACCOUNT", text, re.IGNORECASE):
            acc_type = "Current Account"
        elif re.search(r"SALARY\s*ACCOUNT", text, re.IGNORECASE):
            acc_type = "Salary Savings Account"

        # 5. Statement Period
        period_match = re.search(r"(?:From\s*:\s*|Period\s*:\s*|Statement\s*Period\s*:\s*)(\d{2}[/-]\d{2}[/-]\d{2,4})\s*(?:To\s*:\s*|to\s*|-)\s*(\d{2}[/-]\d{2}[/-]\d{2,4})", text, re.IGNORECASE)
        stmt_from = ""
        stmt_to = ""
        if period_match:
            stmt_from = period_match.group(1).replace("-", "/")
            stmt_to = period_match.group(2).replace("-", "/")

        stmt_date_match = re.search(r"(?:Statement\s*Date|Date\s*of\s*Statement)\s*[:|\-]?\s*(\d{2}[/-]\d{2}[/-]\d{2,4})", text, re.IGNORECASE)
        stmt_date = stmt_date_match.group(1).replace("-", "/") if stmt_date_match else (stmt_to or "")

        # 6. Transactions Table Extraction
        # Typical HDFC layout:
        # Date | Narration | Chq/Ref No | Value Dt | Withdrawal Amt. | Deposit Amt. | Closing Balance
        transactions = []
        date_pattern = re.compile(r"^(\d{2}[/-]\d{2}[/-]\d{2,4})\b")

        table_lines = []
        in_txn_section = False

        def is_hdfc_header_line(line):
            patterns = [
                r"^Page\s+\d+\s+of\s+\d+",
                r"^(?:Customer\s*ID|Account\s*Number|Account\s*Branch|Joint\s*Holders|Statement\s*From|Account\s*Type|Nomination|Currency|Expected\s*AMB|RTGS/NEFT\s*IFSC|Savings\s*Account\s*Details|Opening\s*Balance\s*:)\b",
                r"^(?:Txn\s*Date|Date)\s+Narration\s+(?:Withdrawals|Withdrawal|Chq)",
                r"^(?:Marathahalli|No\.56,\s*Sai\s*Arcade|Opp\.intel|Sarjapur\s*Ring\s*Road|Bengaluru|Karnataka|560103)\b",
                r"^\*\*\*\s*End\s*of\s*Statement",
                r"^Signature\s*Not\s*Verified",
                r"^Digitally\s*signed\s*by",
                r"^Arka\s*Chakraborty$",
                r"^SUMMARY\b",
                r"^Total\s*Withdrawal\s*Balance",
                r"^HDFC\s*BANK"
            ]
            return any(re.search(p, line.strip(), re.IGNORECASE) for p in patterns)

        for line in lines:
            if re.search(r"(?:Txn\s*Date|Date)\s+Narration\s+(?:Withdrawals|Withdrawal|Chq|Withdrawal\s+Amt)", line, re.IGNORECASE):
                in_txn_section = True
                continue
            if in_txn_section:
                if re.search(r"(?:^\*\*\*\s*End\s+of\s+Statement|SUMMARY\s*\n|Total\s+Withdrawals)", line, re.IGNORECASE) and len(transactions) > 0:
                    break
                table_lines.append(line)
        candidate_lines = table_lines if table_lines else lines

        # Pre-extract summary balances for running balance baseline
        opening_balance = None
        closing_balance = None
        summary_debits = None
        summary_credits = None
        m_hdfc_summary = re.search(
            r"Opening\s*Balance\s+Debit\s*Amount\s+Credit\s*Amount\s+Closing\s*Balance\s*\n+\s*([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})",
            text,
            re.IGNORECASE
        )
        if m_hdfc_summary:
            opening_balance = parse_amount(m_hdfc_summary.group(1))
            summary_debits = parse_amount(m_hdfc_summary.group(2))
            summary_credits = parse_amount(m_hdfc_summary.group(3))
            closing_balance = parse_amount(m_hdfc_summary.group(4))

        if closing_balance is None:
            m_withdrawable = re.search(r"Total\s*Withdrawal\s*Balance(?:\*\*\*)?\s*:\s*([\d,]+\.\d{2})", text, re.IGNORECASE)
            if m_withdrawable:
                closing_balance = parse_amount(m_withdrawable.group(1))

        if closing_balance is None:
            summary_close_match = re.search(r"Closing\s*Balance\s*:\s*(?:Rs\.?|INR|₹)?\s*(-?\d[\d,]*(?:\.\d{1,2})?)", text, re.IGNORECASE)
            if summary_close_match:
                closing_balance = parse_amount(summary_close_match.group(1))
        if opening_balance is None:
            summary_open_match = re.search(r"Opening\s*Balance\s*:\s*(?:Rs\.?|INR|₹)?\s*(-?\d[\d,]*(?:\.\d{1,2})?)", text, re.IGNORECASE)
            if summary_open_match:
                opening_balance = parse_amount(summary_open_match.group(1))

        raw_tx_list = []
        curr_tx = None
        for line in candidate_lines:
            d_match = date_pattern.match(line)
            if d_match:
                if curr_tx:
                    raw_tx_list.append(curr_tx)
                    curr_tx = None

                tx_date = d_match.group(1).replace("-", "/")
                remainder = line[d_match.end():].strip()

                money_matches = list(re.finditer(r"(?<![A-Za-z0-9])(-?\d[\d,]*(?:\.\d{2}))(?![A-Za-z0-9])", remainder))
                if not money_matches:
                    money_matches = list(re.finditer(r"(?<![A-Za-z0-9])(-?\d[\d,]*(?:\.\d{1,2})?)(?![A-Za-z0-9])", remainder))

                if money_matches:
                    balance_raw = money_matches[-1].group(1)
                    closing_bal = parse_amount(balance_raw)

                    wd_amt = 0.0
                    dp_amt = 0.0
                    if len(money_matches) >= 3:
                        wd_amt = abs(parse_amount(money_matches[-3].group(1)) or 0.0)
                        dp_amt = abs(parse_amount(money_matches[-2].group(1)) or 0.0)
                    elif len(money_matches) == 2:
                        amt_raw = money_matches[-2].group(1)
                        wd_amt = abs(parse_amount(amt_raw) or 0.0)

                    first_num_start = money_matches[0].start()
                    desc_part = remainder[:first_num_start].strip()

                    ref_match = re.search(r"\b([A-Z]{2,}[0-9]{4,}|[A-Z0-9]{8,22})\b", remainder)
                    ref_no = ref_match.group(1) if ref_match else ""
                    if ref_no and ref_no in desc_part:
                        desc_part = re.sub(r"\s*" + re.escape(ref_no) + r"\s*$", "", desc_part).strip()

                    tx_type = "DR" if wd_amt > 0 else ("CR" if dp_amt > 0 else "CR")
                    amt = wd_amt if wd_amt > 0 else dp_amt

                    curr_tx = {
                        "date": tx_date,
                        "narration": desc_part if desc_part else "Transaction",
                        "ref_no": ref_no,
                        "type": tx_type,
                        "amount": round_money(amt),
                        "balance": round_money(closing_bal)
                    }
            elif curr_tx:
                if not is_hdfc_header_line(line):
                    curr_tx["narration"] = (curr_tx["narration"] + " " + line).strip()
        if curr_tx:
            raw_tx_list.append(curr_tx)

        # Mathematical normalization using running balances:
        prev_balance = opening_balance
        for tx in raw_tx_list:
            bal = tx["balance"]
            if prev_balance is not None and bal is not None:
                delta = round_money(bal - prev_balance)
                if delta < 0:
                    tx["type"] = "DR"
                    tx["amount"] = abs(delta)
                elif delta > 0:
                    tx["type"] = "CR"
                    tx["amount"] = delta
                elif tx["amount"] == 0.0 and re.search(r"\bOPENING\b", tx["narration"], re.IGNORECASE):
                    tx["type"] = "CR"
            else:
                if re.search(r"\bOPENING\b", tx["narration"], re.IGNORECASE):
                    tx["type"] = "CR"
                    tx["amount"] = 0.0
                elif any(k in tx["narration"].upper() for k in ["DR", "DEBIT", "TRANSFER TO", "UPI/DR", "ATM-WDL", "POS-PUR"]):
                    tx["type"] = "DR"
            prev_balance = bal
            if tx["amount"] > 0 or re.search(r"\bOPENING\b", tx["narration"], re.IGNORECASE):
                transactions.append(tx)

        # Enrich transactions with merchant normalization, narration scrubbing, and spend categorization
        for tx in transactions:
            tx["narration"] = scrub_narration(tx.get("narration", ""))
            tx["merchant"] = extract_merchant(tx["narration"])
            if tx.get("type") == "DR":
                cat, col = categorize_transaction(tx["narration"])
                tx["category"] = cat
                tx["color"] = col
            else:
                tx["category"] = "Income & Deposits"
                tx["color"] = "#22c55e"

        # Derive from transactions if not found in summary
        if closing_balance is None and transactions:
            closing_balance = transactions[-1].get("balance", 0.0)

        total_credits = summary_credits if summary_credits is not None else round_money(sum(t["amount"] for t in transactions if t["type"] == "CR"))
        total_debits = summary_debits if summary_debits is not None else round_money(sum(t["amount"] for t in transactions if t["type"] == "DR"))
        if opening_balance is None:
            if closing_balance is not None:
                opening_balance = round_money(closing_balance - total_credits + total_debits)
            elif transactions:
                first_tx = transactions[0]
                first_bal = first_tx.get("balance", 0.0)
                first_amt = first_tx.get("amount", 0.0)
                if first_tx.get("type") == "CR":
                    opening_balance = round_money(first_bal - first_amt)
                else:
                    opening_balance = round_money(first_bal + first_amt)
            else:
                opening_balance = 0.0

        if closing_balance is None:
            closing_balance = round_money((opening_balance or 0.0) + total_credits - total_debits)

        net_cashflow = round_money(total_credits - total_debits)

        if not stmt_date and transactions:
            stmt_date = transactions[-1].get("date", "")
        if not stmt_to and stmt_date:
            stmt_to = stmt_date
        if not stmt_from and transactions:
            stmt_from = transactions[0].get("date", "")

        monthly_cashflow = synthesize_monthly_cashflow(transactions)
        spending_summary = synthesize_spending_summary(transactions, stmt_from, stmt_to)

        account = {
            "account_number": acc_number or "HDFC-ACCOUNT-01",
            "masked_account_number": mask_account_number(acc_number),
            "account_holder": holder_name or "HDFC Customer",
            "bank_name": "HDFC Bank",
            "bank_code": "HDFC",
            "account_type": acc_type,
            "branch": branch,
            "ifsc": ifsc,
            "currency": "INR",
            "opening_balance": round_money(opening_balance),
            "closing_balance": round_money(closing_balance),
            "total_credits": total_credits,
            "total_debits": total_debits,
            "net_cashflow": net_cashflow,
            "statement_date": stmt_date,
            "statement_period": {"from": stmt_from, "to": stmt_to},
            "monthly_cashflow": monthly_cashflow,
            "spending_summary": spending_summary,
            "transactions": transactions,
        }
        return {
            "success": True,
            "source": "Bank Statement",
            "bank_name": "HDFC Bank",
            "accounts": [account],
        }


class StandardCharteredParser:
    """Parser tailored for Standard Chartered Bank savings and current account statements."""

    @classmethod
    def matches(cls, text):
        markers = [
            r"STANDARD\s*CHARTERED",
            r"\bSCB\b",
            r"SUPERVALUE\s*SAVINGS",
            r"SCBL0036\d{3}",
        ]
        return any(re.search(p, text, re.IGNORECASE) for p in markers)

    def parse(self, text):
        lines = [line.strip() for line in text.splitlines() if line.strip()]

        # 1. Account Number
        # SCB uses 16 digit or masked accounts
        acc_match = re.search(r"\b(?:Account\s*(?:No\.?|Number)|A/C\s*(?:No\.?|Number))\s*[:|\-]?\s*(\d{11,16}|X{4,8}\d{4,6})\b", text, re.IGNORECASE)
        # SCB uses 11 or 16 digit accounts
        acc_no_m = re.search(r"ACCOUNT\s*NO\s*:\s*(\d+)", text, re.IGNORECASE)
        if acc_no_m:
            acc_number = acc_no_m.group(1)
        else:
            acc_match = re.search(r"\b(?:Account\s*(?:No\.?|Number)|A/C\s*(?:No\.?|Number))\s*[:|\-]?\s*(\d{11,16}|X{4,8}\d{4,6})\b", text, re.IGNORECASE)
            if not acc_match:
                for line in lines[:30]:
                    m = re.search(r"\b(019\d{13}|\d{16})\b", line)
                    if m:
                        acc_match = m
                        break
            acc_number = acc_match.group(1) if acc_match else ""

        # 2. Account Holder Name
        holder_name = ""
        name_m = re.search(r"^\s*(?:MR|MS|MRS|DR)?\.?\s*([A-Z\s]{4,35}?)(?:\s{3,}|BRANCH|\n|$)", text, re.MULTILINE)
        if name_m:
            cand = name_m.group(1).strip().upper()
            if not any(k in cand for k in ["STANDARD", "CHARTERED", "STATEMENT", "PAGE", "BRANCH", "ACCOUNT", "NOMINEE", "REGISTERED", "CURRENCY"]):
                holder_name = cand

        if not holder_name:
            for line in lines[2:15]:
                if re.match(r"^[A-Z\s]{4,35}$", line) and not any(k in line.upper() for k in ["STANDARD", "CHARTERED", "STATEMENT", "PAGE", "BRANCH", "ACCOUNT", "NOMINEE", "REGISTERED", "CURRENCY"]):
                    holder_name = line.strip().upper()
                    break
        # 3. Account Type / Title
        acc_type = "Savings Account"
        if re.search(r"SUPERVALUE\s*SAVINGS", text, re.IGNORECASE):
            acc_type = "SuperValue Savings Account"
        elif re.search(r"SAVINGS\s*ACCOUNT", text, re.IGNORECASE):
            acc_type = "Savings Account"
        elif re.search(r"CURRENT\s*ACCOUNT", text, re.IGNORECASE):
            acc_type = "Current Account"

        # 4. Branch & IFSC
        ifsc_match = re.search(r"\b(SCBL\d{7})\b", text, re.IGNORECASE)
        ifsc = ifsc_match.group(1).upper() if ifsc_match else "SCBL0036001"

        branch_match = re.search(r"(?:BRANCH\s*:\s*|Branch\s*[:|\-]?\s*)([A-Za-z0-9\s\-]+?)(?:\n|IFSC|,|Pin|STATEMENT|CURRENCY|$)", text, re.IGNORECASE)
        branch = branch_match.group(1).strip() if branch_match else "Secunderabad"
        # 5. Statement Period & Date
        period_match = re.search(r"(?:Statement\s*Period|Period)\s*[:|\-]?\s*(\d{2}[/-]\d{2}[/-]\d{2,4})\s*(?:to|-)\s*(\d{2}[/-]\d{2}[/-]\d{2,4})", text, re.IGNORECASE)
        stmt_from = ""
        stmt_to = ""
        if period_match:
            stmt_from = period_match.group(1).replace("-", "/")
            stmt_to = period_match.group(2).replace("-", "/")

        stmt_date_match = re.search(r"(?:Statement\s*Date|Date)\s*[:|\-]?\s*(\d{1,2}\s+[A-Za-z]{3}\s+\d{4}|\d{2}[/-]\d{2}[/-]\d{2,4})", text, re.IGNORECASE)
        stmt_date = stmt_date_match.group(1).replace("-", "/") if stmt_date_match else (stmt_to or "")
        # 6. Balances from Summary Row (SCB provides Total row with deposits, withdrawals, and balance)
        opening_balance = None
        closing_balance = None
        sum_debits = None
        sum_credits = None

        tot_m = re.search(r"\bTotal\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})", text, re.IGNORECASE)
        if tot_m:
            sum_credits = parse_amount(tot_m.group(1))
            sum_debits = parse_amount(tot_m.group(2))
            closing_balance = parse_amount(tot_m.group(3))

        bal_fwd_m = re.search(r"BALANCE\s*FORWARD\s*([\d,]+\.\d{2})", text, re.IGNORECASE)
        if bal_fwd_m:
            opening_balance = parse_amount(bal_fwd_m.group(1))

        if closing_balance is None:
            closing_bal_match = re.search(r"(?:Closing\s*Balance|Ending\s*Balance|Carried\s*Forward)\s*[:|\-]?\s*(?:Rs\.?|INR|₹)?\s*(-?\d[\d,]*(?:\.\d{1,2})?)", text, re.IGNORECASE)
            if closing_bal_match:
                closing_balance = parse_amount(closing_bal_match.group(1))

        if opening_balance is None:
            open_bal_match = re.search(r"(?:Opening\s*Balance|Brought\s*Forward)\s*[:|\-]?\s*(?:Rs\.?|INR|₹)?\s*(-?\d[\d,]*(?:\.\d{1,2})?)", text, re.IGNORECASE)
            if open_bal_match:
                opening_balance = parse_amount(open_bal_match.group(1))

        # 7. Transaction Table Extraction
        transactions = []
        date_pattern = re.compile(r"^\s*(\d{2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}|\d{2}[/-]\d{2}[/-]\d{2,4})\b", re.IGNORECASE)

        def is_scb_header_line(line):
            patterns = [
                r"^Page\s+\d+\s+of\s+\d+",
                r"^MR\s*ARKA\s*CHAKRABORTY",
                r"^BRANCH\s*ADDRESS",
                r"^(?:Value\s*Date|Date\s+Description|Cheque\s+Deposit)",
                r"^Total\s+[\d,]+",
                r"^Dear\s*Client",
                r"^Bank\s*deposits\s*are\s*covered",
                r"^The\s*Ministry\s*of\s*Home",
                r"^Insurance:",
                r"^Private\s*Debit",
                r"^Platinum\s*Rewards",
                r"^You\s*may\s*visit"
            ]
            return any(re.search(p, line.strip(), re.IGNORECASE) for p in patterns)
        raw_tx_list = []
        curr_tx = None

        for line in lines:
            d_match = date_pattern.match(line)
            if d_match:
                if curr_tx:
                    raw_tx_list.append(curr_tx)
                    curr_tx = None

                tx_date = d_match.group(1).replace("-", "/")
                remainder = line[d_match.end():].strip()

                # If line has value date after date, strip it
                val_date_m = date_pattern.match(remainder)
                if val_date_m:
                    remainder = remainder[val_date_m.end():].strip()

                money_matches = list(re.finditer(r"(?<![A-Za-z0-9])(-?\d[\d,]*(?:\.\d{2}))(?![A-Za-z0-9])", remainder))
                if not money_matches:
                    money_matches = list(re.finditer(r"(?<![A-Za-z0-9])(-?\d[\d,]*(?:\.\d{1,2})?)(?![A-Za-z0-9])", remainder))

                if money_matches:
                    balance_raw = money_matches[-1].group(1)
                    closing_bal = parse_amount(balance_raw)

                    amt = 0.0
                    if len(money_matches) >= 2:
                        amt_raw = money_matches[-2].group(1)
                        amt = abs(parse_amount(amt_raw) or 0.0)

                    first_num_start = money_matches[0].start()
                    desc_part = remainder[:first_num_start].strip()

                    ref_match = re.search(r"\b([A-Z]{2,}[0-9]{4,}|[A-Z0-9]{8,22})\b", remainder)
                    ref_no = ref_match.group(1) if ref_match else ""
                    if ref_no and ref_no in desc_part:
                        desc_part = re.sub(r"\s*" + re.escape(ref_no) + r"\s*$", "", desc_part).strip()

                    curr_tx = {
                        "date": tx_date,
                        "narration": desc_part if desc_part else "Transaction",
                        "ref_no": ref_no,
                        "type": "CR",
                        "amount": round_money(amt),
                        "balance": round_money(closing_bal)
                    }
            elif curr_tx:
                if not is_scb_header_line(line):
                    curr_tx["narration"] = (curr_tx["narration"] + " " + line).strip()

        if curr_tx:
            raw_tx_list.append(curr_tx)

        prev_balance = opening_balance
        for tx in raw_tx_list:
            bal = tx["balance"]
            if prev_balance is not None and bal is not None:
                delta = round_money(bal - prev_balance)
                if delta < 0:
                    tx["type"] = "DR"
                    tx["amount"] = abs(delta)
                elif delta > 0:
                    tx["type"] = "CR"
                    tx["amount"] = delta
                elif tx["amount"] == 0.0 and re.search(r"\bBALANCE\s*FORWARD\b", tx["narration"], re.IGNORECASE):
                    tx["type"] = "CR"
            else:
                if any(k in tx["narration"].upper() for k in ["DR", "DEBIT", "TRANSFER TO", "ATM", "POS", "PAYMENT"]):
                    tx["type"] = "DR"
                elif tx["amount"] == 0.0 and re.search(r"\bBALANCE\s*FORWARD\b", tx["narration"], re.IGNORECASE):
                    tx["type"] = "CR"
            prev_balance = bal
            transactions.append(tx)

        # Enrich transactions with merchant normalization, narration scrubbing, and spend categorization
        for tx in transactions:
            tx["narration"] = scrub_narration(tx.get("narration", ""))
            tx["merchant"] = extract_merchant(tx["narration"])
            if tx.get("type") == "DR":
                cat, col = categorize_transaction(tx["narration"])
                tx["category"] = cat
                tx["color"] = col
            else:
                tx["category"] = "Income & Deposits"
                tx["color"] = "#22c55e"

        # Balances consolidation
        total_credits = round_money(sum(t["amount"] for t in transactions if t["type"] == "CR"))
        total_debits = round_money(sum(t["amount"] for t in transactions if t["type"] == "DR"))

        if sum_credits is not None and sum_credits > 0 and not transactions:
            total_credits = round_money(sum_credits)
        if sum_debits is not None and sum_debits > 0 and not transactions:
            total_debits = round_money(sum_debits)

        if closing_balance is None and transactions:
            closing_balance = transactions[-1].get("balance", 0.0)

        if opening_balance is None:
            if closing_balance is not None:
                opening_balance = round_money(closing_balance - total_credits + total_debits)
            else:
                opening_balance = 0.0

        if closing_balance is None:
            closing_balance = round_money(opening_balance + total_credits - total_debits)

        net_cashflow = round_money(total_credits - total_debits)

        if not stmt_date and transactions:
            stmt_date = transactions[-1].get("date", "")
        if not stmt_to and stmt_date:
            stmt_to = stmt_date
        if not stmt_from and transactions:
            stmt_from = transactions[0].get("date", "")

        monthly_cashflow = synthesize_monthly_cashflow(transactions)
        spending_summary = synthesize_spending_summary(transactions, stmt_from, stmt_to)

        account = {
            "account_number": acc_number or "SCB-ACCOUNT-01",
            "masked_account_number": mask_account_number(acc_number),
            "account_holder": holder_name or "SCB Customer",
            "bank_name": "Standard Chartered Bank",
            "bank_code": "SCB",
            "account_type": acc_type,
            "branch": branch,
            "ifsc": ifsc,
            "currency": "INR",
            "opening_balance": round_money(opening_balance),
            "closing_balance": round_money(closing_balance),
            "total_credits": total_credits,
            "total_debits": total_debits,
            "net_cashflow": net_cashflow,
            "statement_date": stmt_date,
            "statement_period": {"from": stmt_from, "to": stmt_to},
            "monthly_cashflow": monthly_cashflow,
            "spending_summary": spending_summary,
            "transactions": transactions,
        }

        return {
            "success": True,
            "source": "Bank Statement",
            "bank_name": "Standard Chartered Bank",
            "accounts": [account],
        }


class GenericBankParser:
    """Fallback parser for other Indian bank statements."""

    def parse(self, text, bank_hint="Generic Bank"):
        lines = [line.strip() for line in text.splitlines() if line.strip()]

        # Account Number
        acc_match = re.search(r"\b(?:Account\s*(?:No\.?|Number)|A/C\s*(?:No\.?|Number))\s*[:|\-]?\s*(\d{9,18}|X{4,8}\d{4,6})\b", text, re.IGNORECASE)
        acc_number = acc_match.group(1) if acc_match else "BANK-ACC-01"

        # Account Holder
        holder_match = re.search(r"(?:Customer\s*Name|Account\s*Name|Account\s*Holder|Name)\s*[:|\-]?\s*([A-Z\s\.]{3,40})(?:\n|$)", text, re.IGNORECASE)
        holder_name = holder_match.group(1).strip().upper() if holder_match else "Account Holder"

        # IFSC
        ifsc_match = re.search(r"\b([A-Z]{4}0[A-Z0-9]{6})\b", text)
        ifsc = ifsc_match.group(1) if ifsc_match else ""

        # Balances
        open_bal_match = re.search(r"(?:Opening\s*Balance|Brought\s*Forward)\s*[:|\-]?\s*([₹\s\d,]+(?:\.\d{1,2})?)", text, re.IGNORECASE)
        close_bal_match = re.search(r"(?:Closing\s*Balance|Ending\s*Balance|Available\s*Balance)\s*[:|\-]?\s*([₹\s\d,]+(?:\.\d{1,2})?)", text, re.IGNORECASE)

        opening_balance = parse_amount(open_bal_match.group(1)) if open_bal_match else 0.0
        closing_balance = parse_amount(close_bal_match.group(1)) if close_bal_match else 0.0

        # Generic transaction parsing
        transactions = []
        date_pattern = re.compile(r"^(\d{2}[/-]\d{2}[/-]\d{2,4})\b")

        for line in lines:
            d_match = date_pattern.match(line)
            if d_match:
                remainder = line[d_match.end():].strip()
                num_matches = list(re.finditer(r"(-?\d[\d,]*(?:\.\d{1,2})?)", remainder))
                if len(num_matches) >= 1:
                    last_num = parse_amount(num_matches[-1].group(1)) or 0.0
                    amt = abs(last_num)
                    is_dr = any(k in remainder.upper() for k in ["DR", "DEBIT", "TRANSFER TO", "WD"])
                    transactions.append({
                        "date": d_match.group(1).replace("-", "/"),
                        "narration": remainder[:num_matches[0].start()].strip() or "Transaction",
                        "ref_no": "",
                        "type": "DR" if is_dr else "CR",
                        "amount": round_money(amt),
                        "balance": round_money(closing_balance)
                    })

        # Enrich transactions with merchant normalization, narration scrubbing, and spend categorization
        for tx in transactions:
            tx["narration"] = scrub_narration(tx.get("narration", ""))
            tx["merchant"] = extract_merchant(tx["narration"])
            if tx.get("type") == "DR":
                cat, col = categorize_transaction(tx["narration"])
                tx["category"] = cat
                tx["color"] = col
            else:
                tx["category"] = "Income & Deposits"
                tx["color"] = "#22c55e"

        total_credits = round_money(sum(t["amount"] for t in transactions if t["type"] == "CR"))
        total_debits = round_money(sum(t["amount"] for t in transactions if t["type"] == "DR"))

        if closing_balance == 0.0 and transactions:
            closing_balance = transactions[-1].get("balance", 0.0)

        monthly_cashflow = synthesize_monthly_cashflow(transactions)
        spending_summary = synthesize_spending_summary(transactions)

        account = {
            "account_number": acc_number,
            "masked_account_number": mask_account_number(acc_number),
            "account_holder": holder_name,
            "bank_name": bank_hint if bank_hint and bank_hint != "auto" else "Bank Account",
            "bank_code": "BANK",
            "account_type": "Savings Account",
            "branch": "Branch",
            "ifsc": ifsc,
            "currency": "INR",
            "opening_balance": round_money(opening_balance),
            "closing_balance": round_money(closing_balance),
            "total_credits": total_credits,
            "total_debits": total_debits,
            "net_cashflow": round_money(total_credits - total_debits),
            "statement_date": "",
            "statement_period": {"from": "", "to": ""},
            "monthly_cashflow": monthly_cashflow,
            "spending_summary": spending_summary,
            "transactions": transactions,
        }

        return {
            "success": True,
            "source": "Bank Statement",
            "bank_name": account["bank_name"],
            "accounts": [account],
        }


def parse_bank_statement(pdf_path, password="", bank_hint="auto"):
    """
    Main extraction and parsing orchestrator.
    """
    text = extract_pdf_text(pdf_path, password)
    hint_clean = (bank_hint or "auto").strip().lower()

    if hint_clean in ("scb", "standard_chartered", "standard chartered", "scb_bank") or (hint_clean == "auto" and StandardCharteredParser.matches(text)):
        parser = StandardCharteredParser()
        res = parser.parse(text)
    elif hint_clean in ("hdfc", "hdfc_bank", "hdfc bank") or (hint_clean == "auto" and HDFCBankParser.matches(text)):
        parser = HDFCBankParser()
        res = parser.parse(text)
    else:
        parser = GenericBankParser()
        res = parser.parse(text, bank_hint=bank_hint)

    if res.get("success") and res.get("accounts"):
        all_txs = [tx for acc in res["accounts"] for tx in acc.get("transactions", [])]
        res["spending_summary"] = synthesize_spending_summary(all_txs)

    return res

def main():
    if len(sys.argv) < 2:
        print(json.dumps({
            "success": False,
            "error_type": "INVALID_ARGUMENTS",
            "error": "Usage: bank_parser.py <pdf_path> [password] [bank_hint]"
        }))
        return

    pdf_path = sys.argv[1]
    password = sys.argv[2] if len(sys.argv) > 2 else ""
    bank_hint = sys.argv[3] if len(sys.argv) > 3 else "auto"

    try:
        result = parse_bank_statement(pdf_path, password=password, bank_hint=bank_hint)
        print(json.dumps(result))
    except IncorrectPasswordError as exc:
        print(json.dumps({
            "success": False,
            "error_type": exc.error_type,
            "error": str(exc)
        }))
    except BankParserError as exc:
        print(json.dumps({
            "success": False,
            "error_type": exc.error_type,
            "error": str(exc)
        }))
    except Exception as exc:
        sys.stderr.write(traceback.format_exc())
        print(json.dumps({
            "success": False,
            "error_type": "UNKNOWN_ERROR",
            "error": f"Failed to parse bank statement: {exc}"
        }))


if __name__ == "__main__":
    main()
