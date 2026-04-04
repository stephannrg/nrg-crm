import { supabase } from '../js/supabase.js'
import { esc, showModal, hideModal } from '../js/utils.js'

// Injects the actie modal + klant modal into the given container
export async function openNieuweActie(container) {
  // Load companies for search
  const { data: companies } = await supabase.from('companies').select('id,name,city,status').order('name')
  const { data: profiles }  = await supabase.from('profiles').select('id,full_name')
  const { data: { session } } = await supabase.auth.getSession()
  const uid = session?.user?.id

  const modals = document.createElement('div')
  modals.innerHTML = `
    <!-- Nieuwe Actie Modal (3 stappen) -->
    <div class="modal-overlay" id="actie-modal">
      <div class="modal">
        <div class="modal-handle"></div>
        <div class="modal-header">
          <h3 id="actie-title">Nieuwe actie</h3>
          <button class="btn btn-icon close-btn" onclick="document.getElementById('actie-modal').classList.remove('open')">✕</button>
        </div>
        <div class="modal-body">
          <div id="actie-error" class="alert alert-error" style="display:none"></div>

          <!-- Stap 1: type -->
          <div class="action-step active" id="step-1">
            <div class="action-type-grid">
              <button class="action-type-btn" data-type="bel">
                <span class="action-type-icon">📞</span>
                <span>Belnotitie</span>
              </button>
              <button class="action-type-btn" data-type="mail">
                <span class="action-type-icon">✉️</span>
                <span>E-mail</span>
              </button>
              <button class="action-type-btn" data-type="meeting">
                <span class="action-type-icon">🤝</span>
                <span>Meeting</span>
              </button>
              <button class="action-type-btn" data-type="notitie">
                <span class="action-type-icon">📝</span>
                <span>Notitie</span>
              </button>
            </div>
          </div>

          <!-- Stap 2: klant -->
          <div class="action-step" id="step-2">
            <div class="step-back" id="back-to-1">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
              Terug
            </div>
            <div class="field">
              <label>Zoek klant</label>
              <div class="search-wrap" style="position:relative">
                <svg class="search-icon" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input type="text" id="actie-company-search" placeholder="Bedrijfsnaam typen..." autocomplete="off"/>
                <div class="suggestions" id="actie-suggestions" style="display:none"></div>
              </div>
            </div>
            <div id="selected-company" style="display:none" class="alert alert-success"></div>
          </div>

          <!-- Stap 3: notitie -->
          <div class="action-step" id="step-3">
            <div class="step-back" id="back-to-2">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
              Terug
            </div>
            <div class="field">
              <label>Onderwerp *</label>
              <input type="text" id="actie-subject" placeholder="Bijv. 'Demo laadpalen besproken'"/>
            </div>
            <div class="field">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px">
                <label style="margin-bottom:0">Notities</label>
                <button type="button" id="dicteer-btn" title="Inspreken" style="display:flex;align-items:center;gap:6px;padding:5px 12px;border-radius:20px;font-size:12px;font-weight:600;border:1.5px solid var(--border);background:var(--surface);color:var(--muted);cursor:pointer;transition:all .15s">
                  <svg id="dicteer-icon" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                  <span id="dicteer-label">Inspreken</span>
                </button>
              </div>
              <div id="dicteer-status" style="display:none;margin-bottom:8px;padding:10px 14px;border-radius:10px;font-size:13px;background:var(--green-l);color:#007a4d;border:1.5px solid #b3e6d0"></div>
              <textarea id="actie-body" placeholder="Typ hier of gebruik de microfoon om in te spreken..."></textarea>
            </div>
            <div class="field">
              <label>Datum & tijd</label>
              <input type="datetime-local" id="actie-date"/>
            </div>
            <div class="field-inline">
              <input type="checkbox" id="actie-followup"/>
              <label for="actie-followup">Maak opvolgtaak</label>
            </div>
            <div id="followup-fields" style="display:none;background:var(--bg);border-radius:var(--radius-sm);padding:12px;margin-top:-8px;margin-bottom:14px">
              <div class="field" style="margin-bottom:10px">
                <label>Taakomschrijving</label>
                <input type="text" id="actie-task-title" placeholder="Bijv. 'Offerte opstellen'"/>
              </div>
              <div class="field-row" style="margin-bottom:0">
                <div class="field" style="margin-bottom:0">
                  <label>Deadline</label>
                  <input type="date" id="actie-task-due"/>
                </div>
                <div class="field" style="margin-bottom:0">
                  <label>Toegewezen aan</label>
                  <select id="actie-task-assigned">
                    ${(profiles||[]).map(p => `<option value="${p.id}" ${p.id===uid?'selected':''}>${esc(p.full_name)}</option>`).join('')}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer" id="actie-footer" style="display:none">
          <button class="btn btn-secondary" onclick="document.getElementById('actie-modal').classList.remove('open')">Annuleren</button>
          <button class="btn btn-primary" id="actie-save-btn">Opslaan</button>
        </div>
      </div>
    </div>

    <!-- Nieuwe Klant Modal met KvK zoek -->
    <div class="modal-overlay" id="klant-modal">
      <div class="modal">
        <div class="modal-handle"></div>
        <div class="modal-header">
          <h3>Nieuwe klant</h3>
          <button class="btn btn-icon close-btn" onclick="document.getElementById('klant-modal').classList.remove('open')">✕</button>
        </div>
        <div class="modal-body">
          <div id="klant-error" class="alert alert-error" style="display:none"></div>

          <!-- KvK zoek -->
          <div class="field">
            <label>Zoek via KvK (optioneel)</label>
            <div class="search-wrap" style="position:relative">
              <svg class="search-icon" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input type="text" id="kvk-search" placeholder="Typ bedrijfsnaam om op te zoeken..." autocomplete="off"/>
              <div class="suggestions" id="kvk-suggestions" style="display:none"></div>
            </div>
          </div>
          <div id="kvk-selected" style="display:none" class="kvk-result"></div>

          <div class="divider"></div>

          <div class="field-row">
            <div class="field"><label>Bedrijfsnaam *</label><input id="k-name" type="text"/></div>
            <div class="field">
              <label>Status</label>
              <select id="k-status">
                <option value="suspect">Suspect</option>
                <option value="prospect">Prospect</option>
                <option value="klant">Klant</option>
                <option value="inactief">Inactief</option>
              </select>
            </div>
          </div>
          <div class="field-row">
            <div class="field"><label>KvK-nummer</label><input id="k-kvk" type="text"/></div>
            <div class="field"><label>Sector</label><input id="k-sector" type="text"/></div>
          </div>
          <div class="field-row">
            <div class="field"><label>Adres</label><input id="k-address" type="text"/></div>
            <div class="field"><label>Stad</label><input id="k-city" type="text"/></div>
          </div>
          <div class="field"><label>Website</label><input id="k-website" type="url" placeholder="https://"/></div>
          <div class="field">
            <label>Labels</label>
            <div id="k-tags" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px"></div>
          </div>
          <div class="field-inline">
            <input type="checkbox" id="k-marketing"/>
            <label for="k-marketing">Aangemeld voor marketing</label>
          </div>
          <div class="field"><label>Notities</label><textarea id="k-notes"></textarea></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="document.getElementById('klant-modal').classList.remove('open')">Annuleren</button>
          <button class="btn btn-primary" id="klant-save-btn">Opslaan</button>
        </div>
      </div>
    </div>
  `
  document.body.appendChild(modals)

  // ── Actie modal logic ──
  let selectedType = null
  let selectedCompanyId = null
  let currentStep = 1

  function goStep(n) {
    currentStep = n
    document.querySelectorAll('.action-step').forEach((el,i) => el.classList.toggle('active', i+1===n))
    document.getElementById('actie-footer').style.display = n === 3 ? 'flex' : 'none'
    document.getElementById('actie-title').textContent = n === 1 ? 'Nieuwe actie — Type' : n === 2 ? 'Nieuwe actie — Klant' : 'Nieuwe actie — Details'
  }

  document.querySelectorAll('.action-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedType = btn.dataset.type
      ;(function(){ const n=new Date(); const y=n.getFullYear(),mo=String(n.getMonth()+1).padStart(2,'0'),d=String(n.getDate()).padStart(2,'0'),h=String(n.getHours()).padStart(2,'0'),mi=String(n.getMinutes()).padStart(2,'0'); document.getElementById('actie-date').value = `${y}-${mo}-${d}T${h}:${mi}` })()
      goStep(2)
    })
  })

  document.getElementById('back-to-1').addEventListener('click', () => goStep(1))
  document.getElementById('back-to-2').addEventListener('click', () => goStep(2))



  function resetActieModal(preId, preNaam) {
    selectedType = null
    selectedCompanyId = preId || null
    document.getElementById('actie-subject').value = ''
    document.getElementById('actie-body').value = ''
    document.getElementById('actie-followup').checked = false
    document.getElementById('followup-fields').style.display = 'none'
    document.getElementById('actie-suggestions').style.display = 'none'
    document.getElementById('actie-error').style.display = 'none'
    const dictBtn = document.getElementById('dicteer-btn')
    if (dictBtn) delete dictBtn._inited

    if (preId && preNaam) {
      // Klant al ingevuld — sla stap 2 over na type keuze
      document.getElementById('actie-company-search').value = preNaam
      const sel = document.getElementById('selected-company')
      sel.textContent = '✓ ' + preNaam + ' geselecteerd'
      sel.style.display = 'block'
      goStep(1)
    } else {
      document.getElementById('actie-company-search').value = ''
      document.getElementById('selected-company').style.display = 'none'
      goStep(1)
    }
  }

  // Globale functie zodat klant.html het kan aanroepen met preselect
  window._openActieVoorBedrijf = (id, naam) => {
    resetActieModal(id, naam)
    document.getElementById('actie-modal').classList.add('open')
    // Als klant al geselecteerd: na type keuze direct naar stap 3
    if (id) {
      document.querySelectorAll('.action-type-btn').forEach(btn => {
        btn.onclick = null
        btn.addEventListener('click', () => {
          selectedType = btn.dataset.type
          ;(function(){ const n=new Date(); const y=n.getFullYear(),mo=String(n.getMonth()+1).padStart(2,'0'),d=String(n.getDate()).padStart(2,'0'),h=String(n.getHours()).padStart(2,'0'),mi=String(n.getMinutes()).padStart(2,'0'); document.getElementById('actie-date').value = `${y}-${mo}-${d}T${h}:${mi}` })()
          goStep(3)
          const dictBtn = document.getElementById('dicteer-btn')
          if (dictBtn) delete dictBtn._inited
          setTimeout(() => setupDictatie('actie-body', () => selectedType), 50)
        }, { once: true })
      })
    }
  }

  // Reset on open (normaal flow zonder preselect)
  new MutationObserver(() => {
    if (document.getElementById('actie-modal').classList.contains('open')) {
      if (!selectedCompanyId) resetActieModal(null, null)
    }
  }).observe(document.getElementById('actie-modal'), { attributes: true, attributeFilter: ['class'] })

  // Company search
  const companySearch = document.getElementById('actie-company-search')
  const suggestions   = document.getElementById('actie-suggestions')

  companySearch.addEventListener('input', () => {
    const q = companySearch.value.toLowerCase().trim()
    if (!q) { suggestions.style.display = 'none'; return }
    const filtered = (companies||[]).filter(c => c.name.toLowerCase().includes(q)).slice(0,6)
    if (!filtered.length) { suggestions.style.display = 'none'; return }
    suggestions.innerHTML = filtered.map(c => `
      <div class="suggestion-item" data-id="${c.id}" data-name="${esc(c.name)}">
        <div class="suggestion-name">${esc(c.name)}</div>
        <div class="suggestion-sub">${[c.city, c.sector].filter(Boolean).map(esc).join(' · ') || 'Geen info'}</div>
      </div>`).join('')
    // Portal pattern: verplaats suggestions naar body zodat modal overflow hem niet afknipt
    const searchEl = document.getElementById('actie-company-search')
    if (searchEl && suggestions.parentElement !== document.body) {
      document.body.appendChild(suggestions)
    }
    if (searchEl) {
      const rect = searchEl.getBoundingClientRect()
      suggestions.style.cssText = `display:block;position:fixed;top:${rect.bottom + 4}px;left:${rect.left}px;width:${rect.width}px;z-index:9999;background:#fff;border:1.5px solid #dde8e3;border-radius:14px;box-shadow:0 12px 40px rgba(0,36,52,.18);max-height:260px;overflow-y:auto;`
    } else {
      suggestions.style.display = 'block'
    }
    suggestions.querySelectorAll('.suggestion-item').forEach(el => {
      el.addEventListener('click', () => {
        selectedCompanyId = el.dataset.id
        companySearch.value = el.dataset.name
        suggestions.style.display = 'none'
        document.getElementById('selected-company').textContent = '✓ ' + el.dataset.name + ' geselecteerd'
        document.getElementById('selected-company').style.display = 'block'
        goStep(3)
        // Start dictatie setup
        setTimeout(() => setupDictatie('actie-body', () => selectedType), 50)
      })
    })
  })

  // Followup toggle
  document.getElementById('actie-followup').addEventListener('change', e => {
    document.getElementById('followup-fields').style.display = e.target.checked ? 'block' : 'none'
  })

  // Save actie
  document.getElementById('actie-save-btn').addEventListener('click', async () => {
    const subject = document.getElementById('actie-subject').value.trim()
    const errorEl = document.getElementById('actie-error')
    if (!subject) { errorEl.textContent = 'Vul een onderwerp in.'; errorEl.style.display = 'block'; return }
    if (!selectedCompanyId) { errorEl.textContent = 'Selecteer een klant.'; errorEl.style.display = 'block'; return }
    errorEl.style.display = 'none'
    const btn = document.getElementById('actie-save-btn')
    btn.disabled = true; btn.textContent = 'Opslaan...'

    const { data: act } = await supabase.from('activities').insert({
      company_id:  selectedCompanyId,
      type:        selectedType,
      subject,
      body:        document.getElementById('actie-body').value.trim() || null,
      occurred_at: document.getElementById('actie-date').value || new Date().toISOString(),
      logged_by:   uid
    }).select().single()

    if (document.getElementById('actie-followup').checked) {
      const taskTitle = document.getElementById('actie-task-title').value.trim()
      if (taskTitle) {
        await supabase.from('tasks').insert({
          company_id:  selectedCompanyId,
          title:       taskTitle,
          due_date:    document.getElementById('actie-task-due').value || null,
          assigned_to: document.getElementById('actie-task-assigned').value || uid,
          created_by:  uid
        })
      }
    }

    document.getElementById('actie-modal').classList.remove('open')
    btn.disabled = false; btn.textContent = 'Opslaan'
    // Redirect to company
    if (selectedCompanyId) location.href = `/pages/klant.html?id=${selectedCompanyId}`
  })

  // ── KvK search ──
  const kvkSearch = document.getElementById('kvk-search')
  const kvkSugg   = document.getElementById('kvk-suggestions')
  let kvkTimeout  = null

  kvkSearch.addEventListener('input', () => {
    clearTimeout(kvkTimeout)
    const q = kvkSearch.value.trim()
    if (q.length < 2) { kvkSugg.style.display = 'none'; return }
    kvkSugg.innerHTML = '<div class="suggestion-loading">Zoeken...</div>'
    kvkSugg.style.display = 'block'
    kvkTimeout = setTimeout(() => searchKvK(q), 400)
  })

  async function searchKvK(q) {
    try {
      const resp = await fetch(`https://api.openkvk.nl/json/${encodeURIComponent(q)}/10/1/`)
      const data = await resp.json()
      const results = data?.data?.results || []
      if (!results.length) { kvkSugg.innerHTML = '<div class="suggestion-loading">Niets gevonden</div>'; return }
      kvkSugg.innerHTML = results.slice(0,6).map(r => `
        <div class="suggestion-item"
          data-name="${esc(r.bedrijfsnaam||'')}"
          data-kvk="${esc(r.kvknummer||'')}"
          data-address="${esc((r.straat||'') + ' ' + (r.huisnummer||''))}"
          data-city="${esc(r.plaats||'')}">
          <div class="suggestion-name">${esc(r.bedrijfsnaam)}</div>
          <div class="suggestion-sub">${esc(r.plaats||'')} · KvK ${esc(r.kvknummer||'')}</div>
        </div>`).join('')
      kvkSugg.querySelectorAll('.suggestion-item').forEach(el => {
        el.addEventListener('click', () => {
          document.getElementById('k-name').value    = el.dataset.name
          document.getElementById('k-kvk').value     = el.dataset.kvk
          document.getElementById('k-address').value = el.dataset.address
          document.getElementById('k-city').value    = el.dataset.city
          kvkSearch.value = el.dataset.name
          kvkSugg.style.display = 'none'
          document.getElementById('kvk-selected').innerHTML = `<strong>${esc(el.dataset.name)}</strong><span>KvK ${esc(el.dataset.kvk)} · ${esc(el.dataset.city)}</span>`
          document.getElementById('kvk-selected').style.display = 'block'
        })
      })
    } catch(e) {
      kvkSugg.innerHTML = '<div class="suggestion-loading">KvK niet bereikbaar</div>'
    }
  }

  // ── Dictatie setup functie ──────────────────────────────────────────────────
  function setupDictatie(textareaId, typeGetter) {
    const btn = document.getElementById('dicteer-btn')
    const label = document.getElementById('dicteer-label')
    const icon = document.getElementById('dicteer-icon')
    const status = document.getElementById('dicteer-status')
    const textarea = document.getElementById(textareaId)
    if (!btn || !textarea || btn._inited) return
    btn._inited = true

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR || location.protocol !== 'https:') {
      btn.style.opacity = '.4'
      btn.title = !SR ? 'Niet ondersteund in deze browser' : 'Microfoon werkt alleen op HTTPS'
      return
    }

    let recognition = null, isListening = false, rawText = ''

    function setUI(active) {
      isListening = active
      btn.classList.toggle('listening', active)
      label.textContent = active ? 'Stop' : 'Inspreken'
      if (active) {
        status.style.display = 'block'
        status.style.cssText = 'display:block;padding:10px 14px;border-radius:10px;font-size:13px;background:#fce8e8;color:#d94f4f;border:1.5px solid #f5c0c0;margin-bottom:8px'
        status.textContent = '🎙 Aan het luisteren...'
      }
    }

    async function cleanWithAI(text, type) {
      status.style.cssText = 'display:block;padding:10px 14px;border-radius:10px;font-size:13px;background:var(--green-l);color:#007a4d;border:1.5px solid #b3e6d0;margin-bottom:8px'
      status.textContent = '✨ Analyseren en invullen...'

      const typeLabels = {bel:'belnotitie',mail:'e-mailnotitie',meeting:'meetingverslag',notitie:'notitie'}
      const typeLabel = typeLabels[type] || 'notitie'
      const today = new Date()
      const todayStr = today.toLocaleDateString('nl-NL', {weekday:'long', day:'numeric', month:'long', year:'numeric'})

      const prompt = `Je bent een slimme CRM-assistent voor een sales team in de EV-laadinfrastructuur sector (laadpalen, CPMS, ERE, ODA, Cockpit, Energiescan).

Vandaag is het: ${todayStr}

Analyseer deze gesproken notitie en geef een JSON object terug met precies deze velden:
- "onderwerp": kort en krachtig onderwerp voor de activiteit (max 8 woorden, bijv. "Demo CPMS besproken — Opcharge")
- "notitie": nette zakelijke CRM-notitie in derde persoon, interpunctie correct, alle concrete info bewaard (namen, data, bedragen, producten), max 3-4 zinnen
- "opvolging_nodig": true of false — true als er een vervolgactie uit de tekst blijkt (bellen, mailen, meeting plannen, offerte sturen, demo inplannen, etc.)
- "opvolging_titel": omschrijving van de taak als opvolging_nodig true is (bijv. "Demo CPMS inplannen — Opcharge"), anders null
- "opvolging_datum": deadline als ISO datum (YYYY-MM-DD) als een datum of tijdsindicatie genoemd wordt (bijv. "volgende week dinsdag", "eind april", "over twee weken"), anders null. Bereken de datum relatief aan vandaag.

Gesproken tekst: "${text}"

Geef ALLEEN het JSON object terug, geen uitleg, geen markdown, geen backticks.`

      try {
        const resp = await fetch('/.netlify/functions/transcribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 400,
            messages: [{ role: 'user', content: prompt }]
          })
        })
        const data = await resp.json()
        const raw = data.content?.[0]?.text?.trim()
        if (!raw) throw new Error('geen resultaat')

        // Parse JSON response
        const result = JSON.parse(raw.replace(/```json|```/g, '').trim())

        // Fill in subject
        const subjectEl = document.getElementById('actie-subject')
        if (subjectEl && result.onderwerp) subjectEl.value = result.onderwerp

        // Fill in note
        if (result.notitie) textarea.value = result.notitie

        // Handle follow-up task
        if (result.opvolging_nodig) {
          const followupCheck = document.getElementById('actie-followup')
          const followupFields = document.getElementById('followup-fields')
          const taskTitle = document.getElementById('actie-task-title')
          const taskDue = document.getElementById('actie-task-due')

          if (followupCheck) followupCheck.checked = true
          if (followupFields) followupFields.style.display = 'block'
          if (taskTitle && result.opvolging_titel) taskTitle.value = result.opvolging_titel
          if (taskDue && result.opvolging_datum) taskDue.value = result.opvolging_datum

          status.textContent = '✓ Ingevuld + opvolgtaak aangemaakt — controleer en sla op'
        } else {
          status.textContent = '✓ Ingevuld — je kunt nog aanpassen'
        }
        status.style.cssText = 'display:block;padding:10px 14px;border-radius:10px;font-size:13px;background:var(--green-l);color:#007a4d;border:1.5px solid #b3e6d0;margin-bottom:8px'
        setTimeout(() => { status.style.display = 'none'; status.textContent = '' }, 4000)

      } catch(err) {
        textarea.value = text
        status.style.cssText = 'display:block;padding:10px 14px;border-radius:10px;font-size:13px;background:#fce8e8;color:#d94f4f;border:1.5px solid #f5c0c0;margin-bottom:8px'
        status.textContent = '⚠ Fout bij verwerken — ruwe tekst ingevuld'
        setTimeout(() => { status.style.display = 'none'; status.textContent = '' }, 3000)
      }
    }

    btn.addEventListener('click', () => {
      if (isListening) { recognition?.stop(); return }
      rawText = ''
      recognition = new SR()
      recognition.lang = 'nl-NL'
      recognition.continuous = true
      recognition.interimResults = true
      recognition.onstart = () => setUI(true)
      recognition.onend = async () => {
        setUI(false)
        if (rawText.trim()) await cleanWithAI(rawText.trim(), typeGetter ? typeGetter() : 'notitie')
        else status.style.display = 'none'
      }
      recognition.onerror = (e) => {
        setUI(false)
        if (e.error === 'not-allowed') {
          status.style.cssText = 'display:block;padding:10px 14px;border-radius:10px;font-size:13px;background:#fce8e8;color:#d94f4f;border:1.5px solid #f5c0c0;margin-bottom:8px'
          status.textContent = '⚠ Microfoon geblokkeerd — sta toegang toe in je browser'
        }
      }
      recognition.onresult = (e) => {
        let interim = ''
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) rawText += e.results[i][0].transcript + ' '
          else interim = e.results[i][0].transcript
        }
        status.textContent = '🎙 ' + (rawText + interim).trim()
        textarea.value = rawText + interim
      }
      recognition.start()
    })
  }

  // Load tags for new klant form
  const { data: allTags } = await supabase.from('tags').select('*').order('name')
  const selectedTags = new Set()
  function renderKTags() {
    const wrap = document.getElementById('k-tags')
    wrap.innerHTML = (allTags||[]).map(t => `
      <span class="tag tag-${t.type} tag-toggle ${selectedTags.has(t.id)?'selected':''}" data-id="${t.id}" style="cursor:pointer">
        ${esc(t.name)}
      </span>`).join('')
    wrap.querySelectorAll('.tag-toggle').forEach(el => {
      el.addEventListener('click', () => {
        selectedTags.has(el.dataset.id) ? selectedTags.delete(el.dataset.id) : selectedTags.add(el.dataset.id)
        renderKTags()
      })
    })
  }
  renderKTags()

  // Save new klant
  document.getElementById('klant-save-btn').addEventListener('click', async () => {
    const name = document.getElementById('k-name').value.trim()
    const errorEl = document.getElementById('klant-error')
    if (!name) { errorEl.textContent = 'Bedrijfsnaam is verplicht.'; errorEl.style.display = 'block'; return }
    errorEl.style.display = 'none'
    const btn = document.getElementById('klant-save-btn')
    btn.disabled = true; btn.textContent = 'Opslaan...'

    const { data: company } = await supabase.from('companies').insert({
      name,
      kvk_number:      document.getElementById('k-kvk').value.trim() || null,
      sector:          document.getElementById('k-sector').value.trim() || null,
      address:         document.getElementById('k-address').value.trim() || null,
      city:            document.getElementById('k-city').value.trim() || null,
      website:         document.getElementById('k-website').value.trim() || null,
      notes:           document.getElementById('k-notes').value.trim() || null,
      status:          document.getElementById('k-status').value,
      marketing_opt_in:document.getElementById('k-marketing').checked,
      owner_id:        uid
    }).select().single()

    if (selectedTags.size && company) {
      await supabase.from('company_tags').insert([...selectedTags].map(tid => ({ company_id: company.id, tag_id: tid })))
    }

    document.getElementById('klant-modal').classList.remove('open')
    btn.disabled = false; btn.textContent = 'Opslaan'
    if (company) location.href = `/pages/klant.html?id=${company.id}`
  })
}

