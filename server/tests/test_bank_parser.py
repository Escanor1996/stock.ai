#!/usr/bin/env python3
"""
Unit tests and synthetic fixture generator for bank_parser.py.
Creates encrypted and unencrypted synthetic PDFs for HDFC Bank and Standard Chartered Bank,
and verifies extraction accuracy against expected balances and transaction ledgers.
"""

import os
import sys
import json
import tempfile
import subprocess
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
import pypdf

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PARSER_BIN = os.path.join(REPO_ROOT, "server", "venv", "bin", "python")
PARSER_SCRIPT = os.path.join(REPO_ROOT, "server", "services", "bank_parser.py")


def create_hdfc_statement_pdf(output_path, password=None):
    """Generate a realistic synthetic HDFC Bank savings account statement."""
    raw_pdf_path = output_path + ".tmp.pdf"
    c = canvas.Canvas(raw_pdf_path, pagesize=letter)
    width, height = letter

    # Header block
    c.setFont("Helvetica-Bold", 14)
    c.drawString(40, height - 50, "HDFC BANK LTD")
    c.setFont("Helvetica", 9)
    c.drawString(40, height - 65, "MARATHAHALLI BRANCH, BANGALORE - 560037")
    c.drawString(40, height - 78, "IFSC: HDFC0001756 | MICR: 560240012 | WWW.HDFCBANK.COM")

    c.setLineWidth(0.5)
    c.line(40, height - 85, width - 40, height - 85)

    # Customer and Account details
    c.setFont("Helvetica-Bold", 10)
    c.drawString(40, height - 105, "Customer Name: MR. ARKA CHAKRABORTY")
    c.setFont("Helvetica", 9)
    c.drawString(40, height - 120, "Account Number: 50100644717285")
    c.drawString(40, height - 135, "Account Type: SAVINGS ACCOUNT")
    c.drawString(40, height - 150, "Statement Period: From 01/09/2026 To 30/09/2026")
    c.drawString(40, height - 165, "Statement Date: 30/09/2026")

    # Balances Summary Box
    c.rect(width - 240, height - 170, 200, 70, stroke=1, fill=0)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(width - 230, height - 115, "STATEMENT SUMMARY")
    c.setFont("Helvetica", 8)
    c.drawString(width - 230, height - 130, "Opening Balance:  Rs. 150,000.00")
    c.drawString(width - 230, height - 145, "Total Deposits:   Rs. 250,000.00")
    c.drawString(width - 230, height - 160, "Closing Balance:  Rs. 185,420.50")

    # Transaction Table Header
    y = height - 200
    c.line(40, y + 10, width - 40, y + 10)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(40, y, "Date")
    c.drawString(100, y, "Narration")
    c.drawString(280, y, "Chq/Ref No")
    c.drawString(370, y, "Withdrawal (DR)")
    c.drawString(450, y, "Deposit (CR)")
    c.drawString(525, y, "Closing Balance")
    c.line(40, y - 5, width - 40, y - 5)

    # Transactions
    txns = [
        ("01/09/2026", "OPENING BALANCE B/F", "REF0000000", "", "", "150,000.00"),
        ("05/09/2026", "SALARY CREDIT - LEBARA MEDIA", "CMS123456789", "", "250,000.00", "400,000.00"),
        ("10/09/2026", "UPI/DR/SWIGGY/123456789012", "UPI987654321", "1,579.50", "", "398,420.50"),
        ("15/09/2026", "SIP MUTUAL FUND DEBIT HDFC MF", "MF88990011", "213,000.00", "", "185,420.50"),
    ]

    c.setFont("Helvetica", 8)
    for date, narr, ref, dr, cr, bal in txns:
        y -= 20
        c.drawString(40, y, date)
        c.drawString(100, y, narr)
        c.drawString(280, y, ref)
        c.drawRightString(430, y, dr)
        c.drawRightString(510, y, cr)
        c.drawRightString(width - 45, y, bal)

    c.line(40, y - 10, width - 40, y - 10)
    y -= 30
    c.setFont("Helvetica-Oblique", 8)
    c.drawString(40, y, "End of Statement. HDFC Bank Ltd. Registered Office: Senapati Bapat Marg, Lower Parel, Mumbai.")

    c.save()

    # Encrypt if password provided
    if password:
        reader = pypdf.PdfReader(raw_pdf_path)
        writer = pypdf.PdfWriter()
        for page in reader.pages:
            writer.add_page(page)
        writer.encrypt(password)
        with open(output_path, "wb") as f_out:
            writer.write(f_out)
        os.remove(raw_pdf_path)
    else:
        os.rename(raw_pdf_path, output_path)

    return output_path


