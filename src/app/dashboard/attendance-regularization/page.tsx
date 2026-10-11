"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { EmployeeLookup, type EmployeeLookupRecord } from "@/components/hr/employee-lookup"

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })

export default function AttendanceRegularizationPage() {
  const router = useRouter()
  const { data: session, status: sessionStatus } = useSession()
  const [employees, setEmployees] = useState<EmployeeLookupRecord[]>([])
  const [employeeQuery, setEmployeeQuery] = useState('')
  const [selected, setSelected] = useState<EmployeeLookupRecord | null>(null)
  const [form, setForm] = useState({ date: today(), punchIn: '', reachedAt: '', punchOut: '', status: '', reason: '' })
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (sessionStatus === 'authenticated' && session?.user?.role !== 'SUPER_ADMIN') {
      router.replace('/dashboard')
      return
    }
    if (sessionStatus !== 'authenticated' || session?.user?.role !== 'SUPER_ADMIN') return
    fetch('/api/hr/employees').then(async (res) => {
      if (res.ok) {
        const data = await res.json()
        setEmployees(data.employees || [])
      }
    })
  }, [sessionStatus, session?.user?.role])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected) return setMessage('Please enter a valid Employee ID or select an employee by name.')
    setLoading(true); setMessage('')
    const res = await fetch('/api/hr/attendance', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: selected.id, ...form }),
    })
    const data = await res.json()
    setMessage(res.ok ? 'Attendance regularized and audit record created.' : data.error || 'Unable to regularize attendance.')
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold tracking-tight text-[#14245b]">Attendance Regularization</h1><p className="text-slate-500">Correct employee attendance when HR receives a valid offline/incomplete attendance request.</p></div>
      {message && <div className="rounded-xl border bg-white p-3 text-sm">{message}</div>}
      <Card>
        <CardHeader><CardTitle>Employee & Attendance Details</CardTitle><CardDescription>Enter Employee ID and press Enter, or search by employee name. Employee details are loaded automatically.</CardDescription></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-5">
            <EmployeeLookup employees={employees} value={employeeQuery} onChange={setEmployeeQuery} onSelect={setSelected} />
            {selected && <div className="grid gap-3 rounded-2xl border border-[#cfe5f7] bg-[#f4faff] p-4 md:grid-cols-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Employee Name</p><p className="mt-1 font-bold text-[#14245b]">{selected.name}</p></div><div><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Department</p><p className="mt-1 font-semibold">{selected.department || '-'}</p></div><div><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Designation</p><p className="mt-1 font-semibold">{selected.designation || '-'}</p></div></div>}
            <div className="grid gap-3 md:grid-cols-4"><div><Label>Date</Label><Input className="mt-1" type="date" value={form.date} onChange={e => setForm(x => ({ ...x, date: e.target.value }))} required /></div><div><Label>Travel Start</Label><Input className="mt-1" type="datetime-local" value={form.punchIn} onChange={e => setForm(x => ({ ...x, punchIn: e.target.value }))} /></div><div><Label>Reached Hospital</Label><Input className="mt-1" type="datetime-local" value={form.reachedAt} onChange={e => setForm(x => ({ ...x, reachedAt: e.target.value }))} /></div><div><Label>Punch Out / Duty Off</Label><Input className="mt-1" type="datetime-local" value={form.punchOut} onChange={e => setForm(x => ({ ...x, punchOut: e.target.value }))} /></div></div>
            <div><Label>Reason</Label><Input className="mt-1" value={form.reason} onChange={e => setForm(x => ({ ...x, reason: e.target.value }))} placeholder="Why HR is regularizing this attendance" required /></div>
            <Button type="submit" disabled={loading || !selected}>{loading ? 'Saving...' : 'Save Attendance Regularization'}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
