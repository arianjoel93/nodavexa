import { useState } from 'react'
import { Save, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { SuccessCaseVideo } from '../types'
import posthog from '../lib/posthog'

export const emptyCaseVideo = (): SuccessCaseVideo => ({
  id: '',
  slug: '',
  title: '',
  video_url: '',
  youtube_id: '',
  description: '',
  position: 0,
  published: true,
})

function youtubeIdFrom(url: string) {
  const trimmed = url.trim()
  const shortMatch = trimmed.match(/shorts\/([a-zA-Z0-9_-]+)/)
  if (shortMatch?.[1]) return shortMatch[1]
  const watchMatch = trimmed.match(/[?&]v=([a-zA-Z0-9_-]+)/)
  if (watchMatch?.[1]) return watchMatch[1]
  const embedMatch = trimmed.match(/embed\/([a-zA-Z0-9_-]+)/)
  return embedMatch?.[1] || ''
}

export function AdminCaseVideoEditor({
  initial,
  onClose,
  onSaved,
}: {
  initial: SuccessCaseVideo
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (key: keyof SuccessCaseVideo, value: unknown) => setForm((current) => ({ ...current, [key]: value }))

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    const youtubeId = form.youtube_id.trim() || youtubeIdFrom(form.video_url)
    if (!youtubeId) {
      setError('No pude detectar el ID del video de YouTube.')
      setBusy(false)
      return
    }
    const slug = (form.slug || form.title)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
    const payload = {
      slug,
      title: form.title.trim(),
      video_url: form.video_url.trim(),
      youtube_id: youtubeId,
      description: form.description.trim(),
      position: Number(form.position) || 0,
      published: form.published,
      updated_at: new Date().toISOString(),
    }
    const response = form.id
      ? await supabase.from('success_case_videos').update(payload).eq('id', form.id)
      : await supabase.from('success_case_videos').insert(payload)
    if (response.error) setError(response.error.message)
    else {
      posthog?.capture('admin_success_case_video_saved', { action: form.id ? 'updated' : 'created', published: form.published })
      onSaved()
    }
    setBusy(false)
  }

  return (
    <div className="editor-overlay">
      <form className="solution-editor" onSubmit={save}>
        <header>
          <div>
            <small>{form.id ? 'EDITAR' : 'NUEVO'} VIDEO DE CASO</small>
            <h2>{form.title || 'Video sin título'}</h2>
          </div>
          <button type="button" onClick={onClose}>
            <X />
          </button>
        </header>
        <div className="editor-scroll">
          <section>
            <h3>Información del video</h3>
            <div className="field-grid">
              <label className="full">
                Título
                <input required value={form.title} onChange={(event) => set('title', event.target.value)} />
              </label>
              <label className="full">
                URL de YouTube
                <input required type="url" value={form.video_url} onChange={(event) => set('video_url', event.target.value)} />
              </label>
              <label>
                Slug opcional
                <input value={form.slug} onChange={(event) => set('slug', event.target.value)} />
              </label>
              <label>
                Orden
                <input type="number" value={form.position} onChange={(event) => set('position', Number(event.target.value))} />
              </label>
              <label className="full">
                Descripción
                <textarea rows={4} value={form.description} onChange={(event) => set('description', event.target.value)} />
              </label>
            </div>
          </section>
          <section className="publish-options">
            <label>
              <input type="checkbox" checked={form.published} onChange={(event) => set('published', event.target.checked)} /> Publicar video
            </label>
          </section>
          {error && <div className="form-error">{error}</div>}
        </div>
        <footer>
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn primary" disabled={busy}>
            <Save /> {busy ? 'Guardando…' : 'Guardar video'}
          </button>
        </footer>
      </form>
    </div>
  )
}
