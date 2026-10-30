import { useEffect, useState } from 'react'
import { Eye, EyeOff, Save, Wrench } from 'lucide-react'
import { fetchResourceTools, type ResourceTool } from '../lib/resource-auth'
import { spanishSupabaseError, supabase } from '../lib/supabase'

export function AdminResourceTools() {
  const [tools, setTools] = useState<ResourceTool[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState('')

  const load = () => fetchResourceTools().then(setTools).catch((error) => setNotice(spanishSupabaseError(error, 'No pudimos cargar los recursos.')))
  useEffect(() => { void load() }, [])

  const update = async (tool: ResourceTool, patch: Partial<Pick<ResourceTool, 'published' | 'requires_auth'>>) => {
    setBusy(tool.id)
    setNotice('')
    const { error } = await supabase.from('resource_tools').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', tool.id)
    if (error) setNotice(spanishSupabaseError(error))
    else setTools((current) => current.map((item) => item.id === tool.id ? { ...item, ...patch } : item))
    setBusy(null)
  }

  return <section className="admin-resource-tools">
    <header><div><span>HERRAMIENTAS</span><h1>Recursos</h1><p>Controla qué herramientas aparecen en el catálogo y si requieren cuenta.</p></div><Wrench /></header>
    {notice && <div className="notice" role="status">{notice}</div>}
    <div className="admin-list"><div className="admin-row labels"><span>Recurso</span><span>Visibilidad</span><span>Acceso</span><span>Estado</span></div>{tools.map((tool) => <div className="admin-row" key={tool.id}><div><div className="admin-thumb form-thumb">{tool.icon_key === 'database' ? 'DB' : 'CSV'}</div><span><b>{tool.title}</b><small>{tool.route}</small></span></div><span><button className="admin-inline-toggle" disabled={busy === tool.id} onClick={() => void update(tool, { published: !tool.published })}>{tool.published ? <><Eye size={16} /> Publicado</> : <><EyeOff size={16} /> Oculto</>}</button></span><span>{tool.requires_auth ? 'Cuenta requerida' : 'Sin cuenta'}</span><span>{busy === tool.id ? <i className="draft">Guardando…</i> : <i className={tool.published ? 'published' : 'draft'}>{tool.published ? 'Activo' : 'Oculto'}</i>}</span></div>)}</div>
    {!tools.length && <p className="empty">No hay recursos configurados. Aplica la migración de Supabase para cargar los recursos iniciales.</p>}
    <p className="dashboard-note"><Save /> Los cambios se guardan directamente en Supabase.</p>
  </section>
}
