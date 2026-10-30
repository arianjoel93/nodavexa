import { useCallback, useEffect, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { ArrowLeft, BarChart3, BriefcaseBusiness, ClipboardList, Film, LayoutGrid, LogOut, Package, Plus, Settings, ShieldCheck, Trash2, X, Wrench } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Logo } from '../components/Logo'
import { AdminSolutionEditor, emptySolution } from '../components/AdminSolutionEditor'
import { AdminCaseEditor, emptyCase } from '../components/AdminCaseEditor'
import { AdminCaseVideoEditor, emptyCaseVideo } from '../components/AdminCaseVideoEditor'
import { AdminSettings } from '../components/AdminSettings'
import { AdminQuotations } from '../components/AdminQuotations'
import { AdminProductPages } from '../components/AdminProductPages'
import { AdminResourceTools } from '../components/AdminResourceTools'
import { AdminResourceAnalytics } from '../components/AdminResourceAnalytics'
import { AdminResourceAccess } from '../components/AdminResourceAccess'
import { fetchSolutions, fetchSuccessCases, fetchSuccessCaseVideos, isSupabaseReady, supabase } from '../lib/supabase'
import posthog from '../lib/posthog'
import type { Solution, SuccessCase, SuccessCaseVideo } from '../types'

type View = 'catalog' | 'productPages' | 'cases' | 'caseVideos' | 'forms' | 'resources' | 'resourceAnalytics' | 'resourceAccess' | 'settings'

export function Admin() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const activeUserId = useRef<string | null>(null)

  const identifyUser = useCallback((authenticatedUser: User) => {
    if (activeUserId.current && activeUserId.current !== authenticatedUser.id) {
      posthog?.reset()
    }

    const personProperties: Record<string, string> = {}
    if (authenticatedUser.email) personProperties.email = authenticatedUser.email
    const role = (authenticatedUser.app_metadata as { role?: string }).role
    if (role) personProperties.role = role

    posthog?.identify(authenticatedUser.id, personProperties)
    activeUserId.current = authenticatedUser.id
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const sessionUser = data.session?.user || null
      setUser(sessionUser)
      if (sessionUser) identifyUser(sessionUser)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null)

      if (event === 'SIGNED_IN' && session?.user) {
        identifyUser(session.user)
        posthog?.capture('admin_login_succeeded')
      }
      if (event === 'SIGNED_OUT') {
        posthog?.reset()
        activeUserId.current = null
      }
    })
    return () => data.subscription.unsubscribe()
  }, [identifyUser])

  if (loading) return <div className="loading">Cargando panel…</div>
  if (!isSupabaseReady) {
    return (
      <div className="admin-auth">
        <div>
          <Logo />
          <h1>Conecta Supabase</h1>
        </div>
      </div>
    )
  }
  if (!user) return <Login onLogin={setUser} />
  const role = (user.app_metadata as { role?: string })?.role
  const adminEmails = ['soporte@nodavexa.com', 'joeltrincadov@gmail.com']
  if (!['admin', 'superadmin'].includes(role || '') && !adminEmails.includes(user.email?.toLowerCase() || '')) {
    return (
      <div className="admin-auth">
        <div>
          <Logo />
          <h1>Sin permiso administrativo</h1>
          <p>Esta cuenta no tiene el rol de administrador.</p>
          <button className="btn ghost" onClick={() => supabase.auth.signOut()}>
            Usar otra cuenta
          </button>
        </div>
      </div>
    )
  }
  return <Dashboard user={user} onLogout={() => supabase.auth.signOut()} />
}

function Login({ onLogin }: { onLogin: (user: User | null) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const go = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    const { data, error: loginError } = await supabase.auth.signInWithPassword({ email, password })
    if (loginError) setError('No pudimos iniciar sesión. Verifica tus datos.')
    else onLogin(data.user)
    setBusy(false)
  }

  return (
    <div className="admin-auth">
      <form onSubmit={go}>
        <Logo />
        <span>Panel administrativo</span>
        <h1>Bienvenido</h1>
        <label>
          Correo
          <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label>
          Contraseña
          <input type="password" required value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        {error && <div className="form-error">{error}</div>}
        <button className="btn primary" disabled={busy}>
          {busy ? 'Iniciando…' : 'Iniciar sesión'}
        </button>
        <Link to="/">← Volver al sitio</Link>
      </form>
    </div>
  )
}

