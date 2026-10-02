#!/usr/bin/env python3
"""Parse a text-based official EPFO member passbook PDF into account balances."""

import json
import os
import re
import shutil
import subprocess
import sys
import traceback


class EPFOPassbookError(Exception):
    """Raised when a PDF cannot be safely interpreted as an EPFO passbook."""


MONEY_FRAGMENT = r"(?:₹\s*|INR\s*|RS\.?\s*)?(\(?\s*-?\s*\d[\d,]*(?:\.\d{1,2})?\s*\)?)"
MEMBER_ID_PATTERNS = (
    r"\bMEMBER\s*(?:ID|ID\.|ACCOUNT\s*(?:NO\.?|NUMBER))(?:\s*/\s*NAME)?\s*[:|\-]?\s*([A-Z0-9/\-]{8,})",
    r"\bPF\s*MEMBER\s*(?:ID|ID\.)(?:\s*/\s*NAME)?\s*[:|\-]?\s*([A-Z0-9/\-]{8,})",
    r"\b([A-Z]{5}\d{17,22})\b",
)
BALANCE_LABELS = {
    "employee_share": r"(?:EMPLOYEE'?S?\s+(?:SHARE|CONTRIBUTION)|MEMBER'?S?\s+SHARE)",
    "employer_share": r"(?:EMPLOYER'?S?\s+(?:SHARE|CONTRIBUTION)|ER\s+SHARE)",
    "pension_balance": r"(?:PENSION\s+(?:CONTRIBUTION|FUND|SHARE|BALANCE)|EPS\s+(?:CONTRIBUTION|FUND|BALANCE)?)",
    "total_balance": r"(?:TOTAL\s+(?:BALANCE|AMOUNT|EPF\s+BALANCE)|NET\s+BALANCE|CLOSING\s+BALANCE)",
}


def round_money(value):
    return round(float(value) * 100) / 100


def parse_amount(raw):
    """Parse an INR amount, including Indian comma grouping and accounting negatives."""
    if raw is None:
        return None

    value = str(raw).strip().upper()
    if value in {"", "-", "—", "NIL", "N/A", "NA"}:
        return 0.0

    negative = value.startswith("(") and value.endswith(")")
    value = value.replace("₹", "").replace("INR", "").replace("RS.", "").replace("RS", "")
    value = value.replace(",", "").replace("(", "").replace(")", "").replace(" ", "")

    try:
        amount = float(value)
    except ValueError:
        return None
    return round_money(-amount if negative else amount)


def extract_pdf_text(pdf_path, password=""):
    # 1. Primary: pdftotext (poppler-utils) with -layout preservation
    if shutil.which("pdftotext"):
        cmd = ["pdftotext", "-layout"]
        if password:
            cmd.extend(["-upw", password])
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
            stderr = proc.stderr.lower()
            if "password" in stderr or "unauthorized" in stderr:
                raise EPFOPassbookError(
                    "This EPFO passbook PDF is password protected. Export an unlocked copy from the official portal before uploading it."
                )
        except subprocess.TimeoutExpired:
            pass
        except EPFOPassbookError:
            raise
        except Exception:
            pass

    # 2. Secondary: pypdfium2 if installed
    try:
        import pypdfium2 as pdfium
        try:
            document = pdfium.PdfDocument(pdf_path, password=password)
            pages = []
            for page_index in range(len(document)):
                try:
                    text = document[page_index].get_textpage().get_text_range()
                except Exception:
                    continue
                if text and text.strip():
                    pages.append(text)
            text = "\n".join(pages).replace("\r", "\n")
            if text.strip():
                return text
        except Exception as exc:
            if "password" in str(exc).lower():
                raise EPFOPassbookError(
                    "This EPFO passbook PDF is password protected. Export an unlocked copy from the official portal before uploading it."
                ) from exc
    except ImportError:
        pass

    # 3. Tertiary: pypdf if installed
    try:
        import pypdf
        try:
            reader = pypdf.PdfReader(pdf_path)
            if reader.is_encrypted:
                if password:
                    reader.decrypt(password)
                else:
                    raise EPFOPassbookError(
                        "This EPFO passbook PDF is password protected. Export an unlocked copy from the official portal before uploading it."
                    )
            pages = [p.extract_text() for p in reader.pages if p.extract_text()]
            text = "\n".join(pages).replace("\r", "\n")
            if text.strip():
                return text
        except EPFOPassbookError:
            raise
        except Exception:
            pass
    except ImportError:
        pass

    raise EPFOPassbookError(
        "No selectable text was found in the PDF. Export the official EPFO passbook as a text-based PDF instead of uploading a scan."
    )


