"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Banknote,
  Coins,
  CalendarDays,
  Clock3,
  Users,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Sparkles,
  Calculator,
  RefreshCw,
  Trash2,
} from "lucide-react"

export default function HRPage() {
  const [leaveRequests, setLeaveRequests] = useState<any[]>([])
  const [compRequests, setCompRequests] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [message, setMessage] = useState('')
  const [employeeForm, setEmployeeForm] = useState({ id: '', name: '', password: '', department: '', designation: '', dateOfJoining: '', annualCtc: '', monthlySalary: '', workMode: 'FIELD', email: '' })

  // Year-end CL Encashment States
  const currentYear = new Date().getFullYear()
  const [encashYear, setEncashYear] = useState<number>(currentYear)
  const [encashEmployeeId, setEncashEmployeeId] = useState<string>('')
  const [encashBalanceInfo, setEncashBalanceInfo] = useState<any>(null)
  const [loadingBalance, setLoadingBalance] = useState<boolean>(false)
  const [encashDays, setEncashDays] = useState<string>('')
  const [encashAmount, setEncashAmount] = useState<string>('')
  const [encashHistory, setEncashHistory] = useState<any[]>([])
  const [encashSummary, setEncashSummary] = useState<{ count: number; totalDays: number; totalAmount: number }>({ count: 0, totalDays: 0, totalAmount: 0 })
  const [loadingEncash, setLoadingEncash] = useState<boolean>(false)
  const [revertingId, setRevertingId] = useState<string | null>(null)

  const load = async () => {
    const [leaveRes, compRes, empRes] = await Promise.all([
      fetch('/api/leave/admin', { cache: 'no-store' }),
      fetch('/api/hr/compoff', { cache: 'no-store' }),
      fetch('/api/hr/employees', { cache: 'no-store' }),
    ])
    if (leaveRes.ok) { const d = await leaveRes.json(); setLeaveRequests(d.requests || []) }
    if (compRes.ok) { const d = await compRes.json(); setCompRequests(d.requests || []) }
    if (empRes.ok) { const d = await empRes.json(); setEmployees(d.employees || []) }
  }

  const loadEncashHistory = async (year: number) => {
    try {
      const res = await fetch(`/api/hr/leave-encashment?year=${year}`, { cache: 'no-store' })
      if (res.ok) {
        const d = await res.json()
        setEncashHistory(d.encashments || [])
        setEncashSummary(d.summary || { count: 0, totalDays: 0, totalAmount: 0 })
      }
    } catch (err) {
      console.error('Failed to load encashment history', err)
    }
  }

  const fetchEmployeeBalance = async (empId: string, yr: number) => {
    if (!empId) {
      setEncashBalanceInfo(null)
      setEncashDays('')
      setEncashAmount('')
      return
    }
    setLoadingBalance(true)
    try {
      const res = await fetch(`/api/hr/leave-encashment?employeeId=${encodeURIComponent(empId)}&year=${yr}`, { cache: 'no-store' })
      if (res.ok) {
        const d = await res.json()
        setEncashBalanceInfo(d)
        if (d.existingEncashment) {
          setEncashDays(String(d.existingEncashment.days))
          setEncashAmount(String(d.existingEncashment.amount))
        } else if (d.balance?.remaining > 0) {
          setEncashDays(String(d.balance.remaining))
          setEncashAmount(String(d.suggestedAmount || 0))
        } else {
          setEncashDays('')
          setEncashAmount('')
        }
      } else {
        setEncashBalanceInfo(null)
      }
    } catch {
      setEncashBalanceInfo(null)
    } finally {
      setLoadingBalance(false)
    }
  }

  useEffect(() => {
    load()
    loadEncashHistory(encashYear)
  }, [])

  useEffect(() => {
    loadEncashHistory(encashYear)
    if (encashEmployeeId) {
      fetchEmployeeBalance(encashEmployeeId, encashYear)
    }
  }, [encashYear])

  const handleEmployeeSelect = (empId: string) => {
    setEncashEmployeeId(empId)
    fetchEmployeeBalance(empId, encashYear)
  }

  const handleDaysChange = (val: string) => {
    setEncashDays(val)
    const d = parseFloat(val)
    if (!isNaN(d) && d > 0 && encashBalanceInfo?.perDaySalary) {
      setEncashAmount((d * encashBalanceInfo.perDaySalary).toFixed(2))
    }
  }

  const handleMaxRemaining = () => {
    if (encashBalanceInfo?.balance?.remaining != null) {
      const rem = encashBalanceInfo.balance.remaining
      setEncashDays(String(rem))
      if (encashBalanceInfo.perDaySalary) {
        setEncashAmount((rem * encashBalanceInfo.perDaySalary).toFixed(2))
      }
    }
  }

  const handleProcessEncashment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!encashEmployeeId) return setMessage('Please select an employee.')
    const daysNum = parseFloat(encashDays)
    const amountNum = parseFloat(encashAmount)
    if (isNaN(daysNum) || daysNum <= 0) return setMessage('Please enter a valid positive number of CL days.')
    if (isNaN(amountNum) || amountNum < 0) return setMessage('Please enter a valid positive encashment amount.')

    setLoadingEncash(true)
    setMessage('')
    try {
      const res = await fetch('/api/hr/leave-encashment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: encashEmployeeId,
          year: encashYear,
          days: daysNum,
          amount: amountNum,
        }),
      })
      const d = await res.json()
      if (res.ok) {
        setMessage(`Encashment of ${daysNum} CL day(s) (₹${amountNum.toLocaleString('en-IN')}) successfully processed for ${encashBalanceInfo?.employee?.name || encashEmployeeId}.`)
        await loadEncashHistory(encashYear)
        await fetchEmployeeBalance(encashEmployeeId, encashYear)
      } else {
        setMessage(d.error || 'Unable to process encashment.')
      }
    } catch (err: any) {
      setMessage(err?.message || 'Error processing encashment.')
    } finally {
      setLoadingEncash(false)
    }
  }

  const handleRevertEncashment = async (encashId: string, empName: string, days: number) => {
    if (!confirm(`Are you sure you want to revert this encashment for ${empName}? The ${days} CL day(s) will be restored to their balance.`)) {
      return
    }
    setRevertingId(encashId)
    setMessage('')
    try {
      const res = await fetch('/api/hr/leave-encashment', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: encashId }),
      })
      const d = await res.json()
      if (res.ok) {
        setMessage(`Encashment record reverted. ${days} CL day(s) restored for ${empName}.`)
        await loadEncashHistory(encashYear)
        if (encashEmployeeId) {
          await fetchEmployeeBalance(encashEmployeeId, encashYear)
        }
      } else {
        setMessage(d.error || 'Failed to revert encashment.')
      }
    } catch (err: any) {
      setMessage(err?.message || 'Error reverting encashment.')
    } finally {
      setRevertingId(null)
    }
  }

  const reviewLeave = async (requestId: string, action: 'APPROVE' | 'REJECT') => {
    const res = await fetch('/api/leave/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId, action }) })
    const d = await res.json(); setMessage(res.ok ? `Leave ${action.toLowerCase()}d.` : d.error || 'Action failed'); if (res.ok) load()
  }

  const reviewComp = async (requestId: string, action: 'APPROVE' | 'REJECT') => {
    const res = await fetch('/api/hr/compoff', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId, action }) })
    const d = await res.json(); setMessage(res.ok ? `Comp-off ${action.toLowerCase()}d.` : d.error || 'Action failed'); if (res.ok) load()
  }

  const saveEmployee = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await fetch('/api/hr/employees', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(employeeForm) })
    const d = await res.json(); setMessage(res.ok ? 'Employee enrollment saved.' : d.error || 'Unable to save employee')
    if (res.ok) { setEmployeeForm({ id: '', name: '', password: '', department: '', designation: '', dateOfJoining: '', annualCtc: '', monthlySalary: '', workMode: 'FIELD', email: '' }); load() }
  }

  const changeEmployeeAccess = async (id: string, action: 'DEACTIVATE' | 'REACTIVATE') => {
    const res = await fetch('/api/hr/employees', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action }) })
    const d = await res.json(); setMessage(res.ok ? (action === 'DEACTIVATE' ? 'Employee login access disabled.' : 'Employee login access restored.') : d.error || 'Unable to update employee access'); if (res.ok) load()
  }

  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[#14245b]">HR Management</h1>
        <p className="mt-1 text-gray-500">Employee master, leave approvals, comp-offs, and year-end CL encashment.</p>
      </div>

      {message && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-sm font-semibold text-[#1264ac]">
          {message}
        </div>
      )}

      {/* Top HR KPI Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-[#cfe5f7]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-500">Pending Leaves</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-[#14245b]">{leaveRequests.filter(x => x.status === 'PENDING').length}</div>
          </CardContent>
        </Card>
        <Card className="border-[#cfe5f7]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-500">Pending Comp-offs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-[#14245b]">{compRequests.filter(x => x.status === 'PENDING').length}</div>
          </CardContent>
        </Card>
        <Card className="border-[#cfe5f7]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-500">Active Employees</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-[#14245b]">{employees.filter(x => x.active).length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Workspace Navigation Shortcuts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Link
          href="/dashboard/attendance-regularization"
          className="rounded-2xl border border-[#cfe5f7] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-[#eaf5ff] p-2.5 text-[#1677ca]">
              <Clock3 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#14245b]">Attendance Regularization</p>
              <p className="mt-0.5 text-xs text-slate-500">Open employee lookup and attendance correction workspace.</p>
            </div>
          </div>
        </Link>
        <Link
          href="/dashboard/leave-regularization"
          className="rounded-2xl border border-[#cfe5f7] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-[#fff1ea] p-2.5 text-[#e55b27]">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#14245b]">Leave Regularization</p>
              <p className="mt-0.5 text-xs text-slate-500">Open employee lookup and offline leave entry workspace.</p>
            </div>
          </div>
        </Link>
      </div>

      {/* YEAR-END CL ENCASHMENT COMPREHENSIVE SECTION */}
      <Card className="border-[#bfdbfe] bg-white shadow-md overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-[#14245b] to-[#1e40af] text-white p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold tracking-wider text-blue-100">
                <Coins className="h-3.5 w-3.5" />
                ANNUAL LEAVE AUDIT & POLICY
              </div>
              <CardTitle className="mt-2 text-2xl font-extrabold text-white">Year-end CL Encashment</CardTitle>
              <CardDescription className="text-blue-100/90 mt-1">
                Audit unused Casual Leaves (CL) at year-end, verify live balance, and record approved monetary encashment payouts.
              </CardDescription>
            </div>

            {/* Year Selector */}
            <div className="flex items-center gap-2 bg-white/10 p-1.5 rounded-xl border border-white/20">
              <span className="text-xs font-semibold px-2 text-blue-100">Audit Year:</span>
              <select
                value={encashYear}
                onChange={e => setEncashYear(Number(e.target.value))}
                className="h-9 rounded-lg bg-white px-3 text-xs font-bold text-[#14245b] outline-none shadow-sm cursor-pointer"
              >
                {[currentYear, currentYear - 1, currentYear - 2].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {/* Year Encashment Summary KPIs */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-[#f8fafc] p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Employees Encashed</p>
                  <p className="mt-1 text-2xl font-extrabold text-[#14245b]">{encashSummary.count}</p>
                </div>
                <div className="rounded-xl bg-[#eaf5ff] p-2.5 text-[#1677ca]">
                  <Users className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-2 text-[11px] text-slate-400">Processed for {encashYear}</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-[#f8fafc] p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total CL Days Encashed</p>
                  <p className="mt-1 text-2xl font-extrabold text-[#14245b]">{encashSummary.totalDays} Days</p>
                </div>
                <div className="rounded-xl bg-[#fff1ea] p-2.5 text-[#e55b27]">
                  <CalendarDays className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-2 text-[11px] text-slate-400">Converted to cash payout</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-[#f8fafc] p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Payout Amount</p>
                  <p className="mt-1 text-2xl font-extrabold text-emerald-700">₹{encashSummary.totalAmount.toLocaleString('en-IN')}</p>
                </div>
                <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-600">
                  <Banknote className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-2 text-[11px] text-slate-400">Approved encashment value</p>
            </div>
          </div>

          {/* Interactive Encashment Form */}
          <div className="rounded-2xl border border-[#dbe5f0] bg-white p-5 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-[#14245b] flex items-center gap-2">
                <Calculator className="h-4 w-4 text-[#1677ca]" />
                Process Employee Encashment for {encashYear}
              </h3>
              <span className="text-xs text-slate-400">Daily rate = Monthly Salary ÷ 30</span>
            </div>

            <form onSubmit={handleProcessEncashment} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-4 items-end">
                {/* Employee Selector */}
                <div>
                  <Label className="text-xs font-bold text-slate-600">Select Employee</Label>
                  <select
                    value={encashEmployeeId}
                    onChange={e => handleEmployeeSelect(e.target.value)}
                    className="mt-1.5 h-11 w-full rounded-xl border border-[#dbe5f0] bg-white px-3 text-sm font-semibold outline-none focus:border-[#1f86df] focus:ring-2 focus:ring-blue-100"
                    required
                  >
                    <option value="">Select an employee...</option>
                    {employees.map(e => (
                      <option key={e.id} value={e.id}>
                        {e.name} — {e.id} {e.department ? `(${e.department})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Audit Year (Synced) */}
                <div>
                  <Label className="text-xs font-bold text-slate-600">Year</Label>
                  <Input
                    className="mt-1.5 h-11"
                    type="number"
                    value={encashYear}
                    onChange={e => setEncashYear(Number(e.target.value))}
                    required
                  />
                </div>

                {/* CL Days to Encash */}
                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-600">CL Days</Label>
                    {encashBalanceInfo?.balance?.remaining > 0 && !encashBalanceInfo?.existingEncashment && (
                      <button
                        type="button"
                        onClick={handleMaxRemaining}
                        className="text-[11px] font-bold text-[#1677ca] hover:underline"
                      >
                        Max ({encashBalanceInfo.balance.remaining})
                      </button>
                    )}
                  </div>
                  <Input
                    className="mt-1.5 h-11"
                    type="number"
                    min="0.5"
                    step="0.5"
                    max={encashBalanceInfo?.balance?.remaining ?? 30}
                    value={encashDays}
                    onChange={e => handleDaysChange(e.target.value)}
                    placeholder="e.g. 5"
                    disabled={Boolean(encashBalanceInfo?.existingEncashment) || (encashBalanceInfo && encashBalanceInfo.balance?.remaining <= 0)}
                    required
                  />
                </div>

                {/* Encashment Amount */}
                <div>
                  <Label className="text-xs font-bold text-slate-600">Encashment Amount (₹)</Label>
                  <Input
                    className="mt-1.5 h-11"
                    type="number"
                    min="0"
                    step="0.01"
                    value={encashAmount}
                    onChange={e => setEncashAmount(e.target.value)}
                    placeholder="e.g. 5000"
                    disabled={Boolean(encashBalanceInfo?.existingEncashment) || (encashBalanceInfo && encashBalanceInfo.balance?.remaining <= 0)}
                    required
                  />
                </div>
              </div>

              {/* Dynamic Employee Balance & Salary Banner */}
              {loadingBalance && (
                <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
                  <RefreshCw className="h-4 w-4 animate-spin text-[#1677ca]" />
                  Fetching live CL balance and salary details for {encashYear}...
                </div>
              )}

              {encashBalanceInfo && !loadingBalance && (
                <div className="rounded-xl border border-[#cfe5f7] bg-[#f4faff] p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-100 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#14245b] text-sm">{encashBalanceInfo.employee.name}</span>
                      <span className="text-xs text-slate-400">({encashBalanceInfo.employee.id})</span>
                      {encashBalanceInfo.employee.department && (
                        <span className="rounded-md bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                          {encashBalanceInfo.employee.department}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-600">
                      Monthly Salary: <span className="font-bold text-[#14245b]">₹{Number(encashBalanceInfo.employee.monthlySalary || 0).toLocaleString('en-IN')}</span> · Daily Rate: <span className="font-bold text-[#1677ca]">₹{encashBalanceInfo.perDaySalary || 0}/day</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-center">
                    <div className="rounded-lg bg-white p-2 border border-blue-100">
                      <p className="text-[10px] uppercase font-bold text-slate-400">Total Accrued</p>
                      <p className="text-base font-extrabold text-[#14245b]">{encashBalanceInfo.balance.total} Days</p>
                    </div>
                    <div className="rounded-lg bg-white p-2 border border-blue-100">
                      <p className="text-[10px] uppercase font-bold text-slate-400">Used CL</p>
                      <p className="text-base font-extrabold text-amber-600">{encashBalanceInfo.balance.used} Days</p>
                    </div>
                    <div className="rounded-lg bg-white p-2 border border-blue-100">
                      <p className="text-[10px] uppercase font-bold text-slate-400">Already Encashed</p>
                      <p className="text-base font-extrabold text-purple-600">{encashBalanceInfo.balance.encashed} Days</p>
                    </div>
                    <div className="rounded-lg bg-white p-2 border border-blue-100">
                      <p className="text-[10px] uppercase font-bold text-slate-400">Available to Encash</p>
                      <p className={`text-base font-extrabold ${encashBalanceInfo.balance.remaining > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {encashBalanceInfo.balance.remaining} Days
                      </p>
                    </div>
                  </div>

                  {encashBalanceInfo.existingEncashment ? (
                    <div className="flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-xs font-semibold text-amber-800 border border-amber-200">
                      <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
                      <span>
                        Year-end encashment for {encashYear} has already been processed for this employee ({encashBalanceInfo.existingEncashment.days} days for ₹{Number(encashBalanceInfo.existingEncashment.amount).toLocaleString('en-IN')}). To adjust or re-process, revert the record below.
                      </span>
                    </div>
                  ) : encashBalanceInfo.balance.remaining <= 0 ? (
                    <div className="flex items-center gap-2 rounded-lg bg-slate-100 p-2.5 text-xs text-slate-600">
                      <AlertCircle className="h-4 w-4 shrink-0 text-slate-400" />
                      <span>This employee has 0 remaining Casual Leaves available to encash for {encashYear}.</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-xs text-emerald-800 bg-emerald-50/80 px-3 py-2 rounded-lg border border-emerald-200">
                      <span className="flex items-center gap-1.5 font-medium">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        Eligible for encashment. Formula: {encashDays || 0} days × ₹{encashBalanceInfo.perDaySalary} = <strong>₹{encashAmount || 0}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={handleMaxRemaining}
                        className="font-bold underline text-emerald-700 hover:text-emerald-900"
                      >
                        Encash All ({encashBalanceInfo.balance.remaining} Days)
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  type="submit"
                  disabled={
                    loadingEncash ||
                    !encashEmployeeId ||
                    Boolean(encashBalanceInfo?.existingEncashment) ||
                    (encashBalanceInfo && encashBalanceInfo.balance?.remaining <= 0)
                  }
                  className="bg-[#1678d2] hover:bg-[#126bbd] text-white font-bold h-11 px-6 shadow-sm"
                >
                  {loadingEncash ? (
                    <span className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Processing...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Coins className="h-4 w-4" />
                      Process Encashment Payout
                    </span>
                  )}
                </Button>
              </div>
            </form>
          </div>

          {/* Processed Encashments Audit Table */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-[#14245b] text-base">Processed Encashments for {encashYear}</h3>
                <p className="text-xs text-slate-500">Historical records of approved year-end encashments.</p>
              </div>
              <button
                type="button"
                onClick={() => loadEncashHistory(encashYear)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh History
              </button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[850px] text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                    <th className="p-3">Employee</th>
                    <th className="p-3">Department</th>
                    <th className="p-3">Year</th>
                    <th className="p-3">Encashed Days</th>
                    <th className="p-3">Payout Amount</th>
                    <th className="p-3">Processed Date</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {encashHistory.map(rec => (
                    <tr key={rec.id} className="hover:bg-slate-50/60 transition">
                      <td className="p-3">
                        <div className="font-bold text-[#14245b]">{rec.employee?.name || rec.employeeId}</div>
                        <div className="text-xs text-slate-400">{rec.employeeId}</div>
                      </td>
                      <td className="p-3 text-slate-600">
                        {rec.employee?.department || '-'}
                      </td>
                      <td className="p-3">
                        <span className="rounded-md bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">
                          {rec.year}
                        </span>
                      </td>
                      <td className="p-3 font-semibold text-[#14245b]">
                        {rec.days} Days
                      </td>
                      <td className="p-3 font-bold text-emerald-700">
                        ₹{Number(rec.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-xs text-slate-500">
                        {new Date(rec.processedAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="p-3 text-right">
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={revertingId === rec.id}
                          onClick={() => handleRevertEncashment(rec.id, rec.employee?.name || rec.employeeId, rec.days)}
                          className="h-8 text-xs font-bold inline-flex items-center gap-1.5"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {revertingId === rec.id ? 'Reverting...' : 'Revert'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {encashHistory.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-sm text-slate-400">
                        No year-end CL encashment records found for {encashYear}.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Leave Approvals */}
      <Card>
        <CardHeader>
          <CardTitle>Leave Approval</CardTitle>
          <CardDescription>Employees submit leave requests; only Super Admin can approve or reject them.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {leaveRequests.filter(x => x.status === 'PENDING').map(req => (
              <div key={req.id} className="flex flex-col gap-3 rounded-lg border p-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="font-medium text-[#14245b]">{req.employee.name} ({req.employee.id}) — {req.leaveType}</div>
                  <div className="text-xs text-gray-500">
                    {new Date(req.startDate).toLocaleDateString('en-IN')} to {new Date(req.endDate).toLocaleDateString('en-IN')} · {req.days} day(s) · {req.reason || 'No reason'}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => reviewLeave(req.id, 'APPROVE')}>Approve</Button>
                  <Button size="sm" variant="destructive" onClick={() => reviewLeave(req.id, 'REJECT')}>Reject</Button>
                </div>
              </div>
            ))}
            {leaveRequests.filter(x => x.status === 'PENDING').length === 0 && (
              <p className="text-sm text-gray-500">No pending leave requests.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Comp-off Approvals */}
      <Card>
        <CardHeader>
          <CardTitle>Comp-off Approval</CardTitle>
          <CardDescription>Employees can request comp-off; only Super Admin can approve or reject.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {compRequests.filter(x => x.status === 'PENDING').map(req => (
              <div key={req.id} className="flex flex-col gap-3 rounded-lg border p-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="font-medium text-[#14245b]">{req.employee.name} ({req.employee.id})</div>
                  <div className="text-xs text-gray-500">Worked: {new Date(req.workedDate).toLocaleDateString('en-IN')} · {req.reason}</div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => reviewComp(req.id, 'APPROVE')}>Approve</Button>
                  <Button size="sm" variant="destructive" onClick={() => reviewComp(req.id, 'REJECT')}>Reject</Button>
                </div>
              </div>
            ))}
            {compRequests.filter(x => x.status === 'PENDING').length === 0 && (
              <p className="text-sm text-gray-500">No pending comp-off requests.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Employee Enrollment */}
      <Card>
        <CardHeader>
          <CardTitle>Employee Enrollment</CardTitle>
          <CardDescription>Create employee login access and maintain the employee master. New accounts are always created as Employee, never as Super Admin.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveEmployee} className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <div><Label>Employee ID</Label><Input className="mt-1" value={employeeForm.id} onChange={e => setEmployeeForm(x => ({ ...x, id: e.target.value }))} required /></div>
            <div><Label>Name</Label><Input className="mt-1" value={employeeForm.name} onChange={e => setEmployeeForm(x => ({ ...x, name: e.target.value }))} required /></div>
            <div><Label>Email</Label><Input className="mt-1" value={employeeForm.email} onChange={e => setEmployeeForm(x => ({ ...x, email: e.target.value }))} /></div>
            <div><Label>Department</Label><Input className="mt-1" value={employeeForm.department} onChange={e => setEmployeeForm(x => ({ ...x, department: e.target.value }))} /></div>
            <div><Label>Designation</Label><Input className="mt-1" value={employeeForm.designation} onChange={e => setEmployeeForm(x => ({ ...x, designation: e.target.value }))} /></div>
            <div><Label>Date of Joining</Label><Input className="mt-1" type="date" value={employeeForm.dateOfJoining} onChange={e => setEmployeeForm(x => ({ ...x, dateOfJoining: e.target.value }))} /></div>
            <div><Label>Annual CTC</Label><Input className="mt-1" type="number" value={employeeForm.annualCtc} onChange={e => setEmployeeForm(x => ({ ...x, annualCtc: e.target.value }))} /></div>
            <div><Label>Monthly Salary</Label><Input className="mt-1" type="number" value={employeeForm.monthlySalary} onChange={e => setEmployeeForm(x => ({ ...x, monthlySalary: e.target.value }))} /></div>
            <div>
              <Label>Work Mode</Label>
              <Select value={employeeForm.workMode} onValueChange={v => setEmployeeForm(x => ({ ...x, workMode: v ?? 'FIELD' }))}>
                <SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="FIELD">Field</SelectItem><SelectItem value="OFFICE">Office</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>New Password</Label><Input className="mt-1" type="password" value={employeeForm.password} onChange={e => setEmployeeForm(x => ({ ...x, password: e.target.value }))} placeholder="Leave blank to keep existing" /></div>
            <div className="flex items-end gap-2"><Button type="submit">Enroll / Save Employee</Button></div>
          </form>
        </CardContent>
      </Card>

      {/* Employee Login Access */}
      <Card>
        <CardHeader>
          <CardTitle>Employee Login Access</CardTitle>
          <CardDescription>Disable preserves HR history while immediately blocking portal login. Restore reactivates access.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500 text-xs uppercase font-bold">
                  <th className="p-2">ID</th>
                  <th className="p-2">Name</th>
                  <th className="p-2">Department</th>
                  <th className="p-2">DOJ</th>
                  <th className="p-2">Monthly Salary</th>
                  <th className="p-2">Mode</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {employees.map(e => (
                  <tr key={e.id} className="border-b last:border-0 hover:bg-slate-50 transition">
                    <td className="p-2 font-mono text-xs">{e.id}</td>
                    <td className="p-2 font-medium text-[#14245b]">{e.name}</td>
                    <td className="p-2">{e.department || '-'}</td>
                    <td className="p-2">{e.dateOfJoining ? new Date(e.dateOfJoining).toLocaleDateString('en-IN') : '-'}</td>
                    <td className="p-2">{e.monthlySalary != null ? `₹${Number(e.monthlySalary).toLocaleString('en-IN')}` : '-'}</td>
                    <td className="p-2">{e.workMode}</td>
                    <td className="p-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${e.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {e.active ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </td>
                    <td className="p-2">
                      <Button size="sm" variant={e.active ? 'destructive' : 'default'} onClick={() => changeEmployeeAccess(e.id, e.active ? 'DEACTIVATE' : 'REACTIVATE')}>
                        {e.active ? 'Disable Login' : 'Restore Login'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {employees.length === 0 && <p className="py-5 text-sm text-slate-500">No employees enrolled yet.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
