import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/prisma'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import bcrypt from 'bcryptjs'

async function requireHR() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'SUPER_ADMIN') return null
  return session
}

export async function GET() {
  try {
    const session = await requireHR()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const employees = await prisma.employee.findMany({
      where: { role: 'EMPLOYEE' },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, role: true, email: true, department: true, designation: true, dateOfJoining: true, annualCtc: true, monthlySalary: true, workMode: true, active: true, bankAccountName: true, bankAccountNumber: true, bankIfsc: true },
    })
    return NextResponse.json({ employees })
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
    const action = body?.action

    if (action === 'DEACTIVATE' || action === 'REACTIVATE') {
      const id = String(body?.id || '').trim()
      if (!id) return NextResponse.json({ error: 'Employee ID is required.' }, { status: 400 })
      const employee = await prisma.employee.findUnique({ where: { id } })
      if (!employee || employee.role !== 'EMPLOYEE') return NextResponse.json({ error: 'Employee not found.' }, { status: 404 })
      const updated = await prisma.employee.update({ where: { id }, data: { active: action === 'REACTIVATE' } })
      return NextResponse.json({ success: true, active: updated.active })
    }

    const { id, name, password, email, department, designation, dateOfJoining, annualCtc, monthlySalary, workMode, bankAccountName, bankAccountNumber, bankIfsc } = body
    if (!id || !name) return NextResponse.json({ error: 'Employee ID and name are required.' }, { status: 400 })
    if (String(id).trim() === session.user.id) return NextResponse.json({ error: 'Super Admin login cannot be edited as an employee.' }, { status: 400 })

    const existing = await prisma.employee.findUnique({ where: { id } })
    if (existing?.role === 'SUPER_ADMIN') return NextResponse.json({ error: 'Super Admin account cannot be modified here.' }, { status: 403 })
    if (!existing && !password) return NextResponse.json({ error: 'A password is required when enrolling a new employee.' }, { status: 400 })

    const data: any = {
      name: String(name).trim(),
      email: email ? String(email).trim() : null,
      department: department ? String(department).trim() : null,
      designation: designation ? String(designation).trim() : null,
      dateOfJoining: dateOfJoining ? new Date(dateOfJoining) : null,
      annualCtc: annualCtc != null && annualCtc !== '' ? Number(annualCtc) : null,
      monthlySalary: monthlySalary != null && monthlySalary !== '' ? Number(monthlySalary) : null,
      workMode: workMode || 'FIELD',
      bankAccountName: bankAccountName ? String(bankAccountName).trim() : null,
      bankAccountNumber: bankAccountNumber ? String(bankAccountNumber).trim() : null,
      bankIfsc: bankIfsc ? String(bankIfsc).trim().toUpperCase() : null,
      role: 'EMPLOYEE',
    }
    if (password) data.hashedPassword = await bcrypt.hash(String(password), 10)

    const employee = await prisma.employee.upsert({
      where: { id },
      update: data,
      create: { id: String(id).trim(), name: String(name).trim(), hashedPassword: data.hashedPassword, ...data },
    })

    return NextResponse.json({ success: true, employee: { id: employee.id, name: employee.name, active: employee.active } })
  } catch (error: any) {
    console.error(error)
    return NextResponse.json({ error: error?.code === 'P2002' ? 'Employee ID or email already exists.' : 'Internal Error' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await requireHR()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await req.json()
    const id = String(body?.id || '').trim()
    if (!id) return NextResponse.json({ error: 'Employee ID is required.' }, { status: 400 })
    if (id === session.user.id) return NextResponse.json({ error: 'Super Admin cannot be deleted here.' }, { status: 403 })
    const employee = await prisma.employee.findUnique({ where: { id }, select: { id: true, role: true, active: true } })
    if (!employee || employee.role !== 'EMPLOYEE') return NextResponse.json({ error: 'Employee not found.' }, { status: 404 })

    // Normal HR records must never be silently deleted. Permanent deletion is an
    // explicit Super Admin action and is only available after the employee is inactive.
    if (employee.active) {
      return NextResponse.json({ error: 'Disable the employee before permanent deletion. Active employee accounts are protected.' }, { status: 409 })
    }

    if (String(body?.confirmId || '').trim() !== id) {
      return NextResponse.json({ error: 'Permanent deletion requires the exact Employee ID as confirmation.' }, { status: 400 })
    }

    await prisma.$transaction(async (tx) => {
      // Delete child records first so HR history and the employee account are removed cleanly.
      await tx.attendance.deleteMany({ where: { employeeId: id } })
      await tx.attendanceRegularization.deleteMany({ where: { employeeId: id } })
      await tx.leaveRequest.deleteMany({ where: { employeeId: id } })
      await tx.compOff.deleteMany({ where: { employeeId: id } })
      await tx.compOffRequest.deleteMany({ where: { employeeId: id } })
      await tx.payslip.deleteMany({ where: { employeeId: id } })
      await tx.leaveEncashment.deleteMany({ where: { employeeId: id } })
      await tx.leaveAccrual.deleteMany({ where: { employeeId: id } })
      await tx.leaveBalance.deleteMany({ where: { employeeId: id } })
      await tx.employee.delete({ where: { id } })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Unable to delete employee.' }, { status: 500 })
  }
}
