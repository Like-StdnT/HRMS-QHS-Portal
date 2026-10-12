"use client"

import { usePathname, useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { useSession, signOut } from "next-auth/react"
import Link from "next/link"
import Image from "next/image"
import {
  CalendarDays,
  Clock3,
  Home,
  LogOut,
  Users,
  WalletCards,
  MapPinned,
  UserCircle,
  Banknote,
  ChevronDown,
  ChevronUp,
  Menu,
  X,
} from "lucide-react"

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/dashboard/payslips", label: "Payslips", icon: WalletCards },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null)
  const [workspaceOpen, setWorkspaceOpen] = useState(true)
  const [adminOpen, setAdminOpen] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const navRef = useRef<HTMLElement>(null)
  const mobileNavRef = useRef<HTMLDivElement>(null)

  const slideNav = (direction: 'up' | 'down') => {
    if (navRef.current) {
      const scrollAmount = direction === 'up' ? -180 : 180
      navRef.current.scrollBy({ top: scrollAmount, behavior: 'smooth' })
    }
  }

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

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

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/")
    }
  }, [status, router])

  if (status === "loading" || !session) {
    return <div className="flex min-h-screen items-center justify-center bg-[#f6f9fd] text-slate-500">Loading Quantzo HR Portal...</div>
  }
  if (session.user.active === false) return <div className="flex min-h-screen items-center justify-center bg-[#f6f9fd] text-slate-500">Your portal access has been disabled. Signing out...</div>

  return (
    <div className="min-h-screen bg-[#f6f9fd] text-[#17213f]">
      {/* Desktop Sidebar with slidable & scrollable Workspace navigation */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[275px] border-r border-[#dbe5f0] bg-white lg:flex lg:flex-col">
        <div className="border-b border-[#e6edf5] px-6 py-5">
          <Image src="/quantzo-logo.png" alt="Quantzo Health Services" width={170} height={115} className="h-auto w-[170px]" priority />
          <div className="mt-4 rounded-2xl bg-[#f3f8ff] px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#1f86df]">Signed in as</p>
            <p className="mt-1 truncate text-sm font-bold text-[#14245b]">{session.user.name || session.user.id}</p>
            <p className="mt-0.5 truncate text-xs text-slate-500">{session.user.id}</p>
          </div>
        </div>

        {/* Slidable Navigation Container */}
        <nav
          ref={navRef}
          className="flex-1 space-y-3 px-3 py-4 overflow-y-auto overflow-x-hidden scroll-smooth custom-scrollbar select-none"
        >
          {/* Quick Slide Control Buttons */}
          <div className="flex items-center justify-between px-2 pb-1.5 border-b border-slate-100">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Navigation</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => slideNav('up')}
                title="Slide navigation up"
                className="rounded-md p-1 text-slate-400 hover:bg-[#eaf5ff] hover:text-[#1677ca] transition"
                aria-label="Slide upwards"
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => slideNav('down')}
                title="Slide navigation down"
                className="rounded-md p-1 text-slate-400 hover:bg-[#eaf5ff] hover:text-[#1677ca] transition"
                aria-label="Slide downwards"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Slidable Workspace Section */}
          <div>
            <button
              type="button"
              onClick={() => setWorkspaceOpen(prev => !prev)}
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition"
              aria-label="Toggle Workspace menu"
            >
              <span>Workspace</span>
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform duration-300 ${workspaceOpen ? 'rotate-0' : '-rotate-90'}`}
              />
            </button>

            <div
              className={`mt-1 space-y-1 transition-all duration-300 ease-in-out overflow-hidden ${
                workspaceOpen ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'
              }`}
            >
              {nav.map(({ href, label, icon: Icon }) => {
                const active = pathname === href
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition ${
                      active
                        ? "bg-[#eaf5ff] text-[#1169b4] shadow-sm"
                        : "text-slate-600 hover:bg-slate-50 hover:text-[#14245b]"
                    }`}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                    {label}
                  </Link>
                )
              })}

              {session.user.role !== "SUPER_ADMIN" && (
                <>
                  <Link
                    href="/dashboard/profile"
                    className={`flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition ${
                      pathname === "/dashboard/profile"
                        ? "bg-[#eaf5ff] text-[#1169b4]"
                        : "text-slate-600 hover:bg-slate-50 hover:text-[#14245b]"
                    }`}
                  >
                    <UserCircle className="h-[18px] w-[18px]" />
                    My Profile
                  </Link>
                  <Link
                    href="/dashboard/leave"
                    className={`flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition ${
                      pathname === "/dashboard/leave"
                        ? "bg-[#eaf5ff] text-[#1169b4] shadow-sm"
                        : "text-slate-600 hover:bg-slate-50 hover:text-[#14245b]"
                    }`}
                  >
                    <CalendarDays className="h-[18px] w-[18px]" />
                    Leaves & Comp-offs
                  </Link>
                  <Link
                    href="/dashboard/attendance"
                    className={`flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition ${
                      pathname === "/dashboard/attendance"
                        ? "bg-[#eaf5ff] text-[#1169b4] shadow-sm"
                        : "text-slate-600 hover:bg-slate-50 hover:text-[#14245b]"
                    }`}
                  >
                    <Clock3 className="h-[18px] w-[18px]" />
                    Attendance
                  </Link>
                </>
              )}

              {session.user.role === "SUPER_ADMIN" && (
                <>
                  <Link
                    href="/dashboard/attendance-regularization"
                    className={`flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition ${
                      pathname === "/dashboard/attendance-regularization"
                        ? "bg-[#eaf5ff] text-[#1169b4]"
                        : "text-slate-600 hover:bg-slate-50 hover:text-[#14245b]"
                    }`}
                  >
                    <Clock3 className="h-[18px] w-[18px]" />
                    Attendance Regularization
                  </Link>
                  <Link
                    href="/dashboard/leave-regularization"
                    className={`flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition ${
                      pathname === "/dashboard/leave-regularization"
                        ? "bg-[#eaf5ff] text-[#1169b4]"
                        : "text-slate-600 hover:bg-slate-50 hover:text-[#14245b]"
                    }`}
                  >
                    <CalendarDays className="h-[18px] w-[18px]" />
                    Leave Regularization
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Slidable Administration Section */}
          {session.user.role === "SUPER_ADMIN" && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setAdminOpen(prev => !prev)}
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition"
                aria-label="Toggle Administration menu"
              >
                <span>Administration</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform duration-300 ${adminOpen ? 'rotate-0' : '-rotate-90'}`}
                />
              </button>

              <div
                className={`mt-1 space-y-1 transition-all duration-300 ease-in-out overflow-hidden ${
                  adminOpen ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'
                }`}
              >
                <Link
                  href="/dashboard/attendance-management"
                  className={`flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition ${
                    pathname === "/dashboard/attendance-management"
                      ? "bg-[#eaf5ff] text-[#1169b4]"
                      : "text-slate-600 hover:bg-slate-50 hover:text-[#14245b]"
                  }`}
                >
                  <MapPinned className="h-[18px] w-[18px]" />
                  Attendance Management
                </Link>
                <Link
                  href="/dashboard/employees"
                  className={`flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition ${
                    pathname === "/dashboard/employees"
                      ? "bg-[#eaf5ff] text-[#1169b4]"
                      : "text-slate-600 hover:bg-slate-50 hover:text-[#14245b]"
                  }`}
                >
                  <Users className="h-[18px] w-[18px]" />
                  Employee Management
                </Link>
                <Link
                  href="/dashboard/payroll"
                  className={`flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition ${
                    pathname === "/dashboard/payroll"
                      ? "bg-[#fff1ea] text-[#c94819]"
                      : "text-slate-600 hover:bg-slate-50 hover:text-[#14245b]"
                  }`}
                >
                  <Banknote className="h-[18px] w-[18px]" />
                  Payroll Processing
                </Link>
                <Link
                  href="/dashboard/hr"
                  className={`flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition ${
                    pathname === "/dashboard/hr"
                      ? "bg-[#fff1ea] text-[#c94819]"
                      : "text-slate-600 hover:bg-slate-50 hover:text-[#14245b]"
                  }`}
                >
                  <Users className="h-[18px] w-[18px]" />
                  HR Management
                </Link>
              </div>
            </div>
          )}
        </nav>

        <div className="border-t border-[#e6edf5] p-4">
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="flex min-h-10 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-red-600 hover:bg-red-50 transition"
          >
            <LogOut className="h-[18px] w-[18px]" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="lg:pl-[275px]">
        <header className="sticky top-0 z-20 border-b border-[#dbe5f0] bg-white/90 px-4 py-3 backdrop-blur md:px-8">
          <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {/* Mobile menu toggle */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(prev => !prev)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 lg:hidden"
                aria-label="Toggle mobile workspace menu"
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#1f86df]">Quantzo Health Services</p>
                <p className="text-sm font-bold text-[#14245b]">Human Resources Portal</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-full bg-[#f3f8ff] px-2.5 py-1.5">
                <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-[#dceeff] text-xs font-bold text-[#1677ca]">
                  {profileImageUrl ? (
                    <img src={profileImageUrl} alt="Profile" className="h-full w-full object-cover" />
                  ) : (
                    (session.user.name || session.user.id).charAt(0).toUpperCase()
                  )}
                </div>
                <span className="max-w-[150px] truncate text-xs font-bold text-[#14245b]">
                  {session.user.name || session.user.id}
                </span>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-3 text-xs font-bold text-red-600 hover:bg-red-100 transition"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          </div>
        </header>

        {/* Mobile Slidable Bottom Sheet / Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden" onClick={() => setMobileMenuOpen(false)}>
            <div
              ref={mobileNavRef}
              onClick={e => e.stopPropagation()}
              className="absolute inset-x-0 bottom-0 max-h-[85vh] rounded-t-3xl border-t border-slate-200 bg-white p-5 shadow-2xl flex flex-col animate-in slide-in-from-bottom duration-300"
            >
              {/* Slidable Drag Handle */}
              <div className="mx-auto -mt-1 mb-4 h-1.5 w-12 rounded-full bg-slate-300 cursor-pointer" onClick={() => setMobileMenuOpen(false)} />
              
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-[#1f86df]">Workspace Navigation</p>
                  <p className="text-sm font-bold text-[#14245b]">{session.user.name || session.user.id}</p>
                </div>
                <button onClick={() => setMobileMenuOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-3 space-y-1 custom-scrollbar">
                <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Workspace</p>
                {nav.map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition ${
                      pathname === href ? "bg-[#eaf5ff] text-[#1169b4]" : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {label}
                  </Link>
                ))}

                {session.user.role !== "SUPER_ADMIN" && (
                  <>
                    <Link
                      href="/dashboard/profile"
                      className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition ${
                        pathname === "/dashboard/profile" ? "bg-[#eaf5ff] text-[#1169b4]" : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <UserCircle className="h-5 w-5" />
                      My Profile
                    </Link>
                    <Link
                      href="/dashboard/leave"
                      className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition ${
                        pathname === "/dashboard/leave" ? "bg-[#eaf5ff] text-[#1169b4]" : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <CalendarDays className="h-5 w-5" />
                      Leaves & Comp-offs
                    </Link>
                    <Link
                      href="/dashboard/attendance"
                      className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition ${
                        pathname === "/dashboard/attendance" ? "bg-[#eaf5ff] text-[#1169b4]" : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <Clock3 className="h-5 w-5" />
                      Attendance
                    </Link>
                  </>
                )}

                {session.user.role === "SUPER_ADMIN" && (
                  <>
                    <Link
                      href="/dashboard/attendance-regularization"
                      className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition ${
                        pathname === "/dashboard/attendance-regularization" ? "bg-[#eaf5ff] text-[#1169b4]" : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <Clock3 className="h-5 w-5" />
                      Attendance Regularization
                    </Link>
                    <Link
                      href="/dashboard/leave-regularization"
                      className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition ${
                        pathname === "/dashboard/leave-regularization" ? "bg-[#eaf5ff] text-[#1169b4]" : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <CalendarDays className="h-5 w-5" />
                      Leave Regularization
                    </Link>
                    <p className="mt-4 px-3 pb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Administration</p>
                    <Link
                      href="/dashboard/attendance-management"
                      className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition ${
                        pathname === "/dashboard/attendance-management" ? "bg-[#eaf5ff] text-[#1169b4]" : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <MapPinned className="h-5 w-5" />
                      Attendance Management
                    </Link>
                    <Link
                      href="/dashboard/employees"
                      className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition ${
                        pathname === "/dashboard/employees" ? "bg-[#eaf5ff] text-[#1169b4]" : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <Users className="h-5 w-5" />
                      Employee Management
                    </Link>
                    <Link
                      href="/dashboard/payroll"
                      className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition ${
                        pathname === "/dashboard/payroll" ? "bg-[#fff1ea] text-[#c94819]" : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <Banknote className="h-5 w-5" />
                      Payroll Processing
                    </Link>
                    <Link
                      href="/dashboard/hr"
                      className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition ${
                        pathname === "/dashboard/hr" ? "bg-[#fff1ea] text-[#c94819]" : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <Users className="h-5 w-5" />
                      HR Management
                    </Link>
                  </>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100">
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="flex min-h-11 w-full items-center justify-center gap-3 rounded-xl bg-red-50 text-sm font-bold text-red-600 hover:bg-red-100"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        )}

        <main className="mx-auto max-w-[1500px] p-4 md:p-8">{children}</main>
      </div>
    </div>
  )
}
