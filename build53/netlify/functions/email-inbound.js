const { createClient } = require('@supabase/supabase-js');
const Anthropic = require('@anthropic-ai/sdk');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const NRG_DOMEINEN = ['nrgsales.nl', 'nrggroup.nl', 'nrg.nl'];

function isNrgAdres(addr) {
  return NRG_DOMEINEN.some(d => (addr || '').toLowerCase().includes('@' + d));
}

function extractAdressen(adresString) {
  if (!adresString) return [];
  return adresString.split(',').map(a => a.trim()).filter(Boolean);
}

// Decodeer alle base64 MIME blokken uit een raw email
function decodeerMime(rawEmail) {
  if (!rawEmail) return '';

  let tekst = rawEmail;

  // Decodeer base64 content blokken
  tekst = tekst.replace(
    /Content-Transfer-Encoding:\s*base64\s*[\r\n]+([\s\S]+?)(?=\n--|\nContent-|\Z)/gi,
    (match, b64Block) => {
      try {
        const schoon = b64Block.replace(/\s/g, '');
        const decoded = Buffer.from(schoon, 'base64').toString('utf-8');
        return decoded;
      } catch (e) {
        return match;
      }
    }
  );

  // Decodeer quoted-printable
  tekst = tekst.replace(/=\r?\n/g, '');
  tekst = tekst.replace(/=([0-9A-Fa-f]{2})/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  );

  // Verwijder MIME headers en boundaries om alleen leesbare tekst over te houden
  tekst = tekst.replace(/^(Content-Type|Content-Transfer-Encoding|Content-Disposition|MIME-Version|X-[A-Za-z-]+):.*$/gm, '');
  tekst = tekst.replace(/^--[A-Za-z0-9_\-=]+.*$/gm, '');

  // Meerdere lege regels samenvoegen
  tekst = tekst.replace(/\n{3,}/g, '\n\n');

  return tekst.trim();
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const { from, to, cc, subject, rawEmail, receivedAt, attachments } = JSON.parse(event.body);

    // Decodeer de volledige raw email inclusief doorgestuurde thread
    const volledigeTekst = decodeerMime(rawEmail);

    console.log('Raw email lengte:', rawEmail?.length);
    console.log('Gedecodeerd lengte:', volledigeTekst?.length);
    console.log('Eerste 500 tekens:', volledigeTekst?.slice(0, 500));

    // Haal profielen op
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email, role')
      .order('created_at', { ascending: true });

    const admin = profiles?.[0];

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

    const externeAdressen = alleAdressen.filter(addr => !isNrgAdres(addr));
    const externeGeadresseerden = externeAdressen.join(', ');
    const externeDomeinen = [...new Set(
      externeAdressen.map(addr => addr.split('@')[1]?.toLowerCase()).filter(Boolean)
    )].join(', ');

    // Haal bedrijven en contacten op
    const { data: companies } = await supabase.from('companies').select('id, name, website');
    const { data: contacts } = await supabase.from('contacts').select('id, name, email, company_id');

    // Verwerk bijlagen
    let attachmentSummary = '';
    if (attachments && attachments.length > 0) {
      const relevant = attachments
        .filter(a => a.content_type && (
          a.content_type.includes('pdf') || a.content_type.includes('word') ||
          a.content_type.includes('excel') || a.content_type.includes('text')
        ))
        .slice(0, 3);
      if (relevant.length > 0) {
        attachmentSummary = '\n\nBijlagen:\n' + relevant.map(a =>
          `- ${a.filename}: ${a.text_preview || '(geen tekst)'}`.slice(0, 500)
        ).join('\n');
      }
    }

    const nrgMedewerkers = nrgAdressen.map(addr => {
      const p = profiles?.find(p => p.email?.toLowerCase() === addr.toLowerCase());
      return p ? `${p.full_name} (${addr})` : addr;
    }).join(', ');

    // Gebruik de gedecodeerde tekst voor Claude — maximaal 10000 tekens
    const emailInhoud = volledigeTekst.slice(0, 10000) + attachmentSummary;

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: `Analyseer deze zakelijke e-mail voor een CRM systeem. De mail is volledig gedecodeerd inclusief de hele thread.

ABSOLUTE REGELS:
- Adressen op nrggroup.nl, nrgsales.nl of nrg.nl zijn ALTIJD NRG medewerkers — NOOIT als klant of nieuw bedrijf voorstellen.
- NRG medewerkers in deze thread: ${nrgMedewerkers || '(zie mailinhoud)'}
- Zoek actief in de VOLLEDIGE mailinhoud naar externe personen, e-mailadressen en bedrijfsnamen — ook diep in geciteerde/doorgestuurde berichten.
- Externe adressen in headers: ${externeGeadresseerden || '(geen — zoek in de mailbody)'}
- Externe domeinen: ${externeDomeinen || '(geen — zoek in de mailbody)'}
- Match domeinen met website velden van bekende bedrijven.
- Als er geen externe partijen zijn → suggestie_actie "geen_actie".

JSON response velden:
- samenvatting: max 100 woorden, vermeld alle externe partijen en de kern van de boodschap
- geadresseerden: externe partijen/personen als string (of null)
- bijlagen_samenvatting: (of null)
- match_type: "bedrijf", "contactpersoon", "nieuw_contact", "nieuw_bedrijf", of "onbekend"
- match_id: uuid (of null)
- match_naam: naam (of null, NOOIT een NRG naam)
- match_zekerheid: "hoog", "middel", of "laag"
- suggestie_actie: "koppel_aan_klant", "maak_nieuwe_klant", of "geen_actie"
- suggestie_toelichting: max 40 woorden (of null bij geen_actie)

Bekende bedrijven: ${JSON.stringify(companies?.slice(0, 50))}
Bekende contacten: ${JSON.stringify(contacts?.slice(0, 50))}

Van: ${from} | Aan: ${to || ''} | CC: ${cc || ''}
Onderwerp: ${subject}

Volledige mailinhoud:
${emailInhoud}

Geef ALLEEN een JSON object terug.`
      }]
    });

    const analysisText = response.content[0].text;
    const analysis = JSON.parse(analysisText.replace(/```json|```/g, '').trim());

    const { error } = await supabase.from('email_inbox').insert({
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
