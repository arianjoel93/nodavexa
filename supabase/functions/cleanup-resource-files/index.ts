import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2.52.1'

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Método no permitido', { status: 405 })
  const token = req.headers.get('x-cleanup-token') || ''
  if (!token) return new Response('No autorizado', { status: 401 })
  const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  const hash = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
  const { data: auth, error: authError } = await client.from('resource_cleanup_auth').select('token_hash').eq('id', true).single()
  if (authError || auth?.token_hash !== hash) return new Response('No autorizado', { status: 401 })
  let removed = 0
  for (let batch = 0; batch < 10; batch++) {
    const { data, error } = await client.from('resource_files').select('id,path').lte('expires_at', new Date().toISOString()).order('expires_at').limit(100)
    if (error) return new Response('Error al consultar archivos', { status: 500 })
    if (!data?.length) break
    const { error: storageError } = await client.storage.from('resource-files').remove(data.map(file => file.path))
    if (storageError) return new Response('Error al eliminar archivos', { status: 500 })
    const { error: deleteError } = await client.from('resource_files').delete().in('id', data.map(file => file.id))
    if (deleteError) return new Response('Error al limpiar historial', { status: 500 })
    removed += data.length
  }
  return Response.json({ removed })
})
