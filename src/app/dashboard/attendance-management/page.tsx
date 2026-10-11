"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { MapPin, RefreshCw, Users, Clock3, CheckCircle2, Navigation, Download } from "lucide-react"

function fmt(date?: string | null) {
  if (!date) return '-'
  return new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date))
}
function duration(minutes?: number | null) {
  if (minutes == null) return '-'
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}
function mapsUrl(lat?: number | null, lng?: number | null) {
  if (lat == null || lng == null) return ''
  return `https://www.google.com/maps?q=${lat},${lng}`
}

export default function AttendanceManagementPage() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [data, setData] = useState<any>({ employees: [], records: [] })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [employees, setEmployees] = useState<any[]>([])
  const [reportType, setReportType] = useState('DAILY')
  const [reportEmployee, setReportEmployee] = useState('ALL')
  const [reportDate, setReportDate] = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }))
  const [reportMonth, setReportMonth] = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }).slice(0, 7))
  const [reportStart, setReportStart] = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }))
  const [reportEnd, setReportEnd] = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }))

  const load = async () => {
    setLoading(true)
    const res = await fetch(`/api/hr/attendance?date=${date}`, { cache: 'no-store' })
    const d = await res.json()
    if (res.ok) setData(d)
    else setMessage(d.error || 'Unable to load attendance.')
    setLoading(false)
  }
  useEffect(() => { load() }, [date])
  useEffect(() => { fetch('/api/hr/employees', { cache: 'no-store' }).then(r => r.ok ? r.json() : { employees: [] }).then(d => setEmployees(d.employees || [])) }, [])
  useEffect(() => {
    const id = setInterval(load, 30000)
    return () => clearInterval(id)
  }, [date])

  const deleteAttendance = async (id: string) => {
    if (!confirm('Delete this attendance record and its location audit events? Use this only for test/incorrect records.')) return
    setDeletingId(id)
    const res = await fetch('/api/hr/attendance', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    const d = await res.json()
    setMessage(res.ok ? 'Attendance record and location audit deleted.' : d.error || 'Unable to delete attendance.')
    if (res.ok) await load()
    setDeletingId(null)
  }

  const recordByEmployee = useMemo(() => new Map<string, any>(data.records.map((r: any) => [r.employeeId, r])), [data.records])
  const stats = useMemo(() => {
    const records = data.records as any[]
    return {
      total: data.employees.length,
      travelling: records.filter(r => r.status === 'TRAVELLING').length,
      onDuty: records.filter(r => r.status === 'ON_DUTY').length,
      completed: records.filter(r => r.status === 'COMPLETED').length,
    }
  }, [data])

  return <div className="space-y-6">
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#1f86df]">Super Admin</p><h1 className="text-3xl font-bold tracking-tight text-[#14245b]">Attendance Management</h1><p className="mt-1 text-gray-500">Monitor employee hospital visits, working status and latest shared locations.</p></div>
      <div className="flex gap-2"><input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-10 rounded-lg border bg-white px-3 text-sm"/><button onClick={load} className="inline-flex h-10 items-center gap-2 rounded-lg border bg-white px-3 text-sm font-semibold hover:bg-slate-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}/>Refresh</button></div>
    </div>
    {message && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{message}</div>}

    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {[[Users,'Active Employees',stats.total], [Navigation,'Travelling',stats.travelling], [Clock3,'On Duty',stats.onDuty], [CheckCircle2,'Completed',stats.completed]].map(([Icon,label,value]: any) => <Card key={label}><CardContent className="p-5"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-slate-500">{label}</p><p className="mt-1 text-3xl font-extrabold text-[#14245b]">{value}</p></div><div className="rounded-2xl bg-[#eaf5ff] p-3 text-[#1677ca]"><Icon className="h-5 w-5"/></div></div></CardContent></Card>)}
    </div>

    <Card><CardHeader><CardTitle>Attendance Reports</CardTitle><CardDescription>Download daily, weekly, monthly or custom-date attendance for one employee or all employees in the same Excel-compatible attendance layout.</CardDescription></CardHeader><CardContent className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <div><label className="mb-1 block text-xs font-semibold text-slate-500">Report Type</label><select value={reportType} onChange={e => setReportType(e.target.value)} className="h-10 w-full rounded-lg border bg-white px-3 text-sm"><option value="DAILY">Daily</option><option value="WEEKLY">Weekly</option><option value="MONTHLY">Monthly</option><option value="CUSTOM">Custom Date Range</option></select></div>
        <div><label className="mb-1 block text-xs font-semibold text-slate-500">Employee</label><select value={reportEmployee} onChange={e => setReportEmployee(e.target.value)} className="h-10 w-full rounded-lg border bg-white px-3 text-sm"><option value="ALL">All Employees</option>{employees.map(e => <option key={e.id} value={e.id}>{e.name} — {e.id}</option>)}</select></div>
        {reportType === 'DAILY' && <div><label className="mb-1 block text-xs font-semibold text-slate-500">Date</label><input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} className="h-10 w-full rounded-lg border bg-white px-3 text-sm"/></div>}
        {reportType === 'WEEKLY' && <div><label className="mb-1 block text-xs font-semibold text-slate-500">Week Start</label><input type="date" value={reportStart} onChange={e => setReportStart(e.target.value)} className="h-10 w-full rounded-lg border bg-white px-3 text-sm"/></div>}
        {reportType === 'MONTHLY' && <div><label className="mb-1 block text-xs font-semibold text-slate-500">Month</label><input type="month" value={reportMonth} onChange={e => setReportMonth(e.target.value)} className="h-10 w-full rounded-lg border bg-white px-3 text-sm"/></div>}
        {reportType === 'CUSTOM' && <><div><label className="mb-1 block text-xs font-semibold text-slate-500">Start Date</label><input type="date" value={reportStart} onChange={e => setReportStart(e.target.value)} className="h-10 w-full rounded-lg border bg-white px-3 text-sm"/></div><div><label className="mb-1 block text-xs font-semibold text-slate-500">End Date</label><input type="date" value={reportEnd} onChange={e => setReportEnd(e.target.value)} className="h-10 w-full rounded-lg border bg-white px-3 text-sm"/></div></>}
      </div>
      <div className="flex flex-wrap gap-2"><button onClick={() => { const params = new URLSearchParams({ type: reportType, employeeId: reportEmployee }); if (reportType === 'DAILY') params.set('date', reportDate); if (reportType === 'WEEKLY') params.set('startDate', reportStart); if (reportType === 'MONTHLY') params.set('month', reportMonth); if (reportType === 'CUSTOM') { params.set('startDate', reportStart); params.set('endDate', reportEnd) }; window.location.href = `/api/hr/attendance/report?${params.toString()}` }} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#1678d2] px-4 text-sm font-bold text-white hover:bg-[#126bbd]"><Download className="h-4 w-4"/>Download Excel Report</button><p className="self-center text-xs text-slate-400">Daily = 1 sheet · Weekly/Monthly/Custom = one sheet per date.</p></div>
    </CardContent></Card>

    <Card><CardHeader><CardTitle>Daily Attendance</CardTitle><CardDescription>Location timestamps are captured by the employee portal. Browser-based tracking records updates while the attendance page remains active.</CardDescription></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-sm"><thead><tr className="border-b text-left text-slate-500"><th className="p-3">Employee</th><th className="p-3">Hospital</th><th className="p-3">Status</th><th className="p-3">Travel Start</th><th className="p-3">Reached</th><th className="p-3">Punch Out</th><th className="p-3">Travel</th><th className="p-3">Working</th><th className="p-3">Latest Location</th><th className="p-3">Action</th></tr></thead><tbody>{data.employees.map((employee: any) => { const r = recordByEmployee.get(employee.id); return <tr key={employee.id} className="border-b last:border-0"><td className="p-3"><div className="font-semibold text-[#14245b]">{employee.name}</div><div className="text-xs text-slate-500">{employee.id}</div></td><td className="p-3">{r?.hospitalName || '-'}</td><td className="p-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${r?.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700' : r?.status === 'ON_DUTY' ? 'bg-blue-50 text-blue-700' : r?.status === 'TRAVELLING' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>{r?.status || 'NOT STARTED'}</span></td><td className="p-3">{fmt(r?.punchIn)}</td><td className="p-3">{fmt(r?.reachedAt)}</td><td className="p-3">{fmt(r?.punchOut)}</td><td className="p-3 font-semibold">{duration(r?.travelMinutes)}</td><td className="p-3 font-semibold">{duration(r?.workingMinutes)}</td><td className="p-3">{r?.lastLatitude != null && r?.lastLongitude != null ? <div><a className="inline-flex items-center gap-1 font-semibold text-[#1677ca] hover:underline" href={mapsUrl(r.lastLatitude, r.lastLongitude)} target="_blank" rel="noreferrer"><MapPin className="h-4 w-4"/>View Map</a><div className="mt-1 text-[11px] text-slate-400">{fmt(r.lastLocationAt)}</div></div> : '-'}</td><td className="p-3">{r ? <button onClick={() => deleteAttendance(r.id)} disabled={deletingId === r.id} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100 disabled:opacity-50">{deletingId === r.id ? 'Deleting...' : 'Delete Record'}</button> : '-'}</td></tr> })}</tbody></table></div></CardContent></Card>

    <Card><CardHeader><CardTitle>Location Audit</CardTitle><CardDescription>Recent location events for the selected date.</CardDescription></CardHeader><CardContent><div className="space-y-2">{data.records.flatMap((r: any) => (r.locations || []).map((l: any) => ({ ...l, employeeName: r.employee.name, employeeId: r.employee.id, hospitalName: r.hospitalName }))).slice(0, 40).map((l: any) => <div key={l.id} className="flex flex-col gap-2 rounded-xl border p-3 md:flex-row md:items-center md:justify-between"><div><p className="font-semibold text-[#14245b]">{l.employeeName} <span className="font-normal text-slate-400">({l.employeeId})</span></p><p className="text-xs text-slate-500">{l.event.replaceAll('_', ' ')} · {l.hospitalName || 'Hospital not recorded'}</p></div><div className="text-right"><a className="inline-flex items-center gap-1 text-sm font-semibold text-[#1677ca] hover:underline" href={mapsUrl(l.latitude, l.longitude)} target="_blank" rel="noreferrer"><MapPin className="h-4 w-4"/>{l.latitude.toFixed(5)}, {l.longitude.toFixed(5)}</a><p className="text-xs text-slate-400">{fmt(l.capturedAt)}{l.accuracy ? ` · ±${Math.round(l.accuracy)}m` : ''}</p></div></div>)}{data.records.length === 0 && <p className="text-sm text-slate-500">No attendance/location records for this date.</p>}</div></CardContent></Card>
  </div>
}
