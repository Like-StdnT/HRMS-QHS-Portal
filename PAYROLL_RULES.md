# Quantzo Payroll Rules – Portal Implementation

This payroll module is based on the September 2026 salary workbook supplied by HR.

## Current Excel observations
- Per Day Salary is Gross Salary / calendar days of the month.
- The workbook uses a standard working-days field (commonly 26) plus weekly offs.
- Paid Days is currently calculated from working days + weekly offs + paid leave/comp-off/holiday fields.
- LWP should reduce paid days.
- Comp-Off Granted is a balance/grant field and is not added to paid days; Comp-Off Used is the paid-day adjustment.
- Extra Sunday Working is retained as an HR input but is not automatically added to salary because the workbook does not currently include it in the Net Salary formula.
- PF, ESI, TDS and Other Deductions are manual inputs in the portal.
- HR Remarks are retained for manual adjustments such as salary advances.

## Portal calculation
Per Day Salary = Monthly Salary / Calendar Days

Paid Days = Working Days + Weekly Offs + Casual Leave + Comp-Off Used + GH Holiday Leave - LWP

Paid Days is capped between 0 and Calendar Days.

Earned Salary = Per Day Salary × Paid Days

Net Pay = Earned Salary + Other Earnings - PF - ESI - TDS - Other Deductions

The portal deliberately does not automatically derive LWP/CL/attendance from attendance data yet. HR should validate monthly inputs against the existing Excel before we automate those inputs.

## Bank payment export
Payroll Processing has an Export Payment CSV action. The CSV opens directly in Excel and contains:
Employee ID, Account Holder Name, Account Number, IFSC Code, Payable Salary.

## Important
The supplied workbook has a naming mismatch: the file/sheet is for September 2026 but its first title says August 2026. The portal uses one authoritative Payroll Month selected by HR.
