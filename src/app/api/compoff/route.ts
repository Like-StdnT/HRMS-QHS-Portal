import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/prisma'
import { authOptions } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.user.role === 'SUPER_ADMIN') return NextResponse.json({ error: 'Super Admin does not use employee self-service.' }, { status: 403 })
    const activeEmployee = await prisma.employee.findUnique({ where: { id: session.user.id }, select: { active: true, role: true } })
    if (!activeEmployee?.active || activeEmployee.role !== 'EMPLOYEE') return NextResponse.json({ error: 'Employee account is inactive.' }, { status: 403 })

    const [requests, available] = await Promise.all([
      prisma.compOffRequest.findMany({ where: { employeeId: session.user.id }, orderBy: { createdAt: 'desc' } }),
      prisma.compOff.findMany({ where: { employeeId: session.user.id }, orderBy: { dateEarned: 'desc' } }),
    ])
    return NextResponse.json({ requests, available })
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

    const { workedDate, reason, durationType = 'FULL_DAY' } = await req.json()
    if (!workedDate || !reason?.trim() || !['FULL_DAY', 'HALF_DAY'].includes(durationType)) return NextResponse.json({ error: 'Worked date and reason are required.' }, { status: 400 })

    const date = new Date(workedDate)
    if (Number.isNaN(date.getTime())) return NextResponse.json({ error: 'Invalid worked date.' }, { status: 400 })
    if (date.getTime() > Date.now()) return NextResponse.json({ error: 'Worked date cannot be in the future.' }, { status: 400 })

    const duplicate = await prisma.compOffRequest.findFirst({ where: { employeeId: session.user.id, workedDate: date, status: { in: ['PENDING', 'APPROVED'] } } })
    if (duplicate) return NextResponse.json({ error: 'A comp-off request already exists for this date.' }, { status: 409 })

    const duration = durationType === 'HALF_DAY' ? 0.5 : 1
    const request = await prisma.compOffRequest.create({ data: { employeeId: session.user.id, workedDate: date, reason: reason.trim(), status: 'PENDING', duration, durationType } })
    return NextResponse.json({ success: true, request })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 })
  }
}
