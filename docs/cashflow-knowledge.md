# Portogo Cashflow — Knowledge Base (for /admin/cashflow)

This is the canonical reference for everything the system needs to know to
generate a monthly cashflow Excel sheet for **PIRO LDA (NIF 517636468)**,
the legal entity behind Portogo. **Read this before touching `/admin/cashflow`
code or anything that writes to the cashflow workbook.**

Source: `Desktop/הכוונות קלוד פורטוגו/קלוד חשבוניות קשפלו/פברואר26/portogo-cashflow-for-claude-code.md`
(copied here so the project is self-contained).

---

## 1. The Big Picture

Tour guides pay suppliers in cash during tours. They photograph the receipts
and upload them to the system (Supabase) with date / amount / supplier name.
At month-end:

1. Each guide marks their month as closed.
2. When all guides have closed, admin gets notified.
3. Admin uploads any extra receipts (salary invoices, bank deposit slips, etc.).
4. Admin clicks **"Generate cashflow"** → system produces a new sheet in the
   `CashFlow Piro26.xlsx` workbook.

**The ONLY rule that must never be broken:** the generator must NEVER modify
existing months' sheets. Only add a new sheet. Cascading balance errors are
expensive to fix.

---

## 2. Excel Workbook — `CashFlow Piro26.xlsx`

### File layout
- One sheet per month: `Jan26`, `Feb26`, `mar26`, `apr26`, ...
- Lowercase month + 2-digit year is the convention.

### Sheet structure (per month)

**Header rows (1–14):**
| Row | Cell | Value |
|-----|------|-------|
| 2 | B2 (merged B2:I2) | `CASH SHEET` |
| 4 | B4 (merged B4:C4) | `Entity:` |
| 4 | D4 (merged D4:I4) | `PIRO, LDA` |
| 6 | G6 (merged G6:H6) | `Year:` |
| 6 | I6 | `2026` (integer) |
| 8 | G8 (merged G8:H8) | `Month` |
| 8 | I8 | Month name in English (e.g., `April`) |
| 10 | H10 | `Cash Fund:` |
| 12 | G12 (merged G12:H12) | `Balance Previous Month:` |
| 12 | I12 | Previous month's closing balance (number) |
| 14 | B–I | Column headers: `Nº`, `Date`, `Entity`, `Doc. Nº`, `Description`, `Cash inflow`, `Cash Outflow`, `Balance` |

**Data rows (15+):**
- Row 15 = **tours income** for the month
  - Description (F15) = `tours income`
  - Cash inflow (G15) = the amount
  - Balance formula (I15) = `=+G15-H15+I12`
- Row 16+ = transactions, one per receipt, sorted by date
  - Nº (B) = sequential, starting at 2
  - Date (C) = `mm-dd-yy` format
  - Entity (D) = supplier name OR `deposit` OR `sallary [name]` (see §3)
  - Doc. Nº (E) = receipt number if available
  - Description (F) = additional details (for deposits: lowercase guide first name)
  - Cash inflow (G) / Cash Outflow (H) = the amount
  - Balance (I) = `=+I{prev}+G{row}-H{row}`

**Footer (row 90):**
- G90 = `Balance:`
- I90 = `=+I88` (final balance reference)

**Pre-existing merged cells** (preserve when copying a sheet):
`B2:I2`, `B4:C4`, `D4:I4`, `G6:H6`, `G8:H8`, `G12:H12`, `G90:H90`, `E89:F89`

### Formatting rules
- Date format: `mm-dd-yy`
- Currency format: `#,##0.00\ "€"` on G, H, I
- Column widths G/H/I = at least 16.0 (otherwise shows `########`)
- Balance formulas continue ~15 empty rows past last data entry

---

## 3. Three Transaction Types

### a) Regular expense
- **Entity** (D) = supplier name as on receipt
- **Outflow** (H) = total amount including VAT
- **No special styling**

### b) Bank deposit (guide → ABANCA)
- **Entity** (D) = `deposit`
- **Description** (F) = guide's first name in **lowercase** (e.g., `yaniv`, `maya`)
- **Outflow** (H) = the deposited amount
- **Styling**: yellow fill on Entity cell — `PatternFill('FFFFFF00', 'FFFFFF00', 'solid')`

### c) Salary (Fatura-Recibo invoice from a guide)
- **Entity** (D) = `sallary [full name]` ← yes, double-L "sallary" is the
  company convention, not a typo. Keep it.
- **Outflow** (H) = `TOTAL A PAGAR` from the PDF
- **Date rule**: The **invoice issue date** sets the month. A salary invoice
  issued March 11 for February services → goes in the **March** sheet.

---

## 4. Tours Income (Row 15)

