import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { ensureCLAccrual } from '@/lib/leave'

export const dynamic = 'force-dynamic'

async function requireSuperAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'SUPER_ADMIN') {
    return null
  }
  return session
}

export async function GET(req: Request) {
  try {
    const session = await requireSuperAdmin()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const employeeId = searchParams.get('employeeId')
    const yearParam = searchParams.get('year')
    const currentYear = new Date().getFullYear()
    const targetYear = yearParam && yearParam !== 'ALL' ? Number(yearParam) : currentYear

    if (employeeId) {
      await ensureCLAccrual(employeeId, targetYear)
      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: {
          id: true,
          name: true,
          department: true,
          designation: true,
          dateOfJoining: true,
          monthlySalary: true,
          annualCtc: true,
          active: true,
        }
      })
      if (!employee) {
        return NextResponse.json({ error: 'Employee not found.' }, { status: 404 })
      }

      let balance = await prisma.leaveBalance.findUnique({
        where: { employeeId_leaveType_year: { employeeId, leaveType: 'CL', year: targetYear } }
      })
      if (!balance) {
        balance = await prisma.leaveBalance.upsert({
          where: { employeeId_leaveType_year: { employeeId, leaveType: 'CL', year: targetYear } },
          update: {},
          create: { employeeId, leaveType: 'CL', year: targetYear, total: 0, used: 0, encashed: 0 }
        })
      }

      const existingEncashment = await prisma.leaveEncashment.findUnique({
        where: { employeeId_year: { employeeId, year: targetYear } }
      })

      const total = balance?.total ?? 0
      const used = balance?.used ?? 0
      const encashed = balance?.encashed ?? 0
      const remaining = Math.max(0, total - used - encashed)
      const monthlySalary = employee.monthlySalary ?? 0
      const perDaySalary = monthlySalary > 0 ? Number((monthlySalary / 30).toFixed(2)) : 0
      const suggestedAmount = Number((remaining * perDaySalary).toFixed(2))

      return NextResponse.json({
        employee,
        year: targetYear,
        balance: { total, used, encashed, remaining },
        perDaySalary,
        suggestedAmount,
        existingEncashment
      })
    }

    const encashmentWhere = yearParam === 'ALL' ? {} : { year: targetYear }
    const encashments = await prisma.leaveEncashment.findMany({
      where: encashmentWhere,
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            department: true,
            designation: true,
            monthlySalary: true,
            email: true,
          }
        }
      },
      orderBy: { processedAt: 'desc' }
    })

    const totalDays = encashments.reduce((acc, curr) => acc + curr.days, 0)
    const totalAmount = encashments.reduce((acc, curr) => acc + curr.amount, 0)

    return NextResponse.json({
      encashments,
      year: targetYear,
      summary: {
        count: encashments.length,
        totalDays,
        totalAmount
      }
    })
  } catch (error: any) {
    console.error(error)
    return NextResponse.json({ error: error?.message || 'Internal Error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSuperAdmin()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { employeeId, year, days, amount } = await req.json()
    const targetYear = Number(year)
    const encashDays = Number(days)
    const encashAmount = Number(amount)

    if (!employeeId || !Number.isInteger(targetYear) || !Number.isFinite(encashDays) || !Number.isFinite(encashAmount) || encashDays <= 0 || encashAmount < 0) {
      return NextResponse.json({ error: 'Employee, year, valid positive days and amount are required.' }, { status: 400 })
    }

    await ensureCLAccrual(employeeId, targetYear)
    let balance = await prisma.leaveBalance.findUnique({
      where: { employeeId_leaveType_year: { employeeId, leaveType: 'CL', year: targetYear } }
    })
    if (!balance) {
      balance = await prisma.leaveBalance.upsert({
        where: { employeeId_leaveType_year: { employeeId, leaveType: 'CL', year: targetYear } },
        update: {},
        create: { employeeId, leaveType: 'CL', year: targetYear, total: 0, used: 0, encashed: 0 }
      })
    }

    const remaining = Math.max(0, balance.total - balance.used - balance.encashed)
    if (encashDays > remaining) {
      return NextResponse.json({ error: `Only ${remaining} CL day(s) are available for encashment.` }, { status: 400 })
    }

    const existing = await prisma.leaveEncashment.findUnique({
      where: { employeeId_year: { employeeId, year: targetYear } }
    })
    if (existing) {
      return NextResponse.json({ error: `Year-end encashment for ${targetYear} has already been processed for this employee.` }, { status: 409 })
    }

    const result = await prisma.$transaction(async (tx: any) => {
      const encashment = await tx.leaveEncashment.create({
        data: {
          employeeId,
          year: targetYear,
          days: encashDays,
          amount: encashAmount,
          processedBy: session.user.id
        },
        include: {
          employee: {
            select: { id: true, name: true, department: true, designation: true }
          }
        }
      })
      await tx.leaveBalance.update({
        where: { employeeId_leaveType_year: { employeeId, leaveType: 'CL', year: targetYear } },
        data: { encashed: { increment: encashDays } }
      })
      return encashment
    })

    return NextResponse.json({ success: true, encashment: result })
  } catch (error: any) {
    console.error(error)
    return NextResponse.json({ error: error?.message || 'Internal Error' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await requireSuperAdmin()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: 'Encashment ID is required.' }, { status: 400 })

    const encashment = await prisma.leaveEncashment.findUnique({ where: { id } })
    if (!encashment) return NextResponse.json({ error: 'Encashment record not found.' }, { status: 404 })

    await prisma.$transaction(async (tx: any) => {
      const balance = await tx.leaveBalance.findUnique({
        where: { employeeId_leaveType_year: { employeeId: encashment.employeeId, leaveType: 'CL', year: encashment.year } }
      })
      if (balance) {
        const newEncashed = Math.max(0, balance.encashed - encashment.days)
        await tx.leaveBalance.update({
          where: { id: balance.id },
          data: { encashed: newEncashed }
        })
      }
      await tx.leaveEncashment.delete({ where: { id } })
    })

    return NextResponse.json({ success: true, message: 'Encashment reverted and balance restored.' })
  } catch (error: any) {
    console.error(error)
    return NextResponse.json({ error: error?.message || 'Internal Error' }, { status: 500 })
  }
}
