import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/prisma'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

async function currentEmployee() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return null
  const employee = await prisma.employee.findUnique({ where: { id: session.user.id } })
  if (!employee || !employee.active) return null
  return employee
}

export async function GET() {
  const employee = await currentEmployee()
  if (!employee) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({
    employee: {
      id: employee.id, name: employee.name, email: employee.email,
      department: employee.department, designation: employee.designation,
      dateOfJoining: employee.dateOfJoining, workMode: employee.workMode,
      profileImageUrl: employee.profileImageUrl,
    }
  })
}

export async function PATCH(req: Request) {
  try {
    const employee = await currentEmployee()
    if (!employee) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await req.json()

    if (body.action === 'CHANGE_PASSWORD') {
      const currentPassword = String(body.currentPassword || '')
      const newPassword = String(body.newPassword || '')
      if (!currentPassword || !newPassword) return NextResponse.json({ error: 'Current and new passwords are required.' }, { status: 400 })
      if (newPassword.length < 8) return NextResponse.json({ error: 'New password must be at least 8 characters.' }, { status: 400 })
      if (!(await bcrypt.compare(currentPassword, employee.hashedPassword))) {
        return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 400 })
      }
      const hashedPassword = await bcrypt.hash(newPassword, 10)
      await prisma.employee.update({ where: { id: employee.id }, data: { hashedPassword } })
      return NextResponse.json({ success: true })
    }

    if (body.action === 'PROFILE_IMAGE') {
      const image = String(body.profileImageUrl || '')
      if (image && (!image.startsWith('data:image/') || image.length > 700000)) {
        return NextResponse.json({ error: 'Please upload a valid image up to approximately 500 KB.' }, { status: 400 })
      }
      await prisma.employee.update({ where: { id: employee.id }, data: { profileImageUrl: image || null } })
      return NextResponse.json({ success: true, profileImageUrl: image || null })
    }

    return NextResponse.json({ error: 'Invalid profile action.' }, { status: 400 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Unable to update profile.' }, { status: 500 })
  }
}
