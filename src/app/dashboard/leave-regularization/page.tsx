"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { EmployeeLookup, type EmployeeLookupRecord } from "@/components/hr/employee-lookup"

export default function LeaveRegularizationPage() {
  const router = useRouter()
  const { data: session, status: sessionStatus } = useSession()
  const [employees, setEmployees] = useState<EmployeeLookupRecord[]>([])
  const [leaveRequests, setLeaveRequests] = useState<any[]>([])
  const [compRequests, setCompRequests] = useState<any[]>([])
  const [employeeQuery, setEmployeeQuery] = useState('')
  const [selected, setSelected] = useState<EmployeeLookupRecord | null>(null)
  const [form, setForm] = useState({ startDate: '', endDate: '', leaveType: 'CL', durationType: 'FULL_DAY', reason: '' })
  const [remarks, setRemarks] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  const [loadingId, setLoadingId] = useState('')
  const [loading, setLoading] = useState(false)

  const load = async () => {
    const [leaveRes, compRes, empRes] = await Promise.all([fetch('/api/leave/admin', { cache: 'no-store' }), fetch('/api/hr/compoff', { cache: 'no-store' }), fetch('/api/hr/employees', { cache: 'no-store' })])
    if (leaveRes.ok) { const d = await leaveRes.json(); setLeaveRequests(d.requests || []); setEmployees(d.employees || []) }
    if (compRes.ok) { const d = await compRes.json(); setCompRequests(d.requests || []) }
    if (empRes.ok) { const d = await empRes.json(); setEmployees(d.employees || []) }
  }

  useEffect(() => {
    if (sessionStatus === 'authenticated' && session?.user?.role !== 'SUPER_ADMIN') { router.replace('/dashboard'); return }
    if (sessionStatus === 'authenticated' && session?.user?.role === 'SUPER_ADMIN') load()
  }, [sessionStatus, session?.user?.role])

  const reviewLeave = async (requestId: string, action: 'APPROVE' | 'REJECT') => {
    setLoadingId(requestId); setMessage('')
    const reviewRemarks = remarks[requestId] || ''
    const res = await fetch('/api/leave/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId, action, reviewRemarks, rejectionReason: reviewRemarks }) })
    const d = await res.json(); setMessage(res.ok ? `Leave ${action === 'APPROVE' ? 'approved' : 'rejected'}.` : d.error || 'Action failed'); if (res.ok) load(); setLoadingId('')
  }

  const reviewComp = async (requestId: string, action: 'APPROVE' | 'REJECT') => {
    setLoadingId(requestId); setMessage('')
    const reviewRemarks = remarks[requestId] || ''
    const res = await fetch('/api/hr/compoff', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId, action, reviewRemarks, rejectionReason: reviewRemarks }) })
    const d = await res.json(); setMessage(res.ok ? `Comp-off ${action === 'APPROVE' ? 'approved' : 'rejected'}.` : d.error || 'Action failed'); if (res.ok) load(); setLoadingId('')
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected) return setMessage('Please enter a valid Employee ID or select an employee by name.')
    setLoading(true); setMessage('')
    const endDate = form.durationType === 'FULL_DAY' ? form.endDate : form.startDate
    const res = await fetch('/api/leave/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, endDate, employeeId: selected.id, action: 'REGULARIZE' }) })
    const data = await res.json()
    setMessage(res.ok ? 'Leave regularized by HR.' : data.error || 'Unable to regularize leave.')
    if (res.ok) { setForm({ startDate: '', endDate: '', leaveType: 'CL', durationType: 'FULL_DAY', reason: '' }); setSelected(null); setEmployeeQuery(''); load() }
    setLoading(false)
  }

  const pendingLeaves = leaveRequests.filter(x => x.status === 'PENDING')
  const pendingComp = compRequests.filter(x => x.status === 'PENDING')

  return <div className="space-y-6">
    <div><h1 className="text-3xl font-bold tracking-tight text-[#14245b]">Leave & Comp-off Management</h1><p className="text-slate-500">Review employee requests, add HR remarks, approve/reject requests, or regularize an offline request.</p></div>
    {message && <div className="rounded-xl border bg-white p-3 text-sm">{message}</div>}

    <div className="grid gap-4 md:grid-cols-2"><Card><CardContent className="p-5"><p className="text-sm font-semibold text-slate-500">Pending Leaves</p><p className="mt-1 text-3xl font-extrabold text-[#14245b]">{pendingLeaves.length}</p></CardContent></Card><Card><CardContent className="p-5"><p className="text-sm font-semibold text-slate-500">Pending Comp-offs</p><p className="mt-1 text-3xl font-extrabold text-[#14245b]">{pendingComp.length}</p></CardContent></Card></div>

    <Card><CardHeader><CardTitle>Leave Requests Awaiting Approval</CardTitle><CardDescription>Review the employee request first. Add an optional HR remark, then approve or reject.</CardDescription></CardHeader><CardContent><div className="space-y-4">
      {pendingLeaves.map(req => <div key={req.id} className="rounded-2xl border p-4"><div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><p className="font-bold text-[#14245b]">{req.employee.name} <span className="font-normal text-slate-400">({req.employee.id})</span></p><p className="mt-1 text-sm">{req.leaveType} · {req.days} day(s) · {req.durationType === 'FIRST_HALF' ? 'First Half' : req.durationType === 'SECOND_HALF' ? 'Second Half' : 'Full Day'}</p><p className="text-xs text-slate-500">{new Date(req.startDate).toLocaleDateString('en-IN')} {new Date(req.startDate).getTime() !== new Date(req.endDate).getTime() ? `to ${new Date(req.endDate).toLocaleDateString('en-IN')}` : ''} · {req.reason || 'No reason'}</p></div><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">PENDING</span></div><div className="mt-3"><Input value={remarks[req.id] || ''} onChange={e => setRemarks(x => ({ ...x, [req.id]: e.target.value }))} placeholder="Optional HR approval/rejection remark" /></div><div className="mt-3 flex gap-2"><Button size="sm" disabled={loadingId === req.id} onClick={() => reviewLeave(req.id, 'APPROVE')}>Approve</Button><Button size="sm" variant="destructive" disabled={loadingId === req.id} onClick={() => reviewLeave(req.id, 'REJECT')}>Reject</Button></div></div>)}
      {pendingLeaves.length === 0 && <p className="text-sm text-slate-500">No pending leave requests.</p>}
    </div></CardContent></Card>

    <Card><CardHeader><CardTitle>Comp-off Requests Awaiting Approval</CardTitle><CardDescription>Full-day and half-day comp-off requests are reviewed here.</CardDescription></CardHeader><CardContent><div className="space-y-4">
      {pendingComp.map(req => <div key={req.id} className="rounded-2xl border p-4"><div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><p className="font-bold text-[#14245b]">{req.employee.name} <span className="font-normal text-slate-400">({req.employee.id})</span></p><p className="mt-1 text-sm">Worked Date: {new Date(req.workedDate).toLocaleDateString('en-IN')} · {req.durationType === 'HALF_DAY' ? 'Half Day' : 'Full Day'} ({req.duration || 1})</p><p className="text-xs text-slate-500">{req.reason}</p></div><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">PENDING</span></div><div className="mt-3"><Input value={remarks[req.id] || ''} onChange={e => setRemarks(x => ({ ...x, [req.id]: e.target.value }))} placeholder="Optional HR approval/rejection remark" /></div><div className="mt-3 flex gap-2"><Button size="sm" disabled={loadingId === req.id} onClick={() => reviewComp(req.id, 'APPROVE')}>Approve</Button><Button size="sm" variant="destructive" disabled={loadingId === req.id} onClick={() => reviewComp(req.id, 'REJECT')}>Reject</Button></div></div>)}
      {pendingComp.length === 0 && <p className="text-sm text-slate-500">No pending comp-off requests.</p>}
    </div></CardContent></Card>

    <Card><CardHeader><CardTitle>Manual Leave Regularization</CardTitle><CardDescription>Use this only when HR has an approved offline leave request that was not submitted through the employee portal.</CardDescription></CardHeader><CardContent><form onSubmit={submit} className="space-y-5">
      <EmployeeLookup employees={employees} value={employeeQuery} onChange={setEmployeeQuery} onSelect={setSelected} />
      {selected && <div className="grid gap-3 rounded-2xl border border-[#cfe5f7] bg-[#f4faff] p-4 md:grid-cols-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Employee Name</p><p className="mt-1 font-bold text-[#14245b]">{selected.name}</p></div><div><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Department</p><p className="mt-1 font-semibold">{selected.department || '-'}</p></div><div><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Designation</p><p className="mt-1 font-semibold">{selected.designation || '-'}</p></div></div>}
      <div className="grid gap-3 md:grid-cols-4"><div><Label>Leave Type</Label><Select value={form.leaveType} onValueChange={v => setForm(x => ({ ...x, leaveType: v ?? 'CL' }))}><SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="CL">Casual Leave (CL)</SelectItem><SelectItem value="COMP_OFF">Comp-off (Compensatory Off)</SelectItem><SelectItem value="LWP">Leave Without Pay</SelectItem></SelectContent></Select></div><div><Label>Duration</Label><Select value={form.durationType} onValueChange={v => setForm(x => ({ ...x, durationType: v ?? 'FULL_DAY' }))}><SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="FULL_DAY">Full Day</SelectItem><SelectItem value="FIRST_HALF">Half Day — First Half</SelectItem><SelectItem value="SECOND_HALF">Half Day — Second Half</SelectItem></SelectContent></Select></div><div><Label>{form.durationType === 'FULL_DAY' ? 'Start Date' : 'Leave Date'}</Label><Input className="mt-1" type="date" value={form.startDate} onChange={e => setForm(x => ({ ...x, startDate: e.target.value, endDate: x.durationType === 'FULL_DAY' ? x.endDate : e.target.value }))} required /></div>{form.durationType === 'FULL_DAY' && <div><Label>End Date</Label><Input className="mt-1" type="date" value={form.endDate} onChange={e => setForm(x => ({ ...x, endDate: e.target.value }))} required /></div>}</div>
      <div><Label>Reason / Offline Source</Label><Input className="mt-1" value={form.reason} onChange={e => setForm(x => ({ ...x, reason: e.target.value }))} placeholder="Reason / source of offline request" required /></div>
      <Button type="submit" disabled={loading || !selected}>{loading ? 'Saving...' : 'Regularize Leave'}</Button>
    </form></CardContent></Card>
  </div>
}
