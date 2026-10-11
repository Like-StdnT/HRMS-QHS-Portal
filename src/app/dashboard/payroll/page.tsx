"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

function num(v:any){return v===""||v==null?0:Number(v)}
function money(v:any){return `₹${Number(v||0).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2})}`}

export default function PayrollPage(){
  const now=new Date()
  const [month,setMonth]=useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`)
  const [calendarDays,setCalendarDays]=useState(0)
  const [employees,setEmployees]=useState<any[]>([])
  const [rows,setRows]=useState<Record<string,any>>({})
  const [message,setMessage]=useState("")
  const [loading,setLoading]=useState(false)

  const load=async()=>{
    setLoading(true);setMessage("")
    const r=await fetch(`/api/hr/payroll?month=${month}`,{cache:"no-store"});const d=await r.json()
    if(!r.ok){setMessage(d.error||"Unable to load payroll.");setLoading(false);return}
    setCalendarDays(d.calendarDays)
    setEmployees(d.employees||[])
    const next:any={}
    for(const e of d.employees||[]){
      const p=e.payslips?.[0]
      next[e.id]={
        monthlySalary:e.monthlySalary??0, workingDays:p?.workingDays??Math.max(0,d.calendarDays-4),
        weeklyOffs:p?.weeklyOffs??Math.max(0,d.calendarDays-26),
        casualLeave:p?.casualLeave??0, compOffGranted:p?.compOffGranted??0, compOffUsed:p?.compOffUsed??0,
        lwp:p?.lwp??0, ghHolidayLeave:p?.ghHolidayLeave??0, pendingCasualLeave:p?.pendingCasualLeave??0,
        extraWorkingDaySunday:p?.extraWorkingDaySunday??0, otherEarnings:p?.otherEarnings??0, pf:p?.pf??0, esi:p?.esi??0,
        tds:p?.tds??p?.incomeTax??0, otherDeductions:p?.otherDeductions??0, workingHours:p?.workingHours??0,
        hrRemarks:p?.hrRemarks??"", published:p?.published??false, id:p?.id
      }
    }
    setRows(next);setLoading(false)
  }
  useEffect(()=>{load()},[month])

  const update=(id:string,key:string,value:any)=>setRows(x=>({...x,[id]:{...x[id],[key]:value}}))
  const calc=(r:any)=>{
    const salary=num(r.monthlySalary), days=calendarDays||1, per=salary/days
    const paid=Math.max(0,Math.min(days,num(r.workingDays)+num(r.weeklyOffs)+num(r.casualLeave)+num(r.compOffUsed)+num(r.ghHolidayLeave)-num(r.lwp)))
    const earned=per*paid
    const deductions=num(r.pf)+num(r.esi)+num(r.tds)+num(r.otherDeductions)
    return {per,paid,earned,net:earned+num(r.otherEarnings)-deductions}
  }

  const save=async(id:string,publish:boolean)=>{
    const r=rows[id];const c=calc(r);setMessage("")
    const res=await fetch("/api/hr/payroll",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...r,employeeId:id,month,publish})})
    const d=await res.json();setMessage(res.ok?`${id}: payroll ${publish?"published":"saved"} successfully.`:d.error||"Unable to save payroll.")
    if(res.ok) await load()
  }

  const exportBank=()=>{
    const headers=["Employee ID","Account Holder Name","Account Number","IFSC Code","Payable Salary"]
    const lines=[headers.join(",")]
    employees.forEach(e=>{const r=rows[e.id];const c=calc(r||{});lines.push([e.id,e.bankAccountName||e.name,e.bankAccountNumber||"",e.bankIfsc||"",c.net.toFixed(2)].map(v=>`"${String(v).replaceAll('"','""')}"`).join(","))})
    const blob=new Blob([lines.join("\n")],{type:"text/csv;charset=utf-8"})
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`Quantzo_Salary_Payment_${month}.csv`;a.click();URL.revokeObjectURL(a.href)
  }

  const totals=useMemo(()=>employees.reduce((a,e)=>{const c=calc(rows[e.id]||{});a.gross+=c.earned;a.net+=c.net;return a},{gross:0,net:0}),[employees,rows,calendarDays])

  return <div className="space-y-6">
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#1f86df]">Super Admin</p><h1 className="text-3xl font-bold tracking-tight text-[#14245b]">Payroll Processing</h1><p className="mt-1 text-gray-500">Built around the current Quantzo salary Excel workflow. Attendance/leave automation can be added after HR validates the monthly inputs.</p></div>
      <div className="flex gap-2"><Input type="month" value={month} onChange={e=>setMonth(e.target.value)} className="w-44 bg-white"/><Button variant="outline" onClick={load}>{loading?"Loading...":"Refresh"}</Button><Button onClick={exportBank}>Export Payment CSV</Button></div>
    </div>
    {message&&<div className="rounded-xl border bg-white p-3 text-sm">{message}</div>}
    <div className="grid gap-4 md:grid-cols-3"><Card><CardContent className="p-5"><p className="text-sm text-slate-500">Employees</p><p className="text-3xl font-bold">{employees.length}</p></CardContent></Card><Card><CardContent className="p-5"><p className="text-sm text-slate-500">Earned Salary</p><p className="text-3xl font-bold">{money(totals.gross)}</p></CardContent></Card><Card><CardContent className="p-5"><p className="text-sm text-slate-500">Net Payable</p><p className="text-3xl font-bold text-[#1169b4]">{money(totals.net)}</p></CardContent></Card></div>

    <Card><CardHeader><CardTitle>Monthly Payroll Inputs</CardTitle><CardDescription>Per-day salary follows your Excel: Gross Salary ÷ calendar days. Paid days = working days + weekly offs + CL + comp-off used + GH holiday − LWP, capped to the calendar days.</CardDescription></CardHeader><CardContent><div className="space-y-5">{employees.map(e=>{const r=rows[e.id]||{};const c=calc(r);return <div key={e.id} className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between"><div><p className="font-bold text-[#14245b]">{e.name}</p><p className="text-xs text-slate-500">{e.id} · {e.department||"-"} · {e.designation||"-"}</p></div><div className="text-right"><p className="text-xs text-slate-500">Net Pay</p><p className="text-xl font-extrabold text-[#1169b4]">{money(c.net)}</p></div></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
        {["monthlySalary","workingDays","weeklyOffs","casualLeave","compOffGranted","compOffUsed","lwp","ghHolidayLeave","pendingCasualLeave","extraWorkingDaySunday","otherEarnings","pf","esi","tds","otherDeductions","workingHours"].map(k=><div key={k}><Label className="text-xs">{({monthlySalary:"Gross / Monthly Salary",workingDays:"Working Days",weeklyOffs:"Weekly Off(s)",casualLeave:"Casual Leave",compOffGranted:"Comp-Off Granted",compOffUsed:"Comp-Off Used",lwp:"LWP",ghHolidayLeave:"GH Holiday Leave",pendingCasualLeave:"Pending CL",extraWorkingDaySunday:"Sunday Work",otherEarnings:"Other Earnings",pf:"PF",esi:"ESI",tds:"TDS",otherDeductions:"Other Deductions",workingHours:"Working Hours"} as any)[k]}</Label><Input className="mt-1" type="number" min="0" step="0.01" value={r[k]??0} onChange={ev=>update(e.id,k,ev.target.value)} /></div>)}
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3"><div><Label>HR Remarks</Label><Input className="mt-1" value={r.hrRemarks||""} onChange={ev=>update(e.id,"hrRemarks",ev.target.value)} placeholder="e.g. Advance deduction" /></div><div className="rounded-xl bg-slate-50 p-3 text-sm"><b>Paid Days:</b> {c.paid.toFixed(2)} · <b>Earned:</b> {money(c.earned)} · <b>Per Day:</b> {money(c.per)}</div><div className="flex items-end justify-end gap-2"><Button variant="outline" onClick={()=>save(e.id,false)}>Save Draft</Button><Button onClick={()=>save(e.id,true)}>{r.published?"Republish":"Publish"}</Button></div></div>
    </div>})}{employees.length===0&&<p className="text-sm text-slate-500">No employees found.</p>}</div></CardContent></Card>
  </div>
}
