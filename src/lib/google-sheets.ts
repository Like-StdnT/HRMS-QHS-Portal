import prisma from '@/lib/prisma'
import { formatIndiaDateTime } from '@/lib/attendance'

export async function syncAttendanceToGoogleSheets(attendanceId: string) {
  const webhook = process.env.GOOGLE_SHEETS_WEBHOOK_URL
  if (!webhook) return { synced: false, skipped: true }

  const attendance = await prisma.attendance.findUnique({
    where: { id: attendanceId },
    include: { employee: { select: { id: true, name: true, department: true, designation: true } } },
  })
  if (!attendance) return { synced: false, skipped: true }

  const payload = {
    event: 'ATTENDANCE_UPSERT',
    secret: process.env.GOOGLE_SHEETS_WEBHOOK_SECRET || '',
    employeeId: attendance.employee.id,
    employeeName: attendance.employee.name,
    department: attendance.employee.department || '',
    designation: attendance.employee.designation || '',
    date: attendance.date.toISOString().slice(0, 10),
    hospitalName: attendance.hospitalName || '',
    travelStart: formatIndiaDateTime(attendance.punchIn),
    reachedHospital: formatIndiaDateTime(attendance.reachedAt),
    punchOut: formatIndiaDateTime(attendance.punchOut),
    travelMinutes: attendance.travelMinutes ?? '',
    workingMinutes: attendance.workingMinutes ?? '',
    status: attendance.status,
    startLatitude: attendance.startLatitude ?? '',
    startLongitude: attendance.startLongitude ?? '',
    reachedLatitude: attendance.reachedLatitude ?? '',
    reachedLongitude: attendance.reachedLongitude ?? '',
    punchOutLatitude: attendance.punchOutLatitude ?? '',
    punchOutLongitude: attendance.punchOutLongitude ?? '',
    lastLatitude: attendance.lastLatitude ?? '',
    lastLongitude: attendance.lastLongitude ?? '',
    lastLocationAt: formatIndiaDateTime(attendance.lastLocationAt),
    syncedAt: new Date().toISOString(),
  }

  try {
    const response = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
    })
    if (!response.ok) {
      console.error('Google Sheets sync failed:', response.status, await response.text())
      return { synced: false, skipped: false }
    }
    return { synced: true, skipped: false }
  } catch (error) {
    console.error('Google Sheets sync error:', error)
    return { synced: false, skipped: false }
  }
}
