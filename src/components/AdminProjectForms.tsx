import { useEffect, useMemo, useState } from 'react'
import { Copy, Download, Edit3, Mail, RefreshCw, Save, Trash2, X } from 'lucide-react'
import { buildLandingQuote, buildManualQuote, convertQuoteCurrency, formatMoney, formatQuoteMoney, serviceLabel } from '../lib/project-quote'
import { defaultSiteSettings, fetchProjectRequests, fetchSiteSettings, isSupabaseReady, spanishSupabaseError, supabase } from '../lib/supabase'
import type { ProjectQuote, ProjectRequest, SiteSettings } from '../types'

type QuoteDraft = { discount: number; manualCost: number; manualMaintenance: number; manualUpdates: number; notes: string }

export function AdminProjectForms() {
  const [settings, setSettings] = useState<SiteSettings>(defaultSiteSettings)
  const [items, setItems] = useState<ProjectRequest[]>([])
  const [notice, setNotice] = useState('')
  const [selected, setSelected] = useState<ProjectRequest | null>(null)
  const [editItem, setEditItem] = useState<ProjectRequest | null>(null)
  const formUrl = `${window.location.origin}/formularios/proyecto`

  const load = () => {
    fetchSiteSettings().then(setSettings).catch((error) => setNotice(spanishSupabaseError(error, 'No se pudo cargar la configuración del formulario.')))
    fetchProjectRequests().then(setItems).catch((error) => setNotice(spanishSupabaseError(error, 'No se pudieron cargar los formularios.')))
  }

  useEffect(() => {
    load()
    if (!isSupabaseReady) return undefined
    const channel = supabase
      .channel('admin-project-requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_requests' }, (payload) => {
        const eventType = payload.eventType
        if (eventType === 'INSERT') {
          const next = payload.new as ProjectRequest
          setItems((current) => current.some((item) => item.id === next.id) ? current : [next, ...current])
        }
        if (eventType === 'UPDATE') {
          const next = payload.new as ProjectRequest
          setItems((current) => current.map((item) => item.id === next.id ? next : item))
          setSelected((current) => current?.id === next.id ? next : current)
          setEditItem((current) => current?.id === next.id ? next : current)
        }
        if (eventType === 'DELETE') {
          const old = payload.old as Pick<ProjectRequest, 'id'>
          setItems((current) => current.filter((item) => item.id !== old.id))
        }
      })
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [])

  const saveSettings = async (event: React.FormEvent) => {
    event.preventDefault()
    const { error } = await supabase.from('site_settings').update({
      form_maintenance_mxn: Number(settings.form_maintenance_mxn || 789),
      form_extra_changes_note: settings.form_extra_changes_note || defaultSiteSettings.form_extra_changes_note,
      form_landing_quote_min_mxn: Number(settings.form_landing_quote_min_mxn || defaultSiteSettings.form_landing_quote_min_mxn),
      form_landing_quote_max_mxn: Number(settings.form_landing_quote_max_mxn || defaultSiteSettings.form_landing_quote_max_mxn),
      updated_at: new Date().toISOString(),
    }).eq('id', true)
    setNotice(error ? spanishSupabaseError(error) : 'Configuración del formulario guardada.')
  }

  const remove = async (item: ProjectRequest) => {
    if (!confirm(`¿Eliminar el formulario de ${item.company_name}?`)) return
    const { error } = await supabase.from('project_requests').delete().eq('id', item.id)
    setNotice(error ? spanishSupabaseError(error) : 'Formulario eliminado.')
    load()
  }

  const saveEdit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!editItem) return
    const { id, quote, created_at, updated_at, quoted_at, sent_at, ...payload } = editItem
    void quote; void created_at; void updated_at; void quoted_at; void sent_at
    const { error } = await supabase.from('project_requests').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', id)
    setNotice(error ? spanishSupabaseError(error) : 'Formulario actualizado.')
    setEditItem(null)
    load()
  }

  return (
    <div className="project-admin">
      <form className="project-admin-settings" onSubmit={saveSettings}>
        <div>
          <h2>Formulario público</h2>
          <p>Comparte esta liga con clientes para levantar requerimientos.</p>
          <div className="form-url-box">
            <code>{formUrl}</code>
            <button type="button" onClick={() => navigator.clipboard?.writeText(formUrl)}><Copy /> Copiar</button>
          </div>
        </div>
        <label>Mantenimiento anual MXN<input type="number" min={0} value={settings.form_maintenance_mxn || 789} onChange={(event) => setSettings({ ...settings, form_maintenance_mxn: Number(event.target.value) })} /></label>
        <div className="quote-range-fields full">
          <label>Mínimo landing page MXN<input type="number" min={0} value={settings.form_landing_quote_min_mxn || 12000} onChange={(event) => setSettings({ ...settings, form_landing_quote_min_mxn: Number(event.target.value) })} /></label>
          <label>Máximo landing page MXN<input type="number" min={0} value={settings.form_landing_quote_max_mxn || 28000} onChange={(event) => setSettings({ ...settings, form_landing_quote_max_mxn: Number(event.target.value) })} /></label>
        </div>
        <label className="full">Nota de cambios extra<textarea rows={3} value={settings.form_extra_changes_note || ''} onChange={(event) => setSettings({ ...settings, form_extra_changes_note: event.target.value })} /></label>
        <button className="btn primary"><Save /> Guardar configuración</button>
      </form>

      {notice && <div className="notice">{notice}<button onClick={() => setNotice('')}><X /></button></div>}

      <div className="admin-list project-request-list">
        <div className="admin-row labels">
          <span>Empresa</span>
          <span>Servicio</span>
          <span>Estado</span>
          <span />
        </div>
        {items.map((item) => (
          <div className="admin-row" key={item.id}>
            <div>
              <div className="admin-thumb form-thumb">FR</div>
              <span>
                <b>{item.company_name}</b>
                <small>{item.contact_name} · {item.email}</small>
              </span>
            </div>
            <span>{serviceLabel(item.service_type)}</span>
            <span><i className={item.status === 'new' ? 'draft' : 'published'}>{statusLabel(item.status)}</i></span>
            <span className="admin-actions-wide">
              <button onClick={() => setSelected(item)}>Cotizar</button>
              <button onClick={() => setEditItem(item)}><Edit3 /></button>
              <button className="icon-danger" onClick={() => void remove(item)}><Trash2 /></button>
            </span>
          </div>
        ))}
        {!items.length && <div className="empty">Aún no hay formularios recibidos.</div>}
      </div>

      {selected && <QuoteModal request={selected} settings={settings} onClose={() => setSelected(null)} onSaved={() => { setSelected(null); load(); setNotice('Cotización guardada.') }} />}
      {editItem && (
        <div className="editor-overlay">
          <form className="solution-editor project-edit-panel" onSubmit={saveEdit}>
            <header><h2>Editar formulario</h2><button type="button" onClick={() => setEditItem(null)}><X /></button></header>
            <div className="editor-scroll">
              <section className="field-grid">
                <label>Empresa<input value={editItem.company_name} onChange={(event) => setEditItem({ ...editItem, company_name: event.target.value })} /></label>
                <label>Contacto<input value={editItem.contact_name} onChange={(event) => setEditItem({ ...editItem, contact_name: event.target.value })} /></label>
                <label>Correo<input value={editItem.email} onChange={(event) => setEditItem({ ...editItem, email: event.target.value })} /></label>
                <label>Teléfono<input value={editItem.phone} onChange={(event) => setEditItem({ ...editItem, phone: event.target.value })} /></label>
                <label className="full">Objetivo<textarea rows={4} value={editItem.project_goal} onChange={(event) => setEditItem({ ...editItem, project_goal: event.target.value })} /></label>
                <label className="full">Notas técnicas<textarea rows={4} value={editItem.technical_notes} onChange={(event) => setEditItem({ ...editItem, technical_notes: event.target.value })} /></label>
              </section>
            </div>
            <footer><button className="btn primary">Guardar</button></footer>
          </form>
        </div>
      )}
    </div>
  )
}

