const TIME_ZONE = 'Asia/Kolkata'

export function indiaDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function indiaMidnight(date = new Date()) {
  return new Date(`${indiaDateKey(date)}T00:00:00.000Z`)
}

export function formatIndiaDateTime(date?: Date | null) {
  if (!date) return '-'
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: TIME_ZONE,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export function workingMinutes(punchIn?: Date | null, punchOut?: Date | null) {
  if (!punchIn || !punchOut) return null
  return Math.max(0, Math.round((punchOut.getTime() - punchIn.getTime()) / 60000))
}
