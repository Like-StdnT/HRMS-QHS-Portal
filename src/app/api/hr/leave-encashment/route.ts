import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/prisma'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { ensureCLAccrual } from '@/lib/leave'

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || session.user.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { employeeId, year, days, amount } = await req.json()
    const targetYear = Number(year)
    const encashDays = Number(days)
    const encashAmount = Number(amount)
    if (!employeeId || !Number.isInteger(targetYear) || !Number.isFinite(encashDays) || !Number.isFinite(encashAmount) || encashDays <= 0 || encashAmount < 0) return NextResponse.json({ error: 'Employee, year, days and amount are required.' }, { status: 400 })

    await ensureCLAccrual(employeeId, targetYear)
    const balance = await prisma.leaveBalance.findUnique({ where: { employeeId_leaveType_year: { employeeId, leaveType: 'CL', year: targetYear } } })
    if (!balance) return NextResponse.json({ error: 'CL balance not found.' }, { status: 404 })
    const remaining = balance.total - balance.used - balance.encashed
    if (encashDays > remaining) return NextResponse.json({ error: `Only ${remaining} CL day(s) are available for encashment.` }, { status: 400 })
    const existing = await prisma.leaveEncashment.findUnique({ where: { employeeId_year: { employeeId, year: targetYear } } })
    if (existing) return NextResponse.json({ error: 'Year-end encashment has already been processed for this employee.' }, { status: 409 })

    const result = await prisma.$transaction(async (tx: any) => {
      const encashment = await tx.leaveEncashment.create({ data: { employeeId, year: targetYear, days: encashDays, amount: encashAmount, processedBy: session.user.id } })
      await tx.leaveBalance.update({ where: { employeeId_leaveType_year: { employeeId, leaveType: 'CL', year: targetYear } }, data: { encashed: { increment: encashDays } } })
      return encashment
    })
    return NextResponse.json({ success: true, encashment: result })
  } catch (error: any) {
    console.error(error)
    return NextResponse.json({ error: error?.message || 'Internal Error' }, { status: 500 })
  }
}
