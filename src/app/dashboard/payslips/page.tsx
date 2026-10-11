"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function PayslipsPage() {
  const [payslips, setPayslips] = useState<any[]>([])
  useEffect(() => { fetch('/api/hr/payslip').then(r => r.json()).then(d => setPayslips(d.payslips || [])) }, [])

  const printSlip = (id: string) => {
    const el = document.getElementById(`slip-${id}`)
    if (!el) return
    const win = window.open('', '_blank', 'width=900,height=900')
    if (!win) return
    win.document.write(`<html><head><title>Quantzo Payslip</title><style>body{font-family:Arial,sans-serif;padding:40px;color:#111}.slip{max-width:760px;margin:auto;border:1px solid #ddd;padding:28px}.head{display:flex;align-items:center;gap:20px;border-bottom:2px solid #f05a24;padding-bottom:18px}.logo{width:150px}.row{display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid #eee}.total{font-size:20px;font-weight:700;margin-top:15px}.muted{color:#666;font-size:12px}</style></head><body>${el.outerHTML}<script>window.onload=()=>window.print()</script></body></html>`)
    win.document.close()
  }

  return <div className="space-y-6"><div><h1 className="text-3xl font-bold">My Payslips</h1><p className="text-gray-500">Only published salary slips are shown here.</p></div>{payslips.length === 0 && <Card><CardContent className="p-6 text-sm text-gray-500">No payslip has been published for you yet.</CardContent></Card>}{payslips.map(p => <Card key={p.id}><CardContent className="p-6"><div id={`slip-${p.id}`} className="rounded-lg border bg-white p-6"><div className="flex items-center gap-4 border-b-2 border-orange-500 pb-4"><Image src="/quantzo-logo.png" alt="Quantzo Health Services" width={150} height={110} className="h-auto w-[150px]" /><div><h2 className="text-xl font-bold">Salary Slip</h2><p className="text-sm text-gray-500">{p.month}</p></div></div><div className="mt-5 grid gap-2 md:grid-cols-2"><div><b>Employee:</b> {p.employee?.name}</div><div><b>Employee ID:</b> {p.employee?.id}</div><div><b>Department:</b> {p.employee?.department || '-'}</div><div><b>Designation:</b> {p.employee?.designation || '-'}</div></div><div className="mt-6 space-y-2 text-sm"><div className="flex justify-between border-b py-2"><span>Monthly Salary</span><span>₹{Number(p.monthlySalary).toLocaleString('en-IN')}</span></div><div className="flex justify-between border-b py-2"><span>Calendar Days</span><span>{p.calendarDays}</span></div><div className="flex justify-between border-b py-2"><span>Paid Days</span><span>{p.paidDays}</span></div><div className="flex justify-between border-b py-2"><span>Earned Salary</span><span>₹{Number(p.earnedSalary).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>{Number(p.incomeTax) > 0 && <div className="flex justify-between border-b py-2"><span>Income Tax</span><span>₹{Number(p.incomeTax).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>}<div className="flex justify-between pt-3 text-lg font-bold"><span>Net Salary Paid</span><span>₹{Number(p.netPay).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div></div><p className="mt-6 text-xs text-gray-500">This is a digitally generated salary slip of Quantzo Health Services.</p></div><Button className="mt-4" onClick={() => printSlip(p.id)}>Download / Print Payslip</Button></CardContent></Card>)}</div>
}