def create_scb_statement_pdf(output_path, password=None):
    """Generate a realistic synthetic Standard Chartered Bank savings account statement."""
    raw_pdf_path = output_path + ".tmp.pdf"
    c = canvas.Canvas(raw_pdf_path, pagesize=letter)
    width, height = letter

    # Header
    c.setFont("Helvetica-Bold", 14)
    c.drawString(40, height - 50, "STANDARD CHARTERED BANK")
    c.setFont("Helvetica", 9)
    c.drawString(40, height - 65, "BRANCH: MG ROAD, BANGALORE | IFSC: SCBL0036001")
    c.line(40, height - 75, width - 40, height - 75)

    # Customer & Account Info
    c.setFont("Helvetica-Bold", 10)
    c.drawString(40, height - 95, "PRIYA SHARMA")
    c.setFont("Helvetica", 9)
    c.drawString(40, height - 110, "SUPERVALUE SAVINGS ACCOUNT")
    c.drawString(40, height - 125, "Account Number: 0199385225266740")
    c.drawString(40, height - 140, "Statement Period: 01/08/2026 to 31/08/2026")
    c.drawString(40, height - 155, "Statement Date: 31/08/2026")

    # Balances Summary Row
    y = height - 185
    c.rect(40, y - 20, width - 80, 30, stroke=1, fill=0)
    c.setFont("Helvetica", 8)
    c.drawString(50, y - 5, "Opening Balance: 100,000.00")
    c.drawString(180, y - 5, "Total Debits: 35,000.00")
    c.drawString(300, y - 5, "Total Credits: 85,000.00")
    c.drawString(420, y - 5, "Closing Balance: 150,000.00")

    # Transaction Table
    y -= 50
    c.line(40, y + 10, width - 40, y + 10)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(40, y, "Date")
    c.drawString(110, y, "Description")
    c.drawString(300, y, "Ref No")
    c.drawString(390, y, "Withdrawal")
    c.drawString(465, y, "Deposit")
    c.drawString(530, y, "Balance")
    c.line(40, y - 5, width - 40, y - 5)

    txns = [
        ("02/08/2026", "CONSULTING FEE CR TECH SERVICES", "TXN998811", "", "85,000.00", "185,000.00"),
        ("12/08/2026", "RENT PAYMENT DR NEFT TRANSFER", "NEFT776655", "35,000.00", "", "150,000.00"),
    ]

    c.setFont("Helvetica", 8)
    for date, desc, ref, wd, dp, bal in txns:
        y -= 20
        c.drawString(40, y, date)
        c.drawString(110, y, desc)
        c.drawString(300, y, ref)
        c.drawRightString(440, y, wd)
        c.drawRightString(515, y, dp)
        c.drawRightString(width - 45, y, bal)

    c.line(40, y - 10, width - 40, y - 10)
    c.save()

    if password:
        reader = pypdf.PdfReader(raw_pdf_path)
        writer = pypdf.PdfWriter()
        for page in reader.pages:
            writer.add_page(page)
        writer.encrypt(password)
        with open(output_path, "wb") as f_out:
            writer.write(f_out)
        os.remove(raw_pdf_path)
    else:
        os.rename(raw_pdf_path, output_path)

    return output_path


def run_parser(pdf_path, password="", bank_hint="auto"):
    cmd = [PARSER_BIN, PARSER_SCRIPT, pdf_path]
    if password:
        cmd.append(password)
    else:
        cmd.append("")
    if bank_hint:
        cmd.append(bank_hint)

    proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if proc.returncode != 0:
        raise RuntimeError(f"Parser exited with non-zero status {proc.returncode}: {proc.stderr}")
    try:
        return json.loads(proc.stdout)
    except Exception as exc:
        raise ValueError(f"Invalid JSON from parser: {proc.stdout}") from exc


