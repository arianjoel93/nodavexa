import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  BarChart3,
  CalendarDays,
  Download,
  Globe2,
  Laptop,
  MapPin,
  PackageCheck,
  RefreshCw,
  Users,
  Wrench,
  X,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { ResourceActivity, ResourceProfile, ResourceTool } from '../lib/resource-auth'

type Period = '7' | '30' | '90' | '365' | 'all'

type ResourceInstallation = {
  id: string
  user_id: string
  tool_id: string
  installed_at: string
}

type NamedMetric = {
  label: string
  value: number
  users: number
  quantity: number
}

type UserUsage = {
  userId: string
  sessions: number
  activeDays: number
  events: number
  tools: string[]
  lastUse: string
  country: string
  sector: string
  name: string
  email: string
}

const numberFormat = new Intl.NumberFormat('es-MX')
const dateFormat = new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
const dateTimeFormat = new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export function AdminResourceAnalytics() {
  const [period, setPeriod] = useState<Period>('30')
  const [selectedTool, setSelectedTool] = useState('all')
  const [activity, setActivity] = useState<ResourceActivity[]>([])
  const [profiles, setProfiles] = useState<ResourceProfile[]>([])
  const [tools, setTools] = useState<ResourceTool[]>([])
  const [installations, setInstallations] = useState<ResourceInstallation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      let activityQuery = supabase.from('resource_activity').select('*').order('created_at', { ascending: false }).limit(10000)
      const since = periodStart(period)
      if (since) activityQuery = activityQuery.gte('created_at', since)

      const [activityResponse, profileResponse, toolResponse, installationResponse] = await Promise.all([
        activityQuery,
        supabase.from('resource_profiles').select('*').order('created_at', { ascending: false }).limit(10000),
        supabase.from('resource_tools').select('*').order('position', { ascending: true }),
        supabase.from('resource_user_tools').select('id,user_id,tool_id,installed_at').order('installed_at', { ascending: false }).limit(10000),
      ])

      const firstError = activityResponse.error || profileResponse.error || toolResponse.error || installationResponse.error
      if (firstError) throw firstError
      setActivity((activityResponse.data || []) as ResourceActivity[])
      setProfiles((profileResponse.data || []) as ResourceProfile[])
      setTools((toolResponse.data || []) as ResourceTool[])
      setInstallations((installationResponse.data || []) as ResourceInstallation[])
    } catch {
      setError('No fue posible cargar las estadísticas de recursos. Revisa tu conexión e inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(
    () => selectedTool === 'all' ? activity : activity.filter((item) => item.tool_slug === selectedTool),
    [activity, selectedTool],
  )
  const profileByUser = useMemo(() => new Map(profiles.map((profile) => [profile.user_id, profile])), [profiles])
  const toolBySlug = useMemo(() => new Map(tools.map((tool) => [tool.slug, tool])), [tools])
  const userRankings = useMemo(() => rankResourceUsers(filtered, profileByUser, toolBySlug), [filtered, profileByUser, toolBySlug])
  const selectedRankedUser = userRankings.find((item) => item.userId === selectedUserId) || null
  const selectedUserModules = useMemo(() => {
    if (!selectedUserId) return []
    return installations.filter((item) => item.user_id === selectedUserId).map((installation) => {
      const tool = tools.find((item) => item.id === installation.tool_id)
      if (!tool) return null
      const records = activity.filter((item) => item.user_id === selectedUserId && item.tool_slug === tool.slug)
      const sessions = new Set(records.map((item) => item.session_id ? `${tool.slug}:${item.session_id}` : `${tool.slug}:${item.created_at.slice(0, 10)}`))
      return { tool, installedAt: installation.installed_at, sessions: sessions.size, operations: records.length, lastUse: records.reduce((latest, item) => item.created_at > latest ? item.created_at : latest, '') }
    }).filter((item): item is NonNullable<typeof item> => item !== null).sort((a, b) => b.sessions - a.sessions || b.lastUse.localeCompare(a.lastUse))
  }, [activity, installations, selectedUserId, tools])
  const uniqueUsers = new Set(filtered.map((item) => item.user_id)).size
  const sessions = new Set(filtered.map((item) => item.session_id).filter(Boolean)).size
  const executions = filtered.filter((item) => isExecutionAction(item.action))
  const processed = executions.reduce((total, item) => total + item.quantity, 0)
  const countries = new Set(filtered.map((item) => item.country_code || item.country_name).filter(Boolean)).size
  const located = filtered.filter((item) => item.country_code || item.country_name).length
  const filteredToolIds = selectedTool === 'all' ? null : new Set(tools.filter((tool) => tool.slug === selectedTool).map((tool) => tool.id))
  const currentInstallations = filteredToolIds ? installations.filter((item) => filteredToolIds.has(item.tool_id)).length : installations.length
  const countryMetrics = useMemo(() => aggregateMetrics(filtered, (item) => countryLabel(item)), [filtered])
  const deviceMetrics = useMemo(() => aggregateMetrics(filtered, (item) => item.device_type || 'Sin identificar'), [filtered])
  const browserMetrics = useMemo(() => aggregateMetrics(filtered, (item) => item.browser || 'Sin identificar'), [filtered])
  const sectorMetrics = useMemo(() => aggregateMetrics(filtered, (item) => profileByUser.get(item.user_id)?.sector || 'Sin identificar'), [filtered, profileByUser])
  const trend = useMemo(() => buildTrend(filtered, period), [filtered, period])
  const hourly = useMemo(() => buildHourlyUsage(filtered), [filtered])
  const maxTrend = Math.max(1, ...trend.map((item) => item.value))
  const maxHour = Math.max(1, ...hourly.map((item) => item.value))

  const toolMetrics = useMemo(() => tools.map((tool) => {
    const records = activity.filter((item) => item.tool_slug === tool.slug)
    const toolExecutions = records.filter((item) => isExecutionAction(item.action))
    return {
      tool,
      uses: records.length,
      opens: records.filter((item) => item.action === 'opened').length,
      executions: toolExecutions.length,
      quantity: toolExecutions.reduce((total, item) => total + item.quantity, 0),
      users: new Set(records.map((item) => item.user_id)).size,
      countries: new Set(records.map((item) => item.country_code || item.country_name).filter(Boolean)).size,
      installations: installations.filter((item) => item.tool_id === tool.id).length,
      lastUse: records[0]?.created_at || '',
    }
  }).sort((a, b) => b.uses - a.uses), [activity, installations, tools])

  function exportCsv() {
    const rows = userRankings.map((item, index) => [
      index + 1, item.name, item.email, item.sector, item.sessions, item.activeDays,
      item.tools.join(' | '), item.country, item.lastUse,
    ])
    const csv = [
      ['Posición', 'Usuario', 'Correo', 'Sector', 'Sesiones de uso', 'Días activos', 'Recursos utilizados', 'País aproximado', 'Último uso'],
      ...rows,
    ].map((row) => row.map(csvCell).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `ranking-usuarios-recursos-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="resource-analytics">
      <header className="resource-analytics-header">
        <div>
          <span>ANALÍTICA DE RECURSOS</span>
          <h1>Uso de herramientas</h1>
          <p>Consulta adopción, actividad, volumen procesado y ubicación aproximada de consumo.</p>
        </div>
        <div className="resource-analytics-actions">
          <label>
            <Wrench size={15} />
            <select value={selectedTool} onChange={(event) => setSelectedTool(event.target.value)} aria-label="Filtrar por recurso">
              <option value="all">Todos los recursos</option>
              {tools.map((tool) => <option value={tool.slug} key={tool.id}>{tool.title}</option>)}
            </select>
          </label>
          <label>
            <CalendarDays size={15} />
            <select value={period} onChange={(event) => setPeriod(event.target.value as Period)} aria-label="Periodo de estadísticas">
              <option value="7">Últimos 7 días</option>
              <option value="30">Últimos 30 días</option>
              <option value="90">Últimos 90 días</option>
              <option value="365">Últimos 12 meses</option>
              <option value="all">Todo el historial</option>
            </select>
          </label>
          <button type="button" onClick={() => void load()} disabled={loading} title="Actualizar estadísticas"><RefreshCw size={16} /></button>
          <button type="button" className="analytics-export" onClick={exportCsv} disabled={!userRankings.length}><Download size={16} /> Exportar ranking</button>
        </div>
      </header>

      {error && <div className="resource-analytics-error" role="alert">{error}</div>}
      {loading ? <div className="resource-analytics-loading"><RefreshCw /> Cargando estadísticas…</div> : <>
        <div className="resource-kpis">
          <Kpi icon={<Activity />} label="Eventos de uso" value={filtered.length} detail={`${executions.length} ejecuciones`} />
          <Kpi icon={<Users />} label="Usuarios activos" value={uniqueUsers} detail={`${sessions || uniqueUsers} sesiones identificadas`} />
          <Kpi icon={<BarChart3 />} label="Registros procesados" value={processed} detail={executions.length ? `${numberFormat.format(Math.round(processed / executions.length))} por ejecución` : 'Sin ejecuciones'} />
          <Kpi icon={<PackageCheck />} label="Instalaciones activas" value={currentInstallations} detail={`${selectedTool === 'all' ? tools.filter((tool) => tool.published).length : 1} recursos en vista`} />
          <Kpi icon={<Globe2 />} label="Países" value={countries} detail={`${filtered.length ? Math.round((located / filtered.length) * 100) : 0}% con ubicación`} />
        </div>

        <div className="resource-analytics-grid">
          <article className="resource-analytics-panel analytics-trend-panel">
            <PanelTitle eyebrow="TENDENCIA" title="Actividad durante el periodo" icon={<BarChart3 />} />
            {trend.length ? <div className="resource-trend-chart" role="img" aria-label="Gráfica de actividad por fecha">
              {trend.map((item) => <div className="resource-trend-column" key={item.key} title={`${item.label}: ${numberFormat.format(item.value)} eventos`}><div><i style={{ height: `${Math.max(6, (item.value / maxTrend) * 100)}%` }} /></div><span>{item.label}</span></div>)}
            </div> : <EmptyMetric />}
          </article>
          <article className="resource-analytics-panel">
            <PanelTitle eyebrow="DISTRIBUCIÓN" title="Horas de mayor uso" icon={<Activity />} />
            {hourly.some((item) => item.value) ? <div className="resource-hour-list">{hourly.map((item) => <div key={item.label}><span>{item.label}</span><i><b style={{ width: `${(item.value / maxHour) * 100}%` }} /></i><strong>{item.value}</strong></div>)}</div> : <EmptyMetric />}
          </article>
        </div>

        <article className="resource-analytics-panel analytics-tools-panel">
          <PanelTitle eyebrow="RENDIMIENTO" title="Desempeño por herramienta" icon={<Wrench />} />
          <div className="resource-analytics-table-wrap">
            <table className="resource-analytics-table">
              <thead><tr><th>Herramienta</th><th>Usos</th><th>Aperturas</th><th>Ejecuciones</th><th>Procesados</th><th>Usuarios</th><th>Instalaciones</th><th>Países</th><th>Último uso</th></tr></thead>
              <tbody>{toolMetrics.map((item) => <tr key={item.tool.id}><td><strong>{item.tool.title}</strong><small>{item.tool.published ? 'Publicada' : 'No publicada'}</small></td><td>{numberFormat.format(item.uses)}</td><td>{numberFormat.format(item.opens)}</td><td>{numberFormat.format(item.executions)}</td><td>{numberFormat.format(item.quantity)}</td><td>{numberFormat.format(item.users)}</td><td>{numberFormat.format(item.installations)}</td><td>{numberFormat.format(item.countries)}</td><td>{item.lastUse ? dateFormat.format(new Date(item.lastUse)) : 'Sin uso'}</td></tr>)}</tbody>
            </table>
          </div>
        </article>

        <div className="resource-analytics-grid analytics-breakdowns">
          <MetricPanel eyebrow="UBICACIÓN" title="Consumo por país" icon={<MapPin />} metrics={countryMetrics} total={filtered.length} />
          <MetricPanel eyebrow="PERFIL" title="Sectores de los usuarios" icon={<Users />} metrics={sectorMetrics} total={filtered.length} />
          <MetricPanel eyebrow="TECNOLOGÍA" title="Dispositivos" icon={<Laptop />} metrics={deviceMetrics} total={filtered.length} />
          <MetricPanel eyebrow="TECNOLOGÍA" title="Navegadores" icon={<Globe2 />} metrics={browserMetrics} total={filtered.length} />
        </div>

        <article className="resource-analytics-panel analytics-user-ranking">
          <div className="user-ranking-heading"><PanelTitle eyebrow="ADOPCIÓN POR PERSONA" title="Usuarios que más utilizan los recursos" icon={<Users />} /><p>Cada cuenta aparece una sola vez. El ranking se ordena por sesiones distintas, no por acciones individuales.</p></div>
          {userRankings.length ? <div className="resource-analytics-table-wrap"><table className="resource-analytics-table user-ranking-table">
            <thead><tr><th>#</th><th>Usuario</th><th>Sector</th><th>Sesiones</th><th>Días activos</th><th>Recursos</th><th>País</th><th>Último uso</th></tr></thead>
            <tbody>{userRankings.slice(0, 100).map((item, index) => <tr key={item.userId}>
              <td><span className={`user-rank-number${index < 3 ? ' is-top' : ''}`}>{String(index + 1).padStart(2, '0')}</span></td>
              <td><button type="button" className="user-rank-open" onClick={() => setSelectedUserId(item.userId)}><strong>{item.name}</strong><small>{item.email || 'Correo no disponible'}</small><em>Ver uso por módulo</em></button></td>
              <td>{item.sector}</td><td><strong>{numberFormat.format(item.sessions)}</strong></td><td>{numberFormat.format(item.activeDays)}</td>
              <td><span className="user-tool-tags">{item.tools.slice(0, 3).join(' · ')}{item.tools.length > 3 ? ` · +${item.tools.length - 3}` : ''}</span></td>
              <td>{item.country}</td><td>{item.lastUse ? dateTimeFormat.format(new Date(item.lastUse)) : 'Sin uso'}</td>
            </tr>)}</tbody>
          </table></div> : <EmptyMetric />}
        </article>
        <p className="resource-location-note"><MapPin size={14} /> La ubicación es una estimación por conexión y puede no coincidir con la ubicación física exacta. No se almacena la dirección IP. La sesión se cuenta una vez por cuenta y recurso.</p>
        {selectedRankedUser && <div className="resource-user-modal" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedUserId(null) }}><section role="dialog" aria-modal="true" aria-labelledby="resource-user-detail-title"><header><div><span>PERFIL DE USO</span><h2 id="resource-user-detail-title">{selectedRankedUser.name}</h2><p>{selectedRankedUser.email || 'Correo no disponible'}{selectedRankedUser.sector ? ` · ${selectedRankedUser.sector}` : ''}</p></div><button type="button" onClick={() => setSelectedUserId(null)} aria-label="Cerrar detalle"><X /></button></header><div className="resource-user-detail-summary"><article><small>Sesiones en el periodo</small><strong>{numberFormat.format(selectedRankedUser.sessions)}</strong></article><article><small>Días activos</small><strong>{numberFormat.format(selectedRankedUser.activeDays)}</strong></article><article><small>Módulos instalados</small><strong>{numberFormat.format(selectedUserModules.length)}</strong></article></div><div className="resource-user-module-list"><div className="resource-user-module-heading"><strong>Módulos instalados</strong><small>Uso agrupado en {period === 'all' ? 'todo el historial' : `los últimos ${period} días`}</small></div>{selectedUserModules.length ? selectedUserModules.map((module) => <article key={module.tool.id}><span className="resource-user-module-icon"><Wrench size={17} /></span><div><strong>{module.tool.title}</strong><small>Instalado el {dateFormat.format(new Date(module.installedAt))}{module.lastUse ? ` · Último uso ${dateTimeFormat.format(new Date(module.lastUse))}` : ' · Aún sin actividad'}</small></div><div className="resource-user-module-count"><strong>{numberFormat.format(module.sessions)}</strong><small>sesiones</small></div><div className="resource-user-module-count"><strong>{numberFormat.format(module.operations)}</strong><small>operaciones</small></div></article>) : <EmptyMetric />}</div><footer><span>Las operaciones se agrupan por cuenta y módulo; no se muestran como movimientos separados.</span><button type="button" onClick={() => setSelectedUserId(null)}>Cerrar</button></footer></section></div>}
      </>}
    </section>
  )
}

function Kpi({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: number; detail: string }) {
  return <article><span>{icon}</span><div><small>{label}</small><strong>{numberFormat.format(value)}</strong><p>{detail}</p></div></article>
}

function PanelTitle({ eyebrow, title, icon }: { eyebrow: string; title: string; icon: React.ReactNode }) {
  return <header className="resource-panel-title"><div><span>{eyebrow}</span><h2>{title}</h2></div>{icon}</header>
}

function MetricPanel({ eyebrow, title, icon, metrics, total }: { eyebrow: string; title: string; icon: React.ReactNode; metrics: NamedMetric[]; total: number }) {
  return <article className="resource-analytics-panel"><PanelTitle eyebrow={eyebrow} title={title} icon={icon} />{metrics.length ? <div className="resource-metric-list">{metrics.slice(0, 8).map((item) => <div key={item.label}><div><strong>{item.label}</strong><span>{numberFormat.format(item.value)} usos · {numberFormat.format(item.users)} usuarios</span></div><b>{total ? Math.round((item.value / total) * 100) : 0}%</b></div>)}</div> : <EmptyMetric />}</article>
}

function EmptyMetric() {
  return <div className="resource-metric-empty">Aún no hay actividad suficiente para este periodo.</div>
}

function aggregateMetrics(records: ResourceActivity[], labelFor: (item: ResourceActivity) => string): NamedMetric[] {
  const values = new Map<string, { value: number; users: Set<string>; quantity: number }>()
  records.forEach((item) => {
    const label = labelFor(item) || 'Sin identificar'
    const current = values.get(label) || { value: 0, users: new Set<string>(), quantity: 0 }
    current.value += 1
    current.users.add(item.user_id)
    current.quantity += item.quantity
    values.set(label, current)
  })
  return [...values.entries()].map(([label, item]) => ({ label, value: item.value, users: item.users.size, quantity: item.quantity })).sort((a, b) => b.value - a.value)
}

function periodStart(period: Period) {
  if (period === 'all') return ''
  const start = new Date()
  start.setDate(start.getDate() - Number(period) + 1)
  start.setHours(0, 0, 0, 0)
  return start.toISOString()
}

function buildTrend(records: ResourceActivity[], period: Period) {
  const mode = period === '7' || period === '30' ? 'day' : 'month'
  const buckets = new Map<string, number>()
  records.forEach((item) => {
    const date = new Date(item.created_at)
    const key = mode === 'day' ? date.toISOString().slice(0, 10) : date.toISOString().slice(0, 7)
    buckets.set(key, (buckets.get(key) || 0) + 1)
  })
  return [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(mode === 'day' ? -30 : -12).map(([key, value]) => ({
    key,
    value,
    label: mode === 'day' ? new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short' }).format(new Date(`${key}T12:00:00`)) : new Intl.DateTimeFormat('es-MX', { month: 'short', year: '2-digit' }).format(new Date(`${key}-15T12:00:00`)),
  }))
}

function buildHourlyUsage(records: ResourceActivity[]) {
  const groups = [
    { label: '00–05 h', from: 0, to: 5, value: 0 },
    { label: '06–11 h', from: 6, to: 11, value: 0 },
    { label: '12–17 h', from: 12, to: 17, value: 0 },
    { label: '18–23 h', from: 18, to: 23, value: 0 },
  ]
  records.forEach((item) => {
    const hour = new Date(item.created_at).getHours()
    const group = groups.find((entry) => hour >= entry.from && hour <= entry.to)
    if (group) group.value += 1
  })
  return groups
}

function countryLabel(item: ResourceActivity) {
  if (item.country_name) return item.country_name
  if (item.country_code) {
    try {
      return new Intl.DisplayNames(['es-MX'], { type: 'region' }).of(item.country_code) || item.country_code
    } catch {
      return item.country_code
    }
  }
  return 'Sin identificar'
}

function isExecutionAction(action: string) {
  return ['conversion', 'calculation', 'download', 'export'].includes(action)
}

function rankResourceUsers(records: ResourceActivity[], profiles: Map<string, ResourceProfile>, tools: Map<string, ResourceTool>): UserUsage[] {
  const groups = new Map<string, { sessions: Set<string>; days: Set<string>; events: number; tools: Set<string>; lastUse: string; countries: Map<string, number> }>()
  records.forEach((item) => {
    const group = groups.get(item.user_id) || { sessions: new Set<string>(), days: new Set<string>(), events: 0, tools: new Set<string>(), lastUse: '', countries: new Map<string, number>() }
    const day = item.created_at.slice(0, 10)
    group.sessions.add(item.session_id ? `${item.tool_slug}:${item.session_id}` : `${item.tool_slug}:${day}`)
    group.days.add(day)
    group.events += 1
    group.tools.add(tools.get(item.tool_slug)?.title || item.tool_slug)
    if (item.created_at > group.lastUse) group.lastUse = item.created_at
    const country = countryLabel(item)
    if (country !== 'Sin identificar') group.countries.set(country, (group.countries.get(country) || 0) + 1)
    groups.set(item.user_id, group)
  })
  return [...groups.entries()].map(([userId, group]) => {
    const profile = profiles.get(userId)
    const country = [...group.countries].sort((a, b) => b[1] - a[1])[0]?.[0] || 'Sin identificar'
    return {
      userId, sessions: group.sessions.size, activeDays: group.days.size, events: group.events,
      tools: [...group.tools].sort(), lastUse: group.lastUse, country,
      sector: profile?.sector || 'Sin identificar', name: profile?.full_name || profile?.email || 'Usuario sin perfil', email: profile?.email || '',
    }
  }).sort((a, b) => b.sessions - a.sessions || b.activeDays - a.activeDays || b.events - a.events || b.lastUse.localeCompare(a.lastUse))
}

function csvCell(value: unknown) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`
}
