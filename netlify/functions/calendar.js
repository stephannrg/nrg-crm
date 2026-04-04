const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL  = 'https://lvpyecqapzqqakokiqgp.supabase.co'
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2cHllY3FhcHpxcWFrb2tpcWdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwMjcyMzUsImV4cCI6MjA5MDYwMzIzNX0.d0oz1eZ0In3nB8dOsyMXIz9FcFlNTrGjZBKOaFmDvFc'

function toIcalDate(dateStr) {
  const d = new Date(dateStr)
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function escIcal(str) {
  return (str || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n').replace(/\r/g, '')
}

function foldLine(line) {
  // iCal spec: lines max 75 chars, fold with CRLF + space
  if (line.length <= 75) return line
  let result = ''
  while (line.length > 75) {
    result += line.slice(0, 75) + '\r\n '
    line = line.slice(75)
  }
  return result + line
}

const TYPE_LABELS = {
  bel: 'Belnotitie',
  mail: 'E-mail',
  meeting: 'Meeting',
  notitie: 'Notitie'
}

exports.handler = async (event) => {
  // Optional: filter by user token from query param
  const userId = event.queryStringParameters?.user || null

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)

  let query = supabase
    .from('activities')
    .select('id, type, subject, body, occurred_at, companies(name), profiles(full_name)')
    .order('occurred_at', { ascending: false })
    .limit(500)

  if (userId) {
    query = query.eq('logged_by', userId)
  }

  const { data: activities, error } = await query

  if (error) {
    return {
      statusCode: 500,
      body: 'Error fetching activities: ' + error.message
    }
  }

  // Also fetch tasks with due dates
  let taskQuery = supabase
    .from('tasks')
    .select('id, title, due_date, status, companies(name), profiles!tasks_assigned_to_fkey(full_name)')
    .eq('status', 'open')
    .not('due_date', 'is', null)
    .order('due_date')
    .limit(200)

  if (userId) {
    taskQuery = taskQuery.eq('assigned_to', userId)
  }

  const { data: tasks } = await taskQuery

  // Build iCal
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//NRG CRM//NL',
    'X-WR-CALNAME:NRG CRM',
    'X-WR-TIMEZONE:Europe/Amsterdam',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ]

  // Activities as VEVENT
  for (const a of (activities || [])) {
    if (!a.occurred_at) continue
    const start = toIcalDate(a.occurred_at)
    const typeLabel = TYPE_LABELS[a.type] || a.type
    const summary = escIcal(`${typeLabel}: ${a.subject || '(geen onderwerp)'} — ${a.companies?.name || ''}`)
    const desc = escIcal([
      a.companies?.name ? `Bedrijf: ${a.companies.name}` : '',
      a.profiles?.full_name ? `Gelogd door: ${a.profiles.full_name}` : '',
      a.body || ''
    ].filter(Boolean).join('\\n'))

    lines.push('BEGIN:VEVENT')
    lines.push(foldLine(`UID:activity-${a.id}@nrgcrm`))
    lines.push(foldLine(`DTSTART:${start}`))
    lines.push(foldLine(`DTEND:${start}`))
    lines.push(foldLine(`SUMMARY:${summary}`))
    if (desc) lines.push(foldLine(`DESCRIPTION:${desc}`))
    lines.push(`CATEGORIES:${typeLabel}`)
    lines.push('END:VEVENT')
  }

  // Tasks as VTODO (shown in some calendar apps) + VEVENT on due date
  for (const t of (tasks || [])) {
    if (!t.due_date) continue
    const dueDate = t.due_date.replace(/-/g, '') + 'T090000Z'
    const summary = escIcal(`📌 ${t.title} — ${t.companies?.name || ''}`)
    const desc = escIcal([
      t.companies?.name ? `Bedrijf: ${t.companies.name}` : '',
      t.profiles?.full_name ? `Toegewezen aan: ${t.profiles.full_name}` : ''
    ].filter(Boolean).join('\\n'))

    // VEVENT for the due date (all-day)
    lines.push('BEGIN:VEVENT')
    lines.push(foldLine(`UID:task-${t.id}@nrgcrm`))
    lines.push(foldLine(`DTSTART;VALUE=DATE:${t.due_date.replace(/-/g, '')}`))
    lines.push(foldLine(`DTEND;VALUE=DATE:${t.due_date.replace(/-/g, '')}`))
    lines.push(foldLine(`SUMMARY:${summary}`))
    if (desc) lines.push(foldLine(`DESCRIPTION:${desc}`))
    lines.push('CATEGORIES:Taak')
    lines.push(`STATUS:NEEDS-ACTION`)
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="nrg-crm.ics"',
      'Cache-Control': 'no-cache, max-age=0'
    },
    body: lines.join('\r\n')
  }
}
