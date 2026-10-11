// AY 2026-27 / FY 2025-26 new-regime salary tax helper.
// Keep this isolated so future Finance Act changes can be updated in one place.
export function annualNewRegimeTax(annualSalary: number) {
  const taxableIncome = Math.max(0, annualSalary - 75000)
  let tax = 0
  if (taxableIncome <= 400000) tax = 0
  else if (taxableIncome <= 800000) tax = (taxableIncome - 400000) * 0.05
  else if (taxableIncome <= 1200000) tax = 20000 + (taxableIncome - 800000) * 0.10
  else if (taxableIncome <= 1600000) tax = 60000 + (taxableIncome - 1200000) * 0.15
  else if (taxableIncome <= 2000000) tax = 120000 + (taxableIncome - 1600000) * 0.20
  else if (taxableIncome <= 2400000) tax = 200000 + (taxableIncome - 2000000) * 0.25
  else tax = 300000 + (taxableIncome - 2400000) * 0.30
  if (taxableIncome <= 1200000) tax = 0
  return Math.max(0, Math.round(tax * 1.04))
}
