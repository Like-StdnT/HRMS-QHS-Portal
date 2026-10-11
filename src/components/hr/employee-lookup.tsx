"use client"

import { useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export type EmployeeLookupRecord = {
  id: string
  name: string
  department?: string | null
  designation?: string | null
}

export function EmployeeLookup({
  employees,
  value,
  onChange,
  onSelect,
}: {
  employees: EmployeeLookupRecord[]
  value: string
  onChange: (value: string) => void
  onSelect: (employee: EmployeeLookupRecord | null) => void
}) {
  const [focused, setFocused] = useState(false)
  const query = value.trim().toLowerCase()
  const matches = useMemo(() => {
    if (!query) return []
    return employees
      .filter((employee) => `${employee.id} ${employee.name}`.toLowerCase().includes(query))
      .slice(0, 6)
  }, [employees, query])

  const resolve = (raw: string) => {
    const q = raw.trim().toLowerCase()
    if (!q) {
      onSelect(null)
      return
    }
    const employee = employees.find((item) => item.id.toLowerCase() === q)
      || employees.find((item) => item.name.toLowerCase() === q)
      || employees.find((item) => item.id.toLowerCase().includes(q) || item.name.toLowerCase().includes(q))
      || null
    onSelect(employee)
    if (employee) onChange(employee.id)
  }

  return (
    <div className="space-y-2">
      <Label>Employee ID / Name</Label>
      <div className="relative">
        <Input
          value={value}
          onChange={(e) => { onChange(e.target.value); onSelect(null) }}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              resolve(value)
            }
          }}
          placeholder="Enter Employee ID and press Enter, or search name"
          autoComplete="off"
        />
        {focused && query && matches.length > 0 && (
          <div className="absolute left-0 right-0 top-11 z-20 overflow-hidden rounded-xl border border-[#dbe5f0] bg-white shadow-lg">
            {matches.map((employee) => (
              <button
                type="button"
                key={employee.id}
                className="block w-full border-b border-slate-100 px-3 py-2.5 text-left last:border-0 hover:bg-[#f3f8ff]"
                onMouseDown={() => { onChange(employee.id); onSelect(employee) }}
              >
                <div className="text-sm font-semibold text-[#14245b]">{employee.name}</div>
                <div className="text-xs text-slate-500">{employee.id} · {employee.designation || "Designation not set"}</div>
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="text-xs text-slate-400">Press Enter to load employee details automatically.</p>
    </div>
  )
}
