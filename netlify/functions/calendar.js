// Geen npm dependencies - gebruikt fetch direct naar Supabase REST API

const SUPABASE_URL  = 'https://lvpyecqapzqqakokiqgp.supabase.co'
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2cHllY3FhcHpxcWFrb2tpcWdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwMjcyMzUsImV4cCI6MjA5MDYwMzIzNX0.d0oz1eZ0In3nB8dOsyMXIz9FcFlNTrGjZBKOaFmDvFc'

async function sbFetch(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      'apikey': SUPABASE_ANON,
      'Authorization': `Bearer ${SUPABASE_ANON}`,
      'Accept': 'application/json'
    }
  })
  return res.json()
}

function toIcalDate(dateStr) {
  const d = new Date(dateStr)
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function escIcal(str) {
  return (str || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n').replace(/\r/g, '')
}

function foldLine(line) {
  if (line.length <= 75) return line
  let result = ''
  while (line.length > 75) {
    result += line.slice(0, 75) + '\r\n '
    line = line.slice(75)
  }
  return result + line
}

const TYPE_LABELS = { bel: 'Belnotitie', mail: 'E-mail', meeting: 'Meeting', notitie: 'Notitie' }

exports.handler = async (event) => {
  const userId = event.queryStringParameters?.user || null

  let actFilter = 'order=occurred_at.desc&limit=500&select=id,type,subject,body,occurred_at,companies(name),profiles(full_name)'
  if (userId) actFilter += `&logged_by=eq.${userId}`

  let taskFilter = 'status=eq.open&due_date=not.is.null&order=due_date.asc&limit=200&select=id,title,due_date,companies(name),profiles!tasks_assigned_to_fkey(full_name)'
  if (userId) taskFilter += `&assigned_to=eq.${userId}`

  const [activities, tasks] = await Promise.all([
    sbFetch(`activities?${actFilter}`),
    sbFetch(`tasks?${taskFilter}`)
  ])

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//NRG CRM//NL',
    'X-WR-CALNAME:NRG CRM',
    'X-WR-TIMEZONE:Europe/Amsterdam',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ]

  for (const a of (Array.isArray(activities) ? activities : [])) {
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

  for (const t of (Array.isArray(tasks) ? tasks : [])) {
    if (!t.due_date) continue
    const summary = escIcal(`📌 ${t.title} — ${t.companies?.name || ''}`)
    const desc = escIcal([
      t.companies?.name ? `Bedrijf: ${t.companies.name}` : '',
      t.profiles?.full_name ? `Toegewezen aan: ${t.profiles.full_name}` : ''
    ].filter(Boolean).join('\\n'))

    lines.push('BEGIN:VEVENT')
    lines.push(foldLine(`UID:task-${t.id}@nrgcrm`))
    lines.push(foldLine(`DTSTART;VALUE=DATE:${t.due_date.replace(/-/g, '')}`))
    lines.push(foldLine(`DTEND;VALUE=DATE:${t.due_date.replace(/-/g, '')}`))
    lines.push(foldLine(`SUMMARY:${summary}`))
    if (desc) lines.push(foldLine(`DESCRIPTION:${desc}`))
    lines.push('CATEGORIES:Taak')
    lines.push('STATUS:NEEDS-ACTION')
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
