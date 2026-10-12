"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Download,
  FileCheck2,
  Filter,
  IndianRupee,
  RefreshCcw,
  Save,
  Search,
  Send,
  Sparkles,
  Users,
  WalletCards,
  AlertCircle
} from "lucide-react"

function num(v: any) {
  return v === "" || v == null ? 0 : Number(v)
}

function money(v: any) {
  return `₹${Number(v || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export default function PayrollPage() {
  const now = new Date()
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`)
  const [calendarDays, setCalendarDays] = useState(0)
  const [sundays, setSundays] = useState(4)
  const [standardWorkingDays, setStandardWorkingDays] = useState(26)
  const [employees, setEmployees] = useState<any[]>([])
  const [rows, setRows] = useState<Record<string, any>>({})
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null)
  const [loading, setLoading] = useState(false)
  const [batchSaving, setBatchSaving] = useState(false)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PUBLISHED" | "DRAFT" | "UNSAVED">("ALL")

  const load = useCallback(async () => {
    setLoading(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/hr/payroll?month=${month}`, { cache: "no-store" })
      const data = await res.json()
      if (!res.ok) {
        setMessage({ text: data.error || "Unable to load payroll.", type: "error" })
        setLoading(false)
        return
      }

      setCalendarDays(data.calendarDays || 30)
      setSundays(data.sundays || 4)
      setStandardWorkingDays(data.standardWorkingDays || 26)
      setEmployees(data.employees || [])

      const next: Record<string, any> = {}
      for (const e of data.employees || []) {
        const p = e.payslips?.[0]
        const sys = e.systemMetrics || {}

        next[e.id] = {
          monthlySalary: p ? p.monthlySalary : (e.monthlySalary ?? 0),
          workingDays: p?.workingDays != null ? p.workingDays : (sys.workingDays ?? data.standardWorkingDays ?? 26),
          weeklyOffs: p?.weeklyOffs != null ? p.weeklyOffs : (sys.weeklyOffs ?? data.sundays ?? 4),
          casualLeave: p?.casualLeave != null ? p.casualLeave : (sys.casualLeave ?? 0),
          compOffGranted: p?.compOffGranted != null ? p.compOffGranted : (sys.compOffGranted ?? 0),
          compOffUsed: p?.compOffUsed != null ? p.compOffUsed : (sys.compOffUsed ?? 0),
          lwp: p?.lwp != null ? p.lwp : (sys.lwp ?? 0),
          ghHolidayLeave: p?.ghHolidayLeave != null ? p.ghHolidayLeave : 0,
          pendingCasualLeave: p?.pendingCasualLeave != null ? p.pendingCasualLeave : (sys.pendingCasualLeave ?? 0),
          extraWorkingDaySunday: p?.extraWorkingDaySunday != null ? p.extraWorkingDaySunday : (sys.extraWorkingDaySunday ?? 0),
          otherEarnings: p?.otherEarnings != null ? p.otherEarnings : 0,
          pf: p?.pf != null ? p.pf : 0,
          esi: p?.esi != null ? p.esi : 0,
          tds: p?.tds != null ? p.tds : (p?.incomeTax != null ? p.incomeTax : (sys.suggestedTds ?? 0)),
          otherDeductions: p?.otherDeductions != null ? p.otherDeductions : 0,
          workingHours: p?.workingHours != null ? p.workingHours : (sys.workingHours ?? 0),
          hrRemarks: p?.hrRemarks ?? "",
          published: p?.published ?? false,
          hasDraft: Boolean(p),
          id: p?.id,
        }
      }
      setRows(next)
    } catch {
      setMessage({ text: "Network error loading payroll.", type: "error" })
    } finally {
      setLoading(false)
    }
  }, [month])

  useEffect(() => {
    load()
  }, [load])

  const update = (id: string, key: string, value: any) => {
    setRows(prev => ({
      ...prev,
      [id]: { ...prev[id], [key]: value },
    }))
  }

  const syncSingleFromSystem = (emp: any) => {
    const sys = emp.systemMetrics || {}
    setRows(prev => ({
      ...prev,
      [emp.id]: {
        ...prev[emp.id],
        workingDays: sys.workingDays ?? standardWorkingDays,
        weeklyOffs: sys.weeklyOffs ?? sundays,
        casualLeave: sys.casualLeave ?? 0,
        lwp: sys.lwp ?? 0,
        compOffUsed: sys.compOffUsed ?? 0,
        compOffGranted: sys.compOffGranted ?? 0,
        pendingCasualLeave: sys.pendingCasualLeave ?? 0,
        extraWorkingDaySunday: sys.extraWorkingDaySunday ?? 0,
        workingHours: sys.workingHours ?? 0,
        tds: sys.suggestedTds ?? prev[emp.id]?.tds ?? 0,
      },
    }))
    setMessage({
      text: `Synced attendance and leave inputs for ${emp.name} (${emp.id}).`,
      type: "info",
    })
  }

  const syncAllFromSystem = () => {
    let count = 0
    setRows(prev => {
      const next = { ...prev }
      for (const emp of employees) {
        const sys = emp.systemMetrics || {}
        next[emp.id] = {
          ...next[emp.id],
          workingDays: sys.workingDays ?? standardWorkingDays,
          weeklyOffs: sys.weeklyOffs ?? sundays,
          casualLeave: sys.casualLeave ?? 0,
          lwp: sys.lwp ?? 0,
          compOffUsed: sys.compOffUsed ?? 0,
          compOffGranted: sys.compOffGranted ?? 0,
          pendingCasualLeave: sys.pendingCasualLeave ?? 0,
          extraWorkingDaySunday: sys.extraWorkingDaySunday ?? 0,
          workingHours: sys.workingHours ?? 0,
          tds: sys.suggestedTds ?? next[emp.id]?.tds ?? 0,
        }
        count++
      }
      return next
    })
    setMessage({
      text: `Auto-calculated attendance, weekly offs, leaves and New-Regime TDS for all ${count} employees.`,
      type: "success",
    })
  }

  const calc = useCallback((r: any) => {
    const salary = num(r?.monthlySalary)
    const days = calendarDays || 30
    const per = salary / days
    const workingDays = num(r?.workingDays)
    const weeklyOffs = num(r?.weeklyOffs)
    const casualLeave = num(r?.casualLeave)
    const compOffUsed = num(r?.compOffUsed)
    const ghHolidayLeave = num(r?.ghHolidayLeave)
    const lwp = num(r?.lwp)

    const rawPaid = workingDays + weeklyOffs + casualLeave + compOffUsed + ghHolidayLeave - lwp
    const paid = Math.max(0, Math.min(days, Number(rawPaid.toFixed(2))))
    const earned = Number((per * paid).toFixed(2))
    const deductions = Number((num(r?.pf) + num(r?.esi) + num(r?.tds) + num(r?.otherDeductions)).toFixed(2))
    const gross = Number((earned + num(r?.otherEarnings)).toFixed(2))
    const net = Math.max(0, Number((gross - deductions).toFixed(2)))

    return { per, paid, earned, deductions, gross, net }
  }, [calendarDays])

  const saveOne = async (id: string, publish: boolean) => {
    const r = rows[id]
    setMessage(null)
    try {
      const res = await fetch("/api/hr/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...r,
          employeeId: id,
          month,
          publish,
          calendarDays,
        }),
      })
      const d = await res.json()
      if (res.ok) {
        setMessage({
          text: `${id}: payroll ${publish ? "published" : "draft saved"} successfully.`,
          type: "success",
        })
        await load()
      } else {
        setMessage({ text: d.error || "Unable to save payroll.", type: "error" })
      }
    } catch {
      setMessage({ text: "Network error saving payroll.", type: "error" })
    }
  }

  const saveAll = async (publish: boolean) => {
    setBatchSaving(true)
    setMessage(null)
    try {
      const records = employees.map(e => ({
        ...rows[e.id],
        employeeId: e.id,
        calendarDays,
      }))

      const res = await fetch("/api/hr/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batch: true,
          month,
          publish,
          records,
        }),
      })
      const d = await res.json()
      if (res.ok) {
        setMessage({
          text: `Successfully ${publish ? "published" : "saved drafts for"} ${d.count} employees!`,
          type: "success",
        })
        await load()
      } else {
        setMessage({ text: d.error || "Unable to process batch payroll.", type: "error" })
      }
    } catch {
      setMessage({ text: "Network error saving batch payroll.", type: "error" })
    } finally {
      setBatchSaving(false)
    }
  }

  const exportBank = () => {
    const headers = [
      "Employee ID",
      "Employee Name",
      "Department",
      "Designation",
      "Account Holder Name",
      "Account Number",
      "IFSC Code",
      "Monthly Gross Salary",
      "Calendar Days",
      "Paid Days",
      "Earned Salary",
      "Other Earnings",
      "PF",
      "ESI",
      "TDS",
      "Other Deductions",
      "Total Deductions",
      "Net Payable Salary",
      "Status",
    ]
    const lines = [headers.join(",")]

    employees.forEach(e => {
      const r = rows[e.id] || {}
      const c = calc(r)
      const values = [
        e.id,
        e.name,
        e.department || "",
        e.designation || "",
        e.bankAccountName || e.name,
        e.bankAccountNumber || "",
        e.bankIfsc || "",
        num(r.monthlySalary).toFixed(2),
        calendarDays,
        c.paid.toFixed(2),
        c.earned.toFixed(2),
        num(r.otherEarnings).toFixed(2),
        num(r.pf).toFixed(2),
        num(r.esi).toFixed(2),
        num(r.tds).toFixed(2),
        num(r.otherDeductions).toFixed(2),
        c.deductions.toFixed(2),
        c.net.toFixed(2),
        r.published ? "Published" : r.hasDraft ? "Draft" : "Unsaved",
      ]
      lines.push(values.map(v => `"${String(v).replaceAll('"', '""')}"`).join(","))
    })

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `Quantzo_Payroll_${month}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const totals = useMemo(() => {
    return employees.reduce(
      (acc, e) => {
        const r = rows[e.id] || {}
        const c = calc(r)
        acc.grossEarned += c.earned
        acc.deductions += c.deductions
        acc.netPayable += c.net
        if (r.published) acc.publishedCount++
        else if (r.hasDraft) acc.draftCount++
        else acc.unsavedCount++
        return acc
      },
      { grossEarned: 0, deductions: 0, netPayable: 0, publishedCount: 0, draftCount: 0, unsavedCount: 0 }
    )
  }, [employees, rows, calc])

  const filteredEmployees = useMemo(() => {
    return employees.filter(e => {
      const q = search.trim().toLowerCase()
      const matchSearch =
        !q ||
        e.name.toLowerCase().includes(q) ||
        e.id.toLowerCase().includes(q) ||
        (e.department && e.department.toLowerCase().includes(q))

      if (!matchSearch) return false

      const r = rows[e.id] || {}
      if (statusFilter === "PUBLISHED") return r.published
      if (statusFilter === "DRAFT") return r.hasDraft && !r.published
      if (statusFilter === "UNSAVED") return !r.hasDraft
      return true
    })
  }, [employees, search, statusFilter, rows])

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1f86df]">Super Admin · Finance</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[#14245b]">Payroll Processing</h1>
          <p className="mt-1 text-sm text-slate-500">
            Automated calendar & attendance synchronization with Quantzo Excel-compatible formula logic.
          </p>
        </div>

        {/* Global Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 shadow-sm">
            <CalendarDays className="h-4 w-4 text-[#1f86df]" />
            <input
              type="month"
              value={month}
              onChange={e => setMonth(e.target.value)}
              className="border-none bg-transparent text-sm font-semibold text-[#14245b] focus:outline-none"
            />
          </div>

          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-1.5 bg-white shadow-sm">
            <RefreshCcw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Button
            size="sm"
            onClick={syncAllFromSystem}
            variant="outline"
            className="gap-1.5 border-blue-200 bg-blue-50/70 text-[#1264ac] hover:bg-blue-100 shadow-sm"
          >
            <Sparkles className="h-3.5 w-3.5 text-[#f15a24]" />
            Auto-Sync Attendance
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => saveAll(false)}
            disabled={batchSaving || loading || employees.length === 0}
            className="gap-1.5 bg-white shadow-sm"
          >
            <Save className="h-3.5 w-3.5" />
            Save All Drafts
          </Button>

          <Button
            size="sm"
            onClick={() => saveAll(true)}
            disabled={batchSaving || loading || employees.length === 0}
            className="gap-1.5 bg-[#1678d2] hover:bg-[#126bbd] text-white shadow-sm"
          >
            <Send className="h-3.5 w-3.5" />
            Publish All
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={exportBank}
            disabled={employees.length === 0}
            className="gap-1.5 border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 shadow-sm"
          >
            <Download className="h-3.5 w-3.5 text-emerald-600" />
            Export Bank CSV
          </Button>
        </div>
      </div>

      {/* Alert Banner */}
      {message && (
        <div
          className={`flex items-center gap-3 rounded-2xl border p-4 text-sm shadow-sm transition-all ${
            message.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : message.type === "error"
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-blue-200 bg-blue-50 text-blue-800"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
          ) : message.type === "error" ? (
            <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
          ) : (
            <Sparkles className="h-5 w-5 shrink-0 text-blue-600" />
          )}
          <span className="font-medium">{message.text}</span>
        </div>
      )}

      {/* KPI Overview Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Staff Overview</span>
              <Users className="h-4 w-4 text-[#1f86df]" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-[#14245b]">{employees.length}</span>
              <span className="text-xs text-slate-500">Employees</span>
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
              <span>{totals.publishedCount} Published</span>
              <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
              <span>{totals.draftCount} Drafts</span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Calendar Baseline</span>
              <CalendarDays className="h-4 w-4 text-[#f15a24]" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-[#14245b]">{calendarDays}</span>
              <span className="text-xs text-slate-500">Days ({sundays} Sundays)</span>
            </div>
            <p className="mt-2 text-xs text-slate-500">Standard working base: {standardWorkingDays} days</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Deductions</span>
              <WalletCards className="h-4 w-4 text-rose-500" />
            </div>
            <div className="mt-2 text-2xl font-black text-rose-600">{money(totals.deductions)}</div>
            <p className="mt-2 text-xs text-slate-500">PF, ESI, TDS & advances</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-blue-200 bg-gradient-to-br from-[#1264ac] to-[#0c447a] text-white shadow-md">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-200">Net Payable Total</span>
              <IndianRupee className="h-4 w-4 text-[#ff9a6d]" />
            </div>
            <div className="mt-2 text-2xl font-black tracking-tight text-white">{money(totals.netPayable)}</div>
            <p className="mt-2 text-xs text-blue-100/80">Earned: {money(totals.grossEarned)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Payroll Management Card */}
      <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <CardHeader className="border-b border-slate-100 pb-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-xl font-bold text-[#14245b]">Employee Payroll Master</CardTitle>
              <CardDescription className="mt-1 text-xs text-slate-500">
                Formula: Per Day = Gross ÷ {calendarDays || 30} days · Paid Days = Working Days + Weekly Offs + CL + Comp-Off Used + GH − LWP (capped at {calendarDays || 30} days).
              </CardDescription>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Search employee or dept..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="h-9 w-52 pl-8 text-xs bg-slate-50/70"
                />
              </div>

              <div className="flex items-center rounded-lg border border-slate-200 p-0.5 text-xs bg-slate-50/70">
                {(["ALL", "PUBLISHED", "DRAFT", "UNSAVED"] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setStatusFilter(tab)}
                    className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                      statusFilter === tab
                        ? "bg-white font-bold text-[#14245b] shadow-sm"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {tab === "ALL" ? "All" : tab === "PUBLISHED" ? "Published" : tab === "DRAFT" ? "Drafts" : "Unsaved"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          <div className="space-y-6">
            {filteredEmployees.map(e => {
              const r = rows[e.id] || {}
              const c = calc(r)
              const sys = e.systemMetrics || {}

              return (
                <div
                  key={e.id}
                  className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm transition-all hover:border-blue-300 hover:shadow-md"
                >
                  {/* Employee Row Header */}
                  <div className="flex flex-col gap-3 pb-4 border-b border-slate-100 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className="text-base font-bold text-[#14245b]">{e.name}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                          {e.id}
                        </span>
                        {r.published ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                            Published
                          </span>
                        ) : r.hasDraft ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                            <FileCheck2 className="h-3 w-3 text-amber-600" />
                            Draft Saved
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                            Unsaved
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {e.department || "No Department"} · {e.designation || "No Designation"} · Joined:{" "}
                        {e.dateOfJoining ? new Date(e.dateOfJoining).toLocaleDateString("en-IN") : "N/A"}
                      </p>
                    </div>

                    <div className="flex items-center gap-4">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => syncSingleFromSystem(e)}
                        className="h-8 gap-1 text-xs text-[#1264ac] hover:bg-blue-50"
                        title="Pull recorded punches, leaves and tax baseline for this employee"
                      >
                        <Sparkles className="h-3.5 w-3.5 text-[#f15a24]" />
                        Sync Data
                      </Button>

                      <div className="text-right">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Net Pay</span>
                        <p className="text-xl font-extrabold text-[#1169b4]">{money(c.net)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Section 1: Working Days & Leaves Inputs */}
                  <div className="mt-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                      1. Attendance, Days & Leave Adjustments
                    </p>
                    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8">
                      <div>
                        <Label className="text-[11px] font-medium text-slate-600">Monthly Gross</Label>
                        <Input
                          className="mt-1 h-8 text-xs font-semibold"
                          type="number"
                          min="0"
                          step="0.01"
                          value={r.monthlySalary ?? 0}
                          onChange={ev => update(e.id, "monthlySalary", ev.target.value)}
                        />
                      </div>

                      <div>
                        <Label className="text-[11px] font-medium text-slate-600">
                          Working Days
                          {sys.attendedDays > 0 && (
                            <span className="text-[10px] text-blue-600 ml-1">({sys.attendedDays} logged)</span>
                          )}
                        </Label>
                        <Input
                          className="mt-1 h-8 text-xs"
                          type="number"
                          min="0"
                          step="0.5"
                          value={r.workingDays ?? 0}
                          onChange={ev => update(e.id, "workingDays", ev.target.value)}
                        />
                      </div>

                      <div>
                        <Label className="text-[11px] font-medium text-slate-600">Weekly Offs</Label>
                        <Input
                          className="mt-1 h-8 text-xs"
                          type="number"
                          min="0"
                          step="1"
                          value={r.weeklyOffs ?? 0}
                          onChange={ev => update(e.id, "weeklyOffs", ev.target.value)}
                        />
                      </div>

                      <div>
                        <Label className="text-[11px] font-medium text-slate-600">
                          Casual Leave
                          {sys.casualLeave > 0 && (
                            <span className="text-[10px] text-blue-600 ml-1">({sys.casualLeave} apprv)</span>
                          )}
                        </Label>
                        <Input
                          className="mt-1 h-8 text-xs"
                          type="number"
                          min="0"
                          step="0.5"
                          value={r.casualLeave ?? 0}
                          onChange={ev => update(e.id, "casualLeave", ev.target.value)}
                        />
                      </div>

                      <div>
                        <Label className="text-[11px] font-medium text-slate-600">
                          Comp-Off Used
                          {sys.compOffUsed > 0 && (
                            <span className="text-[10px] text-blue-600 ml-1">({sys.compOffUsed})</span>
                          )}
                        </Label>
                        <Input
                          className="mt-1 h-8 text-xs"
                          type="number"
                          min="0"
                          step="0.5"
                          value={r.compOffUsed ?? 0}
                          onChange={ev => update(e.id, "compOffUsed", ev.target.value)}
                        />
                      </div>

                      <div>
                        <Label className="text-[11px] font-medium text-slate-600">
                          LWP (Unpaid)
                          {sys.lwp > 0 && <span className="text-[10px] text-rose-600 ml-1">({sys.lwp})</span>}
                        </Label>
                        <Input
                          className="mt-1 h-8 text-xs text-rose-700 font-medium"
                          type="number"
                          min="0"
                          step="0.5"
                          value={r.lwp ?? 0}
                          onChange={ev => update(e.id, "lwp", ev.target.value)}
                        />
                      </div>

                      <div>
                        <Label className="text-[11px] font-medium text-slate-600">GH Holiday</Label>
                        <Input
                          className="mt-1 h-8 text-xs"
                          type="number"
                          min="0"
                          step="1"
                          value={r.ghHolidayLeave ?? 0}
                          onChange={ev => update(e.id, "ghHolidayLeave", ev.target.value)}
                        />
                      </div>

                      <div>
                        <Label className="text-[11px] font-medium text-slate-600">
                          Sunday Work
                          {sys.extraWorkingDaySunday > 0 && (
                            <span className="text-[10px] text-amber-600 ml-1">({sys.extraWorkingDaySunday})</span>
                          )}
                        </Label>
                        <Input
                          className="mt-1 h-8 text-xs"
                          type="number"
                          min="0"
                          step="1"
                          value={r.extraWorkingDaySunday ?? 0}
                          onChange={ev => update(e.id, "extraWorkingDaySunday", ev.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Earnings & Statutory Deductions */}
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                      2. Additions, Statutory Deductions & Balances
                    </p>
                    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8">
                      <div>
                        <Label className="text-[11px] font-medium text-slate-600">Other Earnings</Label>
                        <Input
                          className="mt-1 h-8 text-xs text-emerald-700 font-semibold"
                          type="number"
                          min="0"
                          step="0.01"
                          value={r.otherEarnings ?? 0}
                          onChange={ev => update(e.id, "otherEarnings", ev.target.value)}
                          placeholder="Bonus, incentive..."
                        />
                      </div>

                      <div>
                        <Label className="text-[11px] font-medium text-slate-600">PF Deduction</Label>
                        <Input
                          className="mt-1 h-8 text-xs text-rose-700"
                          type="number"
                          min="0"
                          step="0.01"
                          value={r.pf ?? 0}
                          onChange={ev => update(e.id, "pf", ev.target.value)}
                        />
                      </div>

                      <div>
                        <Label className="text-[11px] font-medium text-slate-600">ESI Deduction</Label>
                        <Input
                          className="mt-1 h-8 text-xs text-rose-700"
                          type="number"
                          min="0"
                          step="0.01"
                          value={r.esi ?? 0}
                          onChange={ev => update(e.id, "esi", ev.target.value)}
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between">
                          <Label className="text-[11px] font-medium text-slate-600">TDS (Tax)</Label>
                          {sys.suggestedTds > 0 && (
                            <button
                              type="button"
                              onClick={() => update(e.id, "tds", sys.suggestedTds)}
                              className="text-[10px] text-blue-600 hover:underline"
                            >
                              ₹{sys.suggestedTds}
                            </button>
                          )}
                        </div>
                        <Input
                          className="mt-1 h-8 text-xs text-rose-700"
                          type="number"
                          min="0"
                          step="0.01"
                          value={r.tds ?? 0}
                          onChange={ev => update(e.id, "tds", ev.target.value)}
                        />
                      </div>

                      <div>
                        <Label className="text-[11px] font-medium text-slate-600">Other Deductions</Label>
                        <Input
                          className="mt-1 h-8 text-xs text-rose-700"
                          type="number"
                          min="0"
                          step="0.01"
                          value={r.otherDeductions ?? 0}
                          onChange={ev => update(e.id, "otherDeductions", ev.target.value)}
                          placeholder="Advance recovery..."
                        />
                      </div>

                      <div>
                        <Label className="text-[11px] font-medium text-slate-600">Pending CL Bal</Label>
                        <Input
                          className="mt-1 h-8 text-xs bg-slate-50"
                          type="number"
                          min="0"
                          step="0.5"
                          value={r.pendingCasualLeave ?? 0}
                          onChange={ev => update(e.id, "pendingCasualLeave", ev.target.value)}
                        />
                      </div>

                      <div>
                        <Label className="text-[11px] font-medium text-slate-600">Comp-Off Granted</Label>
                        <Input
                          className="mt-1 h-8 text-xs bg-slate-50"
                          type="number"
                          min="0"
                          step="0.5"
                          value={r.compOffGranted ?? 0}
                          onChange={ev => update(e.id, "compOffGranted", ev.target.value)}
                        />
                      </div>

                      <div>
                        <Label className="text-[11px] font-medium text-slate-600">Total Work Hrs</Label>
                        <Input
                          className="mt-1 h-8 text-xs bg-slate-50"
                          type="number"
                          min="0"
                          step="0.1"
                          value={r.workingHours ?? 0}
                          onChange={ev => update(e.id, "workingHours", ev.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Section 3: Summary Pill & Action Buttons */}
                  <div className="mt-4 flex flex-col gap-3 rounded-xl bg-slate-50/80 p-3 sm:flex-row sm:items-center sm:justify-between border border-slate-200/60">
                    <div className="flex-1 max-w-sm">
                      <Input
                        value={r.hrRemarks || ""}
                        onChange={ev => update(e.id, "hrRemarks", ev.target.value)}
                        placeholder="HR Remarks (e.g. advance adjustment, performance bonus...)"
                        className="h-8 text-xs bg-white"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                      <div>
                        <span className="text-slate-400">Paid Days:</span>{" "}
                        <span className="font-bold text-[#14245b]">{c.paid.toFixed(2)}</span>
                        <span className="text-slate-400 text-[10px]">/{calendarDays}</span>
                      </div>
                      <div className="hidden sm:inline text-slate-300">|</div>
                      <div>
                        <span className="text-slate-400">Per Day:</span>{" "}
                        <span className="font-bold text-[#14245b]">{money(c.per)}</span>
                      </div>
                      <div className="hidden sm:inline text-slate-300">|</div>
                      <div>
                        <span className="text-slate-400">Earned:</span>{" "}
                        <span className="font-bold text-[#14245b]">{money(c.earned)}</span>
                      </div>
                      <div className="hidden sm:inline text-slate-300">|</div>
                      <div>
                        <span className="text-slate-400">Deductions:</span>{" "}
                        <span className="font-bold text-rose-600">{money(c.deductions)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => saveOne(e.id, false)}
                        className="h-8 text-xs bg-white"
                      >
                        Save Draft
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => saveOne(e.id, true)}
                        className="h-8 text-xs bg-[#1678d2] hover:bg-[#126bbd] text-white"
                      >
                        {r.published ? "Republish" : "Publish"}
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}

            {filteredEmployees.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-200 p-12 text-center text-slate-400">
                <Users className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                <p className="text-sm font-medium">No employees found matching filter criteria.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
