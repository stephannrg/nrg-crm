import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export const supabase = createClient(
  'https://lvpyecqapzqqakokiqgp.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2cHllY3FhcHpxcWFrb2tpcWdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwMjcyMzUsImV4cCI6MjA5MDYwMzIzNX0.d0oz1eZ0In3nB8dOsyMXIz9FcFlNTrGjZBKOaFmDvFc'
)

export async function getProfile(userId) {
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
  return data
}

export async function requireAuth() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) { window.location.href = '/index.html'; return null }
  return session
}
