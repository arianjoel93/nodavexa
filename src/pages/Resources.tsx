import { useEffect, useMemo, useRef, useState } from 'react'
import { AppWindow, ArrowDownToLine, ArrowRight, BarChart3, Calculator, Check, Database, FileSpreadsheet, FileText, FileUp, History, LockKeyhole, Package, Plus, RefreshCw, Table2, Trash2, TrendingUp, Wrench, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AWT_HEADERS, createAwtDatabase, readAwtFile, validateAwtSheets, type AwtSheet } from '../lib/awt-import'
import { fetchInstalledResourceTools, fetchResourceActivity, fetchResourceTools, installResourceTool, logResourceActivity, uninstallResourceTool, type InstalledResourceTool, type ResourceActivity, type ResourceTool } from '../lib/resource-auth'
import { supabase } from '../lib/supabase'
import { downloadResourceFile, listResourceFiles, migrateLegacyResourceFiles, saveResourceFile, type SavedResourceFile } from '../lib/resource-files'
import { ResourcePromotion } from '../components/ResourcePromotion'

type Cell = string | number | boolean | Date | null
type SheetData = { name: string; rows: Cell[][] }
type PreparedSheet = { name: string; headers: string[]; rows: Cell[][] }
type ConversionMode = 'general' | 'awt'

const MAX_FILE_BYTES = 20 * 1024 * 1024
const MAX_ROWS = 50_000
const MAX_COLUMNS = 200

function isEmpty(value: Cell) {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() === '')
}

function parseCsv(text: string): Cell[][] {
  const source = text.replace(/^\uFEFF/, '')
  const candidates = [',', ';', '\t']
  let delimiter = ','
  let maxCount = -1
  const counts = new Map(candidates.map((candidate) => [candidate, 0]))
  let quoted = false
  for (let i = 0; i < source.length; i += 1) {
    if (source[i] === '"') {
      if (quoted && source[i + 1] === '"') i += 1
      else quoted = !quoted
    } else if (!quoted && (source[i] === '\n' || source[i] === '\r')) {
      break
    } else if (!quoted && candidates.includes(source[i])) {
      counts.set(source[i], (counts.get(source[i]) ?? 0) + 1)
    }
  }
  for (const candidate of candidates) {
    const count = counts.get(candidate) ?? 0
    if (count > maxCount) {
      maxCount = count
      delimiter = candidate
    }
  }

  const rows: Cell[][] = []
  let row: Cell[] = []
  let value = ''
  quoted = false
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i]
    if (char === '"') {
      if (quoted && source[i + 1] === '"') {
        value += '"'
        i += 1
      } else {
        quoted = !quoted
      }
    } else if (!quoted && char === delimiter) {
      row.push(value)
      value = ''
    } else if (!quoted && (char === '\n' || char === '\r')) {
      row.push(value)
      rows.push(row)
      row = []
      value = ''
      if (char === '\r' && source[i + 1] === '\n') i += 1
    } else {
      value += char
    }
  }
  row.push(value)
  rows.push(row)
  if (quoted) throw new Error('El archivo CSV contiene comillas sin cerrar. Corrige el archivo e inténtalo de nuevo.')
  return rows.filter((record) => record.some((cell) => !isEmpty(cell)))
}

function normalizeExcelCell(value: unknown): Cell {
  if (value === null || value === undefined) return null
  if (value instanceof Date) return value
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value
  if (typeof value === 'object') {
    const cell = value as { result?: unknown; text?: unknown; richText?: Array<{ text?: string }>; error?: unknown }
    if ('result' in cell) return normalizeExcelCell(cell.result)
    if (Array.isArray(cell.richText)) return cell.richText.map((part) => part.text ?? '').join('')
    if ('text' in cell) return String(cell.text ?? '')
    if ('error' in cell) return String(cell.error ?? '')
  }
  return String(value)
}

async function readSpreadsheetFile(selected: File, csvSheetName = safeFileName(selected.name)): Promise<SheetData[]> {
  const extension = selected.name.split('.').pop()?.toLowerCase()
  if (extension === 'csv') {
    const bytes = await selected.arrayBuffer()
    let text: string
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    } catch {
      text = new TextDecoder('windows-1252').decode(bytes)
    }
    return [{ name: csvSheetName, rows: parseCsv(text) }]
  }
  if (extension !== 'xlsx') throw new Error('Elige un archivo .xlsx o .csv. Los libros .xls antiguos todavía no son compatibles.')

  const [{ default: ExcelJS }, { default: JSZip }] = await Promise.all([import('exceljs'), import('jszip')])
  const source = await selected.arrayBuffer()
  const archive = await JSZip.loadAsync(source)
  const workbookFile = archive.file('xl/workbook.xml')
  if (!workbookFile) throw new Error('El libro de Excel no contiene una estructura válida.')
  const workbookXml = await workbookFile.async('string')
  let workbookData: ArrayBuffer = source
  if (/<x:workbook\b/.test(workbookXml)) {
    const xmlFiles = Object.keys(archive.files).filter((path) => path.startsWith('xl/') && path.endsWith('.xml'))
    await Promise.all(xmlFiles.map(async (path) => {
      const entry = archive.file(path)
      if (!entry) return
      const xml = await entry.async('string')
      archive.file(path, xml.replace(/<x:/g, '<').replace(/<\/x:/g, '</'))
    }))
    workbookData = await archive.generateAsync({ type: 'arraybuffer' })
  }
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(workbookData)
  return workbook.worksheets.map((worksheet) => {
    const rows: Cell[][] = []
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      const values = row.values as unknown[]
      rows.push(Array.from({ length: Math.max(0, values.length - 1) }, (_, index) => normalizeExcelCell(values[index + 1])))
    })
    return { name: worksheet.name, rows }
  }).filter((sheet) => sheet.rows.length > 0)
}

function csvFileName(value: string) {
  // Control characters are rejected from downloaded filenames.
  // eslint-disable-next-line no-control-regex
  const clean = value.trim().replace(/\.[^.]+$/, '').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/[. ]+$/, '')
  if (!clean) throw new Error('Escribe un nombre para el archivo CSV de salida.')
  return `${clean}.csv`
}

function csvText(value: Cell) {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString()
  return String(value)
}

function quoteCsvField(value: Cell) {
  return `"${csvText(value).replace(/"/g, '""')}"`
}

function normalizeIdentifier(input: string, fallback: string) {
  const clean = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase()
  return (clean || fallback).slice(0, 60)
}

