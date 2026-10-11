import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const hrPassword = await bcrypt.hash('Qhs@2026', 10)
  const empPassword = await bcrypt.hash('password123', 10)

  await prisma.attendanceRegularization.deleteMany()
  await prisma.leaveEncashment.deleteMany()
  await prisma.compOff.deleteMany()
  await prisma.compOffRequest.deleteMany()
  await prisma.leaveAccrual.deleteMany()
  await prisma.leaveBalance.deleteMany()
  await prisma.leaveRequest.deleteMany()
  await prisma.payslip.deleteMany()
  await prisma.attendance.deleteMany()
  await prisma.employee.deleteMany()

  await prisma.employee.create({
    data: {
      id: 'adminhr@quantzohealthservices',
      name: 'Super Admin',
      role: 'SUPER_ADMIN',
      hashedPassword: hrPassword,
      email: 'hre.quantzo@quantzohealthservices.co.in',
      department: 'Human Resources',
      designation: 'Super Admin',
      workMode: 'OFFICE',
    },
  })

  await prisma.employee.create({
    data: {
      id: 'QHS26270036',
      name: 'Employee One',
      role: 'EMPLOYEE',
      hashedPassword: empPassword,
      department: 'Operations',
      designation: 'Field Executive',
      dateOfJoining: new Date('2026-08-10T00:00:00.000Z'),
      annualCtc: 240000,
      monthlySalary: 20000,
      workMode: 'FIELD',
    },
  })

  console.log('Seed completed.')
  console.log('Super Admin: adminhr@quantzohealthservices / Qhs@2026')
  console.log('Employee: QHS26270036 / password123')
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(async () => { await prisma.$disconnect() })
