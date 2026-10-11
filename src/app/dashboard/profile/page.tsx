"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function ProfilePage() {
  const [employee, setEmployee] = useState<any>(null)
  const [message, setMessage] = useState("")
  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" })
  const fileRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    const res = await fetch("/api/profile", { cache: "no-store" })
    const d = await res.json()
    if (res.ok) setEmployee(d.employee)
    else setMessage(d.error || "Unable to load profile.")
  }
  useEffect(() => { load() }, [])

  const upload = (file?: File) => {
    if (!file) return
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setMessage("Please select a JPG, PNG or WEBP image."); return
    }
    if (file.size > 500 * 1024) {
      setMessage("Profile picture must be 500 KB or smaller."); return
    }
    const reader = new FileReader()
    reader.onload = async () => {
      const res = await fetch("/api/profile", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "PROFILE_IMAGE", profileImageUrl: reader.result })
      })
      const d = await res.json()
      setMessage(res.ok ? "Profile picture updated." : d.error || "Unable to update picture.")
      if (res.ok) { setEmployee((x:any) => ({ ...x, profileImageUrl: d.profileImageUrl })); window.location.reload() }
    }
    reader.readAsDataURL(file)
  }

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault(); setMessage("")
    if (passwords.next !== passwords.confirm) { setMessage("New password and confirmation do not match."); return }
    const res = await fetch("/api/profile", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "CHANGE_PASSWORD", currentPassword: passwords.current, newPassword: passwords.next })
    })
    const d = await res.json()
    setMessage(res.ok ? "Password changed successfully." : d.error || "Unable to change password.")
    if (res.ok) setPasswords({ current: "", next: "", confirm: "" })
  }

  if (!employee) return <div className="text-sm text-slate-500">Loading profile...</div>

  return <div className="space-y-6">
    <div><h1 className="text-3xl font-bold tracking-tight text-[#14245b]">My Profile</h1><p className="text-gray-500">View your employee information and manage account security.</p></div>
    {message && <div className="rounded-xl border bg-white p-3 text-sm">{message}</div>}
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <Card><CardHeader><CardTitle>Profile Picture</CardTitle><CardDescription>Your profile picture is visible only inside the HR portal.</CardDescription></CardHeader><CardContent className="flex flex-col items-center gap-4">
        {employee.profileImageUrl ? <img src={employee.profileImageUrl} alt="Profile" className="h-32 w-32 rounded-full border object-cover" /> : <div className="flex h-32 w-32 items-center justify-center rounded-full bg-[#eaf5ff] text-4xl font-bold text-[#1677ca]">{employee.name?.charAt(0)}</div>}
        <input ref={fileRef} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={e => upload(e.target.files?.[0])} />
        <Button onClick={() => fileRef.current?.click()}>Upload / Change Picture</Button>
        {employee.profileImageUrl && <Button variant="outline" onClick={() => upload(undefined)}>Use a new picture to replace it</Button>}
        <p className="text-xs text-slate-500">JPG, PNG or WEBP · maximum 500 KB</p>
      </CardContent></Card>

      <Card><CardHeader><CardTitle>Employee Information</CardTitle><CardDescription>These master fields are maintained by HR.</CardDescription></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2">
        {[["Employee ID", employee.id], ["Name", employee.name], ["Department", employee.department || "-"], ["Designation", employee.designation || "-"], ["Email", employee.email || "-"], ["Date of Joining", employee.dateOfJoining ? new Date(employee.dateOfJoining).toLocaleDateString("en-IN") : "-"], ["Work Mode", employee.workMode || "-"]].map(([label,value]) => <div key={label}><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 font-semibold text-[#14245b]">{value}</p></div>)}
      </CardContent></Card>
    </div>

    <Card><CardHeader><CardTitle>Change Password</CardTitle><CardDescription>Use a strong password of at least 8 characters.</CardDescription></CardHeader><CardContent><form onSubmit={changePassword} className="grid gap-4 md:grid-cols-3">
      <div><Label>Current Password</Label><Input className="mt-1" type="password" value={passwords.current} onChange={e => setPasswords(x => ({...x,current:e.target.value}))} required /></div>
      <div><Label>New Password</Label><Input className="mt-1" type="password" value={passwords.next} onChange={e => setPasswords(x => ({...x,next:e.target.value}))} minLength={8} required /></div>
      <div><Label>Confirm New Password</Label><Input className="mt-1" type="password" value={passwords.confirm} onChange={e => setPasswords(x => ({...x,confirm:e.target.value}))} minLength={8} required /></div>
      <div className="md:col-span-3"><Button type="submit">Change Password</Button></div>
    </form></CardContent></Card>
  </div>
}