function uniqueNames(names: string[], fallbackPrefix: string) {
  const used = new Set<string>()
  return names.map((name, index) => {
    const base = normalizeIdentifier(name, `${fallbackPrefix}_${index + 1}`)
    let candidate = base
    let suffix = 2
    while (used.has(candidate.toLowerCase())) {
      candidate = `${base.slice(0, 54)}_${suffix}`
      suffix += 1
    }
    used.add(candidate.toLowerCase())
    return candidate
  })
}

function prepareSheet(sheet: SheetData, firstRowHeaders: boolean): PreparedSheet {
  const nonemptyRows = sheet.rows.filter((row) => row.some((cell) => !isEmpty(cell)))
  const width = Math.max(0, ...nonemptyRows.map((row) => row.length))
  if (!width) throw new Error(`La hoja "${sheet.name}" no contiene datos.`)
  if (width > MAX_COLUMNS) throw new Error(`La hoja "${sheet.name}" tiene más de ${MAX_COLUMNS} columnas.`)

  const start = firstRowHeaders ? 1 : 0
  const activeColumns = Array.from({ length: width }, (_, index) => index).filter((column) =>
    nonemptyRows.some((row, rowIndex) => (rowIndex >= start || (firstRowHeaders && rowIndex === 0)) && !isEmpty(row[column] ?? null)),
  )
  if (!activeColumns.length) throw new Error(`La hoja "${sheet.name}" no tiene columnas con datos.`)

  const sourceHeaders = firstRowHeaders ? nonemptyRows[0] : []
  const headers = uniqueNames(
    activeColumns.map((column) => String(sourceHeaders[column] ?? '').trim()),
    'columna',
  )
  const rows = nonemptyRows.slice(start).map((row) => activeColumns.map((column) => {
    const value = row[column] ?? null
    if (value instanceof Date) return value.toISOString()
    if (typeof value === 'number' && !Number.isFinite(value)) return null
    return value
  }))
  return { name: sheet.name, headers, rows }
}

function quoteIdentifier(value: string) {
  return `"${value.replace(/"/g, '""')}"`
}

function sqliteType(values: Cell[]) {
  const present = values.filter((value) => !isEmpty(value))
  if (!present.length) return 'TEXT'
  if (present.every((value) => typeof value === 'boolean' || (typeof value === 'number' && Number.isInteger(value)))) return 'INTEGER'
  if (present.every((value) => typeof value === 'number' && Number.isFinite(value))) return 'REAL'
  return 'TEXT'
}

function toSqlValue(value: Cell) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'boolean') return value ? 1 : 0
  if (value instanceof Date) return value.toISOString()
  return value
}

function safeFileName(value: string) {
  return normalizeIdentifier(value.replace(/\.[^.]+$/, ''), 'datos') || 'datos'
}

function databaseFileName(value: string) {
  // Control characters are rejected from downloaded filenames.
  // eslint-disable-next-line no-control-regex
  const clean = value.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/[. ]+$/, '')
  if (!clean) throw new Error('Escribe un nombre para el archivo de salida.')
  return /\.db$/i.test(clean) ? clean : `${clean}.db`
}

const resourceCatalog = [
  { title: 'Mis ventas', description: 'Registra ventas, consulta tus números y descarga el reporte mensual.', href: '/recursos/control-ventas', icon: TrendingUp, label: 'Gratis con tu cuenta' },
  { title: 'Reportes TSC', description: 'Analiza reportes CSV de impresoras TSC, compara periodos y exporta resultados.', href: '/recursos/reportes-tsc', icon: BarChart3, label: 'Gratis con tu cuenta' },
  { title: 'Inventario básico', description: 'Controla 30 productos y 15 entradas o salidas por mes, sin borrar tu inventario.', href: '/recursos/inventario-basico', icon: Package, label: 'Gratis con tu cuenta' },
  { title: 'Creador de cotizaciones', description: 'Genera cotizaciones PDF con productos, servicios y descuentos.', href: '/recursos/crear-cotizacion', icon: FileText, label: 'Gratis con tu cuenta' },
  {
    title: 'Excel o CSV a SQLite',
    description: 'Convierte hojas de cálculo en una base de datos .db. Cada pestaña se convierte en una tabla.',
    href: '/recursos/excel-a-sqlite',
    icon: Database,
    label: 'Disponible',
  },
  {
    title: 'Convertidor CSV Formato Tipo Texto',
    description: 'Exporta una hoja como CSV UTF-8, separado por comas y con todos los campos entre comillas.',
    href: '/recursos/csv-formato-texto',
    icon: FileText,
    label: 'Disponible',
  },
]

function resourceIcon(iconKey: string, slug?: string) {
  if (slug === 'reportes-tsc') return BarChart3
  if (slug === 'inventario-basico') return Package
  if (slug === 'control-ventas') return TrendingUp
  if (slug === 'crear-cotizacion') return Calculator
  if (slug === 'csv-formato-texto') return FileSpreadsheet
  if (slug === 'excel-a-sqlite') return Database
  return iconKey === 'database' ? Database : iconKey === 'file-text' ? FileText : Wrench
}

