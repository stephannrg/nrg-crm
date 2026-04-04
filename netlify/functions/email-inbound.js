const { createClient } = require('@supabase/supabase-js');
const Anthropic = require('@anthropic-ai/sdk');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const { from, to, subject, rawEmail, receivedAt } = JSON.parse(event.body);

    // Haal bedrijven en contacten op uit Supabase
    const { data: companies } = await supabase
      .from('companies')
      .select('id, name');

    const { data: contacts } = await supabase
      .from('contacts')
      .select('id, name, email, company_id');

    // Claude analyseert de mail
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `Analyseer deze e-mail en geef een JSON response met:
- samenvatting: korte samenvatting van de mail (max 100 woorden)
- match_type: "bedrijf", "contactpersoon", "nieuw_contact", "nieuw_bedrijf", of "onbekend"
- match_id: uuid van het gevonden bedrijf of contact (of null)
- match_naam: naam van het gevonden bedrijf of contact (of null)
- match_zekerheid: "hoog", "middel", of "laag"

Bekende bedrijven: ${JSON.stringify(companies?.slice(0, 50))}
Bekende contacten: ${JSON.stringify(contacts?.slice(0, 50))}

E-mail van: ${from}
Onderwerp: ${subject}
Inhoud: ${rawEmail?.slice(0, 3000)}

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
        match_type: analysis.match_type,
        match_id: analysis.match_id,
        match_naam: analysis.match_naam,
        match_zekerheid: analysis.match_zekerheid
      });

    if (error) throw error;

    return { statusCode: 200, body: JSON.stringify({ success: true }) };

  } catch (err) {
    console.error('email-inbound error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
