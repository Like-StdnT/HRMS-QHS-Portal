import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/prisma'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

function calculateAnnualNewRegimeTax(annualSalary: number) {
  const taxableIncome = Math.max(0, annualSalary - 75000) // standard deduction for salaried employees under the new regime
  let tax = 0
  if (taxableIncome <= 400000) tax = 0
  else if (taxableIncome <= 800000) tax = (taxableIncome - 400000) * 0.05
  else if (taxableIncome <= 1200000) tax = 20000 + (taxableIncome - 800000) * 0.10
  else if (taxableIncome <= 1600000) tax = 60000 + (taxableIncome - 1200000) * 0.15
  else if (taxableIncome <= 2000000) tax = 120000 + (taxableIncome - 1600000) * 0.20
  else if (taxableIncome <= 2400000) tax = 200000 + (taxableIncome - 2000000) * 0.25
  else tax = 300000 + (taxableIncome - 2400000) * 0.30

  if (taxableIncome <= 1200000) tax = 0
  return Math.max(0, Math.round(tax * 1.04)) // 4% cess
}

async function requireHR() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'SUPER_ADMIN') return null
  return session
}

export async function POST(req: Request) {
  try {
    const session = await requireHR()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { employeeId, month, paidDays, calendarDays, publish = false } = await req.json()
    if (!employeeId || !month || paidDays == null || calendarDays == null) return NextResponse.json({ error: 'Employee, month, paid days and calendar days are required.' }, { status: 400 })

    const employee = await prisma.employee.findUnique({ where: { id: employeeId } })
    if (!employee) return NextResponse.json({ error: 'Employee not found.' }, { status: 404 })
    if (employee.monthlySalary == null) return NextResponse.json({ error: 'Monthly salary is not configured in Employee Master.' }, { status: 400 })

    const days = Number(paidDays)
    const totalDays = Number(calendarDays)
    if (!Number.isFinite(days) || !Number.isFinite(totalDays) || days < 0 || days > totalDays || totalDays < 1) return NextResponse.json({ error: 'Invalid paid days/calendar days.' }, { status: 400 })

    const monthlySalary = Number(employee.monthlySalary)
    const earnedSalary = Number(((monthlySalary / totalDays) * days).toFixed(2))
    const annualProjected = Number(employee.annualCtc || monthlySalary * 12)
    const annualTax = calculateAnnualNewRegimeTax(annualProjected)
    const monthlyTax = Number((annualTax / 12).toFixed(2))
    const incomeTax = annualTax > 0 ? Math.min(monthlyTax, earnedSalary) : 0
    const netPay = Number((earnedSalary - incomeTax).toFixed(2))

    const payslip = await prisma.payslip.upsert({
      where: { employeeId_month: { employeeId, month } },
      update: { monthlySalary, calendarDays: totalDays, paidDays: days, earnedSalary, incomeTax, netPay, published: Boolean(publish) },
      create: { employeeId, month, monthlySalary, calendarDays: totalDays, paidDays: days, earnedSalary, incomeTax, netPay, published: Boolean(publish) },
    })

    return NextResponse.json({ success: true, payslip })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const where = session.user.role === 'SUPER_ADMIN' ? {} : { employeeId: session.user.id, published: true }
    const payslips = await prisma.payslip.findMany({ where, include: { employee: { select: { id: true, name: true, department: true, designation: true, dateOfJoining: true } } }, orderBy: { createdAt: 'desc' } })
    return NextResponse.json({ payslips })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 })
  }
}
