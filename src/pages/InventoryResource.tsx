import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, Package, RefreshCw } from 'lucide-react'
import { inventoryAction, inventoryNumber as number, type InventoryWorkspace } from '../lib/resource-inventory'
import { ResourcePromotion } from '../components/ResourcePromotion'
import { ResourceFileHistory } from './Resources'
import { saveResourceFile } from '../lib/resource-files'
import { supabase } from '../lib/supabase'
import { logResourceActivity } from '../lib/resource-auth'

const emptyProduct = { sku: '', name: '', unit: 'pieza', minimum: '0' }
const emptyMove = { product_id: '', kind: 'in', quantity: '', reference: '', notes: '' }
function track(action: string) {
  void supabase.auth.getUser().then(({ data }) => data.user && logResourceActivity({ userId: data.user.id, toolSlug: 'inventario-basico', action })).catch(() => undefined)
}
export function InventoryResource() {
  const [data, setData] = useState<InventoryWorkspace | null>(null)
  const [product, setProduct] = useState(emptyProduct)
  const [move, setMove] = useState(emptyMove)
  const [page, setPage] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [archive, setArchive] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const request = useRef<string | null>(null)
  const load = useCallback(async () => { setData(await inventoryAction('workspace', { page })) }, [page])
  useEffect(() => {
    const refresh = () => { void load().catch(() => setError('No pudimos cargar el inventario. Intenta actualizarlo.')) }
    refresh()
    const timer = setInterval(refresh, 60000)
    window.addEventListener('focus', refresh)
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh) }
  }, [load])
  async function mutate(action: string, values: Record<string, unknown>) {
    if (busy) return
    setBusy(true); setError(''); setNotice('')
    try {
      await inventoryAction(action, values)
      track(action === 'move' ? 'inventory_movement_created' : `inventory_${action}`)
      if (action === 'product') setProduct(emptyProduct)
      if (action === 'move') { setMove(emptyMove); request.current = null }
      setArchive(null)
      await load(); setNotice('Cambios guardados en tu inventario.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No pudimos guardar los cambios.') }
    finally { setBusy(false) }
  }
  async function exportFile(format: 'csv' | 'pdf') {
    if (!data || busy) return
    setBusy(true); setError('')
    try {
      const history = []
      for (let offset = 0; offset * 25 < data.movement_count; offset++) history.push(...(await inventoryAction('workspace', { page: offset })).movements)
      const rows = history.map(m => {
        const p = data.products.find(p => p.id === m.product_id)
        return [new Date(m.created_at).toLocaleString('es-MX'), p?.sku || '', p?.name || '', m.kind === 'in' ? 'Entrada' : 'Salida', number(m.quantity), p?.unit || '', m.reference, m.notes]
      })
      let blob: Blob
      if (format === 'csv') {
        const safe = (v: string) => `"${(/^[=+\-@\t\r]/.test(v) ? "'" + v : v).replaceAll('"', '""')}"`
        const stockRows = data.products.map(p => [p.sku, p.name, number(p.stock), p.unit, p.active ? 'Activo' : 'Archivado'])
        blob = new Blob(['\uFEFF', [['EXISTENCIAS'], ['SKU / PLU', 'Producto', 'Existencia', 'Unidad', 'Estado'], ...stockRows, [], ['MOVIMIENTOS'], ['Fecha', 'SKU / PLU', 'Producto', 'Movimiento', 'Cantidad', 'Unidad', 'Referencia', 'Notas'], ...rows].map(row => row.map(safe).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' })
      } else {
        const { jsPDF } = await import('jspdf')
        const pdf = new jsPDF()
        let y = 22
        const line = (text: string) => {
          for (const part of pdf.splitTextToSize(text, 174) as string[]) {
            if (y > 276) { pdf.addPage(); y = 22 }
            pdf.text(part, 18, y); y += 6
          }
        }
        pdf.setTextColor('#6f5848'); pdf.setFontSize(18); line('Inventario básico | Nodavexa')
        pdf.setFontSize(10); line(`Reporte del ${new Date().toLocaleDateString('es-MX')}`)
        line('EXISTENCIAS ACTUALES')
        data.products.forEach(p => line(`${p.sku} | ${p.name}: ${number(p.stock)} ${p.unit}${p.active ? '' : ' (archivado)'}`))
        y += 5; line('HISTORIAL DE ENTRADAS Y SALIDAS')
        rows.forEach(row => { line(row.slice(0, 6).join(' | ')); if (row[6] || row[7]) line(`Referencia: ${row[6]} / Notas: ${row[7]}`); y += 3 })
        blob = pdf.output('blob')
      }
      const name = `inventario-${new Date().toISOString().slice(0, 10)}.${format}`
      const url = URL.createObjectURL(blob); const link = document.createElement('a')
      link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 60000)
      track(`inventory_export_${format}`)
      setNotice('Reporte descargado. Tu inventario se conserva sin borrados mensuales.')
      void saveResourceFile('inventario-basico', name, blob).catch(() => setNotice('Reporte descargado. No pudimos guardar una copia en el historial de archivos.'))
    } catch { setError('No pudimos generar el reporte. Vuelve a intentarlo.') }
    finally { setBusy(false) }
  }
  const active = data?.products.filter(p => p.active) || []
  const used = data?.account.used || 0
  const renewal = data?.account.period_end ? new Date(data.account.period_end) : null
  const remainingDays = renewal && data ? Math.max(0, Math.ceil((renewal.getTime() - new Date(data.server_now).getTime()) / 86400000)) : 0
  const changedMove = (key: string, value: string) => { request.current = null; setMove(current => ({ ...current, [key]: value })) }
  return <div className="sales-resource inventory-resource">
    <header className="sales-heading"><div><span className="section-index">RECURSOS · INVENTARIO BÁSICO</span><h1>Entradas, salidas y existencias claras</h1><p>Hasta 30 productos activos y 15 movimientos por mes. Tus productos y tu historial no se borran.</p></div><div><button className="btn ghost" title="Actualizar inventario" disabled={busy} onClick={() => void load().catch(() => setError('No pudimos actualizar el inventario.'))}><RefreshCw size={17} /></button><button className="btn ghost" disabled={!data || busy} onClick={() => void exportFile('csv')}><Download size={17} /> CSV</button><button className="btn primary" disabled={!data || busy} onClick={() => void exportFile('pdf')}><Download size={17} /> PDF</button></div></header>
    <ResourcePromotion tool="inventario-basico" />
    {error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="sales-notice" role="status">{notice}</p>}
    {!data ? <p>Cargando inventario…</p> : <>
      <section className={used >= 15 ? 'sales-expired' : 'inventory-quota'}><h2>Movimientos: {used} de 15 utilizados</h2><progress value={used} max={15} aria-label="Movimientos utilizados" /><p>{renewal ? <>Tu cupo se renueva el <strong>{renewal.toLocaleString('es-MX')}</strong>. Faltan {remainingDays} {remainingDays === 1 ? 'día' : 'días'}.</> : 'Tu primer movimiento inicia el periodo de un mes.'}</p>{used >= 15 && <p>No puedes registrar más entradas o salidas hasta la renovación. Puedes seguir consultando y descargando. Para ampliar tu cupo, <a href="mailto:soporte@nodavexa.com?subject=Ampliar%20cupo%20de%20inventario">escribe a soporte</a> o <a href="https://bodegalia.nodavexa.com" target="_blank" rel="noreferrer">conoce Bodegalia</a>.</p>}<small>Solo se renueva el cupo; no se borran datos. Los movimientos no utilizados no se acumulan.</small></section>
      <div className="sales-kpis"><article><Package /><span>Productos activos</span><strong>{active.length} / 30</strong></article><article><Package /><span>Productos agotados</span><strong>{active.filter(p => Number(p.stock) === 0).length}</strong></article><article><Package /><span>Con stock bajo</span><strong>{active.filter(p => Number(p.stock) > 0 && Number(p.stock) <= Number(p.minimum)).length}</strong></article><article><Package /><span>Movimientos disponibles</span><strong>{15 - used}</strong></article></div>
      <section className="sales-entry"><h2>Agregar producto</h2><form onSubmit={event => { event.preventDefault(); void mutate('product', { ...product, minimum: Number(product.minimum) }) }}><fieldset disabled={busy || active.length >= 30}><label>SKU o PLU<input required maxLength={80} value={product.sku} onChange={e => setProduct({ ...product, sku: e.target.value })} /></label><label>Nombre del producto<input required maxLength={160} value={product.name} onChange={e => setProduct({ ...product, name: e.target.value })} /></label><label>Unidad<input required maxLength={30} value={product.unit} onChange={e => setProduct({ ...product, unit: e.target.value })} /></label><label>Existencia mínima<input required type="number" min="0" max="999999999999" step="0.000001" value={product.minimum} onChange={e => setProduct({ ...product, minimum: e.target.value })} /></label><button className="btn primary">Agregar producto</button></fieldset></form><p className="inventory-help">Se crea con existencia cero. Registra su saldo inicial como una entrada; cuenta como movimiento.</p></section>
      <section className="sales-entry"><h2>Registrar movimiento</h2><form onSubmit={event => { event.preventDefault(); request.current ||= crypto.randomUUID(); void mutate('move', { ...move, quantity: Number(move.quantity), request_id: request.current }) }}><fieldset disabled={busy || used >= 15 || !active.length}><label>Producto<select required value={move.product_id} onChange={e => changedMove('product_id', e.target.value)}><option value="">Selecciona un producto</option>{active.map(p => <option key={p.id} value={p.id}>{p.sku} · {p.name} ({number(p.stock)} {p.unit})</option>)}</select></label><label>Tipo<select value={move.kind} onChange={e => changedMove('kind', e.target.value)}><option value="in">Entrada</option><option value="out">Salida</option></select></label><label>Cantidad<input required type="number" min="0.000001" max="999999999999" step="0.000001" value={move.quantity} onChange={e => changedMove('quantity', e.target.value)} /></label><label>Referencia (opcional)<input maxLength={160} value={move.reference} onChange={e => changedMove('reference', e.target.value)} /></label><label className="sales-notes">Notas (opcional)<textarea maxLength={1000} value={move.notes} onChange={e => changedMove('notes', e.target.value)} /></label><button className="btn primary">{busy ? 'Guardando…' : 'Guardar movimiento'}</button></fieldset></form><p className="inventory-help">Cada entrada o salida corresponde a un producto. Para corregir un registro, crea un movimiento contrario con la referencia original; también utiliza cupo.</p></section>
      <section className="sales-records"><h2>Existencias</h2><label>Buscar producto<input className="inventory-search" value={filter} onChange={e => setFilter(e.target.value)} /></label><div className="sales-table-scroll"><table><thead><tr><th>SKU / PLU</th><th>Producto</th><th>Existencia</th><th>Mínimo</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{data.products.filter(p => `${p.sku} ${p.name}`.toLowerCase().includes(filter.toLowerCase())).map(p => <tr key={p.id}><td>{p.sku}</td><td>{p.name}</td><td>{number(p.stock)} {p.unit}</td><td>{number(p.minimum)}</td><td>{!p.active ? 'Archivado' : Number(p.stock) === 0 ? 'Agotado' : Number(p.stock) <= Number(p.minimum) ? 'Stock bajo' : 'Disponible'}</td><td>{archive === p.id ? <span><button disabled={busy} onClick={() => void mutate('archive', { id: p.id })}>Confirmar archivo</button><button onClick={() => setArchive(null)}>Cancelar</button></span> : <button className="btn ghost" disabled={busy || (p.active && Number(p.stock) !== 0)} onClick={() => p.active ? setArchive(p.id) : void mutate('restore', { id: p.id })}>{p.active ? 'Archivar' : 'Restaurar'}</button>}</td></tr>)}</tbody></table></div>{!data.products.length && <p>Agrega tu primer producto para comenzar.</p>}</section>
      <section className="sales-records"><h2>Historial de movimientos</h2><p>{data.movement_count} movimientos guardados. El historial no se borra al renovar el cupo.</p><div className="sales-table-scroll"><table><thead><tr><th>Fecha</th><th>Producto</th><th>Tipo</th><th>Cantidad</th><th>Referencia y notas</th></tr></thead><tbody>{data.movements.map(m => <tr key={m.id}><td>{new Date(m.created_at).toLocaleString('es-MX')}</td><td>{data.products.find(p => p.id === m.product_id)?.sku}</td><td>{m.kind === 'in' ? 'Entrada' : 'Salida'}</td><td>{number(m.quantity)}</td><td className="sales-note-cell">{m.reference}<br />{m.notes}</td></tr>)}</tbody></table></div><div className="resource-history-pagination"><button className="btn ghost" disabled={!page || busy} onClick={() => setPage(p => p - 1)}>Anterior</button><span>Página {page + 1}</span><button className="btn ghost" disabled={(page + 1) * 25 >= data.movement_count || busy} onClick={() => setPage(p => p + 1)}>Siguiente</button></div></section>
    </>}
    <ResourceFileHistory toolSlug="inventario-basico" />
  </div>
}
