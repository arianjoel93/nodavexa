import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { BadgeCheck, KeyRound, LoaderCircle, ShieldCheck, Trash2, UserPlus } from 'lucide-react'
import { supabase } from '../lib/supabase'

type Tool = { id: string; slug: string; title: string }
type Profile = { user_id: string; email: string; full_name: string }
type Client = { id: string; company_name: string; email: string; contact_name: string }
type Order = { id: string; order_number: string; client_id: string; status: string }
type Entitlement = { id: string; user_id: string; tool_slug: string; source: string; expires_at: string }
type AccessCode = { id: string; client_id: string; sales_order_id: string; tool_slug: string; expires_at: string; redeemed_by: string | null }

const date = (value: string) => new Date(value).toLocaleDateString('es-MX')
const normalizeCode = (value: string) => value.replace(/[^A-Z0-9]/g, '')
const makeCode = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(15))
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const raw = [...bytes].map(byte => alphabet[byte % alphabet.length]).join('')
  return `NDX-${raw.slice(0, 5)}-${raw.slice(5, 10)}-${raw.slice(10, 15)}`
}
const hashCode = async (value: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalizeCode(value)))
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

export function AdminResourceAccess() {
  const [tools, setTools] = useState<Tool[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [entitlements, setEntitlements] = useState<Entitlement[]>([])
  const [codes, setCodes] = useState<AccessCode[]>([])
  const [email, setEmail] = useState('')
  const [manualTool, setManualTool] = useState('')
  const [orderId, setOrderId] = useState('')
  const [codeTool, setCodeTool] = useState('')
  const [generatedCode, setGeneratedCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [toolResult, profileResult, clientResult, orderResult, entitlementResult, codeResult] = await Promise.all([
        supabase.from('resource_tools').select('id,slug,title').order('position'),
        supabase.from('resource_profiles').select('user_id,email,full_name').order('full_name').limit(1000),
        supabase.from('quote_clients').select('id,company_name,email,contact_name').order('company_name').limit(1000),
        supabase.from('sales_orders').select('id,order_number,client_id,status').eq('status', 'paid').order('updated_at', { ascending: false }).limit(500),
        supabase.from('resource_entitlements').select('id,user_id,tool_slug,source,expires_at').order('expires_at', { ascending: false }).limit(1000),
        supabase.from('resource_access_codes').select('id,client_id,sales_order_id,tool_slug,expires_at,redeemed_by').order('created_at', { ascending: false }).limit(500),
      ])
      const failed = [toolResult, profileResult, clientResult, orderResult, entitlementResult, codeResult].find(item => item.error)
      if (failed?.error) throw failed.error
      setTools(toolResult.data || []); setProfiles(profileResult.data || []); setClients(clientResult.data || [])
      setOrders(orderResult.data || []); setEntitlements(entitlementResult.data || []); setCodes(codeResult.data || [])
      setManualTool(previous => previous || toolResult.data?.[0]?.slug || '')
      setCodeTool(previous => previous || toolResult.data?.find(tool => tool.slug === 'reportes-tsc')?.slug || toolResult.data?.[0]?.slug || '')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudieron cargar los accesos.') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  const grantManual = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setNotice('')
    try {
      const normalizedEmail = email.trim().toLowerCase()
      const profile = profiles.find(item => item.email.toLowerCase() === normalizedEmail)
      if (!profile) throw new Error('No encontramos una cuenta de Recursos con ese correo. La persona debe crear su cuenta primero.')
      const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      const { error: insertError } = await supabase.from('resource_entitlements').insert({ user_id: profile.user_id, tool_slug: manualTool, source: 'manual', starts_at: new Date().toISOString(), expires_at: expiresAt, granted_by: (await supabase.auth.getUser()).data.user?.id })
      if (insertError) throw insertError
      setNotice(`Acceso Premium activado para ${profile.full_name || normalizedEmail} durante un año.`); setEmail(''); await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo activar el acceso.') }
    finally { setBusy(false) }
  }

  const generateCode = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setNotice(''); setGeneratedCode('')
    try {
      const order = orders.find(item => item.id === orderId)
      if (!order) throw new Error('Selecciona una orden de venta pagada.')
      const code = makeCode()
      const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      const userId = (await supabase.auth.getUser()).data.user?.id
      const { error: insertError } = await supabase.from('resource_access_codes').insert({ client_id: order.client_id, sales_order_id: order.id, tool_slug: codeTool, code_hash: await hashCode(code), expires_at: expiresAt, created_by: userId })
      if (insertError) throw insertError
      setGeneratedCode(code); setNotice(`Código creado para ${order.order_number}. Tiene vigencia de un año desde hoy.`); await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo crear el código de acceso.') }
    finally { setBusy(false) }
  }

  const revoke = async (id: string) => {
    if (!window.confirm('¿Revocar este acceso Premium?')) return
    const { error: deleteError } = await supabase.from('resource_entitlements').delete().eq('id', id)
    if (deleteError) setError(deleteError.message); else { setNotice('Acceso revocado.'); await load() }
  }
  const toolName = (slug: string) => tools.find(tool => tool.slug === slug)?.title || slug
  const clientName = (id: string) => clients.find(client => client.id === id)?.company_name || 'Cliente'
  const orderLabel = (id: string) => orders.find(order => order.id === id)?.order_number || 'Orden'
  const profileName = (id: string) => profiles.find(profile => profile.user_id === id)?.full_name || profiles.find(profile => profile.user_id === id)?.email || 'Cuenta vinculada'

  return <section className="admin-resource-access">
    <header><div><span>BENEFICIOS PARA CLIENTES</span><h1>Accesos Premium de Recursos</h1><p>Activa beneficios por herramienta, vinculados a cuentas de Recursos y órdenes pagadas de Nodavexa.</p></div><ShieldCheck /></header>
    {error && <div className="admin-access-alert is-error" role="alert">{error}</div>}{notice && <div className="admin-access-alert" role="status">{notice}</div>}
    {generatedCode && <div className="admin-generated-code"><div><strong>Código generado · cópialo ahora</strong><code>{generatedCode}</code><small>Se guarda únicamente una huella segura; el código no podrá volver a consultarse.</small></div><button type="button" onClick={() => void navigator.clipboard.writeText(generatedCode)}>Copiar código</button></div>}
    <div className="admin-access-grid">
      <form className="admin-access-card" onSubmit={grantManual}><span className="admin-access-icon"><UserPlus /></span><h2>Otorgar acceso directamente</h2><p>Para clientes a quienes quieras habilitar una herramienta desde el admin.</p><label>Correo de la cuenta de Recursos<input required type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="cliente@empresa.com" /></label><label>Herramienta<select value={manualTool} onChange={event => setManualTool(event.target.value)}>{tools.map(tool => <option key={tool.id} value={tool.slug}>{tool.title}</option>)}</select></label><button disabled={busy || loading}>{busy ? 'Guardando…' : 'Activar por un año'}</button></form>
      <form className="admin-access-card" onSubmit={generateCode}><span className="admin-access-icon"><KeyRound /></span><h2>Crear código por compra</h2><p>Elige una orden pagada. El cliente debe canjear el código con el correo registrado en esa compra.</p><label>Orden pagada<select required value={orderId} onChange={event => setOrderId(event.target.value)}><option value="">Seleccionar orden…</option>{orders.map(order => <option key={order.id} value={order.id}>{order.order_number} · {clientName(order.client_id)}</option>)}</select></label><label>Acceso que habilita<select value={codeTool} onChange={event => setCodeTool(event.target.value)}>{tools.map(tool => <option key={tool.id} value={tool.slug}>{tool.title}</option>)}</select></label><button disabled={busy || loading || !orders.length}><BadgeCheck size={16} /> {busy ? 'Creando…' : 'Generar código anual'}</button>{!loading && orders.length === 0 && <small>No hay órdenes marcadas como pagadas para generar códigos.</small>}</form>
    </div>
    <section className="admin-access-list"><div className="admin-access-list-title"><div><span>ACCESOS ACTIVOS Y REGISTROS</span><h2>Beneficios asignados</h2></div><button onClick={() => void load()}><LoaderCircle size={15} className={loading ? 'spin' : ''} /> Actualizar</button></div>
      {loading ? <p>Cargando accesos…</p> : entitlements.length ? entitlements.map(item => <article key={item.id}><div><strong>{profileName(item.user_id)}</strong><span>{toolName(item.tool_slug)} · {item.source === 'manual' ? 'Asignado desde admin' : 'Canjeado por compra'} · vence {date(item.expires_at)}</span></div><button aria-label="Revocar acceso" onClick={() => void revoke(item.id)}><Trash2 size={16} /></button></article>) : <p>Aún no hay accesos Premium.</p>}
    </section>
    <section className="admin-access-list"><div className="admin-access-list-title"><div><span>VINCULADOS A COMPRAS</span><h2>Códigos emitidos</h2></div></div>{codes.length ? codes.map(code => <article key={code.id}><div><strong>{clientName(code.client_id)} · {orderLabel(code.sales_order_id)}</strong><span>{toolName(code.tool_slug)} · {code.redeemed_by ? `Canjeado por ${profileName(code.redeemed_by)}` : 'Pendiente de canje'} · vence {date(code.expires_at)}</span></div></article>) : <p>Aún no se han emitido códigos de compra.</p>}</section>
  </section>
}
