"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { format } from "date-fns"
import { CalendarDays, WalletCards, Clock, CheckCircle2, AlertCircle, Info } from "lucide-react"

export default function LeavePage() {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()
  const [data, setData] = useState<any>({ balance: {}, requests: [], compOffs: [], compRequests: [], availableCompOffDays: 0, pendingCompOffDays: 0 })
  const [leaveType, setLeaveType] = useState('')
  const [leaveDuration, setLeaveDuration] = useState('FULL_DAY')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')
  const [workedDate, setWorkedDate] = useState('')
  const [compDuration, setCompDuration] = useState('FULL_DAY')
  const [compReason, setCompReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const load = async () => {
    try {
      const [leaveRes, compRes] = await Promise.all([
        fetch('/api/leave', { cache: 'no-store' }),
        fetch('/api/compoff', { cache: 'no-store' }),
      ])
      const leave = leaveRes.ok ? await leaveRes.json() : {}
      const comp = compRes.ok ? await compRes.json() : {}
      setData({
        ...leave,
        compOffs: comp.available || leave.compOffs || [],
        compRequests: comp.requests || [],
      })
    } catch (err) {
      console.error('Failed to load leave data:', err)
    }
  }

  useEffect(() => {
    if (sessionStatus === 'authenticated' && session?.user?.role === 'SUPER_ADMIN') {
      router.replace('/dashboard/hr')
      return
    }
    if (sessionStatus === 'authenticated') load()
  }, [sessionStatus, session?.user?.role])

  const applyLeave = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    const effectiveEnd = leaveDuration === 'FULL_DAY' ? endDate : startDate
    try {
      const res = await fetch('/api/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leaveType,
          durationType: leaveDuration,
          startDate,
          endDate: effectiveEnd,
          reason,
        }),
      })
      const body = await res.json()
      setMessage(res.ok ? 'Leave request submitted for HR approval.' : body.error || 'Unable to submit leave.')
      if (res.ok) {
        setLeaveType('')
        setLeaveDuration('FULL_DAY')
        setStartDate('')
        setEndDate('')
        setReason('')
        await load()
      }
    } catch (err: any) {
      setMessage(err?.message || 'Error submitting leave request.')
    } finally {
      setLoading(false)
    }
  }

  const requestCompOff = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    try {
      const res = await fetch('/api/compoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workedDate, durationType: compDuration, reason: compReason }),
      })
      const body = await res.json()
      setMessage(res.ok ? 'Comp-off request submitted. Only HR/Admin can approve it.' : body.error || 'Unable to submit comp-off request.')
      if (res.ok) {
        setWorkedDate('')
        setCompDuration('FULL_DAY')
        setCompReason('')
        await load()
      }
    } catch (err: any) {
      setMessage(err?.message || 'Error submitting comp-off request.')
    } finally {
      setLoading(false)
    }
  }

  const clRemaining = data.balance?.remaining ?? 0
  const clPending = data.balance?.pendingDays ?? 0

  // Calculate approved available comp-offs
  const availableCompOffs =
    data.availableCompOffDays ??
    (data.compOffs?.filter((x: any) => x.status === 'AVAILABLE').reduce((sum: number, x: any) => sum + Number(x.duration || 1), 0) ?? 0)
  const pendingCompOffDays =
    data.pendingCompOffDays ??
    (data.requests?.filter((x: any) => x.leaveType === 'COMP_OFF' && x.status === 'PENDING').reduce((sum: number, x: any) => sum + Number(x.days || 1), 0) ?? 0)
  const netAvailableCompOffs = Math.max(0, availableCompOffs - pendingCompOffDays)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[#14245b]">Leave & Comp-off</h1>
        <p className="text-gray-500">Apply for Casual Leave, utilize earned Comp-offs, or request new Comp-offs for extra duty.</p>
      </div>

      {message && (
        <div
          className={`rounded-xl border p-4 text-sm font-semibold flex items-center gap-2 ${
            message.includes('submitted') || message.includes('success')
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {message.includes('submitted') || message.includes('success') ? (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
          )}
          <span>{message}</span>
        </div>
      )}

      {/* KPI Balances */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-[#cfe5f7]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-500">Available CL Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-[#14245b]">{clRemaining} Days</div>
            <p className="mt-1 text-xs text-gray-500">
              Credited: {data.balance?.total ?? 0} · Used: {data.balance?.used ?? 0}
              {clPending > 0 ? ` · ${clPending} pending` : ''}
            </p>
          </CardContent>
        </Card>

        <Card className="border-[#cfe5f7]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-500">Available Comp-offs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-[#1f86df]">{availableCompOffs} Days</div>
            <p className="mt-1 text-xs text-gray-500">
              {pendingCompOffDays > 0 ? `${pendingCompOffDays} reserved in pending leave` : 'Approved and available to utilize as leave'}
            </p>
          </CardContent>
        </Card>

        <Card className="border-[#cfe5f7]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-500">Comp-off Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-[#f15a24]">
              {(data.compRequests || []).filter((x: any) => x.status === 'PENDING').length} Pending
            </div>
            <p className="mt-1 text-xs text-gray-500">Awaiting HR approval for duty earned</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* APPLY LEAVE CARD WITH COMP-OFF UTILIZATION */}
        <Card className="border-[#cfe5f7]">
          <CardHeader>
            <CardTitle className="text-xl text-[#14245b]">Apply Leave</CardTitle>
            <CardDescription>
              Submit leave for Casual Leave (CL), Comp-off utilization, or Leave Without Pay (LWP).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={applyLeave} className="space-y-4">
              <div>
                <Label className="text-xs font-bold text-slate-600">Leave Type</Label>
                <Select value={leaveType} onValueChange={v => setLeaveType(v ?? '')}>
                  <SelectTrigger className="mt-1 w-full font-semibold">
                    <SelectValue placeholder="Select leave type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CL">Casual Leave (CL) — {clRemaining} Available</SelectItem>
                    <SelectItem value="COMP_OFF">Comp-off Utilization — {netAvailableCompOffs} Available</SelectItem>
                    <SelectItem value="LWP">Leave Without Pay (LWP)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Informative helper for selected leave type */}
              {leaveType === 'COMP_OFF' && (
                <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-xs text-blue-900 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <Info className="h-4 w-4 text-[#1677ca]" />
                    Comp-off Utilization Leave
                  </div>
                  <p>
                    You have <strong>{availableCompOffs} day(s)</strong> approved comp-off balance.
                    {pendingCompOffDays > 0 && ` (${pendingCompOffDays} day(s) currently reserved by pending requests).`}
                  </p>
                  <p className="text-[11px] text-blue-700">
                    Once approved by HR, your comp-off balance will be deducted without consuming Casual Leaves or impacting salary.
                  </p>
                  {netAvailableCompOffs <= 0 && (
                    <p className="text-red-600 font-bold mt-1">
                      ⚠️ You have 0 unreserved comp-off days available. Please request a comp-off first or choose Casual Leave.
                    </p>
                  )}
                </div>
              )}

              {leaveType === 'CL' && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-600">
                  Casual Leave balance: <strong>{clRemaining} day(s)</strong> remaining for {new Date().getFullYear()}.
                </div>
              )}

              <div>
                <Label className="text-xs font-bold text-slate-600">Leave Duration</Label>
                <Select value={leaveDuration} onValueChange={v => setLeaveDuration(v ?? 'FULL_DAY')}>
                  <SelectTrigger className="mt-1 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FULL_DAY">Full Day (1 Day)</SelectItem>
                    <SelectItem value="FIRST_HALF">Half Day — First Half (0.5 Day)</SelectItem>
                    <SelectItem value="SECOND_HALF">Half Day — Second Half (0.5 Day)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-bold text-slate-600">
                    {leaveDuration === 'FULL_DAY' ? 'Start Date' : 'Leave Date'}
                  </Label>
                  <Input
                    className="mt-1"
                    type="date"
                    value={startDate}
                    onChange={e => {
                      setStartDate(e.target.value)
                      if (leaveDuration !== 'FULL_DAY') setEndDate(e.target.value)
                    }}
                    required
                  />
                </div>
                {leaveDuration === 'FULL_DAY' && (
                  <div>
                    <Label className="text-xs font-bold text-slate-600">End Date</Label>
                    <Input
                      className="mt-1"
                      type="date"
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                      required
                    />
                  </div>
                )}
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-600">Reason</Label>
                <Input
                  className="mt-1"
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="Reason for leave"
                  required
                />
              </div>

              <Button
                disabled={loading || !leaveType || (leaveType === 'COMP_OFF' && netAvailableCompOffs <= 0)}
                type="submit"
                className="w-full bg-[#1678d2] hover:bg-[#126bbd] text-white font-bold h-11"
              >
                {loading ? 'Submitting...' : 'Submit Leave Request'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* REQUEST NEW COMP-OFF CARD */}
        <Card className="border-[#cfe5f7]">
          <CardHeader>
            <CardTitle className="text-xl text-[#14245b]">Request Comp-off</CardTitle>
            <CardDescription>
              Claim a compensatory off for working on a Sunday, holiday, or extra duty shift.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={requestCompOff} className="space-y-4">
              <div>
                <Label className="text-xs font-bold text-slate-600">Worked Date</Label>
                <Input
                  className="mt-1"
                  type="date"
                  value={workedDate}
                  onChange={e => setWorkedDate(e.target.value)}
                  required
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-600">Comp-off Duration</Label>
                <Select value={compDuration} onValueChange={v => setCompDuration(v ?? 'FULL_DAY')}>
                  <SelectTrigger className="mt-1 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FULL_DAY">Full Day (1 Day)</SelectItem>
                    <SelectItem value="HALF_DAY">Half Day (0.5 Day)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-600">Reason / Work Details</Label>
                <Input
                  className="mt-1"
                  value={compReason}
                  onChange={e => setCompReason(e.target.value)}
                  placeholder="e.g. Hospital support duty on Sunday"
                  required
                />
              </div>

              <Button
                disabled={loading || !workedDate}
                type="submit"
                variant="outline"
                className="w-full h-11 font-bold border-[#1678d2] text-[#1678d2] hover:bg-blue-50"
              >
                {loading ? 'Submitting...' : 'Request Comp-off'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Leave Requests Table */}
      <Card>
        <CardHeader>
          <CardTitle>Leave Requests History</CardTitle>
          <CardDescription>Status of your submitted leave and comp-off utilization applications.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(data.requests || []).map((req: any) => (
              <div key={req.id} className="flex flex-col gap-2 rounded-xl border p-3.5 sm:flex-row sm:items-center sm:justify-between hover:bg-slate-50 transition">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex rounded-md px-2 py-0.5 text-xs font-bold ${
                        req.leaveType === 'COMP_OFF'
                          ? 'bg-blue-100 text-blue-800'
                          : req.leaveType === 'CL'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {req.leaveType === 'COMP_OFF' ? 'Comp-off' : req.leaveType === 'CL' ? 'Casual Leave (CL)' : 'LWP'}
                    </span>
                    <span className="font-bold text-[#14245b]">
                      {req.days} Day(s) · {req.durationType === 'FIRST_HALF' ? 'First Half' : req.durationType === 'SECOND_HALF' ? 'Second Half' : 'Full Day'}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {format(new Date(req.startDate), 'dd MMM yyyy')}
                    {req.startDate !== req.endDate && ` to ${format(new Date(req.endDate), 'dd MMM yyyy')}`}
                    {req.reason && ` · Reason: ${req.reason}`}
                    {req.reviewRemarks && ` · HR: ${req.reviewRemarks}`}
                  </div>
                </div>
                <div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      req.status === 'APPROVED'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : req.status === 'REJECTED'
                        ? 'bg-red-50 text-red-700 border border-red-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}
                  >
                    {req.status}
                  </span>
                </div>
              </div>
            ))}
            {(data.requests || []).length === 0 && <p className="text-sm text-gray-500">No leave requests yet.</p>}
          </div>
        </CardContent>
      </Card>

      {/* Comp-off Requests History */}
      <Card>
        <CardHeader>
          <CardTitle>Comp-off Earned Claims</CardTitle>
          <CardDescription>Claims submitted to earn compensatory offs for extra duty.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(data.compRequests || []).map((req: any) => (
              <div key={req.id} className="flex flex-col gap-2 rounded-xl border p-3.5 sm:flex-row sm:items-center sm:justify-between hover:bg-slate-50 transition">
                <div>
                  <div className="font-bold text-[#14245b]">
                    {req.durationType === 'HALF_DAY' ? 'Half Day' : 'Full Day'} Comp-off Claim ({req.duration || 1} Day)
                  </div>
                  <div className="mt-0.5 text-xs text-gray-500">
                    Worked: {format(new Date(req.workedDate), 'dd MMM yyyy')} · {req.reason}
                    {req.reviewRemarks && ` · HR: ${req.reviewRemarks}`}
                  </div>
                </div>
                <div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      req.status === 'APPROVED'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : req.status === 'REJECTED'
                        ? 'bg-red-50 text-red-700 border border-red-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}
                  >
                    {req.status}
                  </span>
                </div>
              </div>
            ))}
            {(data.compRequests || []).length === 0 && <p className="text-sm text-gray-500">No comp-off claims submitted yet.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
