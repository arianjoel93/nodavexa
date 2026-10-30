import { supabase } from './supabase'

export type SavedResourceFile = { id: string; tool_slug: string; name: string; path: string; created_at: string; size_bytes: number }
export async function saveResourceFile(tool: string, name: string, blob: Blob) {
  const { data, error: authError } = await supabase.auth.getUser()
  if (authError || !data.user) throw new Error('Inicia sesión nuevamente para guardar tu archivo.')
  if (blob.size > 25 * 1024 * 1024) throw new Error('El archivo supera el límite de 25 MB para el historial.')
  const safeName = Array.from(name).map(char => char.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(char) ? '_' : char).join('').slice(0, 170)
  const extension = safeName.split('.').pop()?.toLowerCase() || 'bin'
  const path = `${data.user.id}/${tool}/${crypto.randomUUID()}.${extension}`
  const { error: uploadError } = await supabase.storage.from('resource-files').upload(path, blob, { contentType: blob.type || 'application/octet-stream', upsert: false })
  if (uploadError) throw new Error('No pudimos subir el archivo a tu historial. Inténtalo de nuevo.')
  const { error } = await supabase.from('resource_files').insert({ user_id: data.user.id, tool_slug: tool, name: safeName, path, size_bytes: blob.size })
  if (error) {
    await supabase.storage.from('resource-files').remove([path])
    throw new Error('El archivo no pudo registrarse en el historial. Inténtalo de nuevo.')
  }
  window.dispatchEvent(new Event('resource-files-updated'))
}
export async function listResourceFiles(tool: string, offset = 0): Promise<SavedResourceFile[]> {
  const { data, error } = await supabase.from('resource_files').select('id,tool_slug,name,path,created_at,size_bytes')
    .eq('tool_slug', tool).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).order('id').range(offset, offset + 24)
  if (error) throw new Error('No pudimos consultar tu historial de archivos.')
  return data || []
}
export async function downloadResourceFile(file: SavedResourceFile) {
  const { data, error } = await supabase.storage.from('resource-files').download(file.path)
  if (error || !data) throw new Error('No pudimos descargar el archivo. Revisa tu conexión o vuelve a iniciar sesión.')
  const url = URL.createObjectURL(data)
  const link = document.createElement('a')
  link.href = url; link.download = file.name; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}

const legacyMigrations = new Map<string, Promise<void>>()
export async function migrateLegacyResourceFiles() {
  const { data } = await supabase.auth.getUser()
  if (!data.user || typeof indexedDB === 'undefined') return
  const userId = data.user.id
  if (legacyMigrations.has(userId)) return legacyMigrations.get(userId)
  const migration = (async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('nodavexa-resource-files', 1)
      request.onupgradeneeded = () => request.result.createObjectStore('files', { keyPath: 'id' })
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    try {
      for (let index = 0; index < 100; index++) {
        const file = await new Promise<{ id: string; tool: string; name: string; blob: Blob; created: number } | null>((resolve, reject) => {
          const request = db.transaction('files').objectStore('files').openCursor()
          request.onsuccess = () => { const cursor = request.result; if (!cursor) return resolve(null); if (cursor.value.userId === userId) resolve(cursor.value); else cursor.continue() }
          request.onerror = () => reject(request.error)
        })
        if (!file) break
        if (file.created > Date.now() - 30 * 86400000) await saveResourceFile(file.tool, file.name, file.blob)
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction('files', 'readwrite')
          tx.objectStore('files').delete(file.id)
          tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error)
        })
      }
    } finally { db.close() }
  })()
  legacyMigrations.set(userId, migration)
  return migration
}