function QuoteModal({ request, settings, onClose, onSaved }: { request: ProjectRequest; settings: SiteSettings; onClose: () => void; onSaved: () => void }) {
  const [draft, setDraft] = useState<QuoteDraft>({ discount: request.quote?.discount_percent || 0, manualCost: request.quote?.subtotal || 0, manualMaintenance: request.quote?.annual_maintenance_mxn || request.annual_maintenance_mxn || 789, manualUpdates: 0, notes: request.quote?.notes || '' })
  const [currency, setCurrency] = useState<'MXN' | 'USD'>(request.quote?.currency || 'MXN')
  const [usdRate, setUsdRate] = useState(request.quote?.exchange_rate_mxn_per_usd || 17.5)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    fetch('https://api.exchangerate.host/latest?base=USD&symbols=MXN')
      .then((response) => response.json())
      .then((data) => {
        const rate = Number(data?.rates?.MXN)
        if (rate > 0) setUsdRate(rate)
      })
      .catch(() => {})
  }, [])
  const quoteMxn = useMemo(() => {
    if (request.service_type === 'landing_page') return buildLandingQuote(request, draft.discount, settings.form_landing_quote_min_mxn, settings.form_landing_quote_max_mxn)
    return buildManualQuote(request, draft.manualCost, draft.manualMaintenance, draft.manualUpdates, draft.discount, draft.notes)
  }, [request, draft, settings.form_landing_quote_min_mxn, settings.form_landing_quote_max_mxn])
  const quote = useMemo(() => convertQuoteCurrency(quoteMxn, currency, usdRate), [quoteMxn, currency, usdRate])

  const saveQuote = async (markSent = false) => {
    const { error } = await supabase.from('project_requests').update({
      quote,
      status: markSent ? 'sent' : 'quoted',
      quoted_at: new Date().toISOString(),
      sent_at: markSent ? new Date().toISOString() : request.sent_at || null,
      updated_at: new Date().toISOString(),
    }).eq('id', request.id)
    if (!error) onSaved()
  }

  const sendQuote = async () => {
    setSending(true)
    setError('')
    const { error } = await supabase.functions.invoke('send-project-quote', { body: { requestId: request.id, quote } })
    setSending(false)
    if (error) {
      setError('No fue posible enviar la cotización. Revisa la función de correo o intenta de nuevo.')
      return
    }
    onSaved()
  }

  return (
    <div className="editor-overlay quote-overlay">
      <div className="quote-modal">
        <header>
          <div>
            <small>COTIZACIÓN</small>
            <h2>{request.company_name}</h2>
          </div>
          <button onClick={onClose}><X /></button>
        </header>
        <div className="quote-layout">
          <aside>
            <h3>Formulario recibido</h3>
            <p><b>Contacto:</b> {request.contact_name}</p>
            <p><b>Correo:</b> {request.email}</p>
            <p><b>Objetivo:</b> {request.project_goal}</p>
            <p><b>Secciones:</b> {request.sections_needed.join(', ') || 'No indicado'}</p>
            <p><b>Funciones:</b> {request.features_needed.join(', ') || 'No indicado'}</p>
            {request.service_type === 'landing_page' && <p><b>Rango admin:</b> {formatMoney(settings.form_landing_quote_min_mxn || 12000)} a {formatMoney(settings.form_landing_quote_max_mxn || 28000)}</p>}
            <label className="currency-switch">Moneda de cotización
              <span>
                <button type="button" className={currency === 'MXN' ? 'active' : ''} onClick={() => setCurrency('MXN')}>MXN</button>
                <button type="button" className={currency === 'USD' ? 'active' : ''} onClick={() => setCurrency('USD')}>USD</button>
              </span>
            </label>
            {currency === 'USD' && <small>Tipo de cambio: 1 USD = {usdRate.toFixed(2)} MXN</small>}
            <label>Descuento %<input type="number" min={0} max={60} value={draft.discount} onChange={(event) => setDraft({ ...draft, discount: Number(event.target.value) })} /></label>
            {request.service_type !== 'landing_page' && <>
              <label>Costo desarrollo<input type="number" min={0} value={draft.manualCost} onChange={(event) => setDraft({ ...draft, manualCost: Number(event.target.value) })} /></label>
              <label>Mantenimiento<input type="number" min={0} value={draft.manualMaintenance} onChange={(event) => setDraft({ ...draft, manualMaintenance: Number(event.target.value) })} /></label>
              <label>Cambios / actualizaciones<input type="number" min={0} value={draft.manualUpdates} onChange={(event) => setDraft({ ...draft, manualUpdates: Number(event.target.value) })} /></label>
            </>}
            <label>Notas<textarea rows={4} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></label>
            {error && <div className="form-error">{error}</div>}
          </aside>
          <QuotePreview request={request} quote={quote} />
        </div>
        <footer>
          <button className="btn ghost" onClick={() => window.print()}><Download /> Descargar PDF</button>
          <button className="btn ghost" disabled={sending} onClick={() => void sendQuote()}><Mail /> {sending ? 'Enviando…' : 'Enviar'}</button>
          <button className="btn primary" onClick={() => void saveQuote(false)}><RefreshCw /> Guardar cotización</button>
        </footer>
      </div>
    </div>
  )
}

