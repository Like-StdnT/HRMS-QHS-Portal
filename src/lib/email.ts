const HR_EMAIL = 'hre.quantzo@quantzohealthservices.co.in'

export async function sendHRNotification(subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.ATTENDANCE_NOTIFICATION_FROM

  if (!apiKey || !from) {
    console.warn('[EMAIL NOT SENT] Configure RESEND_API_KEY and ATTENDANCE_NOTIFICATION_FROM to enable HR notifications.')
    return { sent: false, configured: false }
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to: [HR_EMAIL], subject, html }),
  })

  if (!response.ok) {
    const body = await response.text()
    console.error('HR email failed:', body)
    return { sent: false, configured: true }
  }

  return { sent: true, configured: true }
}
