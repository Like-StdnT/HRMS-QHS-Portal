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

export default function LeavePage() {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()
  const [data, setData] = useState<any>({ balance: {}, requests: [], compOffs: [], compRequests: [] })
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
    const [leaveRes, compRes] = await Promise.all([fetch('/api/leave', { cache: 'no-store' }), fetch('/api/compoff', { cache: 'no-store' })])
    const leave = leaveRes.ok ? await leaveRes.json() : {}
    const comp = compRes.ok ? await compRes.json() : {}
    setData({ ...leave, compOffs: comp.available || [], compRequests: comp.requests || [] })
  }

  useEffect(() => {
    if (sessionStatus === 'authenticated' && session?.user?.role === 'SUPER_ADMIN') { router.replace('/dashboard/hr'); return }
    if (sessionStatus === 'authenticated') load()
  }, [sessionStatus, session?.user?.role])

  const applyLeave = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setMessage('')
    const effectiveEnd = leaveDuration === 'FULL_DAY' ? endDate : startDate
    const res = await fetch('/api/leave', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leaveType, durationType: leaveDuration, startDate, endDate: effectiveEnd, reason }) })
    const body = await res.json()
    setMessage(res.ok ? 'Leave request submitted for HR approval.' : body.error || 'Unable to submit leave.')
    if (res.ok) { setLeaveType(''); setLeaveDuration('FULL_DAY'); setStartDate(''); setEndDate(''); setReason(''); await load() }
    setLoading(false)
  }

  const requestCompOff = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setMessage('')
    const res = await fetch('/api/compoff', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workedDate, durationType: compDuration, reason: compReason }) })
    const body = await res.json()
    setMessage(res.ok ? 'Comp-off request submitted. Only HR/Admin can approve it.' : body.error || 'Unable to submit comp-off request.')
    if (res.ok) { setWorkedDate(''); setCompDuration('FULL_DAY'); setCompReason(''); await load() }
    setLoading(false)
  }

  const remaining = data.balance?.remaining ?? 0
  const pending = data.balance?.pendingDays ?? 0

  return <div className="space-y-6">
    <div><h1 className="text-3xl font-bold tracking-tight">Leave & Comp-off</h1><p className="text-gray-500">Apply for full-day or half-day leave and request full-day or half-day comp-off.</p></div>
    {message && <div className="rounded-lg border bg-white p-3 text-sm">{message}</div>}
    <div className="grid gap-4 md:grid-cols-3">
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">CL Balance</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">{remaining}</div><p className="text-xs text-gray-500">Available after approved and reserved CL</p></CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">CL Credited</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">{data.balance?.total ?? 0}</div><p className="text-xs text-gray-500">1 CL per month from joining month</p></CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Comp-offs</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">{data.compOffs?.filter((x: any) => x.status === 'AVAILABLE').reduce((sum: number, x: any) => sum + Number(x.duration || 1), 0) ?? 0}</div><p className="text-xs text-gray-500">Approved and available days</p></CardContent></Card>
    </div>

    <div className="grid gap-6 lg:grid-cols-2">
      <Card><CardHeader><CardTitle>Apply Leave</CardTitle><CardDescription>Full day uses 1 day. Half day uses 0.5 day of the selected leave balance.</CardDescription></CardHeader><CardContent><form onSubmit={applyLeave} className="space-y-4">
        <div><Label>Leave Type</Label><Select value={leaveType} onValueChange={v => setLeaveType(v ?? '')}><SelectTrigger className="mt-1 w-full"><SelectValue placeholder="Select leave type" /></SelectTrigger><SelectContent><SelectItem value="CL">Casual Leave (CL)</SelectItem><SelectItem value="LWP">Leave Without Pay (LWP)</SelectItem></SelectContent></Select></div>
        <div><Label>Leave Duration</Label><Select value={leaveDuration} onValueChange={v => setLeaveDuration(v ?? 'FULL_DAY')}><SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="FULL_DAY">Full Day</SelectItem><SelectItem value="FIRST_HALF">Half Day — First Half</SelectItem><SelectItem value="SECOND_HALF">Half Day — Second Half</SelectItem></SelectContent></Select></div>
        <div className="grid grid-cols-2 gap-3"><div><Label>{leaveDuration === 'FULL_DAY' ? 'Start Date' : 'Leave Date'}</Label><Input className="mt-1" type="date" value={startDate} onChange={e => { setStartDate(e.target.value); if (leaveDuration !== 'FULL_DAY') setEndDate(e.target.value) }} required /></div>{leaveDuration === 'FULL_DAY' && <div><Label>End Date</Label><Input className="mt-1" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required /></div>}</div>
        <div><Label>Reason</Label><Input className="mt-1" value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason for leave" /></div>
        <Button disabled={loading || !leaveType} type="submit">{loading ? 'Submitting...' : 'Submit Leave Request'}</Button>
        {pending > 0 && <p className="text-xs text-gray-500">Pending CL requests: {pending} day(s)</p>}
      </form></CardContent></Card>

      <Card><CardHeader><CardTitle>Request Comp-off</CardTitle><CardDescription>Choose whether the approved comp-off is for a full day or half day.</CardDescription></CardHeader><CardContent><form onSubmit={requestCompOff} className="space-y-4">
        <div><Label>Worked Date</Label><Input className="mt-1" type="date" value={workedDate} onChange={e => setWorkedDate(e.target.value)} required /></div>
        <div><Label>Comp-off Duration</Label><Select value={compDuration} onValueChange={v => setCompDuration(v ?? 'FULL_DAY')}><SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="FULL_DAY">Full Day</SelectItem><SelectItem value="HALF_DAY">Half Day</SelectItem></SelectContent></Select></div>
        <div><Label>Reason / Work Details</Label><Input className="mt-1" value={compReason} onChange={e => setCompReason(e.target.value)} placeholder="e.g. Worked on Sunday for client visit" required /></div>
        <Button disabled={loading} type="submit" variant="outline">{loading ? 'Submitting...' : 'Request Comp-off'}</Button>
      </form></CardContent></Card>
    </div>

    <Card><CardHeader><CardTitle>Leave Requests</CardTitle></CardHeader><CardContent><div className="space-y-3">
      {(data.requests || []).map((req: any) => <div key={req.id} className="flex items-center justify-between border-b pb-3"><div><div className="font-medium">{req.leaveType} — {req.days} day(s) · {req.durationType === 'FIRST_HALF' ? 'First Half' : req.durationType === 'SECOND_HALF' ? 'Second Half' : 'Full Day'}</div><div className="text-xs text-gray-500">{format(new Date(req.startDate), 'dd MMM yyyy')} {req.startDate !== req.endDate && `to ${format(new Date(req.endDate), 'dd MMM yyyy')}`} · {req.reason || 'No reason'}</div></div><span className={`rounded-full px-2 py-1 text-xs ${req.status === 'APPROVED' ? 'bg-green-100 text-green-700' : req.status === 'REJECTED' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{req.status}</span></div>)}
      {(data.requests || []).length === 0 && <p className="text-sm text-gray-500">No leave requests yet.</p>}
    </div></CardContent></Card>

    <Card><CardHeader><CardTitle>Comp-off Requests</CardTitle></CardHeader><CardContent><div className="space-y-3">
      {(data.compRequests || []).map((req: any) => <div key={req.id} className="flex items-center justify-between border-b pb-3"><div><div className="font-medium">{req.durationType === 'HALF_DAY' ? 'Half Day' : 'Full Day'} Comp-off — {req.duration || 1} day(s)</div><div className="text-xs text-gray-500">Worked: {format(new Date(req.workedDate), 'dd MMM yyyy')} · {req.reason}</div></div><span className={`rounded-full px-2 py-1 text-xs ${req.status === 'APPROVED' ? 'bg-green-100 text-green-700' : req.status === 'REJECTED' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{req.status}</span></div>)}
      {(data.compRequests || []).length === 0 && <p className="text-sm text-gray-500">No comp-off requests yet.</p>}
    </div></CardContent></Card>
  </div>
}
