import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, Plus, RefreshCw, TrendingUp, Users, ReceiptText, Wallet, X } from 'lucide-react'
import { ResourcePromotion } from '../components/ResourcePromotion'
import { ResourceFileHistory } from './Resources'
import { addResourceSale, closeResourceSalesPeriod, dailySales, fetchSalesWorkspace, salesMoney, salesSummary, type SalesWorkspace } from '../lib/resource-sales'
import { createSalesReport } from '../lib/resource-sales-pdf'
import { saveResourceFile } from '../lib/resource-files'
import { supabase } from '../lib/supabase'
import { logResourceActivity } from '../lib/resource-auth'

const emptyForm = { client: '', phone: '', company: '', notes: '', amount: '' }
export function SalesResource() {
  const [workspace, setWorkspace] = useState<SalesWorkspace | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(Date.now())
  const [serverOffset, setServerOffset] = useState(0)
  const [download, setDownload] = useState<{ url: string; name: string; period: string } | null>(null)
  const [confirm, setConfirm] = useState<'downloaded' | 'discarded' | null>(null)
  const [page, setPage] = useState(0)
  const load = useCallback(async () => {
    try {
      const data = await fetchSalesWorkspace()
      setWorkspace(data); setServerOffset(new Date(data.server_now).getTime() - Date.now()); setError('')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No pudimos cargar tus ventas.') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => {
    void load()
    const timer = setInterval(() => setNow(Date.now()), 30000)
    const focus = () => void load()
    window.addEventListener('focus', focus)
    return () => { clearInterval(timer); window.removeEventListener('focus', focus) }
  }, [load])
  useEffect(() => () => { if (download) URL.revokeObjectURL(download.url) }, [download])
  const expired = Boolean(workspace && (workspace.expired || now + serverOffset >= new Date(workspace.period.ends_at).getTime()))
  const summary = useMemo(() => salesSummary(workspace?.sales || []), [workspace])
  const days = useMemo(() => workspace ? dailySales(workspace.sales, workspace.period.started_at, workspace.period.ends_at) : [], [workspace])
  const peak = Math.max(1, ...days.map(day => day.amount))
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date())
  const elapsed = days.filter(day => day.day <= today)
  const midpoint = Math.floor(elapsed.length / 2)
  const first = elapsed.slice(0, midpoint).reduce((sum, day) => sum + day.amount, 0)
  const last = elapsed.slice(midpoint, midpoint * 2).reduce((sum, day) => sum + day.amount, 0)
  const trend = midpoint && first > 0 ? `${(((last - first) / first) * 100).toFixed(1)}%` : 'Sin base comparable'
  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (!workspace || expired || busy) return
    setBusy(true); setError(''); setNotice('')
    try {
      await addResourceSale(workspace.period.period_id, { ...form, amount: Number(form.amount) })
      setForm(emptyForm); setPage(0); setNotice('Venta guardada en Supabase.')
      void supabase.auth.getUser().then(({ data }) => data.user && logResourceActivity({ userId: data.user.id, toolSlug: 'control-ventas', action: 'sale_created' })).catch(() => undefined)
      await load()
    } catch (cause) { await load(); setError(cause instanceof Error ? cause.message : 'No pudimos guardar la venta.') }
    finally { setBusy(false) }
  }
  function exportReport() {
    if (!workspace) return
    try {
      setError('')
      const blob = createSalesReport(workspace)
      const name = `ventas-${workspace.period.started_at.slice(0, 10)}.pdf`
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a'); link.href = url; link.download = name
      document.body.appendChild(link); link.click(); link.remove()
      setDownload({ url, name, period: workspace.period.period_id })
      setNotice('Reporte listo. Conserva una copia antes de cerrar el periodo.')
      void saveResourceFile('control-ventas', name, blob).catch(() => setNotice('El PDF está disponible para descargar, pero no se pudo guardar la copia en el historial.'))
    } catch { setError('No pudimos generar el reporte. Inténtalo de nuevo.') }
  }
  async function closePeriod() {
    if (!workspace || !confirm) return
    setBusy(true); setError('')
    try {
      await closeResourceSalesPeriod(workspace.period.period_id, confirm)
      setConfirm(null); setDownload(null); setPage(0); setForm(emptyForm)
      await load(); setNotice('Nuevo periodo iniciado. Tus indicadores están en cero.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No pudimos cerrar el periodo.') }
    finally { setBusy(false) }
  }
  return <div className="sales-resource"><header className="sales-heading"><div><span className="section-index">RECURSOS · MIS VENTAS</span><h1>Tu actividad comercial, día a día</h1><p>Ventas en MXN antes de impuestos. Un periodo de un mes desde el primer acceso.</p></div><div><button className="btn ghost" onClick={() => void load()} disabled={loading || busy} title="Actualizar ventas"><RefreshCw size={17} /></button><button className="btn primary" disabled={!workspace || busy} onClick={exportReport}><Download size={17} /> Reporte PDF</button></div></header>
    <ResourcePromotion tool="control-ventas" />
    {error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="sales-notice" role="status">{notice}</p>}
    {download && <a className="sales-download" href={download.url} download={download.name}><Download size={16} /> Descargar {download.name}</a>}
    {loading ? <p>Cargando ventas…</p> : workspace && <>
      <div className="sales-period"><span>Periodo: <b>{new Date(workspace.period.started_at).toLocaleDateString('es-MX')} — {new Date(workspace.period.ends_at).toLocaleDateString('es-MX')}</b></span><span>{expired ? 'Pendiente de cierre' : 'Periodo activo'}</span></div>
      {expired && <section className="sales-expired" aria-labelledby="period-ended"><h2 id="period-ended">Tu periodo mensual terminó</h2><p>Las ventas nuevas están bloqueadas. Descarga el reporte y confirma que ya lo guardaste, o descarta estos datos para comenzar de cero. Los datos permanecen disponibles hasta que tomes una decisión.</p><div><button className="btn primary" onClick={exportReport}>Descargar reporte</button>{download?.period === workspace.period.period_id && <button className="btn ghost" onClick={() => setConfirm('downloaded')}>Ya lo descargué, iniciar nuevo mes</button>}<button className="btn ghost" onClick={() => setConfirm('discarded')}>Descartar datos y empezar de cero</button></div></section>}
      <div className="sales-kpis"><article><Wallet /><span>Vendido antes de IVA</span><strong>{salesMoney(summary.total)}</strong></article><article><ReceiptText /><span>Total de ventas</span><strong>{summary.count}</strong></article><article><Users /><span>Clientes únicos</span><strong>{summary.clients}</strong><small>Identificados por teléfono</small></article><article><TrendingUp /><span>Ticket promedio</span><strong>{salesMoney(summary.average)}</strong></article></div>
      <section className="sales-chart"><header><div><h2>Ventas diarias</h2><p>Zona horaria: Ciudad de México · Importe antes de IVA</p></div><span>Tendencia: <b>{trend}</b><small>Dos mitades de igual duración del periodo transcurrido.</small></span></header><div className="sales-chart-scroll"><div className="sales-bars" role="img" aria-label="Importes vendidos por día; consulta los valores en la tabla inferior">{days.map(day => <div key={day.day} title={`${day.day}: ${salesMoney(day.amount)} · ${day.count} ventas`}><div><i style={{ height: day.amount ? `${Math.max(2, day.amount / peak * 100)}%` : '0%' }} /></div><span>{day.day.slice(8)}</span></div>)}</div></div><details><summary>Ver datos por día</summary><div className="sales-table-scroll"><table><thead><tr><th>Fecha</th><th>Ventas</th><th>Total sin IVA</th></tr></thead><tbody>{days.map(day => <tr key={day.day}><td>{day.day}</td><td>{day.count}</td><td>{salesMoney(day.amount)}</td></tr>)}</tbody></table></div></details></section>
      <section className="sales-entry"><h2><Plus size={20} /> Registrar una venta</h2><form onSubmit={event => void save(event)}><fieldset disabled={busy || expired}><label>Nombre del cliente<input required maxLength={160} value={form.client} onChange={event => setForm(current => ({ ...current, client: event.target.value }))} /></label><label>Teléfono<input required type="tel" maxLength={40} value={form.phone} onChange={event => setForm(current => ({ ...current, phone: event.target.value }))} /></label><label>Empresa (opcional)<input maxLength={160} value={form.company} onChange={event => setForm(current => ({ ...current, company: event.target.value }))} /></label><label>Total vendido antes de impuestos (MXN)<input required type="number" min="0.01" max="999999999999.99" step="0.01" value={form.amount} onChange={event => setForm(current => ({ ...current, amount: event.target.value }))} /></label><label className="sales-notes">Notas de venta<textarea maxLength={3000} rows={3} value={form.notes} onChange={event => setForm(current => ({ ...current, notes: event.target.value }))} /></label><button className="btn primary">{busy ? 'Guardando…' : 'Guardar venta'}</button></fieldset></form></section>
      <section className="sales-records"><h2>Ventas registradas</h2>{workspace.sales.length ? <><div className="sales-table-scroll"><table><thead><tr><th>Fecha</th><th>Cliente</th><th>Teléfono</th><th>Empresa</th><th>Notas</th><th>Total sin IVA</th></tr></thead><tbody>{workspace.sales.slice(page * 25, page * 25 + 25).map(sale => <tr key={sale.id}><td>{new Date(sale.created_at).toLocaleString('es-MX')}</td><td>{sale.client_name}</td><td>{sale.phone}</td><td>{sale.company || '—'}</td><td className="sales-note-cell">{sale.notes || '—'}</td><td>{salesMoney(Number(sale.amount))}</td></tr>)}</tbody></table></div><div className="resource-history-pagination"><button className="btn ghost" disabled={!page} onClick={() => setPage(value => value - 1)}>Anterior</button><span>Página {page + 1}</span><button className="btn ghost" disabled={(page + 1) * 25 >= workspace.sales.length} onClick={() => setPage(value => value + 1)}>Siguiente</button></div></> : <p>Aún no hay ventas. Registra la primera para ver tus indicadores.</p>}</section>
    </>}
    <ResourceFileHistory toolSlug="control-ventas" />
    {confirm && <div className="sales-confirm-overlay"><section role="dialog" aria-modal="true" aria-labelledby="sales-close-title"><button className="sales-close" onClick={() => setConfirm(null)} disabled={busy} aria-label="Cerrar confirmación"><X /></button><h2 id="sales-close-title">¿Iniciar un nuevo periodo?</h2><p>{confirm === 'downloaded' ? 'Confirma que tu reporte se descargó correctamente.' : 'Vas a continuar sin descargar el reporte.'} Al continuar se eliminarán las ventas del periodo anterior y los indicadores comenzarán en cero. Esta acción no se puede deshacer.</p><div><button className="btn ghost" disabled={busy} onClick={() => setConfirm(null)}>Volver</button><button className="btn primary" disabled={busy} onClick={() => void closePeriod()}>{busy ? 'Iniciando…' : 'Confirmar y comenzar de cero'}</button></div>{error && <p className="form-error" role="alert">{error}</p>}</section></div>}
  </div>
}
