const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' }
  try {
    const { user_id, action } = JSON.parse(event.body)
    if (!user_id) return { statusCode: 400, body: JSON.stringify({ error: 'user_id verplicht' }) }

    if (action === 'unban') {
      const { error } = await supabase.auth.admin.updateUserById(user_id, { ban_duration: 'none' })
      if (error) throw error
    } else {
      // Ban voor 100 jaar
      const { error } = await supabase.auth.admin.updateUserById(user_id, { ban_duration: '876000h' })
      if (error) throw error
    }

    return { statusCode: 200, body: JSON.stringify({ success: true }) }
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
