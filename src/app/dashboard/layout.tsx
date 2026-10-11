"use client"

import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { useSession, signOut } from "next-auth/react"
import { redirect } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { CalendarDays, Clock3, Home, LogOut, Users, WalletCards, MapPinned, UserCircle, Banknote } from "lucide-react"

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
    { href: "/dashboard/payslips", label: "Payslips", icon: WalletCards },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null)
  useEffect(() => {
    if (session?.user?.active === false) signOut({ callbackUrl: '/' })
  }, [session?.user?.active])

  useEffect(() => {
    let cancelled = false
    if (!session?.user?.id) {
      setProfileImageUrl(null)
      return () => { cancelled = true }
    }

    const loadProfileImage = async () => {
      try {
        const response = await fetch('/api/profile', { cache: 'no-store' })
        if (!response.ok) return
        const data = await response.json()
        if (!cancelled) setProfileImageUrl(data?.employee?.profileImageUrl || null)
      } catch {
        if (!cancelled) setProfileImageUrl(null)
      }
    }

    loadProfileImage()
    return () => { cancelled = true }
  }, [session?.user?.id])
  if (status === "loading") return <div className="flex min-h-screen items-center justify-center bg-[#f6f9fd] text-slate-500">Loading Quantzo HR Portal...</div>
  if (!session) redirect("/")
  if (session.user.active === false) return <div className="flex min-h-screen items-center justify-center bg-[#f6f9fd] text-slate-500">Your portal access has been disabled. Signing out...</div>

  return (
    <div className="min-h-screen bg-[#f6f9fd] text-[#17213f]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[275px] border-r border-[#dbe5f0] bg-white lg:flex lg:flex-col">
        <div className="border-b border-[#e6edf5] px-6 py-5">
          <Image src="/quantzo-logo.png" alt="Quantzo Health Services" width={170} height={115} className="h-auto w-[170px]" priority />
          <div className="mt-4 rounded-2xl bg-[#f3f8ff] px-4 py-3"><p className="text-xs font-semibold uppercase tracking-wider text-[#1f86df]">Signed in as</p><p className="mt-1 truncate text-sm font-bold text-[#14245b]">{session.user.name || session.user.id}</p><p className="mt-0.5 truncate text-xs text-slate-500">{session.user.id}</p></div>
        </div>
        <nav className="flex-1 space-y-1 px-4 py-5">
          <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Workspace</p>
          {nav.map(({href,label,icon:Icon}) => {
            const active = pathname === href
            return <Link key={href} href={href} className={`flex min-h-11 items-center gap-3 rounded-xl px-3.5 text-sm font-semibold transition ${active ? "bg-[#eaf5ff] text-[#1169b4] shadow-sm" : "text-slate-600 hover:bg-slate-50 hover:text-[#14245b]"}`}><Icon className="h-[18px] w-[18px]"/>{label}</Link>
          })}
          {session.user.role !== "SUPER_ADMIN" && <Link href="/dashboard/profile" className={`flex min-h-11 items-center gap-3 rounded-xl px-3.5 text-sm font-semibold transition ${pathname === "/dashboard/profile" ? "bg-[#eaf5ff] text-[#1169b4]" : "text-slate-600 hover:bg-slate-50 hover:text-[#14245b]"}`}><UserCircle className="h-[18px] w-[18px]"/>My Profile</Link>}
          {session.user.role !== "SUPER_ADMIN" && <Link href="/dashboard/leave" className={`flex min-h-11 items-center gap-3 rounded-xl px-3.5 text-sm font-semibold transition ${pathname === "/dashboard/leave" ? "bg-[#eaf5ff] text-[#1169b4] shadow-sm" : "text-slate-600 hover:bg-slate-50 hover:text-[#14245b]"}`}><CalendarDays className="h-[18px] w-[18px]"/>Leaves & Comp-offs</Link>}
          {session.user.role !== "SUPER_ADMIN" && <Link href="/dashboard/attendance" className={`flex min-h-11 items-center gap-3 rounded-xl px-3.5 text-sm font-semibold transition ${pathname === "/dashboard/attendance" ? "bg-[#eaf5ff] text-[#1169b4] shadow-sm" : "text-slate-600 hover:bg-slate-50 hover:text-[#14245b]"}`}><Clock3 className="h-[18px] w-[18px]"/>Attendance</Link>}
          {session.user.role === "SUPER_ADMIN" && <>
            <Link href="/dashboard/attendance-regularization" className={`flex min-h-11 items-center gap-3 rounded-xl px-3.5 text-sm font-semibold transition ${pathname === "/dashboard/attendance-regularization" ? "bg-[#eaf5ff] text-[#1169b4]" : "text-slate-600 hover:bg-slate-50 hover:text-[#14245b]"}`}><Clock3 className="h-[18px] w-[18px]"/>Attendance Regularization</Link>
            <Link href="/dashboard/leave-regularization" className={`flex min-h-11 items-center gap-3 rounded-xl px-3.5 text-sm font-semibold transition ${pathname === "/dashboard/leave-regularization" ? "bg-[#eaf5ff] text-[#1169b4]" : "text-slate-600 hover:bg-slate-50 hover:text-[#14245b]"}`}><CalendarDays className="h-[18px] w-[18px]"/>Leave Regularization</Link>
            <p className="mt-7 px-3 pb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Administration</p>
            <Link href="/dashboard/attendance-management" className={`flex min-h-11 items-center gap-3 rounded-xl px-3.5 text-sm font-semibold transition ${pathname === "/dashboard/attendance-management" ? "bg-[#eaf5ff] text-[#1169b4]" : "text-slate-600 hover:bg-slate-50 hover:text-[#14245b]"}`}><MapPinned className="h-[18px] w-[18px]"/>Attendance Management</Link>
            <Link href="/dashboard/employees" className={`flex min-h-11 items-center gap-3 rounded-xl px-3.5 text-sm font-semibold transition ${pathname === "/dashboard/employees" ? "bg-[#eaf5ff] text-[#1169b4]" : "text-slate-600 hover:bg-slate-50 hover:text-[#14245b]"}`}><Users className="h-[18px] w-[18px]"/>Employee Management</Link>
            <Link href="/dashboard/payroll" className={`flex min-h-11 items-center gap-3 rounded-xl px-3.5 text-sm font-semibold transition ${pathname === "/dashboard/payroll" ? "bg-[#fff1ea] text-[#c94819]" : "text-slate-600 hover:bg-slate-50 hover:text-[#14245b]"}`}><Banknote className="h-[18px] w-[18px]"/>Payroll Processing</Link>
            <Link href="/dashboard/hr" className={`flex min-h-11 items-center gap-3 rounded-xl px-3.5 text-sm font-semibold transition ${pathname === "/dashboard/hr" ? "bg-[#fff1ea] text-[#c94819]" : "text-slate-600 hover:bg-slate-50 hover:text-[#14245b]"}`}><Users className="h-[18px] w-[18px]"/>HR Management</Link>
          </>}
        </nav>
        <div className="border-t border-[#e6edf5] p-4"><button onClick={() => signOut({callbackUrl:"/"})} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3.5 text-sm font-semibold text-red-600 hover:bg-red-50"><LogOut className="h-[18px] w-[18px]"/>Sign Out</button></div>
      </aside>

      <div className="lg:pl-[275px]">
        <header className="sticky top-0 z-20 border-b border-[#dbe5f0] bg-white/90 px-4 py-3 backdrop-blur md:px-8">
          <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#1f86df]">Quantzo Health Services</p><p className="text-sm font-bold text-[#14245b]">Human Resources Portal</p></div><div className="flex items-center gap-3"><div className="flex items-center gap-2 rounded-full bg-[#f3f8ff] px-2.5 py-1.5"><div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-[#dceeff] text-xs font-bold text-[#1677ca]">{profileImageUrl ? <img src={profileImageUrl} alt="Profile" className="h-full w-full object-cover" /> : (session.user.name || session.user.id).charAt(0).toUpperCase()}</div><span className="max-w-[150px] truncate text-xs font-bold text-[#14245b]">{session.user.name || session.user.id}</span></div><button onClick={() => signOut({callbackUrl:"/"})} className="inline-flex h-10 items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-3 text-xs font-bold text-red-600 hover:bg-red-100" aria-label="Sign out"><LogOut className="h-4 w-4"/><span className="hidden sm:inline">Sign Out</span></button></div></div>
        </header>
        <main className="mx-auto max-w-[1500px] p-4 md:p-8">{children}</main>
      </div>
    </div>
  )
}