function Dashboard({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [view, setView] = useState<View>('catalog')
  const [items, setItems] = useState<Solution[]>([])
  const [cases, setCases] = useState<SuccessCase[]>([])
  const [caseVideos, setCaseVideos] = useState<SuccessCaseVideo[]>([])
  const [edit, setEdit] = useState<Solution | null>(null)
  const [editCase, setEditCase] = useState<SuccessCase | null>(null)
  const [editCaseVideo, setEditCaseVideo] = useState<SuccessCaseVideo | null>(null)
  const [notice, setNotice] = useState('')
  const canManageResourceAccess = user.email?.toLowerCase() === 'soporte@nodavexa.com' || ['admin', 'superadmin'].includes((user.app_metadata as { role?: string })?.role || '')

  const load = () => {
    fetchSolutions(true).then(setItems).catch((error) => setNotice(error.message))
    fetchSuccessCases(true).then(setCases).catch((error) => setNotice(error.message))
    fetchSuccessCaseVideos(true).then(setCaseVideos).catch((error) => setNotice(error.message))
  }

  useEffect(load, [])

  const removeSolution = async (solution: Solution) => {
    if (!confirm(`¿Eliminar “${solution.name}”?`)) return
    const { error } = await supabase.from('solutions').delete().eq('id', solution.id)
    setNotice(error?.message || 'Publicación eliminada.')
    load()
  }

  const removeCase = async (item: SuccessCase) => {
    if (!confirm(`¿Eliminar “${item.title}”?`)) return
    const { error } = await supabase.from('success_cases').delete().eq('id', item.id)
    setNotice(error?.message || 'Caso eliminado.')
    load()
  }

  const removeCaseVideo = async (item: SuccessCaseVideo) => {
    if (!confirm(`¿Eliminar “${item.title}”?`)) return
    const { error } = await supabase.from('success_case_videos').delete().eq('id', item.id)
    setNotice(error?.message || 'Video eliminado.')
    load()
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-brand"><Logo light /></div>
        <nav aria-label="Secciones de administración">
          <div className="admin-nav-group"><span className="admin-nav-label">CONTENIDO</span>
            <button aria-current={view === 'catalog' ? 'page' : undefined} className={view === 'catalog' ? 'active' : ''} onClick={() => setView('catalog')}><Package /><span>Soluciones y productos</span></button>
            <button aria-current={view === 'productPages' ? 'page' : undefined} className={view === 'productPages' ? 'active' : ''} onClick={() => setView('productPages')}><LayoutGrid /><span>Páginas de producto</span></button>
            <button aria-current={view === 'cases' ? 'page' : undefined} className={view === 'cases' ? 'active' : ''} onClick={() => setView('cases')}><BriefcaseBusiness /><span>Casos de éxito</span></button>
            <button aria-current={view === 'caseVideos' ? 'page' : undefined} className={view === 'caseVideos' ? 'active' : ''} onClick={() => setView('caseVideos')}><Film /><span>Videos de casos</span></button>
          </div>
          <div className="admin-nav-group"><span className="admin-nav-label">OPERACIÓN</span>
            <button aria-current={view === 'forms' ? 'page' : undefined} className={view === 'forms' ? 'active' : ''} onClick={() => setView('forms')}><ClipboardList /><span>Cotizaciones</span></button>
            <button aria-current={view === 'resources' ? 'page' : undefined} className={view === 'resources' ? 'active' : ''} onClick={() => setView('resources')}><Wrench /><span>Recursos</span></button>
          </div>
          {canManageResourceAccess && <div className="admin-nav-group"><span className="admin-nav-label">RECURSOS · CONTROL</span>
            <button aria-current={view === 'resourceAnalytics' ? 'page' : undefined} className={view === 'resourceAnalytics' ? 'active' : ''} onClick={() => setView('resourceAnalytics')}><BarChart3 /><span>Estadísticas de recursos</span></button>
            <button aria-current={view === 'resourceAccess' ? 'page' : undefined} className={view === 'resourceAccess' ? 'active' : ''} onClick={() => setView('resourceAccess')}><ShieldCheck /><span>Accesos Premium</span></button>
          </div>}
          <div className="admin-nav-group"><span className="admin-nav-label">SITIO</span>
            <button aria-current={view === 'settings' ? 'page' : undefined} className={view === 'settings' ? 'active' : ''} onClick={() => setView('settings')}><Settings /><span>Contacto</span></button>
            <Link to="/"><ArrowLeft /><span>Ver sitio</span></Link>
          </div>
        </nav>
        <div className="admin-sidebar-footer"><div className="admin-profile-card"><span>{(user.email || 'ND').slice(0, 2).toUpperCase()}</span><div><strong>Panel Nodavexa</strong><small>{user.email}</small></div></div><button className="admin-logout" onClick={onLogout}><LogOut /><span>Cerrar sesión</span></button></div>
      </aside>
      <main>
        {view === 'catalog' && (
          <>
            <header>
              <div>
                <span>CATÁLOGO</span>
                <h1>Soluciones y productos</h1>
                <p>Administra precios, IVA, pagos, archivos y publicación.</p>
              </div>
              <button className="btn primary" onClick={() => setEdit(emptySolution())}>
                <Plus /> Nueva publicación
              </button>
            </header>
            {notice && <Notice text={notice} close={() => setNotice('')} />}
            <div className="admin-list">
              <div className="admin-row labels">
                <span>Publicación</span>
                <span>Tipo</span>
                <span>Estado</span>
                <span />
              </div>
              {items.map((solution) => (
                <div className="admin-row" key={solution.id}>
                  <div>
                    <div className="admin-thumb" style={solution.cover_url ? { backgroundImage: `url(${solution.cover_url})` } : undefined} />
                    <span>
                      <b>{solution.name}</b>
                      <small>{solution.excerpt}</small>
                    </span>
                  </div>
                  <span>{solution.item_type === 'product' ? 'Producto' : 'Solución'}</span>
                  <span>
                    <i className={solution.published ? 'published' : 'draft'}>{solution.published ? 'Publicada' : 'Borrador'}</i>
                  </span>
                  <span>
                    <button onClick={() => setEdit(solution)}>Editar</button>
                    <button className="icon-danger" onClick={() => void removeSolution(solution)}>
                      <Trash2 />
                    </button>
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
        {view === 'productPages' && <AdminProductPages items={items} onSaved={load} />}
        {view === 'cases' && (
          <>
            <header>
              <div>
                <span>RESULTADOS</span>
                <h1>Casos de éxito</h1>
                <p>Publica el reto, la solución aplicada y el resultado.</p>
              </div>
              <button className="btn primary" onClick={() => setEditCase(emptyCase())}>
                <Plus /> Nuevo caso
              </button>
            </header>
            {notice && <Notice text={notice} close={() => setNotice('')} />}
            <div className="admin-list">
              <div className="admin-row labels">
                <span>Caso</span>
                <span>Cliente</span>
                <span>Estado</span>
                <span />
              </div>
              {cases.map((item) => (
                <div className="admin-row" key={item.id}>
                  <div>
                    <div className="admin-thumb" style={item.cover_url ? { backgroundImage: `url(${item.cover_url})` } : undefined} />
                    <span>
                      <b>{item.title}</b>
                      <small>{item.result}</small>
                    </span>
                  </div>
                  <span>{item.client_type}</span>
                  <span>
                    <i className={item.published ? 'published' : 'draft'}>{item.published ? 'Publicado' : 'Borrador'}</i>
                  </span>
                  <span>
                    <button onClick={() => setEditCase(item)}>Editar</button>
                    <button className="icon-danger" onClick={() => void removeCase(item)}>
                      <Trash2 />
                    </button>
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
        {view === 'caseVideos' && (
          <>
            <header>
              <div>
                <span>VIDEOS</span>
                <h1>Videos de casos</h1>
                <p>Administra Shorts y videos adicionales sin modificar los casos de éxito principales.</p>
              </div>
              <button className="btn primary" onClick={() => setEditCaseVideo(emptyCaseVideo())}>
                <Plus /> Nuevo video
              </button>
            </header>
            {notice && <Notice text={notice} close={() => setNotice('')} />}
            <div className="admin-list">
              <div className="admin-row labels">
                <span>Video</span>
                <span>Orden</span>
                <span>Estado</span>
                <span />
              </div>
              {caseVideos.map((item) => (
                <div className="admin-row" key={item.id}>
                  <div>
                    <div className="admin-thumb video-thumb">YT</div>
                    <span>
                      <b>{item.title}</b>
                      <small>{item.video_url}</small>
                    </span>
                  </div>
                  <span>{item.position}</span>
                  <span>
                    <i className={item.published ? 'published' : 'draft'}>{item.published ? 'Publicado' : 'Borrador'}</i>
                  </span>
                  <span>
                    <button onClick={() => setEditCaseVideo(item)}>Editar</button>
                    <button className="icon-danger" onClick={() => void removeCaseVideo(item)}>
                      <Trash2 />
                    </button>
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
        {view === 'settings' && (
          <>
            <header>
              <div>
                <span>CONFIGURACIÓN</span>
                <h1>Contacto</h1>
                <p>Información pública de Nodavexa.</p>
              </div>
            </header>
            <AdminSettings />
          </>
        )}
        {view === 'forms' && (
          <>
            <header>
              <div>
                <span>FORMULARIOS Y COTIZACIONES</span>
                <h1>Cotizaciones</h1>
                <p>Clientes, productos, formularios recibidos y propuestas profesionales tipo orden.</p>
              </div>
            </header>
            <AdminQuotations />
          </>
        )}
        {view === 'resources' && <AdminResourceTools />}
        {view === 'resourceAnalytics' && <AdminResourceAnalytics />}
        {view === 'resourceAccess' && <AdminResourceAccess />}
      </main>
      {edit && (
        <AdminSolutionEditor
          initial={edit}
          onClose={() => setEdit(null)}
          onSaved={() => {
            setEdit(null)
            setNotice('Publicación guardada correctamente.')
            load()
          }}
        />
      )}
      {editCase && (
        <AdminCaseEditor
          initial={editCase}
          onClose={() => setEditCase(null)}
          onSaved={() => {
            setEditCase(null)
            setNotice('Caso guardado correctamente.')
            load()
          }}
        />
      )}
      {editCaseVideo && (
        <AdminCaseVideoEditor
          initial={editCaseVideo}
          onClose={() => setEditCaseVideo(null)}
          onSaved={() => {
            setEditCaseVideo(null)
            setNotice('Video guardado correctamente.')
            load()
          }}
        />
      )}
    </div>
  )
}

function Notice({ text, close }: { text: string; close: () => void }) {
  return (
    <div className="notice">
      {text}
      <button onClick={close}>
        <X />
      </button>
    </div>
  )
}
