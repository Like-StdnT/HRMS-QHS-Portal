"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const blank = { id:"", name:"", email:"", department:"", designation:"", dateOfJoining:"", annualCtc:"", monthlySalary:"", workMode:"FIELD", password:"", bankAccountName:"", bankAccountNumber:"", bankIfsc:"" }

export default function EmployeeManagementPage() {
  const [employees,setEmployees]=useState<any[]>([])
  const [form,setForm]=useState<any>(blank)
  const [message,setMessage]=useState("")
  const [loading,setLoading]=useState(false)

  const load=async()=>{ const r=await fetch("/api/hr/employees",{cache:"no-store"}); const d=await r.json(); if(r.ok)setEmployees(d.employees||[]); else setMessage(d.error||"Unable to load employees.") }
  useEffect(()=>{load()},[])

  const save=async(e:React.FormEvent)=>{e.preventDefault();setLoading(true);setMessage("");const r=await fetch("/api/hr/employees",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)});const d=await r.json();setMessage(r.ok?"Employee saved successfully.":d.error||"Unable to save employee.");if(r.ok){setForm(blank);await load()}setLoading(false)}
  const edit=(e:any)=>setForm({id:e.id,name:e.name||"",email:e.email||"",department:e.department||"",designation:e.designation||"",dateOfJoining:e.dateOfJoining?new Date(e.dateOfJoining).toISOString().slice(0,10):"",annualCtc:e.annualCtc??"",monthlySalary:e.monthlySalary??"",workMode:e.workMode||"FIELD",password:"",bankAccountName:e.bankAccountName||"",bankAccountNumber:e.bankAccountNumber||"",bankIfsc:e.bankIfsc||""})
  const access=async(id:string,action:"DEACTIVATE"|"REACTIVATE")=>{const r=await fetch("/api/hr/employees",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,action})});const d=await r.json();setMessage(r.ok?(action==="DEACTIVATE"?"Login disabled.":"Login restored."):d.error||"Unable to update access.");if(r.ok)load()}
  const remove=async(id:string)=>{
    const employee=employees.find(x=>x.id===id)
    if(employee?.active){setMessage("Disable the employee before permanent deletion.");return}
    const confirmation=prompt(`Permanent deletion will remove ${id} and all linked test/HR records. This cannot be undone.

Type the Employee ID to continue:`)
    if(confirmation!==id){if(confirmation!==null)setMessage("Deletion cancelled: Employee ID confirmation did not match.");return}
    const r=await fetch("/api/hr/employees",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,confirmId:id})});const d=await r.json();setMessage(r.ok?"Employee and linked records deleted.":d.error||"Unable to delete employee.");if(r.ok)load()
  }

  const field=(key:string,label:string,type="text")=><div><Label>{label}</Label><Input className="mt-1" type={type} value={form[key]} onChange={e=>setForm((x:any)=>({...x,[key]:e.target.value}))} /></div>

  return <div className="space-y-6">
    <div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#1f86df]">Super Admin</p><h1 className="text-3xl font-bold tracking-tight text-[#14245b]">Employee Management</h1><p className="mt-1 text-gray-500">Enroll employees, maintain their master data and control portal access.</p></div>
    {message&&<div className="rounded-xl border bg-white p-3 text-sm">{message}</div>}
    <Card><CardHeader><CardTitle>{form.id ? "Edit Employee" : "Enroll Employee"}</CardTitle><CardDescription>All accounts created here are Employee accounts. Super Admin cannot be created from this screen.</CardDescription></CardHeader><CardContent><form onSubmit={save} className="grid gap-4 md:grid-cols-3">
      {field("id","Employee ID")} {field("name","Employee Name")} {field("email","Email","email")}
      {field("department","Department")} {field("designation","Designation")} {field("dateOfJoining","Date of Joining","date")}
      {field("annualCtc","Annual CTC","number")} {field("monthlySalary","Monthly Salary","number")}
      <div><Label>Work Mode</Label><select className="mt-1 h-10 w-full rounded-xl border px-3 text-sm" value={form.workMode} onChange={e=>setForm((x:any)=>({...x,workMode:e.target.value}))}><option value="FIELD">Field</option><option value="OFFICE">Office</option></select></div>
      {field("bankAccountName","Account Holder Name")} {field("bankAccountNumber","Account Number")} {field("bankIfsc","IFSC Code")}
      {field("password",form.id?"New Password (optional)":"Temporary Password","password")}
      <div className="flex items-end gap-2"><Button type="submit" disabled={loading}>{loading?"Saving...":form.id?"Save Changes":"Enroll Employee"}</Button>{form.id&&<Button type="button" variant="outline" onClick={()=>setForm(blank)}>Cancel</Button>}</div>
    </form></CardContent></Card>

    <Card><CardHeader><CardTitle>Employee Accounts</CardTitle><CardDescription>Disable active employees to preserve HR history. Permanent deletion is available only for inactive accounts and requires Employee ID confirmation.</CardDescription></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-sm"><thead><tr className="border-b text-left text-slate-500"><th className="p-3">Employee</th><th className="p-3">Department</th><th className="p-3">Designation</th><th className="p-3">Salary</th><th className="p-3">Status</th><th className="p-3">Actions</th></tr></thead><tbody>{employees.map(e=><tr key={e.id} className="border-b"><td className="p-3"><b>{e.name}</b><div className="text-xs text-slate-500">{e.id}</div></td><td className="p-3">{e.department||"-"}</td><td className="p-3">{e.designation||"-"}</td><td className="p-3">{e.monthlySalary!=null?`₹${Number(e.monthlySalary).toLocaleString("en-IN")}`:"-"}</td><td className="p-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${e.active?"bg-emerald-50 text-emerald-700":"bg-slate-100 text-slate-500"}`}>{e.active?"ACTIVE":"INACTIVE"}</span></td><td className="p-3"><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={()=>edit(e)}>Edit</Button><Button size="sm" variant={e.active?"destructive":"default"} onClick={()=>access(e.id,e.active?"DEACTIVATE":"REACTIVATE")}>{e.active?"Disable":"Restore"}</Button><Button size="sm" variant="outline" className="border-red-200 text-red-700" onClick={()=>remove(e.id)}>Delete</Button></div></td></tr>)}</tbody></table></div></CardContent></Card>
  </div>

}
