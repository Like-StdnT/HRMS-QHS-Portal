"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function HRPage() {
  const [leaveRequests, setLeaveRequests] = useState<any[]>([])
  const [compRequests, setCompRequests] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [message, setMessage] = useState('')
  const [employeeForm, setEmployeeForm] = useState({ id: '', name: '', password: '', department: '', designation: '', dateOfJoining: '', annualCtc: '', monthlySalary: '', workMode: 'FIELD', email: '' })

  const load = async () => {
    const [leaveRes, compRes, empRes] = await Promise.all([fetch('/api/leave/admin'), fetch('/api/hr/compoff'), fetch('/api/hr/employees')])
    if (leaveRes.ok) { const d = await leaveRes.json(); setLeaveRequests(d.requests || []) }
    if (compRes.ok) { const d = await compRes.json(); setCompRequests(d.requests || []) }
    if (empRes.ok) { const d = await empRes.json(); setEmployees(d.employees || []) }
  }
  useEffect(() => { load() }, [])

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
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold tracking-tight">HR Management</h1><p className="text-gray-500">Employee master, leave/comp-off approvals and HR payroll controls.</p></div>
      {message && <div className="rounded-lg border bg-white p-3 text-sm">{message}</div>}

      <div className="grid gap-4 md:grid-cols-3"><Card><CardHeader className="pb-2"><CardTitle className="text-sm">Pending Leaves</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">{leaveRequests.filter(x => x.status === 'PENDING').length}</div></CardContent></Card><Card><CardHeader className="pb-2"><CardTitle className="text-sm">Pending Comp-offs</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">{compRequests.filter(x => x.status === 'PENDING').length}</div></CardContent></Card><Card><CardHeader className="pb-2"><CardTitle className="text-sm">Active Employees</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">{employees.filter(x => x.active).length}</div></CardContent></Card></div>

      <div className="grid gap-4 md:grid-cols-2"><Link href="/dashboard/attendance-regularization" className="rounded-2xl border border-[#cfe5f7] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><p className="text-sm font-bold text-[#14245b]">Attendance Regularization</p><p className="mt-1 text-xs text-slate-500">Open the dedicated employee lookup and attendance correction workspace.</p></Link><Link href="/dashboard/leave-regularization" className="rounded-2xl border border-[#cfe5f7] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><p className="text-sm font-bold text-[#14245b]">Leave Regularization</p><p className="mt-1 text-xs text-slate-500">Open the dedicated employee lookup and offline leave entry workspace.</p></Link></div>

      <Card><CardHeader><CardTitle>Leave Approval</CardTitle><CardDescription>Employees submit leave requests; only Super Admin can approve or reject them.</CardDescription></CardHeader><CardContent><div className="space-y-3">{leaveRequests.filter(x => x.status === 'PENDING').map(req => <div key={req.id} className="flex flex-col gap-3 rounded-lg border p-3 md:flex-row md:items-center md:justify-between"><div><div className="font-medium">{req.employee.name} ({req.employee.id}) — {req.leaveType}</div><div className="text-xs text-gray-500">{new Date(req.startDate).toLocaleDateString('en-IN')} to {new Date(req.endDate).toLocaleDateString('en-IN')} · {req.days} day(s) · {req.reason || 'No reason'}</div></div><div className="flex gap-2"><Button size="sm" onClick={() => reviewLeave(req.id, 'APPROVE')}>Approve</Button><Button size="sm" variant="destructive" onClick={() => reviewLeave(req.id, 'REJECT')}>Reject</Button></div></div>)}{leaveRequests.filter(x => x.status === 'PENDING').length === 0 && <p className="text-sm text-gray-500">No pending leave requests.</p>}</div></CardContent></Card>

      <Card><CardHeader><CardTitle>Comp-off Approval</CardTitle><CardDescription>Employees can request comp-off; only Super Admin can approve or reject.</CardDescription></CardHeader><CardContent><div className="space-y-3">{compRequests.filter(x => x.status === 'PENDING').map(req => <div key={req.id} className="flex flex-col gap-3 rounded-lg border p-3 md:flex-row md:items-center md:justify-between"><div><div className="font-medium">{req.employee.name} ({req.employee.id})</div><div className="text-xs text-gray-500">Worked: {new Date(req.workedDate).toLocaleDateString('en-IN')} · {req.reason}</div></div><div className="flex gap-2"><Button size="sm" onClick={() => reviewComp(req.id, 'APPROVE')}>Approve</Button><Button size="sm" variant="destructive" onClick={() => reviewComp(req.id, 'REJECT')}>Reject</Button></div></div>)}{compRequests.filter(x => x.status === 'PENDING').length === 0 && <p className="text-sm text-gray-500">No pending comp-off requests.</p>}</div></CardContent></Card>

      <Card><CardHeader><CardTitle>Year-end CL Encashment</CardTitle><CardDescription>Record the approved CL encashment according to company policy.</CardDescription></CardHeader><CardContent><form onSubmit={async (e) => { e.preventDefault(); const form = new FormData(e.currentTarget); const res = await fetch('/api/hr/leave-encashment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ employeeId: form.get('employeeId'), year: form.get('year'), days: form.get('days'), amount: form.get('amount') }) }); const d = await res.json(); setMessage(res.ok ? 'CL encashment recorded.' : d.error || 'Unable to process encashment'); if (res.ok) e.currentTarget.reset() }} className="grid gap-3 md:grid-cols-4"><div><Label>Employee</Label><select name="employeeId" className="mt-1 h-10 w-full rounded-xl border border-[#dbe5f0] bg-white px-3 text-sm" required><option value="">Select employee</option>{employees.map(e => <option key={e.id} value={e.id}>{e.name} — {e.id}</option>)}</select></div><div><Label>Year</Label><Input className="mt-1" name="year" type="number" defaultValue={new Date().getFullYear()} required /></div><div><Label>CL Days</Label><Input className="mt-1" name="days" type="number" min="0.5" step="0.5" required /></div><div><Label>Encashment Amount</Label><Input className="mt-1" name="amount" type="number" min="0" step="0.01" required /></div><div><Button type="submit">Process Encashment</Button></div></form></CardContent></Card>

      <Card><CardHeader><CardTitle>Employee Enrollment</CardTitle><CardDescription>Create employee login access and maintain the employee master. New accounts are always created as Employee, never as Super Admin.</CardDescription></CardHeader><CardContent><form onSubmit={saveEmployee} className="grid gap-3 md:grid-cols-2 lg:grid-cols-3"><div><Label>Employee ID</Label><Input className="mt-1" value={employeeForm.id} onChange={e => setEmployeeForm(x => ({ ...x, id: e.target.value }))} required /></div><div><Label>Name</Label><Input className="mt-1" value={employeeForm.name} onChange={e => setEmployeeForm(x => ({ ...x, name: e.target.value }))} required /></div><div><Label>Email</Label><Input className="mt-1" value={employeeForm.email} onChange={e => setEmployeeForm(x => ({ ...x, email: e.target.value }))} /></div><div><Label>Department</Label><Input className="mt-1" value={employeeForm.department} onChange={e => setEmployeeForm(x => ({ ...x, department: e.target.value }))} /></div><div><Label>Designation</Label><Input className="mt-1" value={employeeForm.designation} onChange={e => setEmployeeForm(x => ({ ...x, designation: e.target.value }))} /></div><div><Label>Date of Joining</Label><Input className="mt-1" type="date" value={employeeForm.dateOfJoining} onChange={e => setEmployeeForm(x => ({ ...x, dateOfJoining: e.target.value }))} /></div><div><Label>Annual CTC</Label><Input className="mt-1" type="number" value={employeeForm.annualCtc} onChange={e => setEmployeeForm(x => ({ ...x, annualCtc: e.target.value }))} /></div><div><Label>Monthly Salary</Label><Input className="mt-1" type="number" value={employeeForm.monthlySalary} onChange={e => setEmployeeForm(x => ({ ...x, monthlySalary: e.target.value }))} /></div><div><Label>Work Mode</Label><Select value={employeeForm.workMode} onValueChange={v => setEmployeeForm(x => ({ ...x, workMode: v ?? 'FIELD' }))}><SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="FIELD">Field</SelectItem><SelectItem value="OFFICE">Office</SelectItem></SelectContent></Select></div><div><Label>New Password</Label><Input className="mt-1" type="password" value={employeeForm.password} onChange={e => setEmployeeForm(x => ({ ...x, password: e.target.value }))} placeholder="Leave blank to keep existing" /></div><div className="flex items-end gap-2"><Button type="submit">Enroll / Save Employee</Button></div></form></CardContent></Card>

      <Card><CardHeader><CardTitle>Employee Login Access</CardTitle><CardDescription>Disable preserves HR history while immediately blocking portal login. Restore reactivates access.</CardDescription></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead><tr className="border-b text-left"><th className="p-2">ID</th><th className="p-2">Name</th><th className="p-2">Department</th><th className="p-2">DOJ</th><th className="p-2">Monthly Salary</th><th className="p-2">Mode</th><th className="p-2">Status</th><th className="p-2">Action</th></tr></thead><tbody>{employees.map(e => <tr key={e.id} className="border-b"><td className="p-2">{e.id}</td><td className="p-2 font-medium">{e.name}</td><td className="p-2">{e.department || '-'}</td><td className="p-2">{e.dateOfJoining ? new Date(e.dateOfJoining).toLocaleDateString('en-IN') : '-'}</td><td className="p-2">{e.monthlySalary != null ? `₹${Number(e.monthlySalary).toLocaleString('en-IN')}` : '-'}</td><td className="p-2">{e.workMode}</td><td className="p-2"><span className={`rounded-full px-2 py-1 text-xs font-bold ${e.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{e.active ? 'ACTIVE' : 'INACTIVE'}</span></td><td className="p-2"><Button size="sm" variant={e.active ? 'destructive' : 'default'} onClick={() => changeEmployeeAccess(e.id, e.active ? 'DEACTIVATE' : 'REACTIVATE')}>{e.active ? 'Disable Login' : 'Restore Login'}</Button></td></tr>)}</tbody></table>{employees.length === 0 && <p className="py-5 text-sm text-slate-500">No employees enrolled yet.</p>}</div></CardContent></Card>
    </div>
  )
}
