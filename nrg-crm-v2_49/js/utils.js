export function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
export function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
}
export function formatDateShort(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}
export function formatEuro(v) {
  if (!v && v !== 0) return '—'
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)
}
export function stageLabel(s) {
  return { lead: 'Lead', gekwalificeerd: 'Gekwalificeerd', offerte: 'Offerte', onderhandeling: 'Onderhandeling', gewonnen: 'Gewonnen', verloren: 'Verloren' }[s] || s
}
export function statusLabel(s) {
  return { suspect: 'Suspect', prospect: 'Prospect', klant: 'Klant', inactief: 'Inactief' }[s] || s
}
export function activityIcon(t) {
  return { bel: '📞', mail: '✉️', meeting: '🤝', notitie: '📝' }[t] || '📋'
}
export function activityLabel(t) {
  return { bel: 'Belnotitie', mail: 'E-mail', meeting: 'Meeting', notitie: 'Notitie' }[t] || t
}
export function fileSizeLabel(b) {
  if (!b) return ''
  if (b < 1024) return b + ' B'
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB'
  return (b / 1048576).toFixed(1) + ' MB'
}
export function initials(name) {
  return (name || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}
export function isOverdue(date) {
  return date && new Date(date) < new Date()
}
export function isoDate(d) {
  return new Date(d).toISOString().slice(0, 10)
}
export function showModal(id) {
  document.getElementById(id)?.classList.add('open')
}
export function hideModal(id) {
  document.getElementById(id)?.classList.remove('open')
}
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) e.target.classList.remove('open')
})
