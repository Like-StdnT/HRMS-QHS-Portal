"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { CalendarDays, Clock3, Users, WalletCards } from "lucide-react"

export default function DashboardPage() {
  const { data: session } = useSession()
  const isSuperAdmin = session?.user?.role === 'SUPER_ADMIN'
  const [leave, setLeave] = useState<any>({ balance: {} })
  const [attendance, setAttendance] = useState<any>(null)
  const [adminStats, setAdminStats] = useState({ activeEmployees: 0, pendingLeaves: 0, pendingCompOffs: 0 })

  useEffect(() => {
    if (!session?.user?.id) return

    if (isSuperAdmin) {
      Promise.all([fetch('/api/hr/employees'), fetch('/api/leave/admin'), fetch('/api/hr/compoff')]).then(async ([employeesRes, leavesRes, compOffRes]) => {
        const [employees, leaves, compOffs] = await Promise.all([
          employeesRes.ok ? employeesRes.json() : { employees: [] },
          leavesRes.ok ? leavesRes.json() : { requests: [] },
          compOffRes.ok ? compOffRes.json() : { requests: [] },
        ])
        setAdminStats({
          activeEmployees: (employees.employees || []).filter((x: any) => x.active).length,
          pendingLeaves: (leaves.requests || []).filter((x: any) => x.status === 'PENDING').length,
          pendingCompOffs: (compOffs.requests || []).filter((x: any) => x.status === 'PENDING').length,
        })
      })
      return
    }

    Promise.all([fetch('/api/leave'), fetch('/api/attendance/punch')]).then(async ([l, a]) => {
      if (l.ok) setLeave(await l.json())
      if (a.ok) { const d = await a.json(); setAttendance(d.today) }
    })
  }, [session?.user?.id, isSuperAdmin])

  const mins = attendance?.workingMinutes
  const hours = mins != null ? `${Math.floor(mins / 60)}h ${mins % 60}m` : attendance?.punchIn ? 'In progress' : 'Not punched in'

  interface DashboardCard {
    title: string
    value: any
    note: string
    icon: any
    tone: string
    href?: string
  }

  const employeeCards: DashboardCard[] = [
    { title: 'CL Balance', value: `${leave.balance?.remaining ?? 0} Days`, note: 'Available for the current year', icon: CalendarDays, tone: 'blue' },
    { title: 'Comp-offs', value: (leave.compOffs || []).filter((x: any) => x.status === 'AVAILABLE').length, note: 'Approved and available', icon: WalletCards, tone: 'orange' },
    { title: "Today's Attendance", value: hours, note: 'Punch in / punch out status', icon: Clock3, tone: 'green' },
  ]

  const adminCards: DashboardCard[] = [
    { title: 'Active Employees', value: adminStats.activeEmployees, note: 'Current employee master', icon: Users, tone: 'blue', href: '/dashboard/employees' },
    { title: 'Pending Leaves', value: adminStats.pendingLeaves, note: 'Requests awaiting review', icon: CalendarDays, tone: 'orange', href: '/dashboard/leave-regularization' },
    { title: 'Pending Comp-offs', value: adminStats.pendingCompOffs, note: 'Requests awaiting review', icon: WalletCards, tone: 'green', href: '/dashboard/leave-regularization' },
  ]

  const cards: DashboardCard[] = isSuperAdmin ? adminCards : employeeCards

  return <div className="space-y-7">
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#14245b] to-[#1b74c4] p-7 text-white shadow-lg md:p-9"><div className="absolute -right-16 -top-20 h-64 w-64 rounded-full border-[55px] border-white/10"/><div className="relative"><p className="text-sm font-semibold text-blue-100">{isSuperAdmin ? 'Administration workspace' : 'Good to see you'}</p><h1 className="mt-1 text-3xl font-extrabold tracking-tight md:text-4xl">{isSuperAdmin ? 'Welcome, Super Admin' : `Welcome, ${session?.user?.name || session?.user?.id}`}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-blue-100">{isSuperAdmin ? 'Manage employee records and pending HR actions from one secure workspace.' : 'Here is your current attendance, leave and payroll overview in one place.'}</p></div></section>
    <div className="grid gap-5 md:grid-cols-3">{cards.map(({ title, value, note, icon: Icon, tone, href }) => { const card = <div key={title} className={`q-card q-card-hover p-5 ${href ? 'cursor-pointer' : ''}`}><div className="flex items-start justify-between"><div><p className="text-sm font-semibold text-slate-500">{title}</p><p className="mt-2 text-3xl font-extrabold tracking-tight text-[#14245b]">{value}</p></div><div className={`rounded-2xl p-3 ${tone === 'orange' ? 'bg-[#fff1ea] text-[#e55b27]' : tone === 'green' ? 'bg-emerald-50 text-emerald-600' : 'bg-[#eaf5ff] text-[#1677ca]'}`}><Icon className="h-5 w-5"/></div></div><p className="mt-4 text-xs font-medium text-slate-400">{note}</p>{href && <p className="mt-2 text-xs font-bold text-[#1677ca]">Open →</p>}</div>; return href ? <Link href={href} key={title}>{card}</Link> : card })}</div>
    <section className="grid gap-5 lg:grid-cols-2"><div className="q-card p-6"><h2 className="q-section-title">{isSuperAdmin ? 'Admin overview' : 'Quick overview'}</h2><p className="mt-2 text-sm text-slate-500">{isSuperAdmin ? 'Use HR Management to maintain employees and review pending leave and comp-off requests.' : 'Use the navigation to manage attendance, leaves, comp-offs and payslips.'}</p>{isSuperAdmin ? <div className="mt-5 rounded-2xl bg-slate-50 p-4"><p className="text-xs font-semibold text-slate-400">Attendance</p><p className="mt-1 text-sm font-semibold text-[#14245b]">Monitor hospital visits, travel status, working hours and latest employee locations.</p><a href="/dashboard/attendance-management" className="mt-3 inline-flex rounded-lg bg-[#eaf5ff] px-3 py-2 text-xs font-bold text-[#1264ac]">Open Attendance Management</a></div> : <div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-semibold text-slate-400">CL credited</p><p className="mt-1 text-xl font-bold text-[#14245b]">{leave.balance?.total ?? 0}</p></div><div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-semibold text-slate-400">Pending CL</p><p className="mt-1 text-xl font-bold text-[#14245b]">{leave.balance?.pendingDays ?? 0}</p></div></div>}</div><div className="q-card border-[#ffd9c9] bg-gradient-to-br from-white to-[#fff7f3] p-6"><h2 className="q-section-title">Quantzo HR Portal</h2><p className="mt-2 text-sm leading-6 text-slate-600">{isSuperAdmin ? 'Centralize employee records, approvals, payroll and attendance controls here.' : 'Your HR records are maintained centrally so attendance and approved leave can feed into monthly paid-day and salary calculations.'}</p><div className="mt-5 h-1 w-16 rounded-full bg-[#f15a24]"/></div></section>
  </div>
}
