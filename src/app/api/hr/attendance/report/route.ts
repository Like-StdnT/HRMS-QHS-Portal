import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/prisma'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { indiaDateKey } from '@/lib/attendance'

const TZ = 'Asia/Kolkata'
const HEADERS = ['S No.', 'Employee Name', 'Designation', 'Department', 'DOB', 'Joining Date', 'Travelling Time ', 'Hospital Name ', 'Reached Time ', 'Left Time ', 'Hospital Group Location', 'Special remarks', 'Working Hrs.']

function xmlEscape(value: unknown) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

function cell(value: unknown, type = 'String') {
  return `<Cell><Data ss:Type="${type}">${xmlEscape(value)}</Data></Cell>`
}

function dateTime(date?: Date | null) {
  if (!date) return ''
  return new Intl.DateTimeFormat('en-IN', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(date)
}

function dateText(date?: Date | null) {
  if (!date) return ''
  return new Intl.DateTimeFormat('en-IN', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' }).format(date).replaceAll('/', '.')
}

function duration(minutes?: number | null) {
  if (minutes == null) return ''
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}:${String(m).padStart(2, '0')}`
}

function ordinalDateLabel(date: Date) {
  const day = date.getUTCDate()
  const month = new Intl.DateTimeFormat('en-IN', { month: 'long', timeZone: 'UTC' }).format(date)
  const year = date.getUTCFullYear()
  const suffix = day % 10 === 1 && day !== 11 ? 'st' : day % 10 === 2 && day !== 12 ? 'nd' : day % 10 === 3 && day !== 13 ? 'rd' : 'th'
  return `${day}${suffix} ${month}, ${year}`
}

function sheetName(date: Date) {
  return `${String(date.getUTCDate()).padStart(2, '0')}.${String(date.getUTCMonth() + 1).padStart(2, '0')}.${date.getUTCFullYear()}`
}

function buildWorkbook(sheets: { name: string; title: string; rows: string[][] }[]) {
  const styles = `
    <Styles>
      <Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Center"/><Font ss:FontName="Calibri" ss:Size="11"/></Style>
      <Style ss:ID="Title"><Font ss:Bold="1" ss:Size="16"/><Alignment ss:Horizontal="Center"/></Style>
      <Style ss:ID="SubTitle"><Font ss:Bold="1" ss:Size="13"/><Alignment ss:Horizontal="Center"/></Style>
      <Style ss:ID="Header"><Font ss:Bold="1"/><Interior ss:Color="#D9EAF7" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center" ss:Vertical="Center"/></Style>
      <Style ss:ID="Text"><Alignment ss:Vertical="Center"/></Style>
    </Styles>`
  const worksheets = sheets.map(sheet => {
    const titleRow = `<Row ss:AutoFitHeight="0"><Cell ss:MergeAcross="12" ss:StyleID="Title"><Data ss:Type="String">Quantzo Health Services</Data></Cell></Row>`
    const subRow = `<Row><Cell ss:MergeAcross="12" ss:StyleID="SubTitle"><Data ss:Type="String">Attendence Sheet </Data></Cell></Row>`
    const dateRow = `<Row><Cell ss:MergeAcross="12" ss:StyleID="SubTitle"><Data ss:Type="String">${xmlEscape(sheet.title)}</Data></Cell></Row>`
    const header = `<Row>${HEADERS.map(h => `<Cell ss:StyleID="Header"><Data ss:Type="String">${xmlEscape(h)}</Data></Cell>`).join('')}</Row>`
    const body = sheet.rows.map(row => `<Row>${row.map(v => cell(v)).join('')}</Row>`).join('')
    return `<Worksheet ss:Name="${xmlEscape(sheet.name)}"><Table ss:ExpandedColumnCount="13" ss:ExpandedRowCount="${4 + sheet.rows.length}" x:FullColumns="1" x:FullRows="1">${titleRow}${subRow}${dateRow}${header}${body}</Table></Worksheet>`
  }).join('')
  return `<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" xmlns:html="http://www.w3.org/TR/REC-html40">${styles}${worksheets}</Workbook>`
}

function addDays(date: Date, count: number) {
  const result = new Date(date)
  result.setUTCDate(result.getUTCDate() + count)
  return result
}

function validDate(value: string | null) {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || session.user.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') || 'DAILY'
    const date = searchParams.get('date') || indiaDateKey()
    const month = searchParams.get('month') || date.slice(0, 7)
    const startParam = searchParams.get('startDate')
    const endParam = searchParams.get('endDate')
    const employeeId = searchParams.get('employeeId') || 'ALL'

    let startDate: Date
    let endDate: Date
    if (type === 'DAILY') {
      if (!validDate(date)) return NextResponse.json({ error: 'Invalid date.' }, { status: 400 })
      startDate = new Date(`${date}T00:00:00.000Z`); endDate = addDays(startDate, 1)
    } else if (type === 'WEEKLY') {
      if (!validDate(startParam)) return NextResponse.json({ error: 'A valid week start date is required.' }, { status: 400 })
      startDate = new Date(`${startParam}T00:00:00.000Z`); endDate = addDays(startDate, 7)
    } else if (type === 'MONTHLY') {
      if (!/^\d{4}-\d{2}$/.test(month)) return NextResponse.json({ error: 'Invalid month.' }, { status: 400 })
      startDate = new Date(`${month}-01T00:00:00.000Z`); endDate = new Date(startDate); endDate.setUTCMonth(endDate.getUTCMonth() + 1)
    } else if (type === 'CUSTOM') {
      if (!validDate(startParam) || !validDate(endParam)) return NextResponse.json({ error: 'Valid custom start and end dates are required.' }, { status: 400 })
      startDate = new Date(`${startParam}T00:00:00.000Z`); endDate = addDays(new Date(`${endParam}T00:00:00.000Z`), 1)
      if (endDate <= startDate) return NextResponse.json({ error: 'End date must be on or after start date.' }, { status: 400 })
    } else return NextResponse.json({ error: 'Invalid report type.' }, { status: 400 })

    const employees = await prisma.employee.findMany({
      where: { role: 'EMPLOYEE', ...(employeeId !== 'ALL' ? { id: employeeId } : {}) },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, designation: true, department: true, dateOfJoining: true },
    })
    if (!employees.length) return NextResponse.json({ error: 'Employee not found.' }, { status: 404 })

    const attendances = await prisma.attendance.findMany({
      where: { date: { gte: startDate, lt: endDate }, ...(employeeId !== 'ALL' ? { employeeId } : {}) },
      orderBy: [{ date: 'asc' }, { employeeId: 'asc' }],
      select: { employeeId: true, date: true, punchIn: true, reachedAt: true, punchOut: true, travelMinutes: true, workingMinutes: true, hospitalName: true, status: true, regularizationReason: true },
    })
    const byKey = new Map(attendances.map(a => [`${a.employeeId}|${a.date.toISOString().slice(0, 10)}`, a]))

    const dates: Date[] = []
    for (let d = new Date(startDate); d < endDate; d = addDays(d, 1)) dates.push(new Date(d))

    const sheets = dates.map(d => {
      const dayKey = d.toISOString().slice(0, 10)
      const rows = employees.map((employee, index) => {
        const record = byKey.get(`${employee.id}|${dayKey}`)
        const remarks = [record?.status && record.status !== 'COMPLETED' ? record.status.replaceAll('_', ' ') : '', record?.regularizationReason || ''].filter(Boolean).join(' · ')
        return [
          String(index + 1), employee.name, employee.designation || '', employee.department || '', '', dateText(employee.dateOfJoining),
          dateTime(record?.punchIn), record?.hospitalName || '', dateTime(record?.reachedAt), dateTime(record?.punchOut), '', remarks,
          duration(record?.workingMinutes),
        ]
      })
      return { name: sheetName(d), title: ordinalDateLabel(d), rows }
    })

    const xml = buildWorkbook(sheets)
    const suffix = employeeId === 'ALL' ? 'All_Employees' : employeeId
    const label = type === 'DAILY' ? date : type === 'WEEKLY' ? `${startParam}_to_${new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC' }).format(addDays(startDate, 6))}` : type === 'MONTHLY' ? month : `${startParam}_to_${endParam}`
    const filename = `Quantzo_Attendance_${type}_${suffix}_${label}.xls`
    return new NextResponse(xml, { status: 200, headers: { 'Content-Type': 'application/vnd.ms-excel; charset=utf-8', 'Content-Disposition': `attachment; filename="${filename}"`, 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Unable to generate attendance report.' }, { status: 500 })
  }
}
