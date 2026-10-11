import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/prisma'
import { authOptions } from '@/lib/auth'

async function requireHR() {
  const session = await getServerSession(authOptions)
  return session?.user?.role === 'SUPER_ADMIN' ? session : null
}

function monthLabel(value: string) {
  const [year, month] = value.split('-').map(Number)
  if (!year || !month || month < 1 || month > 12) return null
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

function calculate(body: any) {
  const monthlySalary = Number(body.monthlySalary)
  const calendarDays = Number(body.calendarDays)
  const workingDays = Number(body.workingDays || 0)
  const weeklyOffs = Number(body.weeklyOffs || 0)
  const casualLeave = Number(body.casualLeave || 0)
  const compOffGranted = Number(body.compOffGranted || 0)
  const compOffUsed = Number(body.compOffUsed || 0)
  const lwp = Number(body.lwp || 0)
  const ghHolidayLeave = Number(body.ghHolidayLeave || 0)
  const pendingCasualLeave = Number(body.pendingCasualLeave || 0)
  const extraWorkingDaySunday = Number(body.extraWorkingDaySunday || 0)
  const otherEarnings = Number(body.otherEarnings || 0)
  const pf = Number(body.pf || 0)
  const esi = Number(body.esi || 0)
  const tds = Number(body.tds || body.incomeTax || 0)
  const otherDeductions = Number(body.otherDeductions || 0)
  const workingHours = Number(body.workingHours || 0)

  if (!Number.isFinite(monthlySalary) || monthlySalary < 0) throw new Error('Invalid monthly salary.')
  if (!Number.isInteger(calendarDays) || calendarDays < 1 || calendarDays > 31) throw new Error('Invalid calendar days.')
  const nums = [workingDays, weeklyOffs, casualLeave, compOffGranted, compOffUsed, lwp, ghHolidayLeave, pendingCasualLeave, extraWorkingDaySunday, otherEarnings, pf, esi, tds, otherDeductions, workingHours]
  if (nums.some(x => !Number.isFinite(x) || x < 0)) throw new Error('Payroll inputs cannot be negative or invalid.')

  // Quantzo's current Excel uses monthly salary / calendar days as the per-day rate.
  // Paid days are based on working days + weekly offs + approved paid leave/comp-off/holiday,
  // reduced by LWP. Comp-off granted is kept as a balance field and is not double-counted.
  const perDaySalary = monthlySalary / calendarDays
  const paidDays = Math.max(0, Math.min(calendarDays, workingDays + weeklyOffs + casualLeave + compOffUsed + ghHolidayLeave - lwp))
  const earnedSalary = Number((perDaySalary * paidDays).toFixed(2))
  const totalDeductions = Number((pf + esi + tds + otherDeductions).toFixed(2))
  const netPay = Number((earnedSalary + otherEarnings - totalDeductions).toFixed(2))

  return {
    monthlySalary, calendarDays, workingDays, weeklyOffs, casualLeave, compOffGranted, compOffUsed,
    lwp, ghHolidayLeave, totalLeave: casualLeave + compOffUsed + lwp + ghHolidayLeave,
    pendingCasualLeave, paidDays, extraWorkingDaySunday, perDaySalary: Number(perDaySalary.toFixed(2)),
    earnedSalary, otherEarnings, pf, esi, tds, incomeTax: tds, otherDeductions, netPay, workingHours,
  }
}

export async function GET(req: Request) {
  try {
    if (!(await requireHR())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { searchParams } = new URL(req.url)
    const month = searchParams.get('month') || new Date().toISOString().slice(0, 7)
    const label = monthLabel(month)
    if (!label) return NextResponse.json({ error: 'Invalid payroll month.' }, { status: 400 })
    const [year, monthNumber] = month.split('-').map(Number)
    const calendarDays = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
    const employees = await prisma.employee.findMany({
      where: { role: 'EMPLOYEE' },
      orderBy: { name: 'asc' },
      select: {
        id: true, name: true, department: true, designation: true, dateOfJoining: true,
        monthlySalary: true, annualCtc: true, bankAccountName: true, bankAccountNumber: true, bankIfsc: true, active: true,
        payslips: { where: { month: label }, take: 1 },
      },
    })
    return NextResponse.json({ month, label, calendarDays, employees })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Unable to load payroll.' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    if (!(await requireHR())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await req.json()
    const employeeId = String(body.employeeId || '')
    const label = monthLabel(String(body.month || ''))
    if (!employeeId || !label) return NextResponse.json({ error: 'Employee and payroll month are required.' }, { status: 400 })
    const employee = await prisma.employee.findUnique({ where: { id: employeeId, role: 'EMPLOYEE' } })
    if (!employee) return NextResponse.json({ error: 'Employee not found.' }, { status: 404 })
    const calc = calculate({ ...body, monthlySalary: body.monthlySalary ?? employee.monthlySalary })
    const payslip = await prisma.payslip.upsert({
      where: { employeeId_month: { employeeId, month: label } },
      update: { ...calc, published: Boolean(body.publish), hrRemarks: body.hrRemarks ? String(body.hrRemarks) : null },
      create: { employeeId, month: label, ...calc, published: Boolean(body.publish), hrRemarks: body.hrRemarks ? String(body.hrRemarks) : null },
    })
    return NextResponse.json({ success: true, payslip })
  } catch (error: any) {
    console.error(error)
    return NextResponse.json({ error: error?.message || 'Unable to save payroll.' }, { status: 400 })
  }
}
