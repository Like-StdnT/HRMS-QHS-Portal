import prisma from '@/lib/prisma'
import { getMonth, getYear } from 'date-fns'

export const CL_PER_MONTH = 1

export function inclusiveLeaveDays(startDate: Date, endDate: Date) {
  // Leave requests currently count each requested calendar date.
  // This helper is deliberately isolated so weekly-off rules can be added later.
  const startDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())
  const endDay = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate())
  return Math.max(1, Math.round((endDay.getTime() - startDay.getTime()) / 86400000) + 1)
}

export async function ensureCLAccrual(employeeId: string, year = new Date().getFullYear()) {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } })
  if (!employee?.dateOfJoining || !employee.active) return null

  const now = new Date()
  const currentYear = getYear(now)
  const lastMonth = year < currentYear ? 12 : year === currentYear ? getMonth(now) + 1 : 0
  if (lastMonth === 0) return null

  const joinYear = getYear(employee.dateOfJoining)
  if (joinYear > year) return null
  const firstMonth = joinYear === year ? getMonth(employee.dateOfJoining) + 1 : 1
  const monthsToCredit = Math.max(0, lastMonth - firstMonth + 1)

  if (monthsToCredit > 0) {
    for (let month = firstMonth; month <= lastMonth; month++) {
      await prisma.leaveAccrual.upsert({
        where: { employeeId_year_month: { employeeId, year, month } },
        update: {},
        create: { employeeId, year, month, creditedDays: CL_PER_MONTH },
      })
    }
  }

  const accruals = await prisma.leaveAccrual.aggregate({
    where: { employeeId, year },
    _sum: { creditedDays: true },
  })
  const total = accruals._sum.creditedDays ?? 0

  const balance = await prisma.leaveBalance.upsert({
    where: { employeeId_leaveType_year: { employeeId, leaveType: 'CL', year } },
    update: { total },
    create: { employeeId, leaveType: 'CL', year, total },
  })

  return balance
}

export async function ensureAllCurrentYearCLAccruals() {
  const employees = await prisma.employee.findMany({ where: { active: true, dateOfJoining: { not: null } }, select: { id: true } })
  for (const employee of employees) await ensureCLAccrual(employee.id)
}

export async function getCLBalance(employeeId: string, year = new Date().getFullYear()) {
  await ensureCLAccrual(employeeId, year)
  return prisma.leaveBalance.findUnique({
    where: { employeeId_leaveType_year: { employeeId, leaveType: 'CL', year } },
  })
}

export async function assertCLAvailable(employeeId: string, days: number, year: number) {
  const balance = await getCLBalance(employeeId, year)
  if (!balance) throw new Error('CL balance is not available for this employee')
  const remaining = balance.total - balance.used - balance.encashed
  if (days > remaining) throw new Error(`Only ${remaining} CL day(s) are available`)
  return balance
}