def cleaned_lines(text):
    return [re.sub(r"[ \t]+", " ", line).strip() for line in text.split("\n") if line.strip()]


def extract_member_id(text, pdf_path=""):
    normalized = re.sub(r"[ \t]+", " ", text).upper()
    for pattern in MEMBER_ID_PATTERNS:
        match = re.search(pattern, normalized, re.IGNORECASE)
        if match:
            member_id = re.sub(r"[^A-Z0-9]", "", match.group(1).upper())
            if len(member_id) >= 8:
                return member_id
    if pdf_path:
        fn_match = re.search(r"([A-Z]{5}\d{17,22})", os.path.basename(pdf_path).upper())
        if fn_match:
            return fn_match.group(1)
    return ""


def extract_member_name(text):
    m = re.search(r"Member\s*(?:ID\s*/\s*)?Name\s*[:|\-]?\s*[A-Z0-9/\-]+\s*/\s*([^\n\r]+)", text, re.IGNORECASE)
    if m:
        name = m.group(1).strip(" -:")
        if name:
            return name
    return ""


def extract_uan(text):
    m = re.search(r"\bUAN\s*[:|\-]?\s*(\d{10,14})\b", text, re.IGNORECASE)
    return m.group(1).strip() if m else ""
def extract_label_value(lines, label_pattern):
    """Extract an explicit `Label: amount` balance; table headers are ignored."""
    matcher = re.compile(
        rf"{label_pattern}(?:\s*(?:\([^)]*\)|\b(?:TOTAL|BALANCE|SHARE|CONTRIBUTION)\b))*\s*[:=\-]\s*{MONEY_FRAGMENT}",
        re.IGNORECASE,
    )
    values = []
    for line in lines:
        match = matcher.search(line)
        if match:
            amount = parse_amount(match.group(1))
            if amount is not None:
                values.append(amount)
    return values[-1] if values else None

def amounts_in_line(line):
    # Strip dates (e.g. 31-03-2024, 31/03/2024, 31 Mar 2024) to avoid treating dates as monetary amounts
    clean_line = re.sub(r"\b\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{2,4}\b", " ", line)
    clean_line = re.sub(r"\b\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4}\b", " ", clean_line)
    values = []
    for match in re.finditer(MONEY_FRAGMENT, clean_line, re.IGNORECASE):
        amount = parse_amount(match.group(1))
        if amount is not None:
            values.append(amount)
    return values

def extract_total_row(lines):
    """Find the final EPFO summary row with Employee, Employer, and Pension values."""
    candidates = []
    for line in lines:
        if not re.search(r"\b(?:TOTAL|CLOSING\s+BALANCE|CURRENT\s+BALANCE|BALANCE\s+AS\s+ON)\b", line, re.IGNORECASE):
            continue
        values = amounts_in_line(line)
        if len(values) >= 3:
            employee_share, employer_share, pension_balance = values[-3:]
            candidates.append((employee_share, employer_share, pension_balance))
    return candidates[-1] if candidates else None


