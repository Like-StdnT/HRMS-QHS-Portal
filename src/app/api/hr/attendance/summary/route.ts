import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { getDaysInMonth } from 'date-fns'
import prisma from '@/lib/prisma'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || session.user.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { searchParams } = new URL(req.url)
    const month = searchParams.get('month') || new Date().toISOString().slice(0, 7)
    const start = new Date(`${month}-01T00:00:00.000Z`)
    const end = new Date(start)
    end.setUTCMonth(end.getUTCMonth() + 1)
    const calendarDays = getDaysInMonth(start)

    const [employees, attendances, leaves] = await Promise.all([
      prisma.employee.findMany({ where: { active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true, monthlySalary: true, annualCtc: true, dateOfJoining: true } }),
      prisma.attendance.findMany({ where: { date: { gte: start, lt: end } }, select: { employeeId: true, status: true, workingMinutes: true } }),
      prisma.leaveRequest.findMany({ where: { status: 'APPROVED', startDate: { lt: end }, endDate: { gte: start } }, select: { employeeId: true, leaveType: true, days: true, startDate: true, endDate: true } }),
    ])

    const summary = employees.map((employee: any) => {
      const records = attendances.filter((a: any) => a.employeeId === employee.id)
      const presentDays = records.reduce((sum: number, a: any) => sum + (a.status === 'HALF_DAY' ? 0.5 : a.status === 'PRESENT' ? 1 : 0), 0)
      const workingMinutes = records.reduce((sum: number, a: any) => sum + (a.workingMinutes || 0), 0)
      const empLeaves = leaves.filter((l: any) => l.employeeId === employee.id)
      const clDays = empLeaves.filter((l: any) => l.leaveType === 'CL').reduce((sum: number, l: any) => sum + l.days, 0)
      const lwpDays = empLeaves.filter((l: any) => l.leaveType === 'LWP').reduce((sum: number, l: any) => sum + l.days, 0)
      const paidDays = presentDays + clDays
      return { employeeId: employee.id, employeeName: employee.name, monthlySalary: employee.monthlySalary, annualCtc: employee.annualCtc, calendarDays, presentDays, clDays, lwpDays, paidDays, workingMinutes }
    })

    return NextResponse.json({ month, calendarDays, summary })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 })
  }
}