export function Resources() {
  const [catalog, setCatalog] = useState<ResourceTool[]>(() => resourceCatalog.map((item, index) => ({
    id: `fallback-${index}`,
    slug: item.href.split('/').pop() || item.title,
    title: item.title,
    description: item.description,
    route: item.href,
    icon_key: item.icon === Database ? 'database' : 'file-text',
    label: item.label,
    published: true,
    requires_auth: true,
    position: index + 1,
  })))

  const [userId, setUserId] = useState('')
  const [installed, setInstalled] = useState<InstalledResourceTool[]>([])
  const [catalogOpen, setCatalogOpen] = useState(false)
  const [busyTool, setBusyTool] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let mounted = true
    async function loadWorkspace() {
      const [{ data }, tools] = await Promise.all([supabase.auth.getSession(), fetchResourceTools()])
      if (!mounted) return
      const publishedTools = tools.filter((tool) => tool.published)
      if (publishedTools.length) setCatalog(publishedTools)
      const currentUser = data.session?.user
      if (!currentUser) return
      setUserId(currentUser.id)
      const userTools = await fetchInstalledResourceTools(currentUser.id)
      if (!mounted) return
      setInstalled(userTools)
    }
    loadWorkspace().catch(() => setNotice('No pudimos cargar tu espacio de Recursos. Inténtalo de nuevo.'))
    return () => { mounted = false }
  }, [])

  const installedApps = installed.map((item) => {
    const relation = Array.isArray(item.resource_tools) ? item.resource_tools[0] : item.resource_tools
    return relation || catalog.find((tool) => tool.id === item.tool_id)
  }).filter((tool): tool is ResourceTool => Boolean(tool))
  const installedIds = new Set(installed.map((item) => item.tool_id))
  const availableTools = catalog.filter((tool) => tool.published)

  async function install(tool: ResourceTool) {
    if (!userId || installedIds.has(tool.id)) return
    setBusyTool(tool.slug)
    setNotice('')
    try {
      const record = await installResourceTool(userId, tool.id)
      setInstalled((current) => [...current, record])
      void logResourceActivity({ userId, toolSlug: tool.slug, action: 'installed' }).catch(() => undefined)
      setNotice(`${tool.title} se agregó a tus aplicaciones.`)
    } catch {
      setNotice('No pudimos instalar el recurso. Inténtalo de nuevo.')
    } finally {
      setBusyTool('')
    }
  }

  async function uninstall(tool: ResourceTool) {
    if (!userId) return
    setBusyTool(tool.slug)
    setNotice('')
    try {
      await uninstallResourceTool(userId, tool.id)
      setInstalled((current) => current.filter((item) => item.tool_id !== tool.id))
      void logResourceActivity({ userId, toolSlug: tool.slug, action: 'uninstalled' }).catch(() => undefined)
      setNotice(`${tool.title} se quitó de tus aplicaciones.`)
    } catch {
      setNotice('No pudimos desinstalar el recurso. Inténtalo de nuevo.')
    } finally {
      setBusyTool('')
    }
  }

  return <div className="resources-page resource-hub-page">
    <section className="resource-hub-hero">
      <div><span className="section-index">ESPACIO DE RECURSOS</span><h1>Tus herramientas, en un solo lugar.</h1><p>Instala las utilidades que necesitas y conserva el control de tus conversiones y cálculos del mes.</p></div>
      <button type="button" className="resource-install-button" onClick={() => setCatalogOpen(true)}><Plus size={17} /> Instalar recursos</button>
    </section>
    <section className="resource-hub-layout" aria-label="Panel de recursos">
      <div className="resource-apps-stage">
        <div className="resource-apps-panel">
          <div className="resource-apps-heading"><div><span className="section-index">MIS RECURSOS</span><h2>Aplicaciones instaladas</h2></div><span className="resource-apps-count"><BarChart3 size={17} /> {installedApps.length}</span></div>
          {notice && <div className="resource-hub-notice" role="status">{notice}</div>}
          <div className="resource-app-grid">
            {installedApps.map((tool) => { const Icon = resourceIcon(tool.icon_key, tool.slug); return <div className={`resource-app app-${tool.slug}`} key={tool.id}>
              <Link to={tool.route} aria-label={`Abrir ${tool.title}`} title={tool.title}><span className="resource-app-icon"><Icon size={34} strokeWidth={1.7} /><small className="resource-app-symbol">{tool.slug === 'inventario-basico' ? 'SKU' : tool.slug === 'control-ventas' ? 'MXN' : tool.slug === 'crear-cotizacion' ? 'PDF' : tool.slug === 'excel-a-sqlite' ? 'DB' : 'CSV'}</small></span><strong>{tool.title}</strong><span className="resource-app-open">Abrir <ArrowRight size={13} /></span></Link>
              <button type="button" className="resource-app-remove" onClick={() => void uninstall(tool)} disabled={busyTool === tool.slug} title={`Desinstalar ${tool.title}`}><Trash2 size={13} /></button>
            </div> })}
          </div>
          {!installedApps.length && <div className="resource-apps-empty"><span><AppWindow size={24} /></span><strong>Aún no tienes aplicaciones</strong><p>Instala una herramienta para comenzar.</p><button type="button" onClick={() => setCatalogOpen(true)}><Plus size={15} /> Ver recursos</button></div>}
        </div>
      </div>
    </section>
    {catalogOpen && <div className="resource-install-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCatalogOpen(false) }}><div className="resource-install-modal" role="dialog" aria-modal="true" aria-labelledby="resource-install-title"><div className="resource-install-modal-head"><div><span className="section-index">CATÁLOGO</span><h2 id="resource-install-title">Elige tus aplicaciones</h2><p>Instala solo los recursos que quieres tener en tu espacio personal.</p></div><button type="button" onClick={() => setCatalogOpen(false)} aria-label="Cerrar catálogo"><X size={19} /></button></div><div className="resource-install-list">{availableTools.map((tool) => { const Icon = resourceIcon(tool.icon_key, tool.slug); const isInstalled = installedIds.has(tool.id); return <div className="resource-install-row" key={tool.id}><span className="resource-install-icon"><Icon size={21} /></span><div><strong>{tool.title}</strong><p>{tool.description}</p></div><button type="button" className={isInstalled ? 'is-installed' : ''} onClick={() => isInstalled ? void uninstall(tool) : void install(tool)} disabled={busyTool === tool.slug}>{busyTool === tool.slug ? 'Guardando…' : isInstalled ? <><Check size={15} /> Instalada</> : <><Plus size={15} /> Instalar</>}</button></div>})}</div></div></div>}
  </div>
}

function ResourceActivityHistory({ toolSlug }: { toolSlug: string }) {
  return <ResourceFileHistory toolSlug={toolSlug} />
}

