# Quantzo Payroll Rules – Portal Implementation

This payroll module is based on the Quantzo Health Services salary structure and Excel workbook workflow supplied by HR, with comprehensive automated system synchronization and batch processing.

## Calculation Rules
- **Per Day Salary** = `Monthly Salary ÷ Calendar Days`
- **Paid Days** = `Working Days + Weekly Offs + Casual Leave + Comp-Off Used + GH Holiday Leave - LWP`
  - Capped strictly between `0` and `Calendar Days`.
  - Floating precision rounded safely to two decimals.
- **Earned Salary** = `Per Day Salary × Paid Days`
- **Total Deductions** = `PF + ESI + TDS + Other Deductions`
- **Net Pay** = `Math.max(0, Earned Salary + Other Earnings - Total Deductions)` (Protected against negative pay).

## Calendar Baseline & Sunday Calculations
- In any selected month, the system calculates the **exact count of calendar Sundays** (`weeklyOffs`).
- Standard scheduled working days is `Calendar Days - Sundays` (e.g. 26 in 30-day months with 4 Sundays, 24 in 28-day February).

## Automated Attendance & Leave Synchronization
The portal supports one-click system synchronization (`Auto-Sync Attendance` or per-employee `Sync Data`):
- **Attended Days**: Extracted from recorded attendance logs (Full day = 1.0, Half day = 0.5).
- **Weekly Offs**: Automatically populated with exact calendar Sundays.
- **Casual Leave (CL)**: Sum of approved CL requests overlapping the payroll month.
- **LWP (Leave Without Pay)**: Sum of approved LWP requests overlapping the payroll month.
- **Comp-Off Used**: Approved comp-off days taken in the payroll month.
- **Comp-Off Granted**: Comp-offs earned/awarded in the payroll month.
- **Pending CL Balance**: Remaining CL quota from `LeaveBalance` for the current calendar year.
- **Sunday Work**: Automatically detected if employee attended work on a Sunday.
- **Working Hours**: Aggregate logged work minutes divided by 60.
- **TDS Assistance**: Automatic monthly projected income tax calculated under the Indian New Tax Regime (Section 115BAC, Budget 2024 slabs with ₹75,000 standard deduction).

HR retains full control to inspect, adjust, or manually override any values before saving or publishing.

## Batch Processing & Bulk Actions
- **Save All Drafts**: Atomically saves all draft payroll rows using database transaction.
- **Publish All**: Publishes payslips for all employees for the month in a single click.
- **Individual Actions**: Draft save / publish remain available per employee card.

## Bank Payment Export (CSV)
The enriched CSV export includes:
`Employee ID`, `Employee Name`, `Department`, `Designation`, `Account Holder Name`, `Account Number`, `IFSC Code`, `Monthly Gross Salary`, `Calendar Days`, `Paid Days`, `Earned Salary`, `Other Earnings`, `PF`, `ESI`, `TDS`, `Other Deductions`, `Total Deductions`, `Net Payable Salary`, `Status`.
