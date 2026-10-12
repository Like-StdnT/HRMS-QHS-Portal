"use client"

import { useState } from "react"
import Image from "next/image"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { ArrowRight, CalendarDays, Eye, EyeOff, LockKeyhole, ShieldCheck, Users, WalletCards } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const [employeeId, setEmployeeId] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError("")
    const res = await signIn("credentials", { employeeId: employeeId.trim(), password, redirect: false, callbackUrl: "/dashboard" })
    if (res?.error) {
      if (res.error === "Configuration") {
        setError("Configuration error: NEXTAUTH_SECRET is missing or invalid in deployment environment variables.")
      } else if (res.error === "CredentialsSignin") {
        setError("Invalid Employee ID or Password")
      } else {
        setError(`Login failed (${res.error}). Please check server logs and database connection.`)
      }
      setLoading(false)
      return
    }
    // Force a fresh navigation so the newly-created NextAuth session cookie is
    // available to the dashboard on the very first login attempt.
    window.location.assign(res?.url || "/dashboard")
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#f5f9ff]">
      <div className="relative mx-auto flex min-h-screen max-w-[1550px] items-stretch p-3 md:p-5 lg:p-7">
        <div className="absolute -left-24 -top-28 h-72 w-72 rounded-full bg-[#dcefff] blur-2xl" />
        <div className="absolute -right-24 -top-20 h-80 w-80 rounded-full bg-[#ffe3d6] blur-2xl" />
        <div className="absolute bottom-0 left-1/3 h-52 w-52 rounded-full bg-[#e6f5ff] blur-3xl" />

        <section className="relative hidden w-[49%] overflow-hidden rounded-[30px] bg-gradient-to-br from-[#11245d] via-[#183b84] to-[#167bd5] p-10 text-white lg:flex lg:flex-col">
          <div className="absolute -right-20 top-24 h-72 w-72 rounded-full border-[70px] border-white/10" />
          <div className="absolute -bottom-24 -left-20 h-80 w-80 rounded-full border-[80px] border-[#f15a24]/20" />
          <div className="relative z-10 flex items-center gap-4">
            <Image src="/quantzo-logo.png" alt="Quantzo Health Services" width={190} height={130} className="h-auto w-[190px] rounded-xl bg-white/95 p-2" priority />
          </div>
          <div className="relative z-10 mt-auto max-w-xl pb-4">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.35em] text-blue-100">People · Process · Progress</p>
            <h1 className="text-6xl font-extrabold leading-[1.02] tracking-tight">Quantzo<br/><span className="text-[#ff9a6d]">HR Portal</span></h1>
            <p className="mt-6 max-w-lg text-lg leading-8 text-blue-50">One secure workspace for employee records, leave, attendance, payroll and payslips.</p>
            <div className="mt-9 grid grid-cols-2 gap-3">
              {[[Users,"Employee Management"],[CalendarDays,"Leave & Attendance"],[WalletCards,"Payroll & Payslips"],[ShieldCheck,"Secure HR Records"]].map(([Icon,label]: any) => (
                <div key={label} className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
                  <Icon className="mb-3 h-5 w-5 text-[#ffad86]"/><p className="text-sm font-semibold text-white/95">{label}</p>
                </div>
              ))}
            </div>
            <div className="mt-10 h-1 w-20 rounded-full bg-[#f15a24]" />
            <p className="mt-4 text-sm text-blue-100">Better People. Stronger Healthcare.</p>
          </div>
        </section>

        <section className="relative flex flex-1 items-center justify-center px-2 py-8 lg:px-10">
          <div className="w-full max-w-[560px]">
            <div className="mb-5 flex items-center justify-between lg:hidden">
              <Image src="/quantzo-logo.png" alt="Quantzo Health Services" width={155} height={105} className="h-auto w-[155px]" />
            </div>
            <div className="q-card overflow-hidden rounded-[28px]">
              <div className="h-2 bg-gradient-to-r from-[#f15a24] via-[#ff8b55] to-[#1684dc]" />
              <div className="p-7 sm:p-10">
                <div className="mb-8">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#1f86df]">Quantzo Health Services</p>
                  <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-[#14245b] sm:text-4xl">Sign in</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">Sign in to access your HR portal.</p>
                </div>
                <form onSubmit={handleLogin} className="space-y-5">
                  <div>
                    <label htmlFor="employeeId" className="q-label">Employee ID / Email</label>
                    <input id="employeeId" name="quantzo-login-id" autoComplete="off" spellCheck={false} className="q-input" placeholder="Enter your employee ID or email" value={employeeId} onChange={e => setEmployeeId(e.target.value)} required />
                  </div>
                  <div>
                    <label htmlFor="password" className="q-label">Password</label>
                    <div className="relative">
                      <LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input id="password" name="quantzo-login-password" autoComplete="new-password" className="q-input pl-10 pr-11" type={showPassword ? "text" : "password"} placeholder="Enter your password" value={password} onChange={e => setPassword(e.target.value)} required />
                      <button type="button" aria-label="Show password" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">{showPassword ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}</button>
                    </div>
                  </div>
                  {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}
                  <button className="q-btn-primary w-full" type="submit" disabled={loading}>{loading ? "Signing in..." : <>Sign In <ArrowRight className="h-4 w-4"/></>}</button>
                </form>
                <div className="mt-8 flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#1f86df]"/>
                  <div><p className="text-sm font-semibold text-[#14245b]">Secure employee access</p><p className="mt-1 text-xs leading-5 text-slate-500">For authorised Quantzo Health Services users only. HR controls employee and payroll records.</p></div>
                </div>
              </div>
            </div>
            <p className="mt-5 text-center text-xs text-slate-400">© {new Date().getFullYear()} Quantzo Health Services · HR Portal</p>
          </div>
        </section>
      </div>
    </main>
  )
}