export function ResourceFileHistory({ toolSlug }: { toolSlug: string }) {
  const [files, setFiles] = useState<SavedResourceFile[]>([])
  const [error, setError] = useState('')
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [downloading, setDownloading] = useState('')
  useEffect(() => { void migrateLegacyResourceFiles().catch(() => setError('Algunos archivos anteriores siguen en este dispositivo. No se eliminaron los archivos que no pudieron subirse.')) }, [])
  useEffect(() => {
    let active = true
    const load = () => {
      setLoading(true)
      listResourceFiles(toolSlug, page * 25).then(items => { if (active) { setFiles(items); setError('') } })
        .catch(() => { if (active) setError('No pudimos cargar los archivos guardados en Supabase.') })
        .finally(() => { if (active) setLoading(false) })
    }
    load()
    window.addEventListener('resource-files-updated', load)
    return () => { active = false; window.removeEventListener('resource-files-updated', load) }
  }, [toolSlug, page])
  async function download(file: SavedResourceFile) {
    setDownloading(file.id); setError('')
    try { await downloadResourceFile(file) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No pudimos descargar el archivo.') }
    finally { setDownloading('') }
  }
  return <section className="resource-file-history"><div className="resource-tool-history-heading"><div><span className="section-index">TUS ARCHIVOS</span><h2>Archivos de los últimos 30 días</h2><p>Guardados de forma privada en tu cuenta. Disponibles desde tus dispositivos.</p></div><span>Página {page + 1}</span></div>{error && <p role="alert">{error}</p>}{loading ? <p>Cargando historial…</p> : files.length ? files.map(file => <div className="resource-file-row" key={file.id}><FileText /><strong>{file.name}</strong><span>{file.name.split('.').pop()?.toUpperCase()}</span><span>{(file.size_bytes / 1024).toFixed(1)} KB</span><time>{new Date(file.created_at).toLocaleString('es-MX')}</time><button className="btn ghost" disabled={Boolean(downloading)} onClick={() => void download(file)}><ArrowDownToLine size={16} />{downloading === file.id ? 'Descargando…' : 'Descargar'}</button></div>) : <p>No hay archivos en esta página del historial.</p>}<div className="resource-history-pagination"><button className="btn ghost" disabled={!page || loading} onClick={() => setPage(value => value - 1)}>Anterior</button><button className="btn ghost" disabled={files.length < 25 || loading} onClick={() => setPage(value => value + 1)}>Siguiente</button></div></section>
}

export function LegacyResourceActivityHistory({ toolSlug }: { toolSlug: string }) {
  const [activity, setActivity] = useState<ResourceActivity[]>([])
  const [loading, setLoading] = useState(true)
  const currentMonth = new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' }).format(new Date())

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session?.user) return
      const records = await fetchResourceActivity(data.session.user.id)
      if (mounted) setActivity(records.filter((item) => item.tool_slug === toolSlug))
    }).catch(() => undefined).finally(() => {
      if (mounted) setLoading(false)
    })
    return () => { mounted = false }
  }, [toolSlug])

  function actionLabel(action: string) {
    if (action === 'conversion') return 'Conversión realizada'
    if (action === 'calculation') return 'Cálculo realizado'
    if (action === 'opened') return 'Herramienta abierta'
    return action.replaceAll('_', ' ')
  }

  return <section className="resource-tool-history" aria-labelledby={`${toolSlug}-history-title`}>
    <div className="resource-tool-history-heading"><div><span className="section-index">HISTORIAL DE LA APP</span><h2 id={`${toolSlug}-history-title`}>Actividad de {currentMonth}</h2></div><span>Se renueva cada mes</span></div>
    {loading ? <p className="resource-history-status">Cargando historial…</p> : activity.length ? <div className="resource-history-list">{activity.map((item) => <div className="resource-history-row" key={item.id}><span className="resource-history-icon"><Check size={16} /></span><div><strong>{actionLabel(item.action)}</strong><small>{item.quantity > 1 ? `${item.quantity.toLocaleString('es-MX')} registros procesados` : 'Registro guardado en tu cuenta'}</small></div><time dateTime={item.created_at}>{new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(item.created_at))}</time></div>)}</div> : <div className="resource-history-empty"><History size={22} /><p>Aún no hay actividad de esta aplicación durante el periodo actual.</p></div>}
  </section>
}

