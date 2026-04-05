const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const { email, full_name, role } = JSON.parse(event.body);
    if (!email || !full_name) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Email en naam zijn verplicht' }) };
    }

    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
      data: { full_name, role: role || 'user' }
    });

    if (error) throw error;

    // Maak ook meteen een profiel aan
    await supabase.from('profiles').upsert({
      id: data.user.id,
      full_name,
      email,
      role: role || 'user'
    });

    return { statusCode: 200, body: JSON.stringify({ success: true }) };

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