The amount is **calculated** by the system but **set by the admin**. The goal
is for the month's final balance (I88) to land near **15€**.

**Suggested formula:**
```
suggested = total_outflow - balance_previous_month + 15
```

Then admin rounds to a clean number. Examples:
- Feb26: calculated ~12,815 → admin set 12,840€
- Mar26: calculated ~9,762 → admin set 9,800€

**Always present the suggestion and let admin override.**

---

## 5. Critical Business Rules

| # | Rule | Why |
|---|------|-----|
| 1 | NEVER modify previous months' sheets | Cascading balance errors |
| 2 | Balance Previous Month (I12) must be READ from prior sheet's I88 | Don't recalculate from raw data |
| 3 | A receipt's date determines its month — not when it was uploaded | If guide uploads March-dated receipt during April processing, flag for admin |
| 4 | Same receipt # + date + amount = duplicate. Count once. | Guides photograph the same receipt twice |
| 5 | MULTIBANCO (card terminal) payments are NOT cash — exclude or flag | They're not from the cash fund |
| 6 | Sort transactions by date within the month | |
| 7 | Match formatting from previous month exactly | Manual editors expect consistency |

---

## 6. Frequent Suppliers (helps autocomplete + classify)

| Supplier | Notes |
|----------|-------|
| Pastéis de Belém | If total cut off: calculate from Pago - Troco |
| José Maria da Fonseca | Azeitão winery (often abbreviated JMF) |
| Rei do Bacalhau | a.k.a. Santos Ramalho Lda |
| Mercado do Camões | mini-market |
| Horacio Esteves e Justo | café |
| Croqueteria | located in Mercado da Ribeira |
| Padaria Portuguesa | bakery chain |
| Pingo Doce | supermarket |
| Santuário de Cristo Rei | monument entry |
| Parques de Sintra | Sintra palaces / parks tickets |
| Teleférico de Gaia | Vila Nova de Gaia cable car |
| Arcadia | chocolate shop, sometimes at UBBO mall |
| CP — Navegante | Lisbon metro/train pass |

---

## 7. Known Guides (for deposit name normalization)

| DB name | Lowercase first name (Description column for deposits) |
|---------|--------------------------------------------------------|
| אביב (Aviv Pollack) | `aviv` |
| יניב טובי (Yaniv Tovi) | `yaniv` |
| מאיה (Maya Meidan) | `maya` |
| מני (Menashe Krispi) | `meni` |
| תום | `tom` |
| דותן | `dotan` |
| עומר הבן | `omer` |
| ניר | `nir` |
| רונה | `rona` |

---

## 8. Receipt Reading Tips (for OCR / future AI processing)

- **ABANCA deposit slips**: usually photographed sideways. Key fields:
  ORDENANTE (depositor = guide), DATA, MONTANTE (amount), TITULAR (PIRO LDA).
- **Pastéis de Belém**: total line often cut off → `Total = Pago - Troco`
- **Fatura-Recibo (salary PDFs)**: extract `Nome`, `Data de emissão` (= month
  assignment), and `TOTAL A PAGAR`.

---

## 9. Implementation Plan in This Codebase

### What we already have (see schema.sql)
- `expenses` table: guide_id, expense_date, item, amount, notes, **receipt_url**, tour_type
- `closed_months` table: guide_id, year, month, closed_at, closed_by
- `transfers` table: guide_id → portugo deposits (this is where bank deposits live!)
- Storage bucket `expense-receipts` for receipt images
- `/close-month` flow for guides

### What we need to add
- `expenses` columns: `supplier_name TEXT`, `cashflow_category` (regular / deposit / salary / multibanco / excluded), `receipt_number TEXT`, `is_admin_added BOOLEAN`
- `cashflow_runs` table: history of generated cashflows, with year/month/tours_income/file URL
- `/admin/cashflow` page tree (see plan in chat)
- `exceljs`-based generator (Node-compatible — no Python needed in production)

### The flow (target state)
1. Guide uploads receipt → `expenses` row with image + amount + supplier_name
2. Guide hits "סגור חודש" → `closed_months` row created
3. When all guides closed → admin notified (banner on /home + email via Brevo)
4. Admin opens `/admin/cashflow` → picks month → reviews receipts → uploads
   any extras (salary PDFs, bank slips) → confirms tours_income
5. System loads admin's `CashFlow Piro26.xlsx` (uploaded once per month) →
   creates new sheet → never touches existing → admin downloads result
6. Result also stored in Supabase Storage for audit trail

---

**End of knowledge base.** When in doubt, the rule is: don't break previous
months, ask admin before guessing on tours_income, and follow the spelling
conventions exactly (`deposit` lowercase, `sallary` double-L).