def test_hdfc_encrypted_parsing():
    print("[TEST] Testing HDFC encrypted statement parsing...")
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tf:
        hdfc_pdf = tf.name

    try:
        password = "SecretPass123"
        create_hdfc_statement_pdf(hdfc_pdf, password=password)

        # 1. Test exact password
        res = run_parser(hdfc_pdf, password=password, bank_hint="auto")
        assert res.get("success") is True, f"Expected success: true, got {res}"
        assert res.get("bank_name") == "HDFC Bank"
        accounts = res.get("accounts", [])
        assert len(accounts) == 1, f"Expected 1 account, got {len(accounts)}"
        acc = accounts[0]
        assert acc.get("account_number") == "50100644717285", f"Account number mismatch: {acc.get('account_number')}"
        assert acc.get("masked_account_number") == "••••7285", f"Masked number mismatch: {acc.get('masked_account_number')}"
        assert "ARKA CHAKRABORTY" in acc.get("account_holder", ""), f"Account holder mismatch: {acc.get('account_holder')}"
        assert acc.get("closing_balance") == 185420.50, f"Closing balance mismatch: {acc.get('closing_balance')}"
        assert acc.get("ifsc") == "HDFC0001756", f"IFSC mismatch: {acc.get('ifsc')}"
        assert len(acc.get("transactions", [])) >= 3, f"Expected at least 3 transactions, got {len(acc.get('transactions', []))}"
        assert len(acc.get("monthly_cashflow", [])) >= 1, "Expected monthly cashflow synthesis"

        # 2. Test password casing variation (e.g. user entered lowercase "secretpass123")
        res_var = run_parser(hdfc_pdf, password="  SecretPass123  ", bank_hint="auto")
        assert res_var.get("success") is True, f"Failed with trimmed password: {res_var}"

        # 3. Test incorrect password failure
        res_bad = run_parser(hdfc_pdf, password="WrongPassword99", bank_hint="auto")
        assert res_bad.get("success") is False, "Expected failure with bad password"
        assert res_bad.get("error_type") == "INCORRECT_PASSWORD", f"Expected INCORRECT_PASSWORD error type, got {res_bad}"
        print("  ✓ HDFC encrypted statement parsed successfully with exact & variation passwords, and failed on bad password.")
    finally:
        if os.path.exists(hdfc_pdf):
            os.remove(hdfc_pdf)


def test_scb_unencrypted_parsing():
    print("[TEST] Testing Standard Chartered unencrypted statement parsing...")
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tf:
        scb_pdf = tf.name

    try:
        create_scb_statement_pdf(scb_pdf, password=None)

        res = run_parser(scb_pdf, password="", bank_hint="auto")
        assert res.get("success") is True, f"Expected success: true, got {res}"
        assert res.get("bank_name") == "Standard Chartered Bank"
        accounts = res.get("accounts", [])
        assert len(accounts) == 1, f"Expected 1 account, got {len(accounts)}"
        acc = accounts[0]
        assert acc.get("account_number") == "0199385225266740", f"SCB account mismatch: {acc.get('account_number')}"
        assert acc.get("masked_account_number") == "••••6740", f"SCB masked mismatch: {acc.get('masked_account_number')}"
        assert "PRIYA SHARMA" in acc.get("account_holder", ""), f"Account holder mismatch: {acc.get('account_holder')}"
        assert acc.get("closing_balance") == 150000.00, f"Closing balance mismatch: {acc.get('closing_balance')}"
        assert acc.get("ifsc") == "SCBL0036001", f"IFSC mismatch: {acc.get('ifsc')}"
        assert len(acc.get("transactions", [])) == 2, f"Expected 2 transactions, got {len(acc.get('transactions', []))}"
        assert len(acc.get("monthly_cashflow", [])) == 1, "Expected monthly cashflow entry"
        print("  ✓ Standard Chartered statement parsed successfully.")
    finally:
        if os.path.exists(scb_pdf):
            os.remove(scb_pdf)


def test_scb_encrypted_parsing():
    print("[TEST] Testing Standard Chartered password-protected statement parsing...")
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tf:
        scb_pdf = tf.name

    try:
        password = "PRIY1208"  # Name + DDMM convention
        create_scb_statement_pdf(scb_pdf, password=password)

        # Test with lower case input by user
        res = run_parser(scb_pdf, password="priy1208", bank_hint="auto")
        assert res.get("success") is True, f"Expected success with lowercase password: {res}"
        assert res.get("bank_name") == "Standard Chartered Bank"
        acc = res.get("accounts", [])[0]
        assert acc.get("closing_balance") == 150000.00
        print("  ✓ Standard Chartered password-protected statement parsed with case insensitive password.")
    finally:
        if os.path.exists(scb_pdf):
            os.remove(scb_pdf)


if __name__ == "__main__":
    os.makedirs(os.path.dirname(os.path.abspath(__file__)), exist_ok=True)
    test_hdfc_encrypted_parsing()
    test_scb_unencrypted_parsing()
    test_scb_encrypted_parsing()
    print("\nAll bank parser unit tests passed!")
