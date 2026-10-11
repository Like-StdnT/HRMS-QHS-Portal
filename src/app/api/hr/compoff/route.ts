import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/prisma'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

async function requireHR() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'SUPER_ADMIN') return null
  return session
}

export async function GET() {
  try {
    const session = await requireHR()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const requests = await prisma.compOffRequest.findMany({ include: { employee: true }, orderBy: { createdAt: 'desc' }, take: 200 })
    return NextResponse.json({ requests })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireHR()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { requestId, action, rejectionReason, reviewRemarks } = await req.json()
    if (!requestId || !['APPROVE', 'REJECT'].includes(action)) return NextResponse.json({ error: 'Invalid action.' }, { status: 400 })

    const request = await prisma.compOffRequest.findUnique({ where: { id: requestId } })
    if (!request) return NextResponse.json({ error: 'Comp-off request not found.' }, { status: 404 })
    if (request.status !== 'PENDING') return NextResponse.json({ error: 'Request already reviewed.' }, { status: 409 })

    if (action === 'REJECT') {
      const updated = await prisma.compOffRequest.update({ where: { id: requestId }, data: { status: 'REJECTED', reviewedBy: session.user.id, reviewedAt: new Date(), rejectionReason: rejectionReason || reviewRemarks || 'Rejected by HR', reviewRemarks: reviewRemarks || null } })
      return NextResponse.json({ success: true, request: updated })
    }

    const result = await prisma.$transaction(async (tx: any) => {
      const updated = await tx.compOffRequest.update({ where: { id: requestId }, data: { status: 'APPROVED', reviewedBy: session.user.id, reviewedAt: new Date(), reviewRemarks: reviewRemarks || null } })
      const compOff = await tx.compOff.create({ data: { employeeId: request.employeeId, dateEarned: request.workedDate, status: 'AVAILABLE', grantedBy: session.user.id, requestId: request.id, duration: request.duration, durationType: request.durationType } })
      return { updated, compOff }
    })

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 })
  }
}