export function SpreadsheetSqliteTool() {
  const fileInput = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<ConversionMode>('general')
  const [file, setFile] = useState<File | null>(null)
  const [sheets, setSheets] = useState<SheetData[]>([])
  const [awtSheets, setAwtSheets] = useState<AwtSheet[]>([])
  const [awtSelections, setAwtSelections] = useState<Map<string, number>>(() => new Map())
  const [confirmAwt, setConfirmAwt] = useState(false)
  const [activeSheet, setActiveSheet] = useState(0)
  const [firstRowHeaders, setFirstRowHeaders] = useState(true)
  const [tableName, setTableName] = useState('')
  const [outputFileName, setOutputFileName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ url: string; fileName: string; tables: number; rows: number; mode: ConversionMode; preservedTables: number } | null>(null)
  const awtReview = useMemo(() => awtSheets.length ? validateAwtSheets(awtSheets, awtSelections) : null, [awtSheets, awtSelections])

  useEffect(() => () => {
    if (result?.url) URL.revokeObjectURL(result.url)
  }, [result?.url])

  const activePreview = useMemo(() => {
    if (!sheets[activeSheet]) return null
    try {
      return prepareSheet(sheets[activeSheet], mode === 'awt' || firstRowHeaders)
    } catch {
      return null
    }
  }, [sheets, activeSheet, firstRowHeaders, mode])

  async function chooseFile(selected: File | undefined) {
    setError('')
    setResult(null)
    setSheets([])
    setAwtSheets([])
    setAwtSelections(new Map())
    setConfirmAwt(false)
    setFile(null)
    if (!selected) return
    if (selected.size > MAX_FILE_BYTES) {
      setError('El archivo supera el límite de 20 MB. Divide el libro y vuelve a intentarlo.')
      return
    }

    setBusy(true)
    try {
      if (mode === 'awt') {
        const imported = await readAwtFile(selected)
        const totalRows = imported.reduce((total, sheet) => total + sheet.rows.length, 0)
        if (totalRows > MAX_ROWS + 1) throw new Error(`El archivo supera el límite de ${MAX_ROWS.toLocaleString('es-MX')} productos.`)
        setAwtSheets(imported)
        setFile(selected)
        return
      }
      const imported = await readSpreadsheetFile(selected, safeFileName(selected.name))
      const totalRows = imported.reduce((total, sheet) => total + sheet.rows.length, 0)
      if (!totalRows) throw new Error('No encontramos filas con datos en el archivo.')
      if (totalRows > MAX_ROWS) throw new Error(`El archivo supera el límite de ${MAX_ROWS.toLocaleString('es-MX')} filas.`)
      imported.forEach((sheet) => prepareSheet(sheet, firstRowHeaders))
      setFile(selected)
      setSheets(imported)
      setActiveSheet(0)
      setTableName(safeFileName(selected.name))
      setOutputFileName(`${safeFileName(selected.name)}.db`)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : ''
      const userMessage = /^(Elige|El archivo|No encontramos|La hoja|El libro|El CSV|Solo se aceptan|No se pudo leer)/.test(message)
      setError(userMessage ? message : 'No pudimos leer el archivo. Comprueba que sea un .xlsx válido, que no esté dañado ni protegido con contraseña y vuelve a intentarlo.')
    } finally {
      setBusy(false)
    }
  }

  async function convertFile() {
    if (!file || (mode === 'awt' ? !awtReview || awtReview.issues.length > 0 || !awtReview.products.length : !sheets.length)) return
    setError('')
    setResult(null)
    let downloadName: string
    try {
      downloadName = mode === 'awt' ? 'AWT.DB' : databaseFileName(outputFileName)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Escribe un nombre válido para el archivo de salida.')
      return
    }
    setBusy(true)
    let db: import('sql.js').Database | undefined
    try {
      const [{ default: initSqlJs }, { default: wasmUrl }] = await Promise.all([
        import('sql.js'),
        import('sql.js/dist/sql-wasm.wasm?url'),
      ])
      const SQL = await initSqlJs({ locateFile: () => wasmUrl })
      let totalRecords = 0
      let outputTables = 0
      const preservedTables = 0

      if (mode === 'awt') {
        const templateResponse = await fetch('/resources/awt-template.db')
        if (!templateResponse.ok) throw new Error('No se pudo cargar la plantilla de base AWT. Recarga la página e inténtalo de nuevo.')
        const bytes = createAwtDatabase(SQL, new Uint8Array(await templateResponse.arrayBuffer()), awtReview!.products)
        const url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.sqlite3' }))
        setResult({ url, fileName: 'AWT.DB', tables: 1, rows: awtReview!.products.length, mode, preservedTables: 15 })
        void saveResourceFile('excel-a-sqlite', 'AWT.DB', new Blob([bytes])).catch(() => setError('Archivo generado. No pudimos guardarlo en Supabase; puedes descargarlo ahora y volver a intentarlo.'))
        void supabase.auth.getSession().then(({ data }) => data.session?.user && logResourceActivity({ userId: data.session.user.id, toolSlug: 'excel-a-sqlite', action: 'conversion', quantity: awtReview!.products.length, metadata: { fileName: file.name, mode: 'awt', output: 'AWT.DB' } })).catch(() => undefined)
        return
      } else {
        db = new SQL.Database()
        const prepared = sheets.map((sheet) => prepareSheet(sheet, firstRowHeaders))
        const tableNames = uniqueNames(prepared.map((sheet, index) => index === 0 && tableName.trim() ? tableName : sheet.name), 'tabla')
        totalRecords = prepared.reduce((total, sheet) => total + sheet.rows.length, 0)
        db.run('BEGIN TRANSACTION')
        prepared.forEach((sheet, index) => {
          const table = tableNames[index]
          const types = sheet.headers.map((_, columnIndex) => sqliteType(sheet.rows.map((row) => row[columnIndex] ?? null)))
          const columns = sheet.headers.map((header, columnIndex) => `${quoteIdentifier(header)} ${types[columnIndex]}`).join(', ')
          db!.run(`CREATE TABLE ${quoteIdentifier(table)} (${columns})`)
          if (!sheet.rows.length) return
          const placeholders = sheet.headers.map(() => '?').join(', ')
          const statement = db!.prepare(`INSERT INTO ${quoteIdentifier(table)} VALUES (${placeholders})`)
          try {
            for (const row of sheet.rows) statement.run(row.map(toSqlValue))
          } finally {
            statement.free()
          }
        })
        db.run('COMMIT')
        outputTables = prepared.length
      }

      const bytes = db.export()
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.sqlite3' }))
      setResult({ url, fileName: downloadName, tables: outputTables, rows: totalRecords, mode, preservedTables })
      void saveResourceFile('excel-a-sqlite', downloadName, new Blob([bytes])).catch(() => setError('Archivo generado. No pudimos guardarlo en Supabase; puedes descargarlo ahora y volver a intentarlo.'))
      void supabase.auth.getSession().then(({ data }) => data.session?.user && logResourceActivity({ userId: data.session.user.id, toolSlug: 'excel-a-sqlite', action: 'conversion', quantity: totalRecords, metadata: { fileName: file.name, mode: 'general', tables: outputTables } })).catch(() => undefined)
    } catch (cause) {
      try { db?.run('ROLLBACK') } catch { /* The database may already be closed. */ }
      const message = cause instanceof Error ? cause.message : ''
      const userMessage = /^(La hoja|No encontramos|No hay|El PLU|La fila|El identificador PLU|La plantilla|La tabla|La base|Una tabla|No se pudo cargar)/.test(message)
      setError(userMessage ? message : 'No pudimos generar la base SQLite. Revisa los datos y vuelve a intentarlo.')
    } finally {
      db?.close()
      setBusy(false)
    }
  }

  function downloadTemplate(content: Blob, name: string) {
    const url = URL.createObjectURL(content)
    const link = document.createElement('a')
    link.href = url
    link.download = name
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  async function downloadExcelTemplate() {
    try {
      const { default: ExcelJS } = await import('exceljs')
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Productos')
      worksheet.addRow([...AWT_HEADERS])
      worksheet.getColumn(1).numFmt = '@'
      const bytes = await workbook.xlsx.writeBuffer()
      downloadTemplate(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'plantilla-awt.xlsx')
    } catch {
      setError('No se pudo preparar la plantilla Excel. Inténtalo de nuevo.')
    }
  }

  function downloadCsvTemplate() {
    downloadTemplate(new Blob([`${AWT_HEADERS.join(',')}\r\n`], { type: 'text/csv;charset=utf-8' }), 'plantilla-awt.csv')
  }

  function reset() {
    setFile(null)
    setSheets([])
    setAwtSheets([])
    setAwtSelections(new Map())
    setConfirmAwt(false)
    setActiveSheet(0)
    setTableName('')
    setOutputFileName('')
    setError('')
    setResult(null)
    setFirstRowHeaders(true)
  }

  function changeMode(nextMode: ConversionMode) {
    if (nextMode === mode) return
    setMode(nextMode)
    setFile(null)
    setSheets([])
    setAwtSheets([])
    setAwtSelections(new Map())
    setConfirmAwt(false)
    setActiveSheet(0)
    setTableName('')
    setOutputFileName('')
    setError('')
    setResult(null)
    setFirstRowHeaders(true)
  }

  return (
    <div className="resources-page">
      <section className="resources-hero">
        <Link className="resource-breadcrumb" to="/recursos">Recursos <ArrowRight size={15} /> Convertir Excel o CSV a SQLite</Link>
        <span className="section-index">HERRAMIENTA GRATUITA</span>
        <h1>Convierte Excel o CSV a SQLite.</h1>
        <p>Procesa tus archivos directamente en tu navegador y descarga una base de datos .db.</p>
      </section>

      <section className="resource-tool-section" aria-labelledby="sqlite-tool-title">
        <div className="resource-tool-intro">
          <span className="resource-icon"><Database /></span>
          <span className="section-index">CONVERSOR DE ARCHIVOS</span>
          <h2 id="sqlite-tool-title">Excel o CSV a SQLite</h2>
          <p>{mode === 'awt' ? 'Importa un catálogo de tres columnas para generar una base SQLite compatible con básculas.' : <>Convierte hojas de cálculo en una base de datos SQLite con extensión <code>.db</code>. Cada pestaña del libro se guardará como una tabla.</>}</p>
          <ol className="resource-steps">
            <li><b>1</b><span>Selecciona un archivo .xlsx o .csv.</span></li>
            <li><b>2</b><span>Revisa la hoja y la vista previa de tus datos.</span></li>
            <li><b>3</b><span>Genera y descarga {mode === 'awt' ? 'SQLite' : 'la base de datos .db'}.</span></li>
          </ol>
        </div>

        <div className="resource-converter">
          <div className="resource-converter-heading">
            <div><small>HERRAMIENTA</small><h3>Convertir archivo</h3></div>
            <FileSpreadsheet aria-hidden="true" />
          </div>

          <fieldset className="resource-mode-picker">
            <legend>Tipo de base de datos</legend>
            <label className={mode === 'general' ? 'selected' : ''}>
              <input type="radio" name="database-mode" value="general" checked={mode === 'general'} onChange={() => changeMode('general')} />
              <span><strong>SQLite general</strong><small>Crear tablas con todas las hojas del archivo.</small></span>
            </label>
            <label className={mode === 'awt' ? 'selected' : ''}>
              <input type="radio" name="database-mode" value="awt" checked={mode === 'awt'} onChange={() => changeMode('awt')} />
              <span><strong>SQLite para básculas</strong><small>Importar productos y generar AWT.DB.</small></span>
            </label>
          </fieldset>

          <div className={`resource-upload ${file ? 'has-file' : ''}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void chooseFile(event.dataTransfer.files[0]) }}>
            <input ref={fileInput} className="resource-upload-input" key={mode} type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => void chooseFile(event.target.files?.[0])} />
            {busy && !file ? <RefreshCw className="resource-spinner" /> : <FileUp />}
            <strong>{file ? file.name : 'Arrastra un archivo aquí'}</strong>
            <span>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB${mode === 'awt' ? ` · ${awtReview?.total ?? 0} productos detectados` : ` · ${sheets.length} hojas detectadas`}` : mode === 'awt' ? 'Formatos permitidos: Excel (.xlsx) y CSV (.csv)' : 'Excel .xlsx o CSV .csv · máximo 20 MB'}</span>
            <button type="button" className="resource-select-file" onClick={() => fileInput.current?.click()} disabled={busy}>Seleccionar archivo</button>
          </div>

          {mode === 'awt' && <>
            <p className="resource-format-note">El archivo debe contener únicamente PLU, Descripción y Peso por pieza. El peso se expresa en kg.</p>
            <div className="resource-template-actions">
              <button type="button" onClick={() => void downloadExcelTemplate()}><ArrowDownToLine size={16} /> Descargar plantilla Excel</button>
              <button type="button" onClick={downloadCsvTemplate}><ArrowDownToLine size={16} /> Descargar plantilla CSV</button>
            </div>
            {awtReview && <div className="resource-awt-review">
              <div className="resource-awt-stats">
                <span><strong>{awtReview.total.toLocaleString('es-MX')}</strong> Registros</span>
                <span><strong>{awtReview.uniquePlu.toLocaleString('es-MX')}</strong> PLU únicos</span>
                <span className={awtReview.issues.length ? 'has-errors' : ''}><strong>{awtReview.issues.length.toLocaleString('es-MX')}</strong> Errores</span>
              </div>
              {awtReview.preview.length > 0 && <div className="resource-preview"><div className="resource-preview-title"><span><Table2 size={16} /> Primeros 10 productos</span><small>Peso por pieza en kg</small></div><div className="resource-table-wrap"><table><thead><tr><th>Fila</th>{AWT_HEADERS.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{awtReview.preview.map(({ row, cells }) => <tr key={row}><td>{row}</td>{AWT_HEADERS.map((header, index) => <td key={header}>{String(cells[index] ?? '')}</td>)}</tr>)}</tbody></table></div></div>}
              {awtReview.duplicates.length > 0 && <div className="resource-awt-duplicates"><h4>PLU repetidos</h4><p>Elige la fila que se guardará para cada PLU. Las demás filas repetidas no se incluirán.</p>{awtReview.duplicates.map((group, groupIndex) => <fieldset key={group.id}><legend>PLU: {group.id}</legend>{group.rows.map((entry) => <label key={entry.row}><input type="radio" name={`awt-duplicate-${groupIndex}`} checked={awtSelections.get(group.id) === entry.row} onChange={() => { setAwtSelections((previous) => new Map(previous).set(group.id, entry.row)); setResult(null) }} /><span><strong>Fila {entry.row}</strong><span>{String(entry.description ?? '')}</span><small>{String(entry.weight ?? '')} kg</small></span></label>)}</fieldset>)}</div>}
              {awtReview.issues.length > 0 && <div className="resource-awt-errors" role="alert"><strong>Corrige estos errores antes de generar AWT.DB:</strong><ul>{awtReview.issues.slice(0, 100).map((issue, index) => <li key={`${issue.row}-${issue.field}-${index}`}><b>Fila {issue.row} · {issue.field}:</b> {issue.message}</li>)}</ul>{awtReview.issues.length > 100 && <p>Se muestran los primeros 100 de {awtReview.issues.length.toLocaleString('es-MX')} errores.</p>}</div>}
            </div>}
          </>}

          {sheets.length > 0 && (
            <div className="resource-file-options">
              {mode === 'general' && <label className="resource-check"><input type="checkbox" checked={firstRowHeaders} onChange={(event) => { setFirstRowHeaders(event.target.checked); setResult(null) }} /><span>La primera fila contiene nombres de columnas</span></label>}
              {mode === 'general' && sheets.length > 1 && <label className="resource-field">Vista previa de hoja<select value={activeSheet} onChange={(event) => setActiveSheet(Number(event.target.value))}>{sheets.map((sheet, index) => <option key={`${sheet.name}-${index}`} value={index}>{sheet.name}</option>)}</select><small>Se incluirán todas las hojas en la base SQLite.</small></label>}
              {mode === 'general' && <label className="resource-field">Nombre de la primera tabla<input value={tableName} onChange={(event) => setTableName(event.target.value)} maxLength={60} /></label>}
              {mode === 'general' && <label className="resource-field">Nombre del archivo de salida<input value={outputFileName} onChange={(event) => { setOutputFileName(event.target.value); setResult(null) }} maxLength={80} placeholder="Ejemplo: datos.db" /><small>Se descargará con extensión .db; puedes escribirla o dejar que se agregue automáticamente.</small></label>}
              {activePreview && <div className="resource-preview"><div className="resource-preview-title"><span><Table2 size={16} /> Vista previa</span><small>{activePreview.rows.length.toLocaleString('es-MX')} filas · {activePreview.headers.length} columnas</small></div><div className="resource-table-wrap"><table><thead><tr>{activePreview.headers.slice(0, 6).map((header) => <th key={header}>{header}</th>)}{activePreview.headers.length > 6 && <th>…</th>}</tr></thead><tbody>{activePreview.rows.slice(0, 5).map((row, rowIndex) => <tr key={rowIndex}>{row.slice(0, 6).map((cell, cellIndex) => <td key={cellIndex}>{cell instanceof Date ? cell.toLocaleDateString() : String(cell ?? '')}</td>)}{row.length > 6 && <td>…</td>}</tr>)}</tbody></table></div></div>}
            </div>
          )}

          {error && <div className="resource-alert" role="alert">{error}</div>}
          {result && <div className="resource-success" role="status"><strong>{result.mode === 'awt' ? 'Tu base AWT está lista.' : 'Tu base de datos está lista.'}</strong><span>{result.mode === 'awt' ? `${result.rows.toLocaleString('es-MX')} registros PLU actualizados · ${result.preservedTables} tablas conservadas` : `${result.tables} ${result.tables === 1 ? 'tabla' : 'tablas'} · ${result.rows.toLocaleString('es-MX')} filas`}</span><a className="btn primary" href={result.url} download={result.fileName}><ArrowDownToLine size={18} /> Descargar {result.fileName}</a></div>}

          <div className="resource-actions">
            {file && <button type="button" className="resource-reset" onClick={reset}>Cambiar archivo</button>}
            <button type="button" className="btn primary" disabled={!file || busy || (mode === 'awt' && (!awtReview || awtReview.issues.length > 0 || !awtReview.products.length))} onClick={() => mode === 'awt' ? setConfirmAwt(true) : void convertFile()}>
              {busy ? <><RefreshCw className="resource-spinner" /> Preparando…</> : <><Database size={18} /> {mode === 'awt' ? 'Generar SQL ' : 'Convertir a .DB'} <ArrowRight size={17} /></>}
            </button>
          </div>
          <p className="resource-limits">{mode === 'awt' ? 'Máximo 20 MB y 50,000 productos. La generación se bloquea mientras existan errores.' : 'Admite hasta 50,000 filas y 200 columnas. Las celdas vacías se conservan como valores nulos.'}</p>
        </div>
      </section>
      <ResourcePromotion tool="excel-a-sqlite" />
      <ResourceActivityHistory toolSlug="excel-a-sqlite" />

      {confirmAwt && <div className="resource-confirm-backdrop"><div className="resource-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="awt-confirm-title" onKeyDown={(event) => { if (event.key === 'Escape') setConfirmAwt(false) }}>
        <h2 id="awt-confirm-title">Confirmar generación de AWT.DB</h2>
        <p>Se generará una copia de la plantilla con {awtReview?.products.length.toLocaleString('es-MX')} productos. El catálogo anterior de tblPlu se reemplazará por completo.</p>
        <div className="resource-confirm-actions"><button type="button" onClick={() => setConfirmAwt(false)}>Cancelar</button><button type="button" className="btn primary" autoFocus onClick={() => { setConfirmAwt(false); void convertFile() }}>Generar AWT.DB</button></div>
      </div></div>}

      <section className="resource-coming-soon"><span className="section-index">MÁS HERRAMIENTAS</span><p>Estamos preparando nuevos recursos para facilitar el trabajo con tus datos y procesos.</p><Link to="/recursos">Ver todos los recursos <ArrowRight size={16} /></Link></section>
    </div>
  )
}

export function CsvTextConverter() {
  const [file, setFile] = useState<File | null>(null)
  const [sheets, setSheets] = useState<SheetData[]>([])
  const [activeSheet, setActiveSheet] = useState(0)
  const [includeBlankFirstLine, setIncludeBlankFirstLine] = useState(false)
  const [outputFileName, setOutputFileName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ url: string; fileName: string; rows: number; columns: number } | null>(null)

  useEffect(() => () => {
    if (result?.url) URL.revokeObjectURL(result.url)
  }, [result?.url])

  const rows = sheets[activeSheet]?.rows ?? []
  const columnCount = Math.max(0, ...rows.map((row) => row.length))

  async function chooseFile(selected: File | undefined) {
    setError('')
    setResult(null)
    setFile(null)
    setSheets([])
    if (!selected) return
    if (selected.size > MAX_FILE_BYTES) {
      setError('El archivo supera el límite de 20 MB. Divide el archivo y vuelve a intentarlo.')
      return
    }

    setBusy(true)
    try {
      const imported = await readSpreadsheetFile(selected)
      if (!imported.length) throw new Error('No encontramos hojas con datos en el archivo.')
      if (imported.some((sheet) => sheet.rows.length > MAX_ROWS)) throw new Error(`Cada hoja puede tener hasta ${MAX_ROWS.toLocaleString('es-MX')} filas.`)
      if (imported.some((sheet) => Math.max(0, ...sheet.rows.map((row) => row.length)) > MAX_COLUMNS)) throw new Error(`Cada hoja puede tener hasta ${MAX_COLUMNS} columnas.`)
      setFile(selected)
      setSheets(imported)
      setActiveSheet(0)
      setOutputFileName(`${safeFileName(selected.name)}.csv`)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : ''
      const userMessage = /^(Elige|El archivo|El libro|No encontramos|Cada hoja)/.test(message)
      setError(userMessage ? message : 'No pudimos leer el archivo. Comprueba que sea un .xlsx o .csv válido e inténtalo de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  function convertFile() {
    if (!file || !rows.length) return
    setError('')
    setResult(null)
    let downloadName: string
    try {
      downloadName = csvFileName(outputFileName)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Escribe un nombre válido para el archivo CSV.')
      return
    }

    setBusy(true)
    try {
      const content = rows.map((row) => Array.from({ length: columnCount }, (_, index) => quoteCsvField(row[index] ?? null)).join(',')).join('\r\n')
      const prefix = includeBlankFirstLine ? '\uFEFF\r\n' : '\uFEFF'
      const blob = new Blob([prefix, content, '\r\n'], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      setResult({ url, fileName: downloadName, rows: rows.length, columns: columnCount })
      void saveResourceFile('csv-formato-texto', downloadName, blob).catch(() => setError('Archivo generado. No pudimos guardarlo en Supabase; puedes descargarlo ahora y volver a intentarlo.'))
      void supabase.auth.getSession().then(({ data }) => data.session?.user && logResourceActivity({ userId: data.session.user.id, toolSlug: 'csv-formato-texto', action: 'conversion', quantity: rows.length, metadata: { fileName: file.name, rows: rows.length, columns: columnCount } })).catch(() => undefined)
    } catch {
      setError('No pudimos generar el CSV. Revisa el archivo e inténtalo de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  function reset() {
    setFile(null)
    setSheets([])
    setActiveSheet(0)
    setOutputFileName('')
    setIncludeBlankFirstLine(false)
    setError('')
    setResult(null)
  }

  return (
    <div className="resources-page">
      <section className="resources-hero">
        <Link className="resource-breadcrumb" to="/recursos">Recursos <ArrowRight size={15} /> CSV Formato Tipo Texto</Link>
        <span className="section-index">HERRAMIENTA GRATUITA</span>
        <h1>Convertidor CSV Formato Tipo Texto.</h1>
        <p>Prepara archivos para importarlos como texto: UTF-8, separados por comas y con todos los campos entre comillas.</p>
      </section>

      <section className="resource-tool-section" aria-labelledby="csv-tool-title">
        <div className="resource-tool-intro">
          <span className="resource-icon"><FileText /></span>
          <span className="section-index">FORMATO DE IMPORTACIÓN</span>
          <h2 id="csv-tool-title">Un CSV listo para importar.</h2>
          <div className="resource-privacy"><LockKeyhole size={17} /> Tus archivos se procesan en este navegador. No se cargan a internet.</div>
          <ol className="resource-steps">
            <li><b>1</b><span>Elige el Excel o CSV y, si aplica, la hoja que vas a exportar.</span></li>
            <li><b>2</b><span>Define si quieres una línea vacía al inicio.</span></li>
            <li><b>3</b><span>Descarga el CSV en UTF-8, con coma y texto entre comillas.</span></li>
          </ol>
        </div>

        <div className="resource-converter">
          <div className="resource-converter-heading"><div><small>HERRAMIENTA</small><h3>Preparar CSV</h3></div><FileSpreadsheet aria-hidden="true" /></div>
          <div className="csv-format-summary"><span>Unicode UTF-8</span><span>Separador: coma</span><span>Comillas: todos los campos</span></div>
          <label className={`resource-upload ${file ? 'has-file' : ''}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void chooseFile(event.dataTransfer.files[0]) }}>
            <input type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => void chooseFile(event.target.files?.[0])} />
            {busy && !file ? <RefreshCw className="resource-spinner" /> : <FileUp />}
            <strong>{file ? file.name : 'Selecciona o arrastra un archivo'}</strong>
            <span>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB · ${sheets.length} ${sheets.length === 1 ? 'hoja detectada' : 'hojas detectadas'}` : 'Excel .xlsx o CSV · máximo 20 MB'}</span>
          </label>

          {sheets.length > 0 && <div className="resource-file-options">
            {sheets.length > 1 && <label className="resource-field">Hoja que se exportará<select value={activeSheet} onChange={(event) => { setActiveSheet(Number(event.target.value)); setResult(null) }}>{sheets.map((sheet, index) => <option key={`${sheet.name}-${index}`} value={index}>{sheet.name}</option>)}</select><small>Se exportará una hoja por archivo CSV.</small></label>}
            <label className="resource-field">Nombre del archivo de salida<input value={outputFileName} onChange={(event) => { setOutputFileName(event.target.value); setResult(null) }} maxLength={80} placeholder="Ejemplo: BDUSER.csv" /><small>La extensión .csv se agrega automáticamente.</small></label>
            <label className="resource-check"><input type="checkbox" checked={includeBlankFirstLine} onChange={(event) => { setIncludeBlankFirstLine(event.target.checked); setResult(null) }} /><span>Agregar una primera línea en blanco</span></label>
            <p className="csv-blank-help">Activado: el archivo comienza con una línea vacía. Desactivado: comienza directamente con la primera fila de datos.</p>
            <div className="resource-preview"><div className="resource-preview-title"><span><Table2 size={16} /> Vista previa</span><small>{rows.length.toLocaleString('es-MX')} filas · {columnCount} columnas</small></div><div className="resource-table-wrap"><table><tbody>{rows.slice(0, 5).map((row, rowIndex) => <tr key={rowIndex}>{Array.from({ length: Math.min(columnCount, 6) }, (_, index) => <td key={index}>{csvText(row[index] ?? null)}</td>)}{columnCount > 6 && <td>…</td>}</tr>)}</tbody></table></div></div>
          </div>}

          {error && <div className="resource-alert" role="alert">{error}</div>}
          {result && <div className="resource-success" role="status"><strong>Tu CSV está listo.</strong><span>{result.rows.toLocaleString('es-MX')} filas · {result.columns} columnas · UTF-8</span><a className="btn primary" href={result.url} download={result.fileName}><ArrowDownToLine size={18} /> Descargar {result.fileName}</a></div>}
          <div className="resource-actions">
            {file && <button type="button" className="resource-reset" onClick={reset}>Cambiar archivo</button>}
            <button type="button" className="btn primary" disabled={!file || busy} onClick={convertFile}>{busy ? <><RefreshCw className="resource-spinner" /> Preparando…</> : <><FileText size={18} /> Generar CSV <ArrowRight size={17} /></>}</button>
          </div>
          </div>
      </section>
      <ResourcePromotion tool="csv-formato-texto" />
      <ResourceActivityHistory toolSlug="csv-formato-texto" />
      <section className="resource-coming-soon"><span className="section-index">OTRAS HERRAMIENTAS</span><p>Encuentra más recursos para trabajar con tus datos y procesos.</p><Link to="/recursos">Ver todos los recursos <ArrowRight size={16} /></Link></section>
    </div>
  )
}