function QuotePreview({ request, quote }: { request: ProjectRequest; quote: ProjectQuote }) {
  return (
    <article className="quote-preview" id="quote-preview">
      <div className="quote-head">
        <div><b>NODAVEXA</b><small>COTIZACIÓN</small></div>
        <span>{quote.quote_number}</span>
      </div>
      <h2>{quote.service_title}</h2>
      <p>Cliente: <b>{request.company_name}</b></p>
      <table>
        <tbody>
          {quote.lines.map((line) => <tr key={line.label}><td><b>{line.label}</b><small>{line.description}</small></td><td>{formatQuoteMoney(line.amount, quote.currency)}</td></tr>)}
          <tr><td>Subtotal</td><td>{formatQuoteMoney(quote.subtotal, quote.currency)}</td></tr>
          {quote.discount_amount > 0 && <tr><td>Descuento {quote.discount_percent}%</td><td>-{formatQuoteMoney(quote.discount_amount, quote.currency)}</td></tr>}
          <tr><td>Mantenimiento anual</td><td>{formatQuoteMoney(quote.annual_maintenance_mxn, quote.currency)}</td></tr>
          <tr className="quote-total"><td>Total estimado</td><td>{formatQuoteMoney(quote.total, quote.currency)}</td></tr>
        </tbody>
      </table>
      <p className="quote-notes">{quote.notes}</p>
      {quote.currency === 'USD' && quote.exchange_rate_mxn_per_usd && <small>Referencia de conversión: 1 USD = {quote.exchange_rate_mxn_per_usd.toFixed(2)} MXN.</small>}
      <small>Vigencia: {new Date(quote.valid_until).toLocaleDateString('es-MX')}</small>
    </article>
  )
}

function statusLabel(status: ProjectRequest['status']) {
  return ({ new: 'Nuevo', reviewing: 'Revisión', quoted: 'Cotizado', sent: 'Enviado', archived: 'Archivado' })[status]
}
