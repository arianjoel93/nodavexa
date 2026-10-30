import { useEffect, useState } from 'react'
import { Download, Plus, Trash2 } from 'lucide-react'
import { ResourcePromotion } from '../components/ResourcePromotion'
import { createQuotePdf } from '../lib/resource-quote-pdf'
import { supabase } from '../lib/supabase'
import { logResourceActivity } from '../lib/resource-auth'
import { saveResourceFile } from '../lib/resource-files'
import { ResourceFileHistory } from './Resources'

type Line = { id: string; description: string; quantity: number; price: number; unit: string }
const newLine = (): Line => ({ id: crypto.randomUUID(), description: '', quantity: 1, price: 0, unit: 'Pieza' })
export function QuoteResource() {
  const [company, setCompany] = useState('')
  const [email, setEmail] = useState('')
  const [client, setClient] = useState('')
  const [logo, setLogo] = useState('')
  const [currency, setCurrency] = useState('MXN')
  const [number, setNumber] = useState(`COT-${Date.now().toString().slice(-8)}`)
  const [validUntil, setValidUntil] = useState(new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10))
  const [discount, setDiscount] = useState(0)
  const [tax, setTax] = useState(0)
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<Line[]>([newLine()])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [download, setDownload] = useState<{ url: string; filename: string } | null>(null)
  useEffect(() => () => { if (download) URL.revokeObjectURL(download.url) }, [download])
  useEffect(() => { supabase.auth.getUser().then(({ data }) => { if (data.user) { try { const saved = JSON.parse(localStorage.getItem(`quote-company-${data.user.id}`) || '{}'); setCompany(saved.company || ''); setEmail(saved.email || ''); setLogo('') } catch { /* No saved company yet. */ } } }) }, [])
  const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100
  const subtotal = round(lines.reduce((sum, line) => sum + round(line.quantity * line.price), 0))
  const net = round(subtotal - round(subtotal * discount / 100))
  const total = round(net + round(net * tax / 100))
  const money = (value: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency }).format(value)
  const update = (id: string, patch: Partial<Line>) => setLines(current => current.map(line => line.id === id ? { ...line, ...patch } : line))
  async function generate(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true); setMessage('')
    try {
      if (!lines.length || lines.some(line => !line.description.trim() || !Number.isFinite(line.quantity) || line.quantity <= 0 || !Number.isFinite(line.price) || line.price < 0) || !Number.isFinite(total)) throw new Error('Revisa las cantidades, precios y descripciones.')
      const { blob, logoSkipped } = createQuotePdf({ company, email, client, logo, currency, number, validUntil, discount, tax, notes, lines })
      const filename = `${number.replace(/[^a-zA-Z0-9_-]/g, '-') || 'cotizacion'}.pdf`
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url; link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      setDownload({ url, filename })
      setMessage(`Tu PDF está listo. Si la descarga no comenzó, pulsa el enlace de descarga que aparece debajo.${logoSkipped ? ' El logotipo no se pudo leer y se omitió.' : ''}`)
      void saveResourceFile('crear-cotizacion', filename, blob).catch(error => setMessage(`Tu PDF sigue disponible para descargar. ${error instanceof Error ? error.message : 'No pudimos guardar el historial en Supabase.'}`))
      const { data } = await supabase.auth.getUser()
      if (data.user) {
        try { localStorage.setItem(`quote-company-${data.user.id}`, JSON.stringify({ company, email })) } catch { /* PDF remains downloadable if local storage is full. */ }
        void logResourceActivity({ userId: data.user.id, toolSlug: 'crear-cotizacion', action: 'export', quantity: lines.length, metadata: { format: 'pdf', currency } }).catch(() => undefined)
      }
    } catch (error) { setMessage(error instanceof Error && /Revisa/.test(error.message) ? error.message : 'No pudimos generar el PDF. Revisa los datos o recarga la página para actualizar el generador.') }
    finally { setBusy(false) }
  }
  return <div className="quote-resource"><header><span className="section-index">RECURSOS · COTIZADOR GRATUITO</span><h1>Crea una cotización profesional</h1><p>Organiza productos o servicios y descarga tu propuesta comercial en PDF.</p></header><ResourcePromotion tool="crear-cotizacion" /><form onSubmit={event => void generate(event)}><div className="quote-resource-fields"><label>Tu empresa<input required value={company} onChange={event => setCompany(event.target.value)} /></label><label>Correo de contacto<input type="email" required value={email} onChange={event => setEmail(event.target.value)} /></label><label>Cliente<input required value={client} onChange={event => setClient(event.target.value)} /></label><label>Folio<input required value={number} onChange={event => setNumber(event.target.value)} /></label><label>Válida hasta<input type="date" required value={validUntil} onChange={event => setValidUntil(event.target.value)} /></label><label>Moneda<select value={currency} onChange={event => setCurrency(event.target.value)}><option>MXN</option><option>USD</option></select></label><label>Logotipo opcional<input type="file" accept="image/png,image/jpeg" onChange={event => { const file = event.target.files?.[0]; if (!file) return; if (file.size > 500000 || !['image/png', 'image/jpeg'].includes(file.type)) { setMessage('El logo debe ser PNG o JPG y pesar menos de 500 KB.'); return } const reader = new FileReader(); reader.onload = () => setLogo(String(reader.result)); reader.readAsDataURL(file) }} /></label></div><h2>Productos y servicios</h2>{lines.map(line => <div className="quote-resource-line" key={line.id}><label>Descripción<input required value={line.description} onChange={event => update(line.id, { description: event.target.value })} /></label><label>Cantidad<input type="number" required min="0.001" step="any" value={line.quantity} onChange={event => update(line.id, { quantity: Number(event.target.value) })} /></label><label>Unidad<select value={line.unit} onChange={event => update(line.id, { unit: event.target.value })}><option>Pieza</option><option>Hora</option><option>Servicio</option></select></label><label>Precio<input type="number" required min="0" step="0.01" value={line.price} onChange={event => update(line.id, { price: Number(event.target.value) })} /></label><strong>{money(line.quantity * line.price)}</strong><button type="button" disabled={lines.length === 1} title="Eliminar concepto" onClick={() => setLines(current => current.filter(item => item.id !== line.id))}><Trash2 size={17} /></button></div>)}<button className="btn ghost" type="button" onClick={() => setLines(current => [...current, newLine()])}><Plus size={16} /> Agregar concepto</button><div className="quote-resource-fields"><label>Descuento %<input type="number" min="0" max="100" value={discount} onChange={event => setDiscount(Number(event.target.value))} /></label><label>IVA %<input type="number" min="0" max="100" step="0.01" value={tax} onChange={event => setTax(Number(event.target.value))} /></label><label>Notas y condiciones<textarea value={notes} onChange={event => setNotes(event.target.value)} /></label></div><div className="quote-resource-totals"><p><span>Subtotal</span><strong>{money(subtotal)}</strong></p>{discount > 0 && <><p><span>Descuento ({discount}%)</span><strong>{money(subtotal - net)}</strong></p><p><span>Subtotal con descuento</span><strong>{money(net)}</strong></p></>}{tax > 0 && <p><span>IVA ({tax}%)</span><strong>{money(total - net)}</strong></p>}<p className="quote-resource-total"><span>Total</span><strong>{money(total)} {currency}</strong></p></div><button className="btn primary" disabled={busy}><Download size={18} /> {busy ? 'Generando…' : 'Descargar cotización PDF'}</button>{message && <p role="status">{message}</p>}{download && <a className="btn ghost" href={download.url} download={download.filename}><Download size={18} /> Descargar {download.filename}</a>}</form><ResourceFileHistory toolSlug="crear-cotizacion" /></div>
}
