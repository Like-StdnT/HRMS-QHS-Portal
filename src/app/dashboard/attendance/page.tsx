"use client"

import { useEffect, useRef, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { MapPin, Navigation, LogOut, CheckCircle2, Clock3, RefreshCw, AlertCircle } from "lucide-react"

function fmt(date?: string | null) {
  if (!date) return '-'
  return new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date))
}
function duration(minutes?: number | null) {
  if (minutes == null) return '-'
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

export default function AttendancePage() {
  const router = useRouter()
  const { data: session, status: sessionStatus } = useSession()
  const [today, setToday] = useState<any>(null)
  const [records, setRecords] = useState<any[]>([])
  const [hospitalName, setHospitalName] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [locationStatus, setLocationStatus] = useState('Location permission is required for attendance.')
  const watchRef = useRef<number | null>(null)
  const lastSentRef = useRef(0)
  const actionLockRef = useRef(false)

  const load = async () => {
    try {
      const res = await fetch('/api/attendance/punch', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setToday(data.today)
        setRecords(data.records || [])
      }
    } catch (err) {
      console.error('Failed to load attendance:', err)
    }
  }

  useEffect(() => {
    if (sessionStatus === 'authenticated' && session?.user?.role === 'SUPER_ADMIN') {
      router.replace('/dashboard')
      return
    }
    if (sessionStatus === 'authenticated') load()
  }, [sessionStatus, session?.user?.role])

  // Dual-tier location helper: attempts high-accuracy GPS first, with automatic fallback
  // to network/WiFi location so it never hangs or times out indoors inside hospitals.
  const getLocation = async () => {
    if (!navigator.geolocation) {
      throw new Error('Geolocation is not supported on this device/browser.')
    }

    try {
      return await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 8000,
          maximumAge: 45000,
        })
      })
    } catch (err: any) {
      // If user denied permission explicitly, abort immediately
      if (err?.code === 1) throw err

      // If high accuracy GPS timed out or failed indoors, fallback to fast network location
      return await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 120000,
        })
      })
    }
  }

  const sendLocation = async (position: GeolocationPosition, action: 'START_TRAVEL' | 'REACHED' | 'OUT' | 'LOCATION', extra: Record<string, unknown> = {}) => {
    const res = await fetch('/api/attendance/punch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        ...extra,
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Unable to update attendance.')
    return data
  }

  const handleAction = async (action: 'START_TRAVEL' | 'REACHED' | 'OUT') => {
    if (actionLockRef.current) return
    actionLockRef.current = true
    setLoading(true)
    setMessage('')
    setLocationStatus(
      action === 'START_TRAVEL'
        ? 'Acquiring start location...'
        : action === 'REACHED'
        ? 'Verifying hospital arrival...'
        : 'Recording punch out location...'
    )

    try {
      if (action === 'START_TRAVEL' && !hospitalName.trim()) {
        throw new Error('Please enter the hospital name first.')
      }

      const position = await getLocation()
      setLocationStatus(`Location captured (±${Math.round(position.coords.accuracy)}m)`)

      const data = await sendLocation(position, action, action === 'START_TRAVEL' ? { hospitalName: hospitalName.trim() } : {})
      
      // Update local state immediately so UI updates even before load() completes
      if (data.attendance) {
        setToday(data.attendance)
      }

      setMessage(
        action === 'START_TRAVEL'
          ? 'Travel started successfully.'
          : action === 'REACHED'
          ? 'Hospital arrival recorded! Duty is now active.'
          : 'Duty completed. Attendance has been closed.'
      )

      if (action === 'START_TRAVEL') setHospitalName('')
      await load()
    } catch (error: any) {
      const errMsg =
        error?.code === 1
          ? 'Location permission was denied. Please allow location access in your browser and try again.'
          : error?.message || 'Unable to update attendance.'
      setMessage(errMsg)
      await load()
    } finally {
      actionLockRef.current = false
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!today || today.punchOut || !session?.user?.id) {
      if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current)
      watchRef.current = null
      return
    }
    if (!navigator.geolocation) return
    setLocationStatus('Live location updates are active while this page remains open.')

    watchRef.current = navigator.geolocation.watchPosition(
      async position => {
        // Skip background watch sends while a user action (e.g. Reached Hospital) is in progress
        if (actionLockRef.current) return

        const now = Date.now()
        if (now - lastSentRef.current < 60000) return
        lastSentRef.current = now
        try {
          await sendLocation(position, 'LOCATION')
          setLocationStatus(`Last location update: ${new Date().toLocaleTimeString('en-IN')}`)
        } catch {
          // The next location update will retry automatically
        }
      },
      () => setLocationStatus('Location update unavailable. Please keep location permission enabled.'),
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 15000 }
    )

    return () => {
      if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current)
      watchRef.current = null
    }
  }, [today?.id, today?.punchOut, session?.user?.id])

  const started = Boolean(today?.punchIn)
  const reached = Boolean(today?.reachedAt)
  const completed = Boolean(today?.punchOut)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[#14245b]">Attendance</h1>
        <p className="text-gray-500">Start your hospital journey, record arrival and complete duty from one place.</p>
      </div>

      {message && (
        <div
          className={`rounded-xl border p-4 text-sm font-semibold flex items-center gap-2 ${
            message.includes('successfully') || message.includes('recorded') || message.includes('completed')
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {message.includes('successfully') || message.includes('recorded') || message.includes('completed') ? (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
          )}
          <span>{message}</span>
        </div>
      )}

      <Card className="border-[#cfe5f7] bg-gradient-to-br from-white to-[#f4faff]">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-[#1677ca]">
                <MapPin className="h-4 w-4" />
                Location status
              </div>
              <p className="mt-1 text-sm text-slate-600">{locationStatus}</p>
            </div>
            <div className="rounded-xl bg-white px-4 py-3 text-xs text-slate-500 shadow-sm border border-slate-100">
              Location is captured securely for hospital arrival verification and duty tracking.
            </div>
          </div>
        </CardContent>
      </Card>

      {!started && (
        <Card>
          <CardHeader>
            <CardTitle>Start Travelling</CardTitle>
            <CardDescription>Enter the hospital you are travelling to. You can enter any hospital name.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold">Hospital Name</label>
              <input
                className="q-input"
                value={hospitalName}
                onChange={e => setHospitalName(e.target.value)}
                placeholder="e.g. Fortis Hospital, Gurugram"
                maxLength={150}
              />
            </div>
            <button
              disabled={loading || !hospitalName.trim()}
              onClick={() => handleAction('START_TRAVEL')}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1678d2] px-5 font-semibold text-white shadow-sm hover:bg-[#126bbd] disabled:cursor-not-allowed disabled:opacity-50 transition"
            >
              {loading ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Navigation className="h-5 w-5" />}
              {loading ? 'Starting Travel...' : 'Start Travelling'}
            </button>
          </CardContent>
        </Card>
      )}

      {started && (
        <Card className="border-[#cfe5f7]">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-xl text-[#14245b]">{today.hospitalName || 'Hospital Visit'}</CardTitle>
                <CardDescription>Travel started at {fmt(today.punchIn)}</CardDescription>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  completed
                    ? 'bg-emerald-50 text-emerald-700'
                    : reached
                    ? 'bg-blue-50 text-blue-700'
                    : 'bg-amber-50 text-amber-700'
                }`}
              >
                {today.status}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
              <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
                <p className="text-xs font-semibold text-slate-400">Travel Start</p>
                <p className="mt-1 font-bold text-[#14245b]">{fmt(today.punchIn)}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
                <p className="text-xs font-semibold text-slate-400">Reached Hospital</p>
                <p className="mt-1 font-bold text-[#14245b]">{fmt(today.reachedAt)}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
                <p className="text-xs font-semibold text-slate-400">Travel Time</p>
                <p className="mt-1 font-bold text-[#14245b]">{duration(today.travelMinutes)}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
                <p className="text-xs font-semibold text-slate-400">Working Hours</p>
                <p className="mt-1 font-bold text-[#14245b]">{duration(today.workingMinutes)}</p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {!reached && (
                <button
                  disabled={loading}
                  onClick={() => handleAction('REACHED')}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#1f86df] px-5 font-bold text-white hover:bg-[#1677ca] disabled:opacity-50 shadow-sm transition"
                >
                  {loading ? <RefreshCw className="h-5 w-5 animate-spin" /> : <MapPin className="h-5 w-5" />}
                  {loading ? 'Recording Arrival...' : 'Reached Hospital'}
                </button>
              )}
              {reached && !completed && (
                <button
                  disabled={loading}
                  onClick={() => handleAction('OUT')}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#e5484d] px-5 font-bold text-white hover:bg-[#cf3d42] disabled:opacity-50 shadow-sm transition"
                >
                  {loading ? <RefreshCw className="h-5 w-5 animate-spin" /> : <LogOut className="h-5 w-5" />}
                  {loading ? 'Punching Out...' : 'Punch Out / Duty Off'}
                </button>
              )}
              {completed && (
                <div className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-50 px-5 font-semibold text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="h-5 w-5" />
                  Duty Completed at {fmt(today.punchOut)}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recent Attendance</CardTitle>
          <CardDescription>Latest recorded hospital visits</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500 font-semibold">
                  <th className="p-3">Date</th>
                  <th className="p-3">Hospital</th>
                  <th className="p-3">Travel Start</th>
                  <th className="p-3">Reached</th>
                  <th className="p-3">Punch Out</th>
                  <th className="p-3">Travel</th>
                  <th className="p-3">Working</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {records.slice(0, 15).map(record => (
                  <tr key={record.id} className="border-b last:border-0 hover:bg-slate-50 transition">
                    <td className="p-3">{new Date(record.date).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}</td>
                    <td className="p-3 font-medium text-[#14245b]">{record.hospitalName || '-'}</td>
                    <td className="p-3">{fmt(record.punchIn)}</td>
                    <td className="p-3">{fmt(record.reachedAt)}</td>
                    <td className="p-3">{fmt(record.punchOut)}</td>
                    <td className="p-3">{duration(record.travelMinutes)}</td>
                    <td className="p-3 font-semibold">{duration(record.workingMinutes)}</td>
                    <td className="p-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          record.status === 'COMPLETED'
                            ? 'bg-emerald-50 text-emerald-700'
                            : record.status === 'ON_DUTY'
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {record.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {records.length === 0 && <p className="py-6 text-sm text-slate-500">No attendance records yet.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
