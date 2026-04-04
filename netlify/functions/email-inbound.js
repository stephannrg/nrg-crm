const { createClient } = require('@supabase/supabase-js');
const Anthropic = require('@anthropic-ai/sdk');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const { from, to, subject, rawEmail, receivedAt, attachments } = JSON.parse(event.body);

    // Haal alle profielen op
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email, role')
      .order('created_at', { ascending: true });

    // Bepaal admin = eerste aangemaakte gebruiker
    const admin = profiles?.[0];

    // Zoek of de afzender een bekende gebruiker is
    const senderProfile = profiles?.find(p =>
      p.email?.toLowerCase() === from?.toLowerCase()
    );

    // Bepaal voor wie deze mail is
    // - Afzender is een bekende gebruiker → stuur naar die gebruiker zelf
    // - Afzender is onbekend → alleen naar admin
    const assigned_to = senderProfile ? senderProfile.id : admin?.id || null;

    // Haal bedrijven en contacten op
    const { data: companies } = await supabase
      .from('companies')
      .select('id, name');

    const { data: contacts } = await supabase
      .from('contacts')
      .select('id, name, email, company_id');

    // Verwerk bijlagen — lees tekst, sla niet op
    let attachmentSummary = '';
    if (attachments && attachments.length > 0) {
      const relevantAttachments = attachments
        .filter(a => a.content_type && (
          a.content_type.includes('pdf') ||
          a.content_type.includes('word') ||
          a.content_type.includes('excel') ||
          a.content_type.includes('spreadsheet') ||
          a.content_type.includes('text')
        ))
        .slice(0, 3); // max 3 bijlagen

      if (relevantAttachments.length > 0) {
        attachmentSummary = '\n\nBijlagen:\n' + relevantAttachments.map(a =>
          `- ${a.filename} (${a.content_type}): ${a.text_preview || '(geen tekstinhoud)'}`.slice(0, 500)
        ).join('\n');
      }
    }

    const emailInhoud = (rawEmail?.slice(0, 3000) || '') + attachmentSummary;

    // Claude analyseert de mail
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: `Analyseer deze zakelijke e-mail voor een CRM systeem en geef een JSON response met de volgende velden:

- samenvatting: heldere, zakelijke samenvatting van max 80 woorden. Focus op wat er gevraagd of gemeld wordt.
- bijlagen_samenvatting: korte beschrijving van relevante bijlagen (of null als geen bijlagen)
- match_type: "bedrijf", "contactpersoon", "nieuw_contact", "nieuw_bedrijf", of "onbekend"
- match_id: uuid van het gevonden bedrijf of contact uit onderstaande lijsten (of null)
- match_naam: naam van het gevonden bedrijf of contact (of null)
- match_zekerheid: "hoog", "middel", of "laag"
- suggestie_actie: één van "koppel_aan_klant", "maak_nieuwe_klant", "geen_actie"
- suggestie_toelichting: korte uitleg waarom deze actie aanbevolen wordt (max 40 woorden)

Bekende bedrijven: ${JSON.stringify(companies?.slice(0, 50))}
Bekende contacten: ${JSON.stringify(contacts?.slice(0, 50))}

E-mail van: ${from}
Onderwerp: ${subject}
Inhoud: ${emailInhoud}

Geef ALLEEN een JSON object terug, geen andere tekst.`
      }]
    });

    const analysisText = response.content[0].text;
    const analysis = JSON.parse(analysisText.replace(/```json|```/g, '').trim());

    // Sla op in Supabase
    const { error } = await supabase
      .from('email_inbox')
      .insert({
        from_email: from,
        subject: subject,
        received_at: receivedAt,
        raw_email: rawEmail?.slice(0, 10000),
        samenvatting: analysis.samenvatting,
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
