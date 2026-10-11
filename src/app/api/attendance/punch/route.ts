import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { indiaMidnight, formatIndiaDateTime, workingMinutes } from '@/lib/attendance'
import { sendHRNotification } from '@/lib/email'
import { syncAttendanceToGoogleSheets } from '@/lib/google-sheets'

function validCoordinate(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value)
}

function locationPayload(body: any) {
  const latitude = Number(body?.latitude)
  const longitude = Number(body?.longitude)
  const accuracy = body?.accuracy == null ? null : Number(body.accuracy)
  if (!validCoordinate(latitude) || latitude < -90 || latitude > 90 || !validCoordinate(longitude) || longitude < -180 || longitude > 180) {
    return null
  }
  return { latitude, longitude, accuracy: Number.isFinite(accuracy) ? accuracy : null }
}

async function requireEmployee() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return null
  if (session.user.role === 'SUPER_ADMIN') return null
  const employee = await prisma.employee.findUnique({ where: { id: session.user.id }, select: { id: true, name: true, active: true } })
  if (!employee?.active) return null
  return { session, employee }
}

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const auth = await requireEmployee()
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const records = await prisma.attendance.findMany({
      where: { employeeId: auth.employee.id },
      orderBy: { date: 'desc' },
      take: 31,
      select: {
        id: true, date: true, punchIn: true, reachedAt: true, punchOut: true,
        travelMinutes: true, workingMinutes: true, hospitalName: true, status: true,
        lastLatitude: true, lastLongitude: true, lastAccuracy: true, lastLocationAt: true,
      },
    })

    let today = await prisma.attendance.findUnique({
      where: { employeeId_date: { employeeId: auth.employee.id, date: indiaMidnight() } },
      select: {
        id: true, date: true, punchIn: true, reachedAt: true, punchOut: true,
        travelMinutes: true, workingMinutes: true, hospitalName: true, status: true,
        startLatitude: true, startLongitude: true, startAccuracy: true,
        reachedLatitude: true, reachedLongitude: true, reachedAccuracy: true,
        punchOutLatitude: true, punchOutLongitude: true, punchOutAccuracy: true,
        lastLatitude: true, lastLongitude: true, lastAccuracy: true, lastLocationAt: true,
      },
    })

    if (!today) {
      today = await prisma.attendance.findFirst({
        where: {
          employeeId: auth.employee.id,
          punchOut: null,
          punchIn: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
        orderBy: { date: 'desc' },
        select: {
          id: true, date: true, punchIn: true, reachedAt: true, punchOut: true,
          travelMinutes: true, workingMinutes: true, hospitalName: true, status: true,
          startLatitude: true, startLongitude: true, startAccuracy: true,
          reachedLatitude: true, reachedLongitude: true, reachedAccuracy: true,
          punchOutLatitude: true, punchOutLongitude: true, punchOutAccuracy: true,
          lastLatitude: true, lastLongitude: true, lastAccuracy: true, lastLocationAt: true,
        },
      })
    }

    return NextResponse.json({ records, today })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireEmployee()
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const action = body?.action
    const location = locationPayload(body)
    if (!location) return NextResponse.json({ error: 'A valid current location is required.' }, { status: 400 })

    const date = indiaMidnight()
    let attendance = await prisma.attendance.findUnique({ where: { employeeId_date: { employeeId: auth.employee.id, date } } })

    if (!attendance && action !== 'START_TRAVEL') {
      attendance = await prisma.attendance.findFirst({
        where: {
          employeeId: auth.employee.id,
          punchOut: null,
          punchIn: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
        orderBy: { date: 'desc' },
      })
    }

    if (action === 'START_TRAVEL') {
      if (attendance) return NextResponse.json({ error: 'Today\'s attendance has already been started.' }, { status: 409 })
      const hospitalName = String(body?.hospitalName || '').trim()
      if (!hospitalName) return NextResponse.json({ error: 'Please enter the hospital name before starting travel.' }, { status: 400 })
      if (hospitalName.length > 150) return NextResponse.json({ error: 'Hospital name is too long.' }, { status: 400 })

      const now = new Date()
      attendance = await prisma.attendance.create({
        data: {
          employeeId: auth.employee.id,
          date,
          punchIn: now,
          hospitalName,
          status: 'TRAVELLING',
          startLatitude: location.latitude,
          startLongitude: location.longitude,
          startAccuracy: location.accuracy,
          lastLatitude: location.latitude,
          lastLongitude: location.longitude,
          lastAccuracy: location.accuracy,
          lastLocationAt: now,
        },
      })
      await prisma.attendanceLocation.create({ data: { attendanceId: attendance.id, ...location, event: 'START_TRAVEL', capturedAt: now } })
      void syncAttendanceToGoogleSheets(attendance.id).catch((error) => console.error('Attendance sheet sync error:', error))
      void sendHRNotification(
        `Quantzo Attendance: ${auth.employee.name} started travel`,
        `<div style="font-family:Arial,sans-serif"><h2>Attendance Update</h2><p><b>Employee:</b> ${auth.employee.name} (${auth.employee.id})</p><p><b>Hospital:</b> ${hospitalName}</p><p><b>Event:</b> Started Travel</p><p><b>Time:</b> ${formatIndiaDateTime(now)}</p><p><b>Location:</b> ${location.latitude}, ${location.longitude}</p></div>`,
      ).catch((error) => console.error('Attendance email error:', error))
      return NextResponse.json({ success: true, attendance })
    }

    if (!attendance) return NextResponse.json({ error: 'Please start your travel first.' }, { status: 400 })
    if (attendance.punchOut) return NextResponse.json({ error: 'Today\'s attendance is already closed.' }, { status: 409 })

    if (action === 'REACHED') {
      if (attendance.reachedAt) return NextResponse.json({ error: 'Hospital arrival has already been recorded.' }, { status: 409 })
      const now = new Date()
      const travel = workingMinutes(attendance.punchIn, now) ?? 0
      // Make the state transition atomic. This prevents a fast double-click or
      // concurrent browser request from recording REACHED twice and leaving the
      // client in a stale transition state.
      const changed = await prisma.attendance.updateMany({
        where: { id: attendance.id, reachedAt: null, punchOut: null },
        data: {
          reachedAt: now,
          travelMinutes: travel,
          status: 'ON_DUTY',
          reachedLatitude: location.latitude,
          reachedLongitude: location.longitude,
          reachedAccuracy: location.accuracy,
          lastLatitude: location.latitude,
          lastLongitude: location.longitude,
          lastAccuracy: location.accuracy,
          lastLocationAt: now,
        },
      })
      if (changed.count !== 1) {
        const current = await prisma.attendance.findUnique({ where: { id: attendance.id } })
        if (current?.reachedAt) return NextResponse.json({ success: true, alreadyRecorded: true, attendance: current })
        return NextResponse.json({ error: 'Attendance state changed. Please refresh and try again.' }, { status: 409 })
      }
      attendance = await prisma.attendance.findUniqueOrThrow({ where: { id: attendance.id } })
      await prisma.attendanceLocation.create({ data: { attendanceId: attendance.id, ...location, event: 'REACHED_HOSPITAL', capturedAt: now } })
      void syncAttendanceToGoogleSheets(attendance.id).catch((error) => console.error('Attendance sheet sync error:', error))
      return NextResponse.json({ success: true, attendance })
    }

    if (action === 'LOCATION') {
      const now = new Date()
      attendance = await prisma.attendance.update({
        where: { id: attendance.id },
        data: {
          lastLatitude: location.latitude,
          lastLongitude: location.longitude,
          lastAccuracy: location.accuracy,
          lastLocationAt: now,
        },
      })
      await prisma.attendanceLocation.create({ data: { attendanceId: attendance.id, ...location, event: 'LIVE_UPDATE', capturedAt: now } })
      return NextResponse.json({ success: true, attendance })
    }

    if (action === 'OUT') {
      if (!attendance.reachedAt) return NextResponse.json({ error: 'Please record Reached Hospital before punching out.' }, { status: 400 })
      const now = new Date()
      const changed = await prisma.attendance.updateMany({
        where: { id: attendance.id, punchOut: null, reachedAt: { not: null } },
        data: {
          punchOut: now,
          workingMinutes: workingMinutes(attendance.reachedAt, now),
          status: 'COMPLETED',
          punchOutLatitude: location.latitude,
          punchOutLongitude: location.longitude,
          punchOutAccuracy: location.accuracy,
          lastLatitude: location.latitude,
          lastLongitude: location.longitude,
          lastAccuracy: location.accuracy,
          lastLocationAt: now,
        },
      })
      if (changed.count !== 1) {
        const current = await prisma.attendance.findUnique({ where: { id: attendance.id } })
        if (current?.punchOut) return NextResponse.json({ success: true, alreadyRecorded: true, attendance: current })
        return NextResponse.json({ error: 'Attendance state changed. Please refresh and try again.' }, { status: 409 })
      }
      attendance = await prisma.attendance.findUniqueOrThrow({ where: { id: attendance.id } })
      await prisma.attendanceLocation.create({ data: { attendanceId: attendance.id, ...location, event: 'PUNCH_OUT', capturedAt: now } })
      void syncAttendanceToGoogleSheets(attendance.id).catch((error) => console.error('Attendance sheet sync error:', error))
      const workingText = attendance.workingMinutes != null ? `${Math.floor(attendance.workingMinutes / 60)}h ${attendance.workingMinutes % 60}m` : '-'
      void sendHRNotification(
        `Quantzo Attendance: ${auth.employee.name} completed duty`,
        `<div style="font-family:Arial,sans-serif"><h2>Attendance Update</h2><p><b>Employee:</b> ${auth.employee.name} (${auth.employee.id})</p><p><b>Hospital:</b> ${attendance.hospitalName || '-'}</p><p><b>Duty End:</b> ${formatIndiaDateTime(now)}</p><p><b>Working Hours:</b> ${workingText}</p></div>`,
      ).catch((error) => console.error('Attendance email error:', error))
      return NextResponse.json({ success: true, attendance })
    }

    return NextResponse.json({ error: 'Invalid attendance action.' }, { status: 400 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 })
  }
}
