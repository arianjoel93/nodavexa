import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Activity, ArrowDownToLine, ArrowLeft, BarChart3, ChevronDown, FileSpreadsheet, FileText, LoaderCircle, Package, Scale, TriangleAlert, Upload, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ResourcePromotion } from '../components/ResourcePromotion'
import { fetchResourceProfile } from '../lib/resource-auth'
import { supabase } from '../lib/supabase'
import { parseTscCsv, solutionLabel, type ParsedTsc, type TscRow, type TscSolution } from '../lib/tsc-reports'
import { calculateTscAnalytics } from '../lib/tsc-reports-analytics'
import { downloadTscOriginal, importTscReport, listTscUploads, purgeExpiredTscUploads, sha256, type ReportPeriod, type ReportUpload } from '../lib/tsc-reports-service'
import '../tsc-reports.css'
import '../tsc-reports-extra.css'
import '../tsc-reports-dashboard.css'

type PendingFile = { file: File; parsed: ParsedTsc; hash: string; period: ReportPeriod }
type DashPoint = { date: string; records: number; weight: number | null }
type DashGroup = { label: string; records: number; weight: number | null }
type Dashboard = { uploads: number; records: number; days: number; solutions: number; products_count: number; clients_count: number; weight_total: number | null; weight_average: number | null; warnings: number; series: DashPoint[]; products: DashGroup[]; clients: DashGroup[] }
const emptyDashboard: Dashboard = { uploads: 0, records: 0, days: 0, solutions: 0, products_count: 0, clients_count: 0, weight_total: null, weight_average: null, warnings: 0, series: [], products: [], clients: [] }
const solutionOptions: TscSolution[] = ['basculas', 'estacionamiento', 'comedor', 'toma_turnos', 'exportacion_mangos', 'etiquetado_produccion', 'generico']
const fmt = (value: number) => new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 }).format(value)
const monthKey = (value: string) => value.slice(0, 7)
const monthLabel = (value: string) => new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}-01T00:00:00Z`))
const getReportMonths = (rows: TscRow[]) => [...new Set(rows.map(row => String(row.normalized.fecha || '').slice(0, 7)).filter(value => /^\d{4}-\d{2}$/.test(value)))].sort()

export function TscReportsResource() {
  const [user, setUser] = useState<{ id: string; name: string } | null>(null)
  const [uploads, setUploads] = useState<ReportUpload[]>([])
  const [dashboard, setDashboard] = useState<Dashboard>(emptyDashboard)
  const [pending, setPending] = useState<PendingFile[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [premium, setPremium] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [granularity, setGranularity] = useState<'daily' | 'weekly' | 'monthly'>('daily')
  const [compareMonthA, setCompareMonthA] = useState('')
  const [compareMonthB, setCompareMonthB] = useState('')

  const refresh = useCallback(async (ownerId: string) => {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    await purgeExpiredTscUploads(ownerId)
    const [fileRows, summary] = await Promise.all([
      listTscUploads(ownerId, cutoff),
      supabase.rpc('report_tsc_dashboard', { p_since: cutoff }),
    ])
    if (summary.error) throw summary.error
    setUploads(fileRows)
    setDashboard({ ...emptyDashboard, ...(summary.data as Partial<Dashboard>) })
  }, [])

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (!authUser) throw new Error('Inicia sesión para usar este recurso.')
        const [profile, access] = await Promise.all([
          fetchResourceProfile(authUser),
          supabase.rpc('resource_has_premium', { p_tool_slug: 'reportes-tsc' }),
        ])
        if (!active) return
        if (access.error) throw access.error
        setUser({ id: authUser.id, name: profile?.full_name || authUser.email || 'Mi espacio' })
        setPremium(Boolean(access.data))
        await refresh(authUser.id)
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : 'No se pudo cargar el dashboard.')
      } finally { if (active) setLoading(false) }
    })()
    return () => { active = false }
  }, [refresh])

  const addFiles = async (files: FileList | null) => {
    if (!files) return
    setError(''); setNotice('')
    const chosen = Array.from(files)
    if (chosen.length > 5) { setError('Puedes seleccionar hasta 5 archivos por carga.'); return }
    if (chosen.reduce((total, file) => total + file.size, 0) > 50 * 1024 * 1024) { setError('El conjunto supera el máximo de 50 MB por carga.'); return }
    const additions: PendingFile[] = []
    for (const file of chosen) {
      if (!/\.csv$/i.test(file.name)) { setError(`${file.name}: solo se aceptan archivos CSV.`); continue }
      if (file.size > 25 * 1024 * 1024) { setError(`${file.name}: supera el límite de 25 MB.`); continue }
      try {
        const parsed = parseTscCsv(file.name, await file.arrayBuffer())
        if (parsed.rows.length > 100000) throw new Error('El archivo supera el máximo de 100,000 filas.')
        additions.push({ file, parsed, hash: await sha256(file), period: 'daily' })
      } catch (reason) { setError(`${file.name}: ${reason instanceof Error ? reason.message : 'no se pudo leer.'}`) }
    }
    if (additions.length) setPending(previous => [...previous, ...additions])
  }

  const updatePending = (index: number, update: Partial<PendingFile>) => setPending(previous => previous.map((file, i) => i === index ? { ...file, ...update } : file))
  const importPending = async () => {
    if (!user || !pending.length) return
    setBusy(true); setError(''); setNotice('')
    const completed: PendingFile[] = []
    try {
      if (!premium) {
        const { data: savedUploads, error: monthQueryError } = await supabase.from('report_uploads').select('report_months').eq('owner_id', user.id)
        if (monthQueryError) throw new Error('No pudimos verificar el mes de tus reportes. Inténtalo de nuevo.')
        const savedMonths = new Set((savedUploads || []).flatMap(item => item.report_months || []))
        const incomingMonths = new Set(pending.flatMap(item => getReportMonths(item.parsed.rows)))
        if (savedMonths.size > 1 || incomingMonths.size > 1 || [...incomingMonths].some(month => savedMonths.size > 0 && !savedMonths.has(month)) || (savedMonths.size > 0 && incomingMonths.size === 0)) {
          throw new Error('La cuenta gratuita solo puede alimentar el dashboard con datos de un mismo mes. Activa Premium para cargar y comparar meses distintos.')
        }
      }
      for (const item of pending) {
        const months = getReportMonths(item.parsed.rows)
        if (!premium && months.length > 1) throw new Error(`${item.file.name}: contiene más de un mes. La cuenta gratuita admite un solo mes. Activa Premium para comparar meses distintos.`)
        await importTscReport({ ownerId: user.id, userId: user.id, file: item.file, hash: item.hash, parsed: item.parsed, mode: 'new_period', period: item.period })
        completed.push(item)
      }
      await refresh(user.id)
      setNotice(`Se agregaron ${completed.length} ${completed.length === 1 ? 'archivo al dashboard' : 'archivos al dashboard'}.`)
      setPending([])
    } catch (reason) {
      if (completed.length) await refresh(user.id).catch(() => undefined)
      const message = reason instanceof Error ? reason.message : 'No fue posible importar los archivos.'
      setError(message.includes('report_months') || message.includes('resource_has_premium') ? 'El acceso o el mes del reporte no pudo validarse. Actualiza la página e inténtalo de nuevo.' : message)
    } finally { setBusy(false) }
  }

  const downloadOriginal = async (upload: ReportUpload) => {
    try { await downloadTscOriginal(upload.storage_path, upload.original_name) }
    catch { setError('No se pudo descargar el archivo original. Comprueba tu conexión e inténtalo nuevamente.') }
  }
  const bars = useMemo(() => {
    const grouped = new Map<string, { records: number; weight: number }>()
    for (const point of dashboard.series) {
      const date = new Date(`${point.date}T00:00:00`)
      const key = granularity === 'monthly' ? point.date.slice(0, 7) : granularity === 'weekly' ? (() => { const d = new Date(date); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.toISOString().slice(0, 10) })() : point.date
      const previous = grouped.get(key) || { records: 0, weight: 0 }
      previous.records += point.records; previous.weight += point.weight || 0; grouped.set(key, previous)
    }
    return [...grouped].slice(-12).map(([date, values]) => ({ date, value: dashboard.weight_total !== null ? values.weight : values.records }))
  }, [dashboard.series, dashboard.weight_total, granularity])
  const weightAvailable = dashboard.weight_total !== null
  const monthTotals = useMemo(() => {
    const totals = new Map<string, { records: number; weight: number }>()
    for (const point of dashboard.series) {
      const month = point.date.slice(0, 7)
      const total = totals.get(month) || { records: 0, weight: 0 }
      total.records += point.records; total.weight += point.weight || 0; totals.set(month, total)
    }
    return [...totals].map(([month, values]) => ({ month, ...values }))
  }, [dashboard.series])
  useEffect(() => {
    if (monthTotals.length < 2) { setCompareMonthA(monthTotals[0]?.month || ''); setCompareMonthB(''); return }
    setCompareMonthA(value => monthTotals.some(item => item.month === value) ? value : monthTotals[monthTotals.length - 2].month)
    setCompareMonthB(value => monthTotals.some(item => item.month === value) ? value : monthTotals[monthTotals.length - 1].month)
  }, [monthTotals])
  const comparedA = monthTotals.find(item => item.month === compareMonthA)
  const comparedB = monthTotals.find(item => item.month === compareMonthB)

  const downloadPdf = async () => {
    try {
      const { downloadTscAnalysisPdf } = await import('../lib/tsc-report-pdf')
      const rows = dashboard.products.map((item, index) => ({ rowNumber: index + 1, key: item.label, raw: {}, normalized: { producto: item.label, peso: item.weight ?? 0 } })) as TscRow[]
      const analytics = calculateTscAnalytics(rows, 'basculas')
      await downloadTscAnalysisPdf({ reportName: 'Dashboard Reportes TSC', solution: 'Resumen de reportes cargados', period: 'monthly', uploadedAt: new Date().toISOString(), rowCount: dashboard.records, warnings: dashboard.warnings, insights: analytics, previous: null, comparison: null, trend: dashboard.series.map(point => ({ period_start: point.date, records: point.records, value: point.weight })), granularity })
    } catch { setError('No se pudo generar el informe PDF. Inténtalo nuevamente.') }
  }

  if (loading && !user) return <main className="tsc-page"><div className="tsc-loading"><LoaderCircle className="spin" /> Cargando Reportes TSC…</div></main>
  const maxBar = Math.max(1, ...bars.map(point => Math.abs(point.value)))
  const recentMonth = dashboard.series.length ? monthKey(dashboard.series[dashboard.series.length - 1].date) : ''

  return <main className="tsc-page tsc-dashboard-first">
    <div className="tsc-top"><Link to="/recursos" className="tsc-back"><ArrowLeft size={16} /> Menú de aplicaciones</Link><span>Espacio privado · {user?.name || 'Cuenta'}</span></div>
    <header className="tsc-heading"><div><span className="tsc-kicker">PANEL DE OPERACIÓN</span><h1>Dashboard de Reportes TSC</h1><p>Sube tus archivos HISTO y convierte cada carga en una vista acumulada de actividad, pesos y productos.</p></div><label className="tsc-upload"><Upload size={17} /> Subir HISTO<input type="file" accept=".csv,text/csv" multiple onChange={event => { void addFiles(event.target.files); event.currentTarget.value = '' }} /></label></header>
    <div className={`tsc-plan-banner${premium ? ' is-premium' : ''}`}><div><strong>{premium ? 'Acceso Premium activo' : 'Plan gratuito · un mes de reportes'}</strong><span>{premium ? 'Puedes alimentar el dashboard con periodos distintos mientras tus reportes estén dentro de los últimos 30 días.' : 'Los archivos deben corresponder al mismo mes. Para cargar y comparar otros meses, solicita acceso Premium de Nodavexa.'}</span></div>{!premium && <Link to="/recursos">Conoce beneficios</Link>}</div>
    {error && <div className="tsc-alert is-error" role="alert"><TriangleAlert size={17} />{error}</div>}{notice && <div className="tsc-alert is-ok">{notice}</div>}

    {pending.length > 0 && <section className="tsc-panel"><div className="tsc-panel-title"><div><span className="tsc-kicker">ARCHIVOS POR AGREGAR</span><h2>Confirma las cargas</h2><p>Estos CSV se sumarán a los datos que ya alimentan el dashboard.</p></div></div><div className="tsc-pending-list">{pending.map((item, index) => <article className="tsc-pending" key={`${item.file.name}-${index}`}><div className="tsc-pending-head"><FileSpreadsheet /><div><strong>{item.file.name}</strong><small>{fmt(item.parsed.rows.length)} registros · {getReportMonths(item.parsed.rows).map(monthLabel).join(', ') || 'sin mes identificable'}</small></div><button className="tsc-text-button" onClick={() => setPending(previous => previous.filter((_, i) => i !== index))}>Quitar</button></div><div className="tsc-pending-options"><label>Tipo de solución<select value={item.parsed.solution} onChange={event => updatePending(index, { parsed: { ...item.parsed, solution: event.target.value as TscSolution } })}>{solutionOptions.map(solution => <option key={solution} value={solution}>{solutionLabel(solution)}</option>)}</select></label><label>Periodicidad<select value={item.period} onChange={event => updatePending(index, { period: event.target.value as ReportPeriod })}><option value="daily">Diaria</option><option value="weekly">Semanal</option><option value="monthly">Mensual</option></select></label></div>{item.parsed.warnings.length > 0 && <details className="tsc-warning-box"><summary><TriangleAlert size={15} /> {item.parsed.warnings.length} advertencias de lectura</summary><ul>{item.parsed.warnings.slice(0, 30).map((warning, i) => <li key={i}>{warning.rowNumber ? `Fila ${warning.rowNumber}: ` : ''}{warning.message}</li>)}</ul></details>}</article>)}</div><div className="tsc-import-footer"><button className="tsc-primary" disabled={busy} onClick={() => void importPending()}>{busy ? <LoaderCircle className="spin" size={16} /> : <Upload size={16} />} Agregar al dashboard</button></div></section>}

    <section className="tsc-dashboard-kpis"><Kpi icon={<FileSpreadsheet />} label="Archivos del periodo" value={fmt(dashboard.uploads)} detail="Cargas de los últimos 30 días" /><Kpi icon={<Activity />} label="Registros analizados" value={fmt(dashboard.records)} detail={`${fmt(dashboard.days)} días con actividad`} /><Kpi icon={<Scale />} label={weightAvailable ? 'Peso acumulado' : 'Soluciones analizadas'} value={weightAvailable ? `${fmt(dashboard.weight_total || 0)} kg` : fmt(dashboard.solutions)} detail={weightAvailable && dashboard.weight_average !== null ? `${fmt(dashboard.weight_average)} kg promedio por registro` : 'Datos disponibles en los archivos'} /><Kpi icon={<Package />} label="Productos identificados" value={fmt(dashboard.products_count)} detail={`${fmt(dashboard.warnings)} avisos de lectura`} /><Kpi icon={<Users />} label="Clientes identificados" value={fmt(dashboard.clients_count)} detail="Cuando el archivo incluye esa columna" /></section>

    <div className="tsc-dashboard-grid"><section className="tsc-panel tsc-chart"><div className="tsc-panel-title"><div><span className="tsc-kicker">TENDENCIA ACUMULADA</span><h2>{weightAvailable ? 'Peso registrado en el tiempo' : 'Registros por periodo'}</h2><p>Todos los archivos válidos de los últimos 30 días, con registros repetidos descontados.</p></div><BarChart3 size={23} /></div><div className="tsc-chart-controls" role="group" aria-label="Agrupar gráfica"><button className={granularity === 'daily' ? 'active' : ''} onClick={() => setGranularity('daily')}>Días</button><button className={granularity === 'weekly' ? 'active' : ''} onClick={() => setGranularity('weekly')}>Semanas</button><button className={granularity === 'monthly' ? 'active' : ''} onClick={() => setGranularity('monthly')}>Meses</button></div>{bars.length ? <div className="tsc-chart-bars" role="img" aria-label="Gráfica de actividad acumulada">{bars.map(point => <div className="tsc-chart-col" key={point.date}><strong>{fmt(point.value)}</strong><span style={{ height: `${Math.max(6, Math.abs(point.value) / maxBar * 100)}%` }} /><small>{granularity === 'monthly' ? point.date : point.date.slice(5)}</small></div>)}</div> : <div className="tsc-empty">Sube tu primer HISTO para ver la actividad representada aquí.</div>}</section>
      <section className="tsc-panel tsc-dimension-insights"><div className="tsc-panel-title"><div><span className="tsc-kicker">DESGLOSE OPERATIVO</span><h2>Productos con más actividad</h2><p>Resumen conjunto de los archivos cargados.</p></div><Package size={22} /></div><GroupBars items={dashboard.products} unit={weightAvailable ? 'kg' : 'registros'} /><div className="tsc-client-groups"><h3>Actividad por cliente</h3><GroupBars items={dashboard.clients} unit={weightAvailable ? 'kg' : 'registros'} /></div></section></div>

    <section className="tsc-panel tsc-month-dashboard"><div className="tsc-panel-title"><div><span className="tsc-kicker">COMPARACIÓN MENSUAL</span><h2>Compara la actividad de dos meses</h2><p>{premium ? 'La comparación usa todos los archivos disponibles en el dashboard.' : 'La cuenta gratuita trabaja con un solo mes; con Premium puedes comparar periodos distintos.'}</p></div></div>{monthTotals.length < 2 ? <div className="tsc-empty">Carga reportes con fechas de dos meses para mostrar la comparación.</div> : <><div className="tsc-month-selects"><label>Mes A<select value={compareMonthA} onChange={event => setCompareMonthA(event.target.value)}>{monthTotals.map(item => <option key={item.month} value={item.month}>{monthLabel(item.month)}</option>)}</select></label><span>contra</span><label>Mes B<select value={compareMonthB} onChange={event => setCompareMonthB(event.target.value)}>{monthTotals.map(item => <option key={item.month} value={item.month}>{monthLabel(item.month)}</option>)}</select></label></div>{comparedA && comparedB && comparedA.month !== comparedB.month && <div className="tsc-month-results">{[{ label: 'Registros', a: comparedA.records, b: comparedB.records, unit: '' }, ...(weightAvailable ? [{ label: 'Peso total', a: comparedA.weight, b: comparedB.weight, unit: 'kg' }] : [])].map(item => <article key={item.label}><div className="tsc-month-result-head"><strong>{item.label}</strong><span>{item.b > item.a ? '+' : ''}{fmt(item.b - item.a)}{item.unit ? ` ${item.unit}` : ''}{item.a ? ` · ${item.b > item.a ? '+' : ''}${fmt((item.b - item.a) / Math.abs(item.a) * 100)}%` : ''}</span></div><div className="tsc-month-pair"><div><small>{monthLabel(comparedA.month)} · {fmt(item.a)}{item.unit ? ` ${item.unit}` : ''}</small></div><div><small>{monthLabel(comparedB.month)} · {fmt(item.b)}{item.unit ? ` ${item.unit}` : ''}</small></div></div></article>)}</div>}</>}</section>

    <section className="tsc-panel tsc-dashboard-insight"><div><span className="tsc-kicker">LECTURA RÁPIDA</span><h2>{recentMonth ? `Actividad más reciente: ${monthLabel(recentMonth)}` : 'Tu actividad aparecerá aquí'}</h2><p>{dashboard.uploads ? `El tablero reúne ${fmt(dashboard.uploads)} archivos y ${fmt(dashboard.records)} registros. Los productos y clientes se muestran cuando sus columnas están incluidas en los CSV.` : 'Sube un archivo HISTO para empezar a construir un resumen claro de tu operación.'}</p></div>{dashboard.uploads > 0 && <button className="tsc-primary" onClick={() => void downloadPdf()}><FileText size={16} /> Descargar reporte PDF</button>}</section>

    <details className="tsc-history-accordion" open={historyOpen} onToggle={event => setHistoryOpen(event.currentTarget.open)}><summary><span><FileSpreadsheet size={18} /><b>Historial de archivos</b><small>{uploads.length} archivos · últimos 30 días</small></span><ChevronDown size={18} /></summary><div className="tsc-file-list">{uploads.length === 0 ? <div className="tsc-empty">Todavía no hay archivos de los últimos 30 días.</div> : uploads.map(upload => <article className="tsc-file-row" key={upload.id}><div className="tsc-file-select"><FileSpreadsheet size={19} /><span><strong>{upload.original_name}</strong><small>{solutionLabel(upload.solution_type as TscSolution)} · {upload.report_period === 'daily' ? 'Diario' : upload.report_period === 'weekly' ? 'Semanal' : 'Mensual'} · {fmt(upload.row_count)} registros · {new Date(upload.uploaded_at).toLocaleDateString('es-MX')}</small></span></div><span className={`tsc-file-status status-${upload.validation_status}`}>{upload.validation_status === 'valid' ? 'Listo' : upload.validation_status === 'warnings' ? 'Con avisos' : 'Revisar'}</span><button className="tsc-icon-button" onClick={() => void downloadOriginal(upload)} aria-label={`Descargar ${upload.original_name}`}><ArrowDownToLine size={16} /></button></article>)}</div></details>
    <ResourcePromotion tool="reportes-tsc" /><footer className="tsc-foot">El dashboard se alimenta de los CSV que subes. Los archivos originales se conservan privados durante el periodo disponible.</footer>
  </main>
}

function Kpi({ icon, label, value, detail }: { icon: ReactNode; label: string; value: string; detail: string }) {
  return <article className="tsc-kpi-card"><span>{icon}</span><small>{label}</small><strong>{value}</strong><p>{detail}</p></article>
}

function GroupBars({ items, unit }: { items: DashGroup[]; unit: string }) {
  if (!items.length) return <p className="tsc-group-empty">El archivo aún no contiene esta información.</p>
  const maximum = Math.max(1, ...items.map(item => Math.abs(item.weight ?? item.records)))
  return <div className="tsc-group-bars">{items.slice(0, 6).map(item => <div className="tsc-group-bar" key={item.label}><div><span title={item.label}>{item.label}</span><strong>{fmt(item.weight ?? item.records)} {unit}</strong></div><i><b style={{ width: `${Math.abs(item.weight ?? item.records) / maximum * 100}%` }} /></i></div>)}</div>
}
