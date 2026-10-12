import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/prisma'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

async function requireHR() {
  const session = await getServerSession(authOptions)
  return session?.user?.role === 'SUPER_ADMIN' ? session : null
}

function monthLabel(value: string) {
  const [year, month] = value.split('-').map(Number)
  if (!year || !month || month < 1 || month > 12) return null
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

function getMonthCalendar(year: number, monthNumber: number) {
  const calendarDays = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
  let sundays = 0
  for (let day = 1; day <= calendarDays; day++) {
    if (new Date(Date.UTC(year, monthNumber - 1, day)).getUTCDay() === 0) sundays++
  }
  const standardWorkingDays = Math.max(0, calendarDays - sundays)
  return { calendarDays, sundays, standardWorkingDays }
}

function calculateAnnualNewRegimeTax(annualSalary: number) {
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
  const tds = Number(body.tds ?? body.incomeTax ?? 0)
  const otherDeductions = Number(body.otherDeductions || 0)
  const workingHours = Number(body.workingHours || 0)

  if (!Number.isFinite(monthlySalary) || monthlySalary < 0) throw new Error('Invalid monthly salary.')
  if (!Number.isInteger(calendarDays) || calendarDays < 1 || calendarDays > 31) throw new Error('Invalid calendar days.')
  const nums = [workingDays, weeklyOffs, casualLeave, compOffGranted, compOffUsed, lwp, ghHolidayLeave, pendingCasualLeave, extraWorkingDaySunday, otherEarnings, pf, esi, tds, otherDeductions, workingHours]
  if (nums.some(x => !Number.isFinite(x) || x < 0)) throw new Error('Payroll inputs cannot be negative or invalid.')

  // Per Day Salary = Gross Salary / calendar days
  // Paid Days = working days + weekly offs + CL + comp-off used + GH holiday - LWP (clamped between 0 and calendarDays)
  const perDaySalary = monthlySalary / calendarDays
  const rawPaidDays = workingDays + weeklyOffs + casualLeave + compOffUsed + ghHolidayLeave - lwp
  const paidDays = Math.max(0, Math.min(calendarDays, Number(rawPaidDays.toFixed(2))))
  const earnedSalary = Number((perDaySalary * paidDays).toFixed(2))
  const totalDeductions = Number((pf + esi + tds + otherDeductions).toFixed(2))
  const grossEarnings = Number((earnedSalary + otherEarnings).toFixed(2))
  const netPay = Math.max(0, Number((grossEarnings - totalDeductions).toFixed(2)))

  return {
    monthlySalary, calendarDays, workingDays, weeklyOffs, casualLeave, compOffGranted, compOffUsed,
    lwp, ghHolidayLeave, totalLeave: Number((casualLeave + compOffUsed + lwp + ghHolidayLeave).toFixed(2)),
    pendingCasualLeave, paidDays, extraWorkingDaySunday, perDaySalary: Number(perDaySalary.toFixed(2)),
    earnedSalary, otherEarnings, pf, esi, tds, incomeTax: tds, otherDeductions, netPay, workingHours,
  }
}

function overlapDays(start1: Date, end1: Date, start2: Date, end2: Date) {
  const s = Math.max(start1.getTime(), start2.getTime())
  const e = Math.min(end1.getTime(), end2.getTime() - 1)
  if (e < s) return 0
  return Math.round((e - s) / 86400000) + 1
}

export async function GET(req: Request) {
  try {
    if (!(await requireHR())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { searchParams } = new URL(req.url)
    const month = searchParams.get('month') || new Date().toISOString().slice(0, 7)
    const label = monthLabel(month)
    if (!label) return NextResponse.json({ error: 'Invalid payroll month.' }, { status: 400 })

    const [year, monthNumber] = month.split('-').map(Number)
    const { calendarDays, sundays, standardWorkingDays } = getMonthCalendar(year, monthNumber)

    const monthStart = new Date(Date.UTC(year, monthNumber - 1, 1, 0, 0, 0))
    const monthEnd = new Date(Date.UTC(year, monthNumber, 1, 0, 0, 0))

    const [employees, attendances, leaveRequests, compOffsEarned, leaveBalances] = await Promise.all([
      prisma.employee.findMany({
        where: { role: 'EMPLOYEE' },
        orderBy: { name: 'asc' },
        select: {
          id: true, name: true, department: true, designation: true, dateOfJoining: true,
          monthlySalary: true, annualCtc: true, bankAccountName: true, bankAccountNumber: true, bankIfsc: true, active: true,
          payslips: { where: { month: label }, take: 1 },
        },
      }),
      prisma.attendance.findMany({
        where: { date: { gte: monthStart, lt: monthEnd } },
        select: { employeeId: true, date: true, status: true, workingMinutes: true, punchIn: true },
      }),
      prisma.leaveRequest.findMany({
        where: { status: 'APPROVED', startDate: { lt: monthEnd }, endDate: { gte: monthStart } },
        select: { employeeId: true, leaveType: true, days: true, startDate: true, endDate: true },
      }),
      prisma.compOff.findMany({
        where: { dateEarned: { gte: monthStart, lt: monthEnd } },
        select: { employeeId: true, duration: true },
      }),
      prisma.leaveBalance.findMany({
        where: { leaveType: 'CL', year },
        select: { employeeId: true, total: true, used: true, encashed: true },
      }),
    ])

    const attendanceByEmp = new Map<string, typeof attendances>()
    for (const a of attendances) {
      const list = attendanceByEmp.get(a.employeeId) || []
      list.push(a)
      attendanceByEmp.set(a.employeeId, list)
    }

    const leavesByEmp = new Map<string, typeof leaveRequests>()
    for (const l of leaveRequests) {
      const list = leavesByEmp.get(l.employeeId) || []
      list.push(l)
      leavesByEmp.set(l.employeeId, list)
    }

    const compOffsByEmp = new Map<string, typeof compOffsEarned>()
    for (const c of compOffsEarned) {
      const list = compOffsByEmp.get(c.employeeId) || []
      list.push(c)
      compOffsByEmp.set(c.employeeId, list)
    }

    const balanceByEmp = new Map(leaveBalances.map(b => [b.employeeId, b]))

    const enrichedEmployees = employees.map(e => {
      const empAttendances = attendanceByEmp.get(e.id) || []
      const empLeaves = leavesByEmp.get(e.id) || []
      const empCompOffs = compOffsByEmp.get(e.id) || []
      const empBalance = balanceByEmp.get(e.id)

      // Attended days: full day = 1, half day = 0.5
      const attendedDays = empAttendances.reduce((acc, a) => {
        if (a.status === 'HALF_DAY') return acc + 0.5
        if (['PRESENT', 'COMPLETED', 'TRAVELLING', 'ON_DUTY'].includes(a.status) || a.punchIn) return acc + 1
        return acc
      }, 0)

      // Sundays worked
      const sundayWork = empAttendances.filter(a => {
        const d = new Date(a.date)
        return d.getUTCDay() === 0 && (['PRESENT', 'COMPLETED', 'TRAVELLING', 'ON_DUTY'].includes(a.status) || a.punchIn)
      }).length

      // Working hours
      const workingMinutesTotal = empAttendances.reduce((acc, a) => acc + (a.workingMinutes || 0), 0)
      const workingHours = Number((workingMinutesTotal / 60).toFixed(1))

      // Leaves in this month
      let clDays = 0
      let lwpDays = 0
      let compOffUsed = 0

      for (const req of empLeaves) {
        const overlap = overlapDays(new Date(req.startDate), new Date(req.endDate), monthStart, monthEnd)
        const daysPortion = Math.min(req.days, overlap)
        if (req.leaveType === 'CL') clDays += daysPortion
        else if (req.leaveType === 'LWP') lwpDays += daysPortion
        else if (req.leaveType === 'COMP_OFF') compOffUsed += daysPortion
      }

      const compOffGranted = empCompOffs.reduce((acc, c) => acc + (c.duration || 1), 0)
      const pendingCL = empBalance ? Math.max(0, empBalance.total - empBalance.used - empBalance.encashed) : 0

      // Suggested tax / TDS
      const salary = Number(e.monthlySalary || 0)
      const annualProjected = Number(e.annualCtc || salary * 12)
      const annualTax = calculateAnnualNewRegimeTax(annualProjected)
      const suggestedTds = annualTax > 0 ? Number((annualTax / 12).toFixed(2)) : 0

      return {
        ...e,
        systemMetrics: {
          calendarDays,
          weeklyOffs: sundays,
          standardWorkingDays,
          attendedDays,
          workingDays: attendedDays > 0 ? attendedDays : standardWorkingDays,
          casualLeave: Number(clDays.toFixed(1)),
          lwp: Number(lwpDays.toFixed(1)),
          compOffUsed: Number(compOffUsed.toFixed(1)),
          compOffGranted: Number(compOffGranted.toFixed(1)),
          pendingCasualLeave: Number(pendingCL.toFixed(1)),
          extraWorkingDaySunday: sundayWork,
          workingHours,
          suggestedTds,
        },
      }
    })

    return NextResponse.json({
      month,
      label,
      calendarDays,
      sundays,
      standardWorkingDays,
      employees: enrichedEmployees,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Unable to load payroll.' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    if (!(await requireHR())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await req.json()

    // Handle batch submission
    if (body.batch && Array.isArray(body.records)) {
      const label = monthLabel(String(body.month || ''))
      if (!label) return NextResponse.json({ error: 'Invalid payroll month.' }, { status: 400 })

      const results = await prisma.$transaction(async (tx) => {
        const saved = []
        for (const item of body.records) {
          const employeeId = String(item.employeeId || '')
          if (!employeeId) continue
          const employee = await tx.employee.findUnique({ where: { id: employeeId, role: 'EMPLOYEE' } })
          if (!employee) continue
          const calc = calculate({ ...item, monthlySalary: item.monthlySalary ?? employee.monthlySalary })
          const payslip = await tx.payslip.upsert({
            where: { employeeId_month: { employeeId, month: label } },
            update: { ...calc, published: Boolean(body.publish), hrRemarks: item.hrRemarks ? String(item.hrRemarks) : null },
            create: { employeeId, month: label, ...calc, published: Boolean(body.publish), hrRemarks: item.hrRemarks ? String(item.hrRemarks) : null },
          })
          saved.push(payslip)
        }
        return saved
      })

      return NextResponse.json({ success: true, count: results.length, payslips: results })
    }

    // Handle single record submission
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
