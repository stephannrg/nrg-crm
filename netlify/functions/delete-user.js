const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  try {
    const { user_id } = JSON.parse(event.body);
    if (!user_id) return { statusCode: 400, body: JSON.stringify({ error: 'user_id verplicht' }) };
    const { error } = await supabase.auth.admin.deleteUser(user_id);
    if (error) throw error;
    await supabase.from('profiles').delete().eq('id', user_id);
    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
