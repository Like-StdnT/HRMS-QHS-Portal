import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { assertCLAvailable, ensureCLAccrual, inclusiveLeaveDays } from '@/lib/leave'

export const dynamic = 'force-dynamic'

async function requireHR() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'SUPER_ADMIN') return null
  return session
}

export async function GET() {
  try {
    const session = await requireHR()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [requests, employees] = await Promise.all([
      prisma.leaveRequest.findMany({ include: { employee: true }, orderBy: { createdAt: 'desc' }, take: 200 }),
      prisma.employee.findMany({ where: { active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true, department: true, designation: true, dateOfJoining: true } }),
    ])
    return NextResponse.json({ requests, employees })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireHR()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { action, requestId, employeeId, startDate, endDate, leaveType, reason, rejectionReason, reviewRemarks, durationType = 'FULL_DAY' } = body

    if (action === 'APPROVE' || action === 'REJECT') {
      if (!requestId) return NextResponse.json({ error: 'Request ID is required.' }, { status: 400 })
      const existing = await prisma.leaveRequest.findUnique({ where: { id: requestId } })
      if (!existing) return NextResponse.json({ error: 'Leave request not found.' }, { status: 404 })
      if (existing.status !== 'PENDING') return NextResponse.json({ error: 'This request has already been reviewed.' }, { status: 409 })

      if (action === 'REJECT') {
        const updated = await prisma.leaveRequest.update({ where: { id: requestId }, data: { status: 'REJECTED', rejectionReason: rejectionReason || reviewRemarks || 'Rejected by HR', reviewRemarks: reviewRemarks || null, approvedBy: session.user.id, approvedAt: new Date() } })
        return NextResponse.json({ success: true, request: updated })
      }

      if (existing.leaveType === 'CL') {
        await assertCLAvailable(existing.employeeId, existing.days, existing.startDate.getFullYear())
      }

      if (existing.leaveType === 'COMP_OFF') {
        const available = await prisma.compOff.findMany({
          where: { employeeId: existing.employeeId, status: 'AVAILABLE' },
        })
        const totalAvail = available.reduce((sum, c) => sum + (c.duration || 1), 0)
        if (existing.days > totalAvail) {
          return NextResponse.json({ error: `Employee only has ${totalAvail} approved comp-off day(s) available.` }, { status: 400 })
        }
      }

      const updated = await prisma.$transaction(async (tx: any) => {
        const request = await tx.leaveRequest.update({ where: { id: requestId }, data: { status: 'APPROVED', reviewRemarks: reviewRemarks || null, approvedBy: session.user.id, approvedAt: new Date() } })
        if (request.leaveType === 'CL') {
          await tx.leaveBalance.update({ where: { employeeId_leaveType_year: { employeeId: request.employeeId, leaveType: 'CL', year: request.startDate.getFullYear() } }, data: { used: { increment: request.days } } })
        } else if (request.leaveType === 'COMP_OFF') {
          let needed = request.days
          const availableCompOffs = await tx.compOff.findMany({
            where: { employeeId: request.employeeId, status: 'AVAILABLE' },
            orderBy: { dateEarned: 'asc' },
          })
          for (const co of availableCompOffs) {
            if (needed <= 0) break
            const dur = co.duration || 1
            if (dur <= needed) {
              await tx.compOff.update({ where: { id: co.id }, data: { status: 'USED' } })
              needed -= dur
            } else {
              await tx.compOff.update({
                where: { id: co.id },
                data: { duration: dur - needed, status: 'AVAILABLE' },
              })
              await tx.compOff.create({
                data: {
                  employeeId: co.employeeId,
                  dateEarned: co.dateEarned,
                  status: 'USED',
                  grantedBy: co.grantedBy,
                  duration: needed,
                  durationType: 'HALF_DAY',
                },
              })
              needed = 0
            }
          }
        }
        return request
      })
      return NextResponse.json({ success: true, request: updated })
    }

    if (action === 'REGULARIZE') {
      if (!employeeId || !startDate || !endDate || !leaveType) return NextResponse.json({ error: 'Employee, dates and leave type are required.' }, { status: 400 })
      if (!['CL', 'LWP', 'COMP_OFF'].includes(leaveType)) return NextResponse.json({ error: 'HR regularization supports CL, Comp-off and LWP.' }, { status: 400 })
      const start = new Date(startDate)
      const end = new Date(endDate)
      if (end < start) return NextResponse.json({ error: 'End date cannot be before start date.' }, { status: 400 })
      if (start.getFullYear() !== end.getFullYear()) return NextResponse.json({ error: 'Please regularize separate leave requests for different calendar years.' }, { status: 400 })
      const overlap = await prisma.leaveRequest.findFirst({ where: { employeeId, status: { in: ['PENDING', 'APPROVED'] }, startDate: { lte: end }, endDate: { gte: start } } })
      if (overlap) return NextResponse.json({ error: 'A leave record already exists for part of this date range.' }, { status: 409 })
      if (!['FULL_DAY', 'FIRST_HALF', 'SECOND_HALF'].includes(durationType)) return NextResponse.json({ error: 'Invalid leave duration.' }, { status: 400 })
      if (durationType !== 'FULL_DAY' && start.getTime() !== end.getTime()) return NextResponse.json({ error: 'Half-day leave must be for a single date.' }, { status: 400 })
      const days = durationType === 'FULL_DAY' ? inclusiveLeaveDays(start, end) : 0.5
      const year = start.getFullYear()

      if (leaveType === 'CL') {
        await assertCLAvailable(employeeId, days, year)
        await ensureCLAccrual(employeeId, year)
      } else if (leaveType === 'COMP_OFF') {
        const available = await prisma.compOff.findMany({
          where: { employeeId, status: 'AVAILABLE' },
        })
        const totalAvail = available.reduce((sum, c) => sum + (c.duration || 1), 0)
        if (days > totalAvail) {
          return NextResponse.json({ error: `Employee only has ${totalAvail} approved comp-off day(s) available.` }, { status: 400 })
        }
      }

      const request = await prisma.$transaction(async (tx: any) => {
        const created = await tx.leaveRequest.create({ data: { employeeId, startDate: start, endDate: end, days, durationType, leaveType, reason: reason || 'Regularized by HR', status: 'APPROVED', source: 'HR', approvedBy: session.user.id, approvedAt: new Date(), reviewRemarks: reason || null } })
        if (leaveType === 'CL') {
          await tx.leaveBalance.update({ where: { employeeId_leaveType_year: { employeeId, leaveType: 'CL', year } }, data: { used: { increment: days } } })
        } else if (leaveType === 'COMP_OFF') {
          let needed = days
          const availableCompOffs = await tx.compOff.findMany({
            where: { employeeId, status: 'AVAILABLE' },
            orderBy: { dateEarned: 'asc' },
          })
          for (const co of availableCompOffs) {
            if (needed <= 0) break
            const dur = co.duration || 1
            if (dur <= needed) {
              await tx.compOff.update({ where: { id: co.id }, data: { status: 'USED' } })
              needed -= dur
            } else {
              await tx.compOff.update({
                where: { id: co.id },
                data: { duration: dur - needed, status: 'AVAILABLE' },
              })
              await tx.compOff.create({
                data: {
                  employeeId: co.employeeId,
                  dateEarned: co.dateEarned,
                  status: 'USED',
                  grantedBy: co.grantedBy,
                  duration: needed,
                  durationType: 'HALF_DAY',
                },
              })
              needed = 0
            }
          }
        }
        return created
      })
      return NextResponse.json({ success: true, request })
    }

    return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 })
  } catch (error: any) {
    console.error(error)
    return NextResponse.json({ error: error?.message || 'Internal Error' }, { status: 500 })
  }
}
