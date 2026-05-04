import { supabase, getProfile, requireAuth } from './supabase.js'
import { esc, initials } from './utils.js'

const ICONS = {
  dashboard: `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,
  klanten: `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  pipeline: `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 6h18M3 12h14M3 18h10"/></svg>`,
  taken: `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
  inbox: `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>`,
  beheer: `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M12 2v2M12 20v2M20 12h2M2 12h2M19.07 19.07l-1.41-1.41M4.93 19.07l1.41-1.41"/></svg>`,
}

export async function initShell(activeNav) {
  const session = await requireAuth()
  if (!session) return null

  const profile = await getProfile(session.user.id)
  const name = profile?.full_name || session.user.email
  const ini = initials(name)
  const isAdmin = profile?.role === 'admin'

  const inboxCount = 0

  const navItems = [
    { key: 'dashboard', label: 'Dashboard', href: '/pages/dashboard.html' },
    { key: 'klanten',   label: 'Klanten',   href: '/pages/klanten.html' },
    { key: 'pipeline',  label: 'Pipeline',  href: '/pages/pipeline.html' },
    { key: 'taken',     label: 'Taken',     href: '/pages/taken.html' },
    { key: 'inbox',     label: 'Inbox',     href: '/pages/inbox.html', badge: inboxCount > 0 ? inboxCount : null },
  ]

  if (isAdmin) navItems.push({ key: 'beheer', label: 'Beheer', href: '/pages/beheer.html' })

  const sidebarNav = navItems.map(n => `
    <a class="nav-item ${activeNav === n.key ? 'active' : ''}" href="${n.href}">
      ${ICONS[n.key] || ''}
      ${n.label}
      ${n.badge ? `<span style="margin-left:auto;background:var(--teal-m);color:white;font-size:11px;font-weight:600;padding:1px 7px;border-radius:10px">${n.badge}</span>` : ''}
    </a>`).join('')

  const bottomNavItems = navItems.slice(0, 5)
  const bottomNav = bottomNavItems.map(n => `
    <a class="bottom-nav-item ${activeNav === n.key ? 'active' : ''}" href="${n.href}">
      ${ICONS[n.key] || ''}
      <span>${n.label}</span>
      ${n.badge ? `<span style="position:absolute;top:4px;right:12px;background:var(--teal-m);color:white;font-size:10px;font-weight:600;padding:0 5px;border-radius:8px">${n.badge}</span>` : ''}
    </a>`).join('')

  document.body.innerHTML = `
    <div class="app">
      <aside class="sidebar">
        <div class="sidebar-brand">
          <a href="/index.html" style="display:inline-block;line-height:0"><img src="/img/logo.png" alt="nrg" class="sidebar-logo"/></a>
        </div>
        <nav class="sidebar-nav">
          <div class="nav-section">Menu</div>
          ${sidebarNav}
        </nav>
        <div class="sidebar-user">
          <div class="avatar">${esc(ini)}</div>
          <div class="sidebar-user-info">
            <strong>${esc(name)}</strong>
            <span>${profile?.role || 'user'}</span>
          </div>
          <button class="logout-btn" id="logout-btn" title="Uitloggen">
            <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </button>
        </div>
      </aside>
      <div class="main" id="main-content"></div>
    </div>
    <nav class="bottom-nav">${bottomNav}</nav>
  `

  document.getElementById('logout-btn').addEventListener('click', async () => {
    await supabase.auth.signOut()
    window.location.href = '/index.html'
  })

  return { session, profile }
}
