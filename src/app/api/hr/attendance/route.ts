import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { workingMinutes } from '@/lib/attendance'
import { syncAttendanceToGoogleSheets } from '@/lib/google-sheets'

async function requireHR() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'SUPER_ADMIN') return null
  return session
}

export async function GET(req: Request) {
  try {
    const session = await requireHR()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date') || new Date().toISOString().slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: 'Invalid date.' }, { status: 400 })
    const day = new Date(`${date}T00:00:00.000Z`)
    const nextDay = new Date(day)
    nextDay.setUTCDate(nextDay.getUTCDate() + 1)

    const [employees, records] = await Promise.all([
      prisma.employee.findMany({ where: { active: true, role: 'EMPLOYEE' }, orderBy: { name: 'asc' }, select: { id: true, name: true, department: true, designation: true } }),
      prisma.attendance.findMany({
        where: { date: { gte: day, lt: nextDay } },
        include: {
          employee: { select: { id: true, name: true, department: true, designation: true } },
          locations: { orderBy: { capturedAt: 'desc' }, take: 10 },
        },
        orderBy: { employeeId: 'asc' },
      }),
    ])
    return NextResponse.json({ date, employees, records })
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
    const { employeeId, date, punchIn, reachedAt, punchOut, status, reason } = body
    if (!employeeId || !date) return NextResponse.json({ error: 'Employee and date are required.' }, { status: 400 })

    const employee = await prisma.employee.findUnique({ where: { id: employeeId, role: 'EMPLOYEE' } })
    if (!employee) return NextResponse.json({ error: 'Employee not found.' }, { status: 404 })

    const day = new Date(`${date}T00:00:00.000Z`)
    const existing = await prisma.attendance.findUnique({ where: { employeeId_date: { employeeId, date: day } } })
    const oldPunchIn = existing?.punchIn ?? null
    const oldReachedAt = existing?.reachedAt ?? null
    const oldPunchOut = existing?.punchOut ?? null
    const nextPunchIn = punchIn ? new Date(punchIn) : null
    const nextReachedAt = reachedAt ? new Date(reachedAt) : null
    const nextPunchOut = punchOut ? new Date(punchOut) : null

    if ([nextPunchIn, nextReachedAt, nextPunchOut].some(x => x && Number.isNaN(x.getTime()))) {
      return NextResponse.json({ error: 'One or more attendance times are invalid.' }, { status: 400 })
    }
    if (nextReachedAt && nextPunchIn && nextReachedAt <= nextPunchIn) return NextResponse.json({ error: 'Reached time must be after travel start.' }, { status: 400 })
    if (nextPunchOut && nextReachedAt && nextPunchOut <= nextReachedAt) return NextResponse.json({ error: 'Punch-out must be after reached time.' }, { status: 400 })

    const attendance = await prisma.attendance.upsert({
      where: { employeeId_date: { employeeId, date: day } },
      update: {
        punchIn: nextPunchIn,
        reachedAt: nextReachedAt,
        punchOut: nextPunchOut,
        travelMinutes: workingMinutes(nextPunchIn, nextReachedAt),
        workingMinutes: workingMinutes(nextReachedAt, nextPunchOut),
        status: status || (nextPunchOut ? 'COMPLETED' : nextReachedAt ? 'ON_DUTY' : nextPunchIn ? 'TRAVELLING' : 'ABSENT'),
        source: 'HR_REGULARIZATION',
        regularizationStatus: 'REGULARIZED',
        regularizationReason: reason || 'Attendance regularized by HR',
        regularizedBy: session.user.id,
      },
      create: {
        employeeId,
        date: day,
        punchIn: nextPunchIn,
        reachedAt: nextReachedAt,
        punchOut: nextPunchOut,
        travelMinutes: workingMinutes(nextPunchIn, nextReachedAt),
        workingMinutes: workingMinutes(nextReachedAt, nextPunchOut),
        status: status || (nextPunchOut ? 'COMPLETED' : nextReachedAt ? 'ON_DUTY' : nextPunchIn ? 'TRAVELLING' : 'ABSENT'),
        source: 'HR_REGULARIZATION',
        regularizationStatus: 'REGULARIZED',
        regularizationReason: reason || 'Attendance regularized by HR',
        regularizedBy: session.user.id,
      },
    })

    await syncAttendanceToGoogleSheets(attendance.id)

    await prisma.attendanceRegularization.create({
      data: {
        employeeId,
        attendanceId: attendance.id,
        date: day,
        oldPunchIn,
        oldReachedAt,
        oldPunchOut,
        newPunchIn: nextPunchIn,
        newReachedAt: nextReachedAt,
        newPunchOut: nextPunchOut,
        reason: reason || 'Attendance regularized by HR',
        updatedBy: session.user.id,
      },
    })

    return NextResponse.json({ success: true, attendance })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 })
  }
}


export async function DELETE(req: Request) {
  try {
    const session = await requireHR()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await req.json()
    const id = String(body?.id || '')
    if (!id) return NextResponse.json({ error: 'Attendance record ID is required.' }, { status: 400 })
    const attendance = await prisma.attendance.findUnique({ where: { id }, select: { id: true, employeeId: true, date: true } })
    if (!attendance) return NextResponse.json({ error: 'Attendance record not found.' }, { status: 404 })
    await prisma.$transaction([
      prisma.attendanceRegularization.deleteMany({ where: { attendanceId: id } }),
      prisma.attendance.delete({ where: { id } }),
    ])
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Unable to delete attendance record.' }, { status: 500 })
  }
}