def extract_balances(text):
    lines = cleaned_lines(text)
    explicit = {
        key: extract_label_value(lines, label)
        for key, label in BALANCE_LABELS.items()
    }

    # 1. Check official EPFO "Closing Balance as on <DATE> <EE> <ER> <EPS>"
    for line in lines:
        closing_match = re.search(
            r"Closing\s+Balance\s+as\s+on\s+([0-3]?\d[/\-][0-1]?\d[/\-]\d{2,4})\s+([\d,]+(?:\.\d{1,2})?)\s+([\d,]+(?:\.\d{1,2})?)\s+([\d,]+(?:\.\d{1,2})?)",
            line,
            re.IGNORECASE
        )
        if closing_match:
            stmt_date = closing_match.group(1)
            ee = parse_amount(closing_match.group(2))
            er = parse_amount(closing_match.group(3))
            eps = parse_amount(closing_match.group(4))
            if ee is not None and er is not None:
                tot = round_money(ee + er + (eps or 0.0))
                return {
                    "employee_share": ee,
                    "employer_share": er,
                    "pension_balance": eps or 0.0,
                    "total_balance": tot,
                    "statement_date": stmt_date,
                    "balance_source": "closing_balance_row"
                }

    # 2. Check explicitly labelled balances
    if explicit["employee_share"] is not None and explicit["employer_share"] is not None:
        ee = explicit["employee_share"]
        er = explicit["employer_share"]
        eps = explicit["pension_balance"] or 0.0
        tot = explicit.get("total_balance")
        if tot is None:
            tot = round_money(ee + er + eps)
        return {
            "employee_share": ee,
            "employer_share": er,
            "pension_balance": eps,
            "total_balance": tot,
            "balance_source": "labelled_summary",
        }

    # 3. Check generic total row
    total_row = extract_total_row(lines)
    if total_row:
        employee_share, employer_share, pension_balance = total_row
        return {
            "employee_share": employee_share,
            "employer_share": employer_share,
            "pension_balance": pension_balance,
            "total_balance": round_money(employee_share + employer_share + pension_balance),
            "balance_source": "total_row",
        }

    raise EPFOPassbookError(
        "Could not find the Employee Share, Employer Share, and Pension Contribution balance summary. "
        "Upload the full official EPFO passbook, including its final balance or total row."
    )


def extract_establishment_name(text, lines):
    # Pattern 1: Same line after Establishment ID/Name: <EST_ID> / <NAME>
    m = re.search(r"Establishment\s*(?:ID\s*/\s*)?Name\s*[:|\-]?\s*[A-Z0-9/\-]+\s*/\s*([^\n\r]+)", text, re.IGNORECASE)
    if m:
        name = m.group(1).strip(" -:,")
        if name and name.upper() not in {"LTD.", "PVT LTD.", "LIMITED", "LLP"}:
            return name

    # Pattern 2: Line with <EST_ID> / <NAME> before Establishment ID/Name line
    m2 = re.search(r"\b([A-Z]{5}\d{7,10})\s*/\s*([^\n\r]+)", text)
    if m2:
        part1 = m2.group(2).strip(" -:,")
        cont = re.search(r"Establishment\s*(?:ID\s*/\s*)?Name\s*[:|\-]?\s*([^\n\r]+)", text, re.IGNORECASE)
        if cont:
            part2 = cont.group(1).strip(" -:,")
            if part2 and part2.upper() not in part1.upper():
                return f"{part1} {part2}".strip(" -:,")
        return part1

    patterns = (
        r"\b(?:ESTABLISHMENT|ESTT\.?|COMPANY)\s*(?:ID\s*/\s*)?NAME\s*[:\-]\s*(.+)$",
        r"\bEMPLOYER\s*NAME\s*[:\-]\s*(.+)$",
    )
    for line in lines:
        for pattern in patterns:
            match = re.search(pattern, line, re.IGNORECASE)
            if match:
                name = match.group(1).strip(" -:")
                if name:
                    return name
    return "EPFO Establishment"
    patterns = (
        r"\b(?:PASSBOOK\s+)?(?:AS\s+ON|STATEMENT\s+DATE|DATE\s+OF\s+PRINT|GENERATED\s+ON)\s*[:\-]?\s*([0-3]?\d[\-/][0-1]?\d[\-/]\d{2,4})",
        r"\b(?:PASSBOOK\s+)?(?:AS\s+ON|STATEMENT\s+DATE|DATE\s+OF\s+PRINT|GENERATED\s+ON)\s*[:\-]?\s*(\d{1,2}\s+[A-Z]{3,9}\s+\d{4})",
    )
    for line in lines:
        for pattern in patterns:
            match = re.search(pattern, line, re.IGNORECASE)
            if match:
                return match.group(1).strip()
    return ""

