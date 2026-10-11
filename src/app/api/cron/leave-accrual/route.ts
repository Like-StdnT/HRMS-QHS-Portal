import { NextResponse } from 'next/server'
import { ensureAllCurrentYearCLAccruals } from '@/lib/leave'

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  const authorization = req.headers.get('authorization')
  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await ensureAllCurrentYearCLAccruals()
  return NextResponse.json({ success: true, message: 'CL accruals synchronized.' })
}
