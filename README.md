# Quantzo Health Services HR Portal

Next.js + Prisma HR portal with employee attendance, leave, comp-off and payroll/payslip foundations.

## Leave rules implemented

- 1 Casual Leave (CL) is credited for each month starting from the employee's joining month.
- Example: joining in August gives 1 CL in August; if unused, September accrual makes the balance 2.
- CL is accumulated during the calendar year.
- Approved CL reduces the yearly CL balance.
- LWP is available when CL is unavailable and does not consume CL.
- Year-end CL encashment is recorded by HR against the remaining balance. The encashment amount is entered by HR according to Quantzo policy rather than hard-coded.
- Employee leave requests are submitted from the employee portal and approved/rejected by HR.
- HR can directly regularize leave when an employee informs HR outside the portal.

## Attendance rules implemented

- Employee punch-in creates an attendance record for the India (Asia/Kolkata) calendar date.
- Employee must punch in before punching out.
- Punch-out calculates working minutes.
- Punch-in and punch-out trigger HR email notifications when Resend is configured.
- HR can regularize punch-in/punch-out and the portal stores an audit record.
- HR attendance summary exposes present days, CL days, LWP days, paid days and total working minutes for payroll processing.

## Comp-off rules implemented

- Employee can only submit a comp-off request.
- HR/Admin is the only role allowed to approve or reject it.
- Approval creates an available comp-off record linked to the approved request.

## Environment

Copy `.env.example` to `.env` and configure:

- `DATABASE_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `RESEND_API_KEY` (for actual HR email notifications)
- `ATTENDANCE_NOTIFICATION_FROM` (must be a verified sender in your email provider)
- `CRON_SECRET` (for monthly CL accrual cron)

## Important production database note

The current Prisma schema is still configured for SQLite for local development. Do **not** rely on `file:./dev.db` as the production database on Vercel because a local SQLite file is not a durable shared production database in a serverless deployment. Before production payroll/attendance use, move Prisma to a persistent PostgreSQL database such as Neon/Supabase and set the production `DATABASE_URL` in Vercel.

## Local setup

```bash
npm install
npx prisma generate
npx prisma db push
npm run dev
```

The project should be tested with a real generated Prisma Client before deployment.

## Attendance automation setup

The portal now uses this field attendance flow:

1. Employee enters the hospital name manually and clicks **Start Travelling**.
2. The browser captures the current GPS location and server time.
3. Employee clicks **Reached Hospital** after arrival; travel time is calculated automatically.
4. While the attendance page remains active and location permission is available, the browser sends periodic latest-location updates.
5. Employee clicks **Punch Out / Duty Off**; working hours are calculated from Reached Hospital to Punch Out.
6. Super Admin can monitor the daily attendance and latest location from **Attendance Management**.
7. Attendance start/arrival/completion events can optionally sync to a Google Sheet through a Google Apps Script web-app URL.

Set `GOOGLE_SHEETS_WEBHOOK_URL` in the production environment after deploying `google-apps-script/Code.gs` as a Google Apps Script Web App connected to the target Google Sheet.

Browser-based location is not guaranteed to run after the employee closes/suspends the page. For guaranteed background tracking, a dedicated mobile app/PWA architecture would be required.
