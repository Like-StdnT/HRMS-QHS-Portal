import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { assertCLAvailable, ensureCLAccrual, inclusiveLeaveDays } from '@/lib/leave'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.user.role === 'SUPER_ADMIN') return NextResponse.json({ error: 'Super Admin does not use employee self-service.' }, { status: 403 })
    const activeEmployee = await prisma.employee.findUnique({ where: { id: session.user.id }, select: { active: true, role: true } })
    if (!activeEmployee?.active || activeEmployee.role !== 'EMPLOYEE') return NextResponse.json({ error: 'Employee account is inactive.' }, { status: 403 })

    const year = new Date().getFullYear()
    const balance = await ensureCLAccrual(session.user.id, year)
    const [requests, compOffs, pendingCL, pendingCompOff] = await Promise.all([
      prisma.leaveRequest.findMany({ where: { employeeId: session.user.id }, orderBy: { createdAt: 'desc' }, take: 50 }),
      prisma.compOff.findMany({ where: { employeeId: session.user.id }, orderBy: { dateEarned: 'desc' } }),
      prisma.leaveRequest.aggregate({
        where: { employeeId: session.user.id, leaveType: 'CL', status: 'PENDING' },
        _sum: { days: true },
      }),
      prisma.leaveRequest.aggregate({
        where: { employeeId: session.user.id, leaveType: 'COMP_OFF', status: 'PENDING' },
        _sum: { days: true },
      }),
    ])

    const remaining = Math.max(0, (balance?.total ?? 0) - (balance?.used ?? 0) - (balance?.encashed ?? 0))
    const pendingDays = pendingCL._sum.days ?? 0
    const availableCompOffDays = compOffs
      .filter(c => c.status === 'AVAILABLE')
      .reduce((sum, c) => sum + (c.duration || 1), 0)
    const pendingCompOffDays = pendingCompOff._sum.days ?? 0

    return NextResponse.json({
      year,
      balance: { total: balance?.total ?? 0, used: balance?.used ?? 0, encashed: balance?.encashed ?? 0, remaining, pendingDays },
      compOffs,
      availableCompOffDays,
      pendingCompOffDays,
      requests,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.user.role === 'SUPER_ADMIN') return NextResponse.json({ error: 'Super Admin does not use employee self-service.' }, { status: 403 })
    const activeEmployee = await prisma.employee.findUnique({ where: { id: session.user.id }, select: { active: true, role: true } })
    if (!activeEmployee?.active || activeEmployee.role !== 'EMPLOYEE') return NextResponse.json({ error: 'Employee account is inactive.' }, { status: 403 })

    const { leaveType, startDate, endDate, reason, durationType = 'FULL_DAY' } = await req.json()
    if (!['CL', 'LWP', 'COMP_OFF'].includes(leaveType) || !startDate || !endDate || !['FULL_DAY', 'FIRST_HALF', 'SECOND_HALF'].includes(durationType)) {
      return NextResponse.json({ error: 'Select a valid leave type (CL, Comp-off, or LWP) and provide both dates.' }, { status: 400 })
    }

    const start = new Date(startDate)
    const end = new Date(endDate)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
      return NextResponse.json({ error: 'Invalid date range.' }, { status: 400 })
    }

    if (start.getFullYear() !== end.getFullYear()) return NextResponse.json({ error: 'Please submit separate leave requests for different calendar years.' }, { status: 400 })

    const overlap = await prisma.leaveRequest.findFirst({ where: { employeeId: session.user.id, status: { in: ['PENDING', 'APPROVED'] }, startDate: { lte: end }, endDate: { gte: start } } })
    if (overlap) return NextResponse.json({ error: 'A leave request already exists for part of this date range.' }, { status: 409 })

    if (durationType !== 'FULL_DAY' && start.getTime() !== end.getTime()) {
      return NextResponse.json({ error: 'Half-day leave must be for a single date.' }, { status: 400 })
    }

    const days = durationType === 'FULL_DAY' ? inclusiveLeaveDays(start, end) : 0.5
    const year = start.getFullYear()

    if (leaveType === 'CL') {
      const balance = await assertCLAvailable(session.user.id, days, year)
      const pending = await prisma.leaveRequest.aggregate({
        where: { employeeId: session.user.id, leaveType: 'CL', status: 'PENDING', startDate: { gte: new Date(`${year}-01-01`) }, endDate: { lt: new Date(`${year + 1}-01-01`) } },
        _sum: { days: true },
      })
      const pendingDays = pending._sum.days ?? 0
      if (days > balance.total - balance.used - balance.encashed - pendingDays) {
        return NextResponse.json({ error: 'Your available CL is already reserved by pending requests.' }, { status: 400 })
      }
    }

    if (leaveType === 'COMP_OFF') {
      const availableCompOffs = await prisma.compOff.findMany({
        where: { employeeId: session.user.id, status: 'AVAILABLE' },
      })
      const totalAvailable = availableCompOffs.reduce((sum, c) => sum + (c.duration || 1), 0)

      const pendingCompOffLeave = await prisma.leaveRequest.aggregate({
        where: { employeeId: session.user.id, leaveType: 'COMP_OFF', status: 'PENDING' },
        _sum: { days: true },
      })
      const pendingCompDays = pendingCompOffLeave._sum.days ?? 0
      const availableAfterPending = totalAvailable - pendingCompDays

      if (days > availableAfterPending) {
        return NextResponse.json({
          error: `Insufficient available comp-offs. You have ${totalAvailable} day(s) approved, with ${pendingCompDays} day(s) reserved by pending requests.`
        }, { status: 400 })
      }
    }

    const request = await prisma.leaveRequest.create({
      data: { employeeId: session.user.id, leaveType, startDate: start, endDate: end, days, durationType, reason, status: 'PENDING', source: 'EMPLOYEE' },
    })

    return NextResponse.json({ success: true, request })
  } catch (error: any) {
    console.error(error)
    return NextResponse.json({ error: error?.message || 'Internal Error' }, { status: 500 })
  }
}