def extract_transactions(text):
    txns = []
    pattern = r"([A-Za-z]{3}-\d{4})\s+([0-3]?\d-[0-1]?\d-\d{4})\s+([A-Z]{2})\s+(.+?)\s+([\d,]+(?:\.\d{1,2})?)\s+([\d,]+(?:\.\d{1,2})?)\s+([\d,]+(?:\.\d{1,2})?)\s+([\d,]+(?:\.\d{1,2})?)\s+([\d,]+(?:\.\d{1,2})?)$"
    for line in text.split("\n"):
        m = re.search(pattern, line.strip())
        if m:
            txns.append({
                "month": m.group(1),
                "date": m.group(2),
                "type": m.group(3),
                "particulars": m.group(4).strip(),
                "wage": parse_amount(m.group(5)),
                "eps_wage": parse_amount(m.group(6)),
                "employee_share": parse_amount(m.group(7)),
                "employer_share": parse_amount(m.group(8)),
                "pension_balance": parse_amount(m.group(9))
            })
    return txns


def parse_passbook(pdf_path, password=""):
    text = extract_pdf_text(pdf_path, password)
    upper_text = text.upper()
    if "EPFO" not in upper_text and "PROVIDENT FUND" not in upper_text:
        raise EPFOPassbookError("This does not look like an EPFO member passbook. Upload a passbook exported from the official EPFO portal.")

    lines = cleaned_lines(text)
    member_id = extract_member_id(text, pdf_path)
    if not member_id:
        raise EPFOPassbookError("Could not find a Member ID in this passbook. Upload the complete EPFO member-account statement.")

    balances = extract_balances(text)
    total_balance = balances.get("total_balance")
    if total_balance is None:
        total_balance = round_money(
            balances["employee_share"] + balances["employer_share"] + balances["pension_balance"]
        )
    statement_date = balances.get("statement_date") or extract_statement_date(lines)
    transactions = extract_transactions(text)

    account = {
        "member_id": member_id,
        "establishment_name": extract_establishment_name(text, lines),
        "employee_share": balances["employee_share"],
        "employer_share": balances["employer_share"],
        "pension_balance": balances["pension_balance"],
        "total_balance": total_balance,
        "statement_date": statement_date,
        "source": "EPFO Member Passbook",
        "balance_source": balances["balance_source"],
        "uan": extract_uan(text),
        "member_name": extract_member_name(text),
        "transactions": transactions,
    }
    return {
        "success": True,
        "source": "EPFO Member Passbook",
        "accounts": [account],
        "summary": {
            "employee_share": account["employee_share"],
            "employer_share": account["employer_share"],
            "pension_balance": account["pension_balance"],
            "total_balance": account["total_balance"],
            "accounts_count": 1,
        },
    }


def main():
    if len(sys.argv) < 2:
        print(json.dumps({
            "success": False,
            "error_type": "INVALID_ARGUMENTS",
            "error": "Usage: epfo_parser.py <passbook.pdf> [password]",
        }))
        return

    pdf_path = sys.argv[1]
    password = sys.argv[2] if len(sys.argv) > 2 else ""

    try:
        print(json.dumps(parse_passbook(pdf_path, password)))
    except EPFOPassbookError as exc:
        print(json.dumps({
            "success": False,
            "error_type": "EPFO_PARSE_ERROR",
            "error": str(exc),
        }))
    except Exception as exc:
        sys.stderr.write(traceback.format_exc())
        print(json.dumps({
            "success": False,
            "error_type": "UNKNOWN_ERROR",
            "error": f"Unable to process EPFO passbook: {exc}",
        }))


if __name__ == "__main__":
    main()
