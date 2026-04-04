const { createClient } = require('@supabase/supabase-js');
const Anthropic = require('@anthropic-ai/sdk');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const NRG_DOMEINEN = ['nrgsales.nl', 'nrggroup.nl', 'nrg.nl'];

function isNrgAdres(addr) {
  return NRG_DOMEINEN.some(d => addr.toLowerCase().includes('@' + d));
}

function extractAdressen(adresString) {
  if (!adresString) return [];
  return adresString.split(',').map(a => a.trim()).filter(Boolean);
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const { from, to, cc, subject, rawEmail, receivedAt, attachments } = JSON.parse(event.body);

    // Haal profielen op
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email, role')
      .order('created_at', { ascending: true });

    const admin = profiles?.[0];

    // Koppel nrggroup.nl adressen aan bekende gebruikers voor assigned_to
    const alleAdressen = [
      ...extractAdressen(from),
      ...extractAdressen(to),
      ...extractAdressen(cc)
    ];

    const nrgAdressen = alleAdressen.filter(isNrgAdres);
    let assigned_to = admin?.id || null;
    for (const addr of nrgAdressen) {
      const profiel = profiles?.find(p => p.email?.toLowerCase() === addr.toLowerCase());
      if (profiel) { assigned_to = profiel.id; break; }
    }

    // Externe adressen uit headers
    const externeAdressen = alleAdressen.filter(addr => !isNrgAdres(addr));
    const externeGeadresseerden = externeAdressen.join(', ');
    const externeDomeinen = [...new Set(
      externeAdressen
        .map(addr => addr.split('@')[1]?.toLowerCase())
        .filter(Boolean)
    )].join(', ');

    // Haal bedrijven en contacten op
    const { data: companies } = await supabase
      .from('companies')
      .select('id, name, website');

    const { data: contacts } = await supabase
      .from('contacts')
      .select('id, name, email, company_id');

    // Verwerk bijlagen
    let attachmentSummary = '';
    if (attachments && attachments.length > 0) {
      const relevant = attachments
        .filter(a => a.content_type && (
          a.content_type.includes('pdf') ||
          a.content_type.includes('word') ||
          a.content_type.includes('excel') ||
          a.content_type.includes('spreadsheet') ||
          a.content_type.includes('text')
        ))
        .slice(0, 3);
      if (relevant.length > 0) {
        attachmentSummary = '\n\nBijlagen:\n' + relevant.map(a =>
          `- ${a.filename} (${a.content_type}): ${a.text_preview || '(geen tekstinhoud)'}`.slice(0, 500)
        ).join('\n');
      }
    }

    const emailInhoud = (rawEmail?.slice(0, 8000) || '') + attachmentSummary;
    const nrgMedewerkers = nrgAdressen
      .map(addr => {
        const p = profiles?.find(p => p.email?.toLowerCase() === addr.toLowerCase());
        return p ? `${p.full_name} (${addr})` : addr;
      })
      .join(', ');

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: `Analyseer deze zakelijke e-mail voor een CRM systeem. Lees de VOLLEDIGE mail inclusief de HELE THREAD — doorgestuurde mails en replies bevatten de originele context onderaan.

ABSOLUTE REGELS:
- Adressen op nrggroup.nl, nrgsales.nl of nrg.nl zijn ALTIJD NRG medewerkers. NOOIT als klant, NOOIT als nieuw bedrijf voorstellen. Stel NOOIT NRG Group voor als nieuw bedrijf.
- NRG medewerkers in deze thread: ${nrgMedewerkers || '(zie mailinhoud)'}
- Als de ENIGE betrokken partijen NRG medewerkers zijn → gebruik suggestie_actie "geen_actie", match_type "onbekend", en laat match_naam null.

MATCHINGSINSTRUCTIES:
- Kijk in de VOLLEDIGE mailthread (ook doorgestuurde/geciteerde berichten onderaan) naar externe personen, bedrijfsnamen en e-mailadressen.
- Externe adressen in headers: ${externeGeadresseerden || '(geen — zoek dan in de mailbody/thread)'}
- Externe domeinen: ${externeDomeinen || '(geen — zoek dan in de mailbody/thread)'}
- Zoek actief in de mailinhoud naar: bedrijfsnamen, externe e-mailadressen, domeinnamen, contactpersonen.
- Match domeinen met de website velden van bekende bedrijven (bijv. "electure.nl" → bedrijf met website "electure.nl").
- Als een persoon of bedrijf GENOEMD wordt maar geen bekende match heeft → suggestie_actie "maak_nieuwe_klant".

Geef een JSON response met:
- samenvatting: heldere samenvatting max 100 woorden van de HELE thread. Vermeld alle externe partijen/personen die relevant zijn.
- geadresseerden: alle externe partijen (adressen + genoemde personen/bedrijven) als string, of null als echt alleen NRG intern
- bijlagen_samenvatting: beschrijving van relevante bijlagen (of null)
- match_type: "bedrijf", "contactpersoon", "nieuw_contact", "nieuw_bedrijf", of "onbekend"
- match_id: uuid van het gevonden bedrijf of contact (of null)
- match_naam: naam van het gevonden bedrijf of contact (of null) — NOOIT een NRG naam hier
- match_zekerheid: "hoog", "middel", of "laag"
- suggestie_actie: "koppel_aan_klant", "maak_nieuwe_klant", of "geen_actie"
- suggestie_toelichting: korte uitleg max 40 woorden — bij geen_actie simpelweg null

Bekende bedrijven (met website): ${JSON.stringify(companies?.slice(0, 50))}
Bekende contacten: ${JSON.stringify(contacts?.slice(0, 50))}

Van: ${from}
Aan: ${to || ''}
CC: ${cc || ''}
Onderwerp: ${subject}

Volledige mailinhoud (inclusief thread):
${emailInhoud}

Geef ALLEEN een JSON object terug, geen andere tekst.`
      }]
    });

    const analysisText = response.content[0].text;
    const analysis = JSON.parse(analysisText.replace(/```json|```/g, '').trim());

    const { error } = await supabase
      .from('email_inbox')
      .insert({
        from_email: from,
        to_email: externeGeadresseerden || null,
        cc_email: cc || null,
        subject: subject,
        received_at: receivedAt,
        raw_email: rawEmail?.slice(0, 10000),
        samenvatting: analysis.samenvatting,
        geadresseerden: analysis.geadresseerden || null,
        bijlagen_samenvatting: analysis.bijlagen_samenvatting || null,
        match_type: analysis.match_type,
        match_id: analysis.match_id,
        match_naam: analysis.match_naam,
        match_zekerheid: analysis.match_zekerheid,
        suggestie_actie: analysis.suggestie_actie,
        suggestie_toelichting: analysis.suggestie_toelichting,
        assigned_to: assigned_to,
        verwerkt: false
      });

    if (error) throw error;

    return { statusCode: 200, body: JSON.stringify({ success: true }) };

  } catch (err) {
    console.error('email-inbound error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
