import { useEffect, useMemo, useState } from 'react'
import type { DragEvent } from 'react'
import { BarChart3, CheckCircle2, Copy, Download, Edit3, ExternalLink, Eye, FileText, Mail, PackagePlus, Plus, Save, ShoppingCart, Trash2, X } from 'lucide-react'
import { fetchProjectRequests, fetchQuoteClients, fetchQuoteProducts, fetchSalesOrders, fetchSalesQuotes, isSupabaseReady, supabase } from '../lib/supabase'
import { formatQuoteMoney } from '../lib/project-quote'
import type { ProjectRequest, QuoteClient, QuoteProduct, SalesOrder, SalesQuote, SalesQuoteItem } from '../types'

type QuoteDraft = {
  id?: string
  quote_number: string
  status: SalesQuote['status']
  title: string
  client: Partial<QuoteClient>
  currency: 'MXN' | 'USD'
  exchange_rate_mxn_per_usd: number
  invoice_required: boolean
  vat_rate: number
  sat_isr_rate: number
  sat_other_tax_rate: number
  discount_percent: number
  notes: string
  internal_notes: string
  valid_until: string
  items: SalesQuoteItem[]
}

type QuoteAdminTab = 'dashboard' | 'pipeline' | 'quotes' | 'forms' | 'products' | 'clients'
type DetailRecord = { title: string; eyebrow: string; rows: Array<[string, string]> }
type ConfirmDialog = { title: string; message: string; confirmLabel: string; tone?: 'danger' | 'normal'; onConfirm: () => Promise<void> | void }
type AppAlert = { title: string; message: string }
type PipelineStage = 'leads' | 'contacted' | 'quoted' | 'won' | 'lost'
type PipelineItem = { type: 'quote'; quote: SalesQuote } | { type: 'request'; request: ProjectRequest }

const pipelineStageLabel = (stage: PipelineStage) => ({
  leads: 'Leads',
  contacted: 'Contactado',
  quoted: 'Ya cotizado',
  won: 'Ganado',
  lost: 'Perdido',
}[stage])

const emptyClient = (): Partial<QuoteClient> => ({
  company_name: '',
  contact_name: '',
  email: '',
  phone: '',
  country: '',
  website: '',
  tax_id: '',
  billing_name: '',
  billing_address: '',
  marketing_consent: false,
  notes: '',
  source: 'admin',
})

const emptyProduct = (): Partial<QuoteProduct> => ({
  name: '',
  description: '',
  unit_price_mxn: 0,
  cost_mxn: 0,
  unit_type: 'total',
  taxable: true,
  product_type: 'service',
  active: true,
})

const quoteNumber = () => {
  const date = new Date()
  return `NDX-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}-${String(date.getTime()).slice(-5)}`
}

const schemaCacheMessage = (error: unknown) => {
  if (!error) return ''
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && 'message' in error) return String((error as { message?: unknown }).message || '')
  return String(error)
}

const isSchemaCacheError = (error: unknown) => {
  const message = schemaCacheMessage(error)
  return message.includes('PGRST204') || message.includes('schema cache') || message.includes('Could not find the')
}

const userErrorMessage = (error: unknown, fallback: string) => schemaCacheMessage(error) || fallback

const legacyQuotePayload = (payload: Record<string, unknown>) => {
  const legacy = { ...payload }
  ;['sat_isr_rate', 'sat_other_tax_rate', 'sat_income_tax_amount', 'sat_other_tax_amount', 'cost_total', 'gross_margin', 'converted_order_id'].forEach((key) => delete legacy[key])
  return legacy
}

const legacyQuoteItemPayload = (items: Array<Record<string, unknown>>) =>
  items.map((item) => {
    const legacy = { ...item }
    delete legacy.cost_unit_mxn
    delete legacy.unit_type
    return legacy
  })

export function AdminQuotations() {
  const [quotes, setQuotes] = useState<SalesQuote[]>([])
  const [orders, setOrders] = useState<SalesOrder[]>([])
  const [clients, setClients] = useState<QuoteClient[]>([])
  const [products, setProducts] = useState<QuoteProduct[]>([])
  const [requests, setRequests] = useState<ProjectRequest[]>([])
  const [activeTab, setActiveTab] = useState<QuoteAdminTab>('dashboard')
  const [notice, setNotice] = useState('')
  const [editor, setEditor] = useState<QuoteDraft | null>(null)
  const [productEditor, setProductEditor] = useState<Partial<QuoteProduct> | null>(null)
  const [clientEditor, setClientEditor] = useState<Partial<QuoteClient> | null>(null)
  const [detail, setDetail] = useState<DetailRecord | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog | null>(null)
  const [appAlert, setAppAlert] = useState<AppAlert | null>(null)
  const formUrl = useMemo(() => `${window.location.origin}/formularios/proyecto`, [])

  const alertApp = (title: string, message: string) => {
    setAppAlert({ title, message })
    setNotice(message)
  }

  const askConfirm = (dialog: ConfirmDialog) => setConfirmDialog(dialog)

  const runConfirmed = async () => {
    if (!confirmDialog) return
    const action = confirmDialog.onConfirm
    setConfirmDialog(null)
    await action()
  }

  const load = () => {
    fetchSalesQuotes().then(setQuotes).catch((error) => setNotice(error.message))
    fetchSalesOrders().then(setOrders).catch((error) => setNotice(error.message))
    fetchQuoteClients().then(setClients).catch((error) => setNotice(error.message))
    fetchQuoteProducts().then(setProducts).catch((error) => setNotice(error.message))
    fetchProjectRequests().then(setRequests).catch((error) => setNotice(error.message))
  }

  useEffect(() => {
    load()
    if (!isSupabaseReady) return undefined
    const channel = supabase
      .channel('admin-sales-quotes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_quotes' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_orders' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_order_items' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quote_clients' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quote_products' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_quote_items' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_requests' }, () => load())
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [])

  const startQuote = (request?: ProjectRequest) => {
    const client = request ? {
      company_name: request.company_name,
      contact_name: request.contact_name,
      email: request.email,
      phone: request.phone,
      country: request.country,
      website: request.company_website,
      marketing_consent: false,
      notes: request.company_description,
      source: 'formulario',
    } : emptyClient()
    const items: SalesQuoteItem[] = request?.service_type === 'landing_page' ? landingItems(products) : []
    setEditor({
      quote_number: quoteNumber(),
      status: 'draft',
      title: request?.service_type === 'landing_page' ? 'Landing page profesional' : 'Cotización de servicios',
      client,
      currency: 'MXN',
      exchange_rate_mxn_per_usd: 17.5,
      invoice_required: false,
      vat_rate: 16,
      sat_isr_rate: 0,
      sat_other_tax_rate: 0,
      discount_percent: 0,
      notes: request?.service_type === 'landing_page'
        ? 'Incluye dominio gratis el primer año y correo profesional con dominio propio. No incluye pauta publicitaria ni cambios fuera del alcance aprobado.'
        : 'Cotización sujeta a alcance aprobado y materiales entregados por el cliente.',
      internal_notes: request?.id ? `Creada desde formulario ${request.id}` : '',
      valid_until: futureDate(15),
      items,
    })
  }

  const editQuote = (quote: SalesQuote) => {
    setEditor({
      id: quote.id,
      quote_number: quote.quote_number,
      status: quote.status,
      title: quote.title,
      client: quote.quote_clients || emptyClient(),
      currency: quote.currency,
      exchange_rate_mxn_per_usd: Number(quote.exchange_rate_mxn_per_usd || 17.5),
      invoice_required: quote.invoice_required,
      vat_rate: Number(quote.vat_rate || 16),
      sat_isr_rate: Number(quote.sat_isr_rate || 0),
      sat_other_tax_rate: Number(quote.sat_other_tax_rate || 0),
      discount_percent: Number(quote.discount_percent || 0),
      notes: quote.notes,
      internal_notes: quote.internal_notes,
      valid_until: quote.valid_until || futureDate(15),
      items: (quote.sales_quote_items || []).sort((a, b) => a.position - b.position),
    })
  }

  const removeQuote = async (quote: SalesQuote) => {
    askConfirm({
      title: 'Eliminar cotización',
      message: `¿Eliminar la cotización ${quote.quote_number}? Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      tone: 'danger',
      onConfirm: async () => {
        const { error } = await supabase.from('sales_quotes').delete().eq('id', quote.id)
        alertApp(error ? 'No se pudo eliminar' : 'Cotización eliminada', error?.message || 'La cotización fue eliminada correctamente.')
        load()
      },
    })
  }

  const orderNumber = () => {
    const date = new Date()
    return `OV-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}-${String(date.getTime()).slice(-5)}`
  }

  const convertQuoteToOrder = async (quote: SalesQuote) => {
    if (quote.converted_order_id) {
      alertApp('Orden ya creada', 'Esta cotización ya fue convertida a orden de venta.')
      return
    }
    askConfirm({
      title: 'Crear orden de venta',
      message: `¿Pasar la cotización ${quote.quote_number} a orden de venta? Se guardará como venta confirmada.`,
      confirmLabel: 'Crear orden',
      onConfirm: async () => {
        const items = quote.sales_quote_items || []
        const financials = quoteFinancials(quote)
        const { data, error } = await supabase.from('sales_orders').insert({
          order_number: orderNumber(),
          quote_id: quote.id,
          client_id: quote.client_id || null,
          status: 'confirmed',
          title: quote.title,
          currency: quote.currency,
          exchange_rate_mxn_per_usd: quote.exchange_rate_mxn_per_usd || null,
          invoice_required: quote.invoice_required,
          vat_rate: quote.vat_rate,
          sat_isr_rate: quote.sat_isr_rate || 0,
          sat_other_tax_rate: quote.sat_other_tax_rate || 0,
          subtotal: financials.subtotal,
          discount_amount: financials.discount,
          vat_amount: financials.vat,
          sat_income_tax_amount: financials.isr,
          sat_other_tax_amount: financials.otherTax,
          total: financials.total,
          cost_total: financials.cost,
          gross_margin: financials.margin,
          notes: quote.notes,
        }).select('id').single()
        if (error) {
          alertApp('No se pudo crear la orden', orderErrorMessage(error.message))
          return
        }
        if (items.length) {
          const { error: itemError } = await supabase.from('sales_order_items').insert(items.map((item, index) => ({
            order_id: data.id,
            quote_item_id: item.id || null,
            product_id: item.product_id || null,
            name: item.name,
            description: item.description || '',
            quantity: Number(item.quantity || 1),
            unit_price: Number(item.unit_price || 0),
            unit_type: item.unit_type || 'total',
            cost_unit_mxn: Number(item.cost_unit_mxn || 0),
            hidden: item.hidden === true,
            position: index,
          })))
          if (itemError) {
            alertApp('Orden creada con aviso', `La orden se creó, pero no se pudieron guardar sus líneas: ${itemError.message}`)
            return
          }
        }
        const { error: quoteError } = await supabase.from('sales_quotes').update({ status: 'ordered', converted_order_id: data.id, updated_at: new Date().toISOString() }).eq('id', quote.id)
        alertApp(quoteError ? 'Orden creada con aviso' : 'Orden de venta creada', quoteError?.message || 'La cotización fue convertida a orden de venta.')
        load()
      },
    })
  }

  const movePipelineItem = async (item: PipelineItem, stage: PipelineStage) => {
    if (item.type === 'quote' && (stage === 'leads' || stage === 'contacted')) {
      alertApp('Etapa no disponible', 'Las cotizaciones pueden moverse entre Ya cotizado, Ganado y Perdido.')
      return
    }
    if (item.type === 'request') {
      const status: ProjectRequest['status'] = ({ leads: 'new', contacted: 'reviewing', quoted: 'quoted', won: 'sent', lost: 'archived' } as const)[stage]
      const { error } = await supabase.from('project_requests').update({ status, updated_at: new Date().toISOString(), ...(stage === 'quoted' ? { quoted_at: new Date().toISOString() } : {}) }).eq('id', item.request.id)
      alertApp(error ? 'No se pudo mover el lead' : 'Etapa actualizada', error?.message || `${item.request.company_name} ahora está en ${pipelineStageLabel(stage)}.`)
    } else {
      const status: SalesQuote['status'] = ({ quoted: 'sent', won: 'accepted', lost: 'rejected' } as const)[stage as 'quoted' | 'won' | 'lost']
      const { error } = await supabase.from('sales_quotes').update({ status, updated_at: new Date().toISOString() }).eq('id', item.quote.id)
      alertApp(error ? 'No se pudo mover la cotización' : 'Etapa actualizada', error?.message || `${item.quote.quote_number} ahora está en ${pipelineStageLabel(stage)}.`)
    }
    if (isSupabaseReady) load()
  }

  const saveProduct = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!productEditor?.name) return
    const payload = {
      name: productEditor.name.trim(),
      description: productEditor.description || '',
      unit_price_mxn: Number(productEditor.unit_price_mxn || 0),
      cost_mxn: Number(productEditor.cost_mxn || 0),
      unit_type: productEditor.unit_type || 'total',
      taxable: true,
      product_type: productEditor.product_type || 'service',
      active: productEditor.active !== false,
      updated_at: new Date().toISOString(),
    }
    const response = productEditor.id
      ? await supabase.from('quote_products').update(payload).eq('id', productEditor.id)
      : await supabase.from('quote_products').insert(payload)
    alertApp(response.error ? 'No se pudo guardar el producto' : 'Producto guardado', response.error ? productSaveErrorMessage(response.error.message) : 'El producto y su costo quedaron guardados.')
    setProductEditor(null)
    load()
  }

  const saveClient = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!clientEditor?.company_name || !clientEditor?.email) return
    const payload = {
      company_name: String(clientEditor.company_name || '').trim(),
      contact_name: String(clientEditor.contact_name || '').trim(),
      email: String(clientEditor.email || '').trim().toLowerCase(),
      phone: String(clientEditor.phone || ''),
      country: String(clientEditor.country || ''),
      website: String(clientEditor.website || ''),
      tax_id: String(clientEditor.tax_id || ''),
      billing_name: String(clientEditor.billing_name || ''),
      billing_address: String(clientEditor.billing_address || ''),
      marketing_consent: clientEditor.marketing_consent === true,
      notes: String(clientEditor.notes || ''),
      source: String(clientEditor.source || 'admin'),
      updated_at: new Date().toISOString(),
    }
    const response = clientEditor.id
      ? await supabase.from('quote_clients').update(payload).eq('id', clientEditor.id)
      : await supabase.from('quote_clients').insert(payload)
    alertApp(response.error ? 'No se pudo guardar el cliente' : 'Cliente guardado', response.error?.message || 'La información del cliente quedó guardada.')
    setClientEditor(null)
    load()
  }

  const removeProduct = async (product: QuoteProduct) => {
    askConfirm({
      title: 'Eliminar producto',
      message: `¿Eliminar el producto ${product.name}?`,
      confirmLabel: 'Eliminar',
      tone: 'danger',
      onConfirm: async () => {
        const { error } = await supabase.from('quote_products').delete().eq('id', product.id)
        alertApp(error ? 'No se pudo eliminar' : 'Producto eliminado', error?.message || 'El producto fue eliminado correctamente.')
        load()
      },
    })
  }

  const removeClient = async (client: QuoteClient) => {
    askConfirm({
      title: 'Eliminar cliente',
      message: `¿Eliminar el cliente ${client.company_name}?`,
      confirmLabel: 'Eliminar',
      tone: 'danger',
      onConfirm: async () => {
        const { error } = await supabase.from('quote_clients').delete().eq('id', client.id)
        alertApp(error ? 'No se pudo eliminar' : 'Cliente eliminado', error?.message || 'El cliente fue eliminado correctamente.')
        load()
      },
    })
  }

  const copyFormUrl = async () => {
    try {
      await navigator.clipboard.writeText(formUrl)
      setNotice('Liga del formulario copiada.')
    } catch {
      setNotice('No se pudo copiar automáticamente. Selecciona la liga y cópiala manualmente.')
    }
  }

  return (
    <div className="quote-admin">
      <section className="project-admin-settings quote-form-link-card">
        <div>
          <h2>Formulario para clientes</h2>
          <p>Comparte esta liga para que el cliente registre la información de su web, aplicación o software. Al enviarlo aparecerá aquí en tiempo real para cotizar.</p>
          <div className="form-url-box">
            <code>{formUrl}</code>
            <button type="button" onClick={() => void copyFormUrl()}><Copy /> Copiar</button>
            <a href={formUrl} target="_blank" rel="noreferrer"><ExternalLink /> Abrir</a>
          </div>
        </div>
      </section>

      <div className="quote-admin-actions">
        {activeTab === 'quotes' && <button className="btn primary" onClick={() => startQuote()}><Plus /> Agregar nueva cotización</button>}
        {activeTab === 'pipeline' && <button className="btn primary" onClick={() => startQuote()}><Plus /> Nueva oportunidad</button>}
        {activeTab === 'forms' && <button className="btn primary" onClick={() => setActiveTab('quotes')}><FileText /> Ver cotizaciones</button>}
        {activeTab === 'products' && <button className="btn primary" onClick={() => setProductEditor(emptyProduct())}><PackagePlus /> Agregar producto</button>}
        {activeTab === 'clients' && <button className="btn primary" onClick={() => setClientEditor(emptyClient())}><Plus /> Agregar cliente</button>}
      </div>
      {notice && <div className="notice">{notice}<button onClick={() => setNotice('')}><X /></button></div>}

      <header className="quote-section-header">
        <div>
          <small>SISTEMA DE COTIZACIONES</small>
          <h2>{activeTab === 'dashboard' ? 'Tableros' : activeTab === 'pipeline' ? 'CRM Kanban' : activeTab === 'quotes' ? 'Cotizaciones' : activeTab === 'forms' ? 'Formularios' : activeTab === 'products' ? 'Productos y servicios' : 'Clientes'}</h2>
        </div>
        <nav className="quote-tabs" aria-label="Secciones de cotizaciones">
          <button className={activeTab === 'dashboard' ? 'active' : ''} onClick={() => setActiveTab('dashboard')}><BarChart3 /> Tableros</button>
          <button className={activeTab === 'pipeline' ? 'active' : ''} onClick={() => setActiveTab('pipeline')}>CRM Kanban</button>
          <button className={activeTab === 'quotes' ? 'active' : ''} onClick={() => setActiveTab('quotes')}>Cotizaciones</button>
          <button className={activeTab === 'forms' ? 'active' : ''} onClick={() => setActiveTab('forms')}>Formularios</button>
          <button className={activeTab === 'products' ? 'active' : ''} onClick={() => setActiveTab('products')}>Productos</button>
          <button className={activeTab === 'clients' ? 'active' : ''} onClick={() => setActiveTab('clients')}>Clientes</button>
        </nav>
      </header>

      {activeTab === 'dashboard' && <DashboardView orders={orders} quotes={quotes} requests={requests} clients={clients} onViewOrder={(order) => setDetail(orderDetail(order))} />}
      {activeTab === 'pipeline' && <PipelineView quotes={quotes} requests={requests} onQuoteClick={editQuote} onRequestClick={(request) => startQuote(request)} onMove={(item, stage) => void movePipelineItem(item, stage)} />}

      {activeTab === 'quotes' && <section className="quote-admin-grid">
        <div className="admin-list">
          <div className="admin-row labels"><span>Cotización</span><span>Cliente</span><span>Total / margen</span><span /></div>
          {quotes.map((quote) => {
            const financials = quoteFinancials(quote)
            return (
              <div className="admin-row" key={quote.id}>
                <div><div className="admin-thumb form-thumb">CT</div><span><b>{quote.quote_number}</b><small>{quote.title}</small></span></div>
                <span>{quote.quote_clients?.company_name || 'Sin cliente'}</span>
                <span>{formatQuoteMoney(displayQuoteAmount(financials.total, quote), quote.currency)}<small>Margen {formatQuoteMoney(financials.margin, 'MXN')}</small></span>
                <span className="admin-actions-wide">
                  <button title="Ver cotización" onClick={() => setDetail(quoteDetail(quote))}><Eye /></button>
                  <button onClick={() => editQuote(quote)}><Edit3 /></button>
                  <button title="Pasar a orden de venta" onClick={() => void convertQuoteToOrder(quote)}><ShoppingCart /></button>
                  <button className="icon-danger" onClick={() => void removeQuote(quote)}><Trash2 /></button>
                </span>
              </div>
            )
          })}
          {!quotes.length && <div className="empty">Aún no hay cotizaciones guardadas.</div>}
        </div>
      </section>}

      {activeTab === 'forms' && <section className="admin-list">
        <div className="admin-row labels"><span>Formulario recibido</span><span>Servicio</span><span>Estado</span><span /></div>
        {requests.map((request) => (
          <div className="admin-row" key={request.id}>
            <div><div className="admin-thumb form-thumb">FR</div><span><b>{request.company_name}</b><small>{request.contact_name} · {request.email}</small></span></div>
            <span>{request.service_type === 'landing_page' ? 'Landing page' : request.service_type}</span>
            <span><i className={request.status === 'new' ? 'draft' : 'published'}>{request.status}</i></span>
            <span className="admin-actions-wide">
              <button title="Ver formulario" onClick={() => setDetail(requestDetail(request))}><Eye /></button>
              <button onClick={() => startQuote(request)}>Cotizar</button>
            </span>
          </div>
        ))}
        {!requests.length && <div className="empty">No hay formularios pendientes.</div>}
      </section>}

      {activeTab === 'products' && <section className="admin-list quote-management-list">
        <div className="admin-row labels"><span>Producto</span><span>Tipo</span><span>Precio / costo</span><span /></div>
        {products.map((product) => (
          <div className="admin-row" key={product.id}>
            <div><div className="admin-thumb form-thumb">PR</div><span><b>{product.name}</b><small>{product.description || 'Sin descripción'}</small></span></div>
            <span>{product.product_type} · {product.unit_type === 'hour' ? 'Por hora' : 'Total'}</span>
            <span>{formatQuoteMoney(product.unit_price_mxn, 'MXN')}{product.unit_type === 'hour' ? ' / hora' : ''}<small>Costo {formatQuoteMoney(Number(product.cost_mxn || 0), 'MXN')}</small></span>
            <span className="admin-actions-wide">
              <button title="Ver producto" onClick={() => setDetail(productDetail(product))}><Eye /></button>
              <button onClick={() => setProductEditor(product)}><Edit3 /></button>
              <button className="icon-danger" onClick={() => void removeProduct(product)}><Trash2 /></button>
            </span>
          </div>
        ))}
        {!products.length && <div className="empty">Aún no hay productos registrados.</div>}
      </section>}

      {activeTab === 'clients' && <section className="admin-list quote-management-list">
        <div className="admin-row labels"><span>Cliente</span><span>Correo</span><span>Marketing</span><span /></div>
        {clients.map((client) => (
          <div className="admin-row" key={client.id}>
            <div><div className="admin-thumb form-thumb">CL</div><span><b>{client.company_name}</b><small>{client.contact_name || 'Sin contacto'} · {client.phone || 'Sin teléfono'}</small></span></div>
            <span>{client.email}</span>
            <span>{client.marketing_consent ? 'Sí' : 'No'}</span>
            <span className="admin-actions-wide">
              <button title="Ver cliente" onClick={() => setDetail(clientDetail(client))}><Eye /></button>
              <button onClick={() => setClientEditor(client)}><Edit3 /></button>
              <button className="icon-danger" onClick={() => void removeClient(client)}><Trash2 /></button>
            </span>
          </div>
        ))}
        {!clients.length && <div className="empty">Aún no hay clientes registrados.</div>}
      </section>}

      {editor && <QuoteEditor draft={editor} clients={clients} products={products} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); load(); setNotice('Cotización guardada.') }} />}
      {detail && <DetailModal detail={detail} onClose={() => setDetail(null)} />}
      {confirmDialog && <ConfirmModal dialog={confirmDialog} onCancel={() => setConfirmDialog(null)} onConfirm={() => void runConfirmed()} />}
      {appAlert && <AppAlertModal alert={appAlert} onClose={() => setAppAlert(null)} />}
      {productEditor && (
        <div className="editor-overlay">
          <form className="solution-editor product-quote-editor" onSubmit={saveProduct}>
            <header><h2>{productEditor.id ? 'Editar producto' : 'Registrar producto'}</h2><button type="button" onClick={() => setProductEditor(null)}><X /></button></header>
            <div className="editor-scroll">
              <section className="field-grid">
                <label className="full">Nombre<input required value={productEditor.name || ''} onChange={(event) => setProductEditor({ ...productEditor, name: event.target.value })} /></label>
                <label className="full">Descripción<textarea rows={3} value={productEditor.description || ''} onChange={(event) => setProductEditor({ ...productEditor, description: event.target.value })} /></label>
                <label>Precio MXN<input type="number" min={0} value={productEditor.unit_price_mxn || 0} onChange={(event) => setProductEditor({ ...productEditor, unit_price_mxn: Number(event.target.value) })} /></label>
                <label>Costo MXN<input type="number" min={0} value={productEditor.cost_mxn || 0} onChange={(event) => setProductEditor({ ...productEditor, cost_mxn: Number(event.target.value) })} /></label>
                <label>Unidad de cobro<select value={productEditor.unit_type || 'total'} onChange={(event) => setProductEditor({ ...productEditor, unit_type: event.target.value as QuoteProduct['unit_type'] })}><option value="total">Costo total</option><option value="hour">Por hora</option></select></label>
                <label>Tipo<select value={productEditor.product_type || 'service'} onChange={(event) => setProductEditor({ ...productEditor, product_type: event.target.value as QuoteProduct['product_type'] })}><option value="service">Servicio</option><option value="product">Producto</option><option value="maintenance">Mantenimiento</option><option value="domain">Dominio</option><option value="email">Correo</option><option value="other">Otro</option></select></label>
                <label><span><input type="checkbox" checked={productEditor.active !== false} onChange={(event) => setProductEditor({ ...productEditor, active: event.target.checked })} /> Activo</span></label>
              </section>
            </div>
            <footer><button className="btn primary"><Save /> Guardar producto</button></footer>
          </form>
        </div>
      )}
      {clientEditor && (
        <div className="editor-overlay">
          <form className="solution-editor product-quote-editor" onSubmit={saveClient}>
            <header><h2>{clientEditor.id ? 'Editar cliente' : 'Agregar cliente'}</h2><button type="button" onClick={() => setClientEditor(null)}><X /></button></header>
            <div className="editor-scroll">
              <section className="field-grid">
                <label>Empresa<input required value={clientEditor.company_name || ''} onChange={(event) => setClientEditor({ ...clientEditor, company_name: event.target.value })} /></label>
                <label>Contacto<input value={clientEditor.contact_name || ''} onChange={(event) => setClientEditor({ ...clientEditor, contact_name: event.target.value })} /></label>
                <label>Correo<input required type="email" value={clientEditor.email || ''} onChange={(event) => setClientEditor({ ...clientEditor, email: event.target.value })} /></label>
                <label>Teléfono<input value={clientEditor.phone || ''} onChange={(event) => setClientEditor({ ...clientEditor, phone: event.target.value })} /></label>
                <label>País<input value={clientEditor.country || ''} onChange={(event) => setClientEditor({ ...clientEditor, country: event.target.value })} /></label>
                <label>Sitio web<input value={clientEditor.website || ''} onChange={(event) => setClientEditor({ ...clientEditor, website: event.target.value })} /></label>
                <label>RFC / Tax ID<input value={clientEditor.tax_id || ''} onChange={(event) => setClientEditor({ ...clientEditor, tax_id: event.target.value })} /></label>
                <label>Razón social<input value={clientEditor.billing_name || ''} onChange={(event) => setClientEditor({ ...clientEditor, billing_name: event.target.value })} /></label>
                <label className="full">Dirección fiscal<textarea rows={3} value={clientEditor.billing_address || ''} onChange={(event) => setClientEditor({ ...clientEditor, billing_address: event.target.value })} /></label>
                <label className="full">Notas<textarea rows={3} value={clientEditor.notes || ''} onChange={(event) => setClientEditor({ ...clientEditor, notes: event.target.value })} /></label>
                <label><span><input type="checkbox" checked={clientEditor.marketing_consent === true} onChange={(event) => setClientEditor({ ...clientEditor, marketing_consent: event.target.checked })} /> Guardar para marketing</span></label>
              </section>
            </div>
            <footer><button className="btn primary"><Save /> Guardar cliente</button></footer>
          </form>
        </div>
      )}
    </div>
  )
}

function DetailModal({ detail, onClose }: { detail: DetailRecord; onClose: () => void }) {
  return (
    <div className="editor-overlay detail-overlay">
      <section className="app-modal detail-modal">
        <header><div><small>{detail.eyebrow}</small><h2>{detail.title}</h2></div><button onClick={onClose}><X /></button></header>
        <div className="detail-grid">
          {detail.rows.map(([label, value]) => (
            <article key={label}>
              <span>{label}</span>
              <b>{value || 'No indicado'}</b>
            </article>
          ))}
        </div>
        <footer><button className="btn primary" onClick={onClose}>Cerrar</button></footer>
      </section>
    </div>
  )
}

function ConfirmModal({ dialog, onCancel, onConfirm }: { dialog: ConfirmDialog; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="editor-overlay detail-overlay">
      <section className="app-modal confirm-modal">
        <header><div><small>CONFIRMACIÓN</small><h2>{dialog.title}</h2></div><button onClick={onCancel}><X /></button></header>
        <p>{dialog.message}</p>
        <footer>
          <button className="btn ghost" onClick={onCancel}>Cancelar</button>
          <button className={`btn primary ${dialog.tone === 'danger' ? 'danger' : ''}`} onClick={onConfirm}>{dialog.confirmLabel}</button>
        </footer>
      </section>
    </div>
  )
}

function AppAlertModal({ alert, onClose }: { alert: AppAlert; onClose: () => void }) {
  return (
    <div className="editor-overlay detail-overlay">
      <section className="app-modal confirm-modal">
        <header><div><small>AVISO</small><h2>{alert.title}</h2></div><button onClick={onClose}><X /></button></header>
        <p>{alert.message}</p>
        <footer><button className="btn primary" onClick={onClose}>Entendido</button></footer>
      </section>
    </div>
  )
}

function quoteDetail(quote: SalesQuote): DetailRecord {
  const financials = quoteFinancials(quote)
  return {
    eyebrow: 'COTIZACIÓN',
    title: quote.quote_number,
    rows: [
      ['Cliente', quote.quote_clients?.company_name || 'Sin cliente'],
      ['Título', quote.title],
      ['Estado', quote.status],
      ['Total', formatQuoteMoney(displayQuoteAmount(financials.total, quote), quote.currency)],
      ['Costo', formatQuoteMoney(financials.cost, 'MXN')],
      ['Margen', formatQuoteMoney(financials.margin, 'MXN')],
      ['IVA', formatQuoteMoney(displayQuoteAmount(financials.vat, quote), quote.currency)],
      ['ISR/SAT estimado', formatQuoteMoney(displayQuoteAmount(financials.isr, quote), quote.currency)],
      ['Notas', quote.notes],
    ],
  }
}

function orderDetail(order: SalesOrder): DetailRecord {
  return {
    eyebrow: 'ORDEN DE VENTA',
    title: order.order_number,
    rows: [
      ['Cliente', order.quote_clients?.company_name || 'Sin cliente'],
      ['Título', order.title],
      ['Estado', order.status],
      ['Total', formatQuoteMoney(Number(order.total || 0), order.currency)],
      ['Costo', formatQuoteMoney(Number(order.cost_total || 0), 'MXN')],
      ['Margen', formatQuoteMoney(Number(order.gross_margin || 0), 'MXN')],
      ['Pagado', formatQuoteMoney(Number(order.paid_amount || 0), order.currency)],
      ['IVA', formatQuoteMoney(Number(order.vat_amount || 0), order.currency)],
      ['ISR/SAT estimado', formatQuoteMoney(Number(order.sat_income_tax_amount || 0), order.currency)],
      ['Notas', order.notes],
    ],
  }
}

function productDetail(product: QuoteProduct): DetailRecord {
  return {
    eyebrow: 'PRODUCTO',
    title: product.name,
    rows: [
      ['Tipo', product.product_type],
      ['Unidad de cobro', product.unit_type === 'hour' ? 'Por hora' : 'Costo total'],
      ['Precio', `${formatQuoteMoney(Number(product.unit_price_mxn || 0), 'MXN')}${product.unit_type === 'hour' ? ' / hora' : ''}`],
      ['Costo', formatQuoteMoney(Number(product.cost_mxn || 0), 'MXN')],
      ['Margen unitario', formatQuoteMoney(Number(product.unit_price_mxn || 0) - Number(product.cost_mxn || 0), 'MXN')],
      ['Activo', product.active ? 'Sí' : 'No'],
      ['Descripción', product.description],
    ],
  }
}

function clientDetail(client: QuoteClient): DetailRecord {
  return {
    eyebrow: 'CLIENTE',
    title: client.company_name,
    rows: [
      ['Contacto', client.contact_name],
      ['Correo', client.email],
      ['Teléfono', client.phone],
      ['País', client.country],
      ['Sitio web', client.website],
      ['RFC / Tax ID', client.tax_id],
      ['Razón social', client.billing_name],
      ['Dirección fiscal', client.billing_address],
      ['Marketing', client.marketing_consent ? 'Sí' : 'No'],
      ['Notas', client.notes],
    ],
  }
}

function requestDetail(request: ProjectRequest): DetailRecord {
  return {
    eyebrow: 'FORMULARIO',
    title: request.company_name,
    rows: [
      ['Contacto', request.contact_name],
      ['Correo', request.email],
      ['Teléfono', request.phone],
      ['Servicio', request.service_type],
      ['Estado', request.status],
      ['Sitio actual', request.company_website],
      ['Objetivo', request.project_goal],
      ['Audiencia', request.target_audience],
      ['Secciones', (request.sections_needed || []).join(', ')],
      ['Funciones', (request.features_needed || []).join(', ')],
      ['Notas técnicas', request.technical_notes],
    ],
  }
}

function orderErrorMessage(message: string) {
  if (message.includes('sales_orders') || message.includes('schema cache') || message.includes('column')) {
    return `${message}. Falta aplicar la migración de órdenes/costos en Supabase para que esta acción funcione.`
  }
  return message
}

function productSaveErrorMessage(message: string) {
  if (message.includes('cost_mxn') || message.includes('schema cache') || message.includes('column')) {
    return `${message}. Falta aplicar la migración que agrega el campo de costo en Supabase; por eso el costo no puede guardarse todavía.`
  }
  return message
}

function DashboardView({ orders, quotes, requests, clients, onViewOrder }: { orders: SalesOrder[]; quotes: SalesQuote[]; requests: ProjectRequest[]; clients: QuoteClient[]; onViewOrder: (order: SalesOrder) => void }) {
  const sales = orders.filter((order) => order.status !== 'cancelled')
  const totalSales = sales.reduce((sum, order) => sum + Number(order.total || 0), 0)
  const totalCost = sales.reduce((sum, order) => sum + Number(order.cost_total || 0), 0)
  const totalMargin = sales.reduce((sum, order) => sum + Number(order.gross_margin || 0), 0)
  const satTaxes = sales.reduce((sum, order) => sum + Number(order.vat_amount || 0) + Number(order.sat_income_tax_amount || 0) + Number(order.sat_other_tax_amount || 0), 0)
  const paid = sales.reduce((sum, order) => sum + Number(order.paid_amount || 0), 0)
  const orderedQuotes = quotes.filter((quote) => quote.status === 'ordered' || quote.converted_order_id)
  const activeQuotes = quotes.filter((quote) => !['ordered', 'rejected', 'archived'].includes(quote.status))
  const proposals = quotes.filter((quote) => ['sent', 'accepted'].includes(quote.status))
  const wonQuotes = quotes.filter((quote) => quote.status === 'ordered' || quote.status === 'accepted' || quote.converted_order_id)
  const conversionRate = quotes.length ? Math.round((wonQuotes.length / quotes.length) * 100) : 0
  const now = Date.now()
  const staleQuotes = activeQuotes.filter((quote) => {
    const updated = quote.updated_at || quote.created_at
    if (!updated) return true
    return now - new Date(updated).getTime() > 1000 * 60 * 60 * 24 * 7
  })
  const thisMonthOrders = sales.filter((order) => {
    const date = order.confirmed_at || order.created_at
    if (!date) return false
    const current = new Date()
    const orderDate = new Date(date)
    return orderDate.getFullYear() === current.getFullYear() && orderDate.getMonth() === current.getMonth()
  })
  const monthlySales = thisMonthOrders.reduce((sum, order) => sum + Number(order.total || 0), 0)
  const mrr = sales
    .filter((order) => /mensual|mrr|soporte|mantenimiento/i.test(`${order.title} ${order.notes}`))
    .reduce((sum, order) => sum + Number(order.total || 0), 0)
  const leadSources = sourceBreakdown(requests, clients)
  const weekly = weeklyScorecard(requests, quotes, sales)
  return (
    <section className="quote-dashboard">
      <div className="dashboard-cards">
        <article><span>Prospectos</span><b>{requests.length}</b><small>{staleQuotes.length} oportunidad(es) sin seguimiento reciente</small></article>
        <article><span>Propuestas</span><b>{proposals.length}</b><small>{formatQuoteMoney(quotes.reduce((sum, quote) => sum + Number(quote.total || 0), 0), 'MXN')} en cotizaciones</small></article>
        <article><span>Cierres</span><b>{sales.length}</b><small>Conversion: {conversionRate}%</small></article>
        <article><span>Facturacion mensual</span><b>{formatQuoteMoney(monthlySales, 'MXN')}</b><small>MRR estimado: {formatQuoteMoney(mrr, 'MXN')}</small></article>
        <article><span>Margen estimado</span><b>{formatQuoteMoney(totalMargin, 'MXN')}</b><small>Costos: {formatQuoteMoney(totalCost, 'MXN')}</small></article>
        <article><span>Impuestos SAT estimados</span><b>{formatQuoteMoney(satTaxes, 'MXN')}</b><small>IVA, ISR y otros configurados</small></article>
        <article><span>Pagado</span><b>{formatQuoteMoney(paid, 'MXN')}</b><small>Pendiente: {formatQuoteMoney(Math.max(0, totalSales - paid), 'MXN')}</small></article>
        <article><span>Clientes</span><b>{clients.length}</b><small>{clients.filter((client) => client.marketing_consent).length} con permiso marketing</small></article>
      </div>

      <div className="commercial-insights">
        <article>
          <h3>Scorecard semanal</h3>
          <div className="score-grid">
            <span><b>{weekly.prospects}</b><small>Prospectos</small></span>
            <span><b>{weekly.meetings}</b><small>Reuniones / formularios</small></span>
            <span><b>{weekly.proposals}</b><small>Propuestas</small></span>
            <span><b>{weekly.closings}</b><small>Cierres</small></span>
          </div>
        </article>
        <article>
          <h3>Origen de leads</h3>
          <div className="lead-source-list">
            {leadSources.map(([source, count]) => <span key={source}><b>{source}</b><small>{count}</small></span>)}
          </div>
        </article>
        <article>
          <h3>Alertas</h3>
          <ul className="alert-list">
            {staleQuotes.slice(0, 4).map((quote) => <li key={quote.id}>{quote.quote_number} necesita proxima accion.</li>)}
            {!staleQuotes.length && <li>No hay oportunidades vencidas por seguimiento.</li>}
          </ul>
        </article>
      </div>

      <div className="admin-list quote-management-list">
        <div className="admin-row labels"><span>Orden de venta</span><span>Cliente</span><span>Total / margen</span><span>Acciones</span></div>
        {sales.map((order) => (
          <div className="admin-row" key={order.id}>
            <div><div className="admin-thumb form-thumb">OV</div><span><b>{order.order_number}</b><small>{order.title}</small></span></div>
            <span>{order.quote_clients?.company_name || 'Sin cliente'}</span>
            <span>{formatQuoteMoney(order.total, order.currency)}<small>Margen {formatQuoteMoney(order.gross_margin, 'MXN')}</small></span>
            <span className="admin-actions-wide">
              <button title="Ver orden de venta" onClick={() => onViewOrder(order)}><Eye /></button>
              <i className={order.status === 'paid' ? 'published' : 'draft'}>{order.status}</i>
            </span>
          </div>
        ))}
        {!sales.length && <div className="empty">Aún no hay órdenes de venta.</div>}
      </div>
      {!!orderedQuotes.length && <p className="dashboard-note"><CheckCircle2 /> {orderedQuotes.length} cotización(es) ya fueron pasadas a orden de venta.</p>}
      <p className="dashboard-note">Los impuestos mostrados son estimaciones administrativas. La declaración real puede depender de régimen fiscal, deducciones, retenciones y facturación emitida.</p>
    </section>
  )
}

function PipelineView({ quotes, requests, onQuoteClick, onRequestClick, onMove }: { quotes: SalesQuote[]; requests: ProjectRequest[]; onQuoteClick: (quote: SalesQuote) => void; onRequestClick: (request: ProjectRequest) => void; onMove: (item: PipelineItem, stage: PipelineStage) => void }) {
  const [draggedItem, setDraggedItem] = useState<PipelineItem | null>(null)
  const stages: Array<[PipelineStage, PipelineItem[]]> = [
    ['leads', requests.filter((request) => request.status === 'new').map((request) => ({ type: 'request' as const, request }))],
    ['contacted', requests.filter((request) => request.status === 'reviewing').map((request) => ({ type: 'request' as const, request }))],
    ['quoted', [
      ...requests.filter((request) => request.status === 'quoted').map((request) => ({ type: 'request' as const, request })),
      ...quotes.filter((quote) => ['draft', 'sent'].includes(quote.status)).map((quote) => ({ type: 'quote' as const, quote })),
    ]],
    ['won', [
      ...requests.filter((request) => request.status === 'sent').map((request) => ({ type: 'request' as const, request })),
      ...quotes.filter((quote) => ['accepted', 'ordered'].includes(quote.status)).map((quote) => ({ type: 'quote' as const, quote })),
    ]],
    ['lost', [
      ...requests.filter((request) => request.status === 'archived').map((request) => ({ type: 'request' as const, request })),
      ...quotes.filter((quote) => ['rejected', 'archived'].includes(quote.status)).map((quote) => ({ type: 'quote' as const, quote })),
    ]],
  ]
  const canDrop = (item: PipelineItem, stage: PipelineStage) => item.type === 'request' || (stage !== 'leads' && stage !== 'contacted')
  const beginDrag = (event: DragEvent<HTMLButtonElement>, item: PipelineItem) => {
    setDraggedItem(item)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', item.type === 'request' ? item.request.id : item.quote.id)
  }
  return (
    <section className="pipeline-board" aria-label="CRM Kanban Nodavexa">
      {stages.map(([stage, items]) => (
        <article
          key={stage}
          className={draggedItem && canDrop(draggedItem, stage) ? 'is-drop-target' : ''}
          onDragOver={(event) => {
            if (draggedItem && canDrop(draggedItem, stage)) {
              event.preventDefault()
              event.dataTransfer.dropEffect = 'move'
            }
          }}
          onDrop={(event) => {
            event.preventDefault()
            if (draggedItem && canDrop(draggedItem, stage)) {
              const item = draggedItem
              setDraggedItem(null)
              onMove(item, stage)
            }
          }}
        >
          <header><h3>{pipelineStageLabel(stage)}</h3><span>{items.length}</span></header>
          <div>
            {items.map((item) => item.type === 'quote' ? (
              <button key={`quote-${item.quote.id}`} draggable onDragStart={(event) => beginDrag(event, item)} onDragEnd={() => setDraggedItem(null)} onClick={() => onQuoteClick(item.quote)} title="Arrastra para cambiar de etapa">
                <b>{item.quote.quote_clients?.company_name || item.quote.title}</b>
                <small>{item.quote.quote_number} · {formatQuoteMoney(Number(item.quote.total || 0), item.quote.currency)}</small>
                <em>Próxima acción: seguimiento comercial</em>
              </button>
            ) : (
              <button key={`request-${item.request.id}`} draggable onDragStart={(event) => beginDrag(event, item)} onDragEnd={() => setDraggedItem(null)} onClick={() => onRequestClick(item.request)} title="Arrastra para cambiar de etapa">
                <b>{item.request.company_name}</b>
                <small>{item.request.service_type} · {item.request.email}</small>
                <em>Próxima acción: diagnóstico inicial</em>
              </button>
            ))}
            {!items.length && <p>Arrastra aquí una oportunidad.</p>}
            {!!draggedItem && canDrop(draggedItem, stage) && <small className="pipeline-drop-hint">Soltar en {pipelineStageLabel(stage)}</small>}
          </div>
        </article>
      ))}
    </section>
  )
}

function sourceBreakdown(requests: ProjectRequest[], clients: QuoteClient[]) {
  const counts = new Map<string, number>()
  requests.forEach((request) => {
    const source = request.form_slug ? `Formulario ${request.form_slug}` : 'Formulario'
    counts.set(source, (counts.get(source) || 0) + 1)
  })
  clients.forEach((client) => {
    const source = client.source || 'admin'
    counts.set(source, (counts.get(source) || 0) + 1)
  })
  const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
  return rows.length ? rows : [['Sin datos', 0]]
}

function weeklyScorecard(requests: ProjectRequest[], quotes: SalesQuote[], orders: SalesOrder[]) {
  const weekAgo = Date.now() - 1000 * 60 * 60 * 24 * 7
  const isRecent = (date?: string) => date ? new Date(date).getTime() >= weekAgo : false
  return {
    prospects: requests.filter((request) => isRecent(request.created_at)).length,
    meetings: requests.filter((request) => isRecent(request.updated_at) && ['reviewing', 'quoted'].includes(request.status)).length,
    proposals: quotes.filter((quote) => isRecent(quote.sent_at || quote.updated_at || quote.created_at)).length,
    closings: orders.filter((order) => isRecent(order.confirmed_at || order.created_at)).length,
  }
}

function QuoteEditor({ draft, clients, products, onClose, onSaved }: { draft: QuoteDraft; clients: QuoteClient[]; products: QuoteProduct[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState(draft)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [clientSearch, setClientSearch] = useState(String(draft.client.company_name || ''))
  const [showClientOptions, setShowClientOptions] = useState(false)
  const [creatingClient, setCreatingClient] = useState(false)
  const totals = useMemo(() => calculateTotals(form), [form])

  const matchingClients = useMemo(() => {
    const query = clientSearch.trim().toLowerCase()
    return clients.filter((client) => !query || [client.company_name, client.contact_name, client.email].some((value) => value.toLowerCase().includes(query))).slice(0, 8)
  }, [clients, clientSearch])
  const hasExactClient = clients.some((client) => client.company_name.trim().toLowerCase() === clientSearch.trim().toLowerCase() && clientSearch.trim())

  const setClient = (key: keyof QuoteClient, value: unknown) => setForm((current) => ({ ...current, client: { ...current.client, [key]: value } }))
  const searchClient = (value: string) => {
    setClientSearch(value)
    setForm((current) => ({ ...current, client: { ...current.client, id: undefined, company_name: value } }))
    setShowClientOptions(true)
  }
  const selectClient = (client: QuoteClient) => {
    setForm((current) => ({ ...current, client }))
    setClientSearch(client.company_name)
    setShowClientOptions(false)
  }
  const createClient = async () => {
    const companyName = clientSearch.trim()
    if (!companyName) return
    setCreatingClient(true)
    setError('')
    const { data, error: clientError } = await supabase.from('quote_clients').insert({
      company_name: companyName,
      contact_name: '',
      email: '',
      phone: '',
      country: '',
      website: '',
      tax_id: '',
      billing_name: '',
      billing_address: '',
      marketing_consent: false,
      notes: '',
      source: 'admin',
    }).select('*').single()
    if (clientError) setError(`No pudimos crear el cliente: ${clientError.message}`)
    else if (data) {
      setForm((current) => ({ ...current, client: data as QuoteClient }))
      setClientSearch(companyName)
      setShowClientOptions(false)
    }
    setCreatingClient(false)
  }
  const updateItem = (index: number, patch: Partial<SalesQuoteItem>) => setForm((current) => ({ ...current, items: current.items.map((item, i) => i === index ? { ...item, ...patch } : item) }))
  const addProduct = (productId: string) => {
    const product = products.find((item) => item.id === productId)
    if (!product) return
    setForm((current) => ({
      ...current,
      items: [...current.items, {
        product_id: product.id,
        name: product.name,
        description: product.description,
        quantity: 1,
        unit_price: Number(product.unit_price_mxn || 0),
        cost_unit_mxn: Number(product.cost_mxn || 0),
        unit_type: product.unit_type || 'total',
        taxable: true,
        hidden: false,
        position: current.items.length,
      }],
    }))
  }

  const save = async (send = false, download = false) => {
    setBusy(true)
    setError('')
    try {
      if (!form.client.company_name || !form.client.email) throw new Error('Agrega empresa y correo del cliente.')
      let clientId = form.client.id
      const clientPayload = {
        company_name: String(form.client.company_name || '').trim(),
        contact_name: String(form.client.contact_name || '').trim(),
        email: String(form.client.email || '').trim().toLowerCase(),
        phone: String(form.client.phone || ''),
        country: String(form.client.country || ''),
        website: String(form.client.website || ''),
        tax_id: String(form.client.tax_id || ''),
        billing_name: String(form.client.billing_name || ''),
        billing_address: String(form.client.billing_address || ''),
        marketing_consent: form.client.marketing_consent === true,
        notes: String(form.client.notes || ''),
        source: String(form.client.source || 'admin'),
        updated_at: new Date().toISOString(),
      }
      if (clientId) {
        const { error: clientError } = await supabase.from('quote_clients').update(clientPayload).eq('id', clientId)
        if (clientError) throw clientError
      } else {
        const { data, error: clientError } = await supabase.from('quote_clients').insert(clientPayload).select('id').single()
        if (clientError) throw clientError
        clientId = data.id
      }

      const quotePayload: Record<string, unknown> = {
        quote_number: form.quote_number,
        client_id: clientId,
        status: send ? 'sent' : form.status,
        title: form.title,
        currency: form.currency,
        exchange_rate_mxn_per_usd: form.currency === 'USD' ? form.exchange_rate_mxn_per_usd : null,
        invoice_required: form.invoice_required,
        vat_rate: form.vat_rate,
        sat_isr_rate: form.sat_isr_rate,
        sat_other_tax_rate: form.sat_other_tax_rate,
        subtotal: totals.subtotal,
        discount_percent: form.discount_percent,
        discount_amount: totals.discount,
        vat_amount: totals.vat,
        sat_income_tax_amount: totals.isr,
        sat_other_tax_amount: totals.otherTax,
        cost_total: totals.cost,
        gross_margin: totals.margin,
        total: totals.total,
        notes: form.notes,
        internal_notes: form.internal_notes,
        valid_until: form.valid_until || null,
        sent_at: send ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }
      let quoteId = form.id
      if (quoteId) {
        let { error: quoteError } = await supabase.from('sales_quotes').update(quotePayload).eq('id', quoteId)
        if (quoteError && isSchemaCacheError(quoteError)) {
          const retry = await supabase.from('sales_quotes').update(legacyQuotePayload(quotePayload)).eq('id', quoteId)
          quoteError = retry.error
        }
        if (quoteError) throw quoteError
        await supabase.from('sales_quote_items').delete().eq('quote_id', quoteId)
      } else {
        let quoteResponse = await supabase.from('sales_quotes').insert(quotePayload).select('id').single()
        if (quoteResponse.error && isSchemaCacheError(quoteResponse.error)) {
          quoteResponse = await supabase.from('sales_quotes').insert(legacyQuotePayload(quotePayload)).select('id').single()
        }
        const { data, error: quoteError } = quoteResponse
        if (quoteError) throw quoteError
        quoteId = data.id
      }
      if (form.items.length) {
        const itemsPayload = form.items.map((item, index) => ({
          quote_id: quoteId,
          product_id: item.product_id || null,
          name: item.name,
          description: item.description || '',
          quantity: Number(item.quantity || 1),
          unit_price: Number(item.unit_price || 0),
          cost_unit_mxn: Number(item.cost_unit_mxn || 0),
          unit_type: item.unit_type || 'total',
          taxable: item.taxable !== false,
          hidden: item.hidden === true,
          position: index,
        }))
        let { error: itemsError } = await supabase.from('sales_quote_items').insert(itemsPayload)
        if (itemsError && isSchemaCacheError(itemsError)) {
          const retry = await supabase.from('sales_quote_items').insert(legacyQuoteItemPayload(itemsPayload))
          itemsError = retry.error
        }
        if (itemsError) throw itemsError
      }
      if (send || download) {
        const { data, error: fnError } = await supabase.functions.invoke('send-project-quote', { body: { salesQuoteId: quoteId, downloadOnly: download && !send } })
        if (fnError) throw fnError
        if (download && data?.pdf_base64) downloadPdf(data.pdf_base64, `${form.quote_number}.pdf`)
      }
      onSaved()
    } catch (e) {
      setError(userErrorMessage(e, 'No fue posible guardar la cotización.'))
    }
    setBusy(false)
  }

  return (
    <div className="editor-overlay quote-overlay">
      <div className="quote-modal">
        <header><div><small>COTIZACIÓN</small><h2>{form.quote_number}</h2></div><button onClick={onClose}><X /></button></header>
        <div className="quote-layout quote-layout-wide">
          <aside>
            <h3>Cliente</h3>
            <div className="quote-client-picker">
              <label>Cliente / empresa<input value={clientSearch} onFocus={() => setShowClientOptions(true)} onChange={(event) => searchClient(event.target.value)} autoComplete="off" /></label>
              {showClientOptions && <div className="quote-client-options" role="listbox">
                {matchingClients.map((client) => <button type="button" key={client.id} onMouseDown={(event) => event.preventDefault()} onClick={() => selectClient(client)}><b>{client.company_name}</b><small>{client.contact_name || 'Sin contacto'} · {client.email || 'Sin correo'}</small></button>)}
                {!hasExactClient && clientSearch.trim() && <button type="button" className="quote-client-create" disabled={creatingClient} onMouseDown={(event) => event.preventDefault()} onClick={() => void createClient()}><Plus size={16} /><span><b>{creatingClient ? 'Creando cliente…' : `Crear cliente “${clientSearch.trim()}”`}</b><small>Guardar este contacto en Supabase</small></span></button>}
                {!matchingClients.length && !clientSearch.trim() && <p>Escribe para buscar clientes guardados.</p>}
              </div>}
            </div>
            <label>Contacto<input value={form.client.contact_name || ''} onChange={(event) => setClient('contact_name', event.target.value)} /></label>
            <label>Correo<input type="email" value={form.client.email || ''} onChange={(event) => setClient('email', event.target.value)} /></label>
            <label>Teléfono<input value={form.client.phone || ''} onChange={(event) => setClient('phone', event.target.value)} /></label>
            <label>RFC / Tax ID<input value={form.client.tax_id || ''} onChange={(event) => setClient('tax_id', event.target.value)} /></label>
            <label>Razón social<input value={form.client.billing_name || ''} onChange={(event) => setClient('billing_name', event.target.value)} /></label>
            <label>Dirección fiscal<textarea rows={2} value={form.client.billing_address || ''} onChange={(event) => setClient('billing_address', event.target.value)} /></label>
            <label><span><input type="checkbox" checked={form.client.marketing_consent === true} onChange={(event) => setClient('marketing_consent', event.target.checked)} /> Guardar para marketing</span></label>
          </aside>
          <main className="quote-builder">
            <section className="field-grid">
              <label>Título<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
              <label>Moneda<select value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value as 'MXN' | 'USD' })}><option value="MXN">MXN</option><option value="USD">USD</option></select></label>
              {form.currency === 'USD' && <label>Tipo de cambio<input type="number" min={1} step="0.01" value={form.exchange_rate_mxn_per_usd} onChange={(event) => setForm({ ...form, exchange_rate_mxn_per_usd: Number(event.target.value) })} /></label>}
              <label>Descuento %<input type="number" min={0} max={60} value={form.discount_percent} onChange={(event) => setForm({ ...form, discount_percent: Number(event.target.value) })} /></label>
              <label><span><input type="checkbox" checked={form.invoice_required} onChange={(event) => setForm({ ...form, invoice_required: event.target.checked })} /> Con factura / agregar IVA</span></label>
              {form.invoice_required && <label>ISR / SAT %<input type="number" min={0} max={60} step="0.01" value={form.sat_isr_rate} onChange={(event) => setForm({ ...form, sat_isr_rate: Number(event.target.value) })} /></label>}
              {form.invoice_required && <label>Otros impuestos %<input type="number" min={0} max={60} step="0.01" value={form.sat_other_tax_rate} onChange={(event) => setForm({ ...form, sat_other_tax_rate: Number(event.target.value) })} /></label>}
            </section>
            <div className="quote-product-picker">
              <select onChange={(event) => { addProduct(event.target.value); event.currentTarget.value = '' }} defaultValue="">
                <option value="" disabled>Agregar producto o servicio</option>
                {products.filter((product) => product.active).map((product) => <option key={product.id} value={product.id}>{product.name} · {formatQuoteMoney(product.unit_price_mxn, 'MXN')}</option>)}
              </select>
              <button type="button" onClick={() => setForm({ ...form, items: [...form.items, { name: 'Nuevo concepto', description: '', quantity: 1, unit_price: 0, cost_unit_mxn: 0, unit_type: 'total', taxable: true, hidden: false, position: form.items.length }] })}><Plus /> Concepto manual</button>
            </div>
            <div className="quote-lines">
              {form.items.map((item, index) => (
                <div className="quote-line-editor" key={index}>
                  <label className="quote-line-name">Producto o servicio<input value={item.name} onChange={(event) => updateItem(index, { name: event.target.value })} /></label>
                  <label>Cantidad<input type="number" min={0} step="0.01" value={item.quantity} onChange={(event) => updateItem(index, { quantity: Number(event.target.value) })} /></label>
                  <label>{item.unit_type === 'hour' ? 'Precio por hora' : 'Precio'}<input type="number" min={0} step="0.01" value={item.unit_price} onChange={(event) => updateItem(index, { unit_price: Number(event.target.value) })} /></label>
                  <label>Costo<input type="number" min={0} step="0.01" value={item.cost_unit_mxn || 0} onChange={(event) => updateItem(index, { cost_unit_mxn: Number(event.target.value) })} /></label>
                  <label>Unidad<select value={item.unit_type || 'total'} onChange={(event) => updateItem(index, { unit_type: event.target.value as SalesQuoteItem['unit_type'] })}><option value="total">Total</option><option value="hour">Horas</option></select></label>
                  <label className="quote-line-note">Nota para esta línea<textarea rows={2} value={item.description || ''} onChange={(event) => updateItem(index, { description: event.target.value })} placeholder="Detalle, alcance o aclaración opcional" /></label>
                  <label className="quote-line-check"><input type="checkbox" checked={item.hidden === true} onChange={(event) => updateItem(index, { hidden: event.target.checked })} /> Oculto</label>
                  <button type="button" onClick={() => setForm({ ...form, items: form.items.filter((_, i) => i !== index) })}><Trash2 /></button>
                </div>
              ))}
            </div>
            <label>Notas para el cliente<textarea rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
            <QuoteSummary form={form} totals={totals} />
            {error && <div className="form-error">{error}</div>}
          </main>
        </div>
        <footer>
          <button className="btn ghost" disabled={busy} onClick={() => void save(false, true)}><Download /> Descargar PDF</button>
          <button className="btn ghost" disabled={busy} onClick={() => void save(true, false)}><Mail /> Enviar por correo</button>
          <button className="btn primary" disabled={busy} onClick={() => void save(false, false)}><Save /> Guardar</button>
        </footer>
      </div>
    </div>
  )
}

function QuoteSummary({ form, totals }: { form: QuoteDraft; totals: ReturnType<typeof calculateTotals> }) {
  const currency = form.currency
  return (
    <article className="quote-preview compact">
      <div className="quote-head"><div><b>NODAVEXA</b><small>COTIZACIÓN</small></div><span>{form.quote_number}</span></div>
      <table><tbody>
        {form.items.filter((item) => !item.hidden).map((item, index) => <tr key={index}><td><b>{item.name}</b><small>{lineMeta(item)}{item.description ? ` · ${item.description}` : ''}</small></td><td>{formatQuoteMoney(convertAmount(item.quantity * item.unit_price, form), currency)}</td></tr>)}
        <tr><td>Subtotal</td><td>{formatQuoteMoney(convertAmount(totals.subtotal, form), currency)}</td></tr>
        {totals.discount > 0 && <tr><td>Descuento</td><td>-{formatQuoteMoney(convertAmount(totals.discount, form), currency)}</td></tr>}
        {form.invoice_required && <tr><td>IVA</td><td>{formatQuoteMoney(convertAmount(totals.vat, form), currency)}</td></tr>}
        {form.invoice_required && totals.isr > 0 && <tr><td>ISR/SAT estimado</td><td>{formatQuoteMoney(convertAmount(totals.isr, form), currency)}</td></tr>}
        {form.invoice_required && totals.otherTax > 0 && <tr><td>Otros impuestos</td><td>{formatQuoteMoney(convertAmount(totals.otherTax, form), currency)}</td></tr>}
        <tr className="quote-total"><td>Total</td><td>{formatQuoteMoney(convertAmount(totals.total, form), currency)}</td></tr>
        <tr><td>Costo estimado</td><td>{formatQuoteMoney(convertAmount(totals.cost, form), currency)}</td></tr>
        <tr><td>Margen estimado</td><td>{formatQuoteMoney(convertAmount(totals.margin, form), currency)}</td></tr>
      </tbody></table>
    </article>
  )
}

function landingItems(products: QuoteProduct[]): SalesQuoteItem[] {
  const landing = products.find((product) => product.name.toLowerCase().includes('landing')) || { id: null, name: 'Landing page profesional', description: 'Landing page de conversión con dominio gratis el primer año y correo profesional con dominio propio.', unit_price_mxn: 18000, cost_mxn: 0, unit_type: 'total' as const, taxable: true }
  const domain = products.find((product) => product.product_type === 'domain')
  const email = products.find((product) => product.product_type === 'email')
  const visiblePrice = Number(landing.unit_price_mxn || 18000) + Number(domain?.unit_price_mxn || 350) + Number(email?.unit_price_mxn || 1200)
  return [{
    product_id: landing.id,
    name: 'Landing page profesional',
    description: 'Incluye dominio gratis el primer año y correo profesional con dominio propio.',
    quantity: 1,
    unit_price: visiblePrice,
    cost_unit_mxn: Number(landing.cost_mxn || 0) + Number(domain?.cost_mxn || 0) + Number(email?.cost_mxn || 0),
    unit_type: 'total',
    taxable: true,
    hidden: false,
    position: 0,
  }]
}

function calculateTotals(form: QuoteDraft) {
  const subtotal = form.items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0), 0)
  const cost = form.items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.cost_unit_mxn || 0), 0)
  const discount = Math.round(subtotal * Math.max(0, Number(form.discount_percent || 0)) / 100)
  const taxableAfterDiscount = Math.max(0, subtotal - discount)
  const vat = form.invoice_required ? Math.round(taxableAfterDiscount * Number(form.vat_rate || 16) / 100) : 0
  const isr = form.invoice_required ? Math.round(taxableAfterDiscount * Number(form.sat_isr_rate || 0) / 100) : 0
  const otherTax = form.invoice_required ? Math.round(taxableAfterDiscount * Number(form.sat_other_tax_rate || 0) / 100) : 0
  const total = Math.max(0, subtotal - discount + vat + isr + otherTax)
  const margin = Math.max(0, total - vat - isr - otherTax - cost)
  return { subtotal: Math.round(subtotal), discount, vat, isr, otherTax, cost: Math.round(cost), margin: Math.round(margin), total }
}

function quoteFinancials(quote: SalesQuote) {
  const items = quote.sales_quote_items || []
  if (!items.length) {
    return {
      subtotal: Math.round(Number(quote.subtotal || 0)),
      discount: Math.round(Number(quote.discount_amount || 0)),
      vat: Math.round(Number(quote.vat_amount || 0)),
      isr: Math.round(Number(quote.sat_income_tax_amount || 0)),
      otherTax: Math.round(Number(quote.sat_other_tax_amount || 0)),
      cost: Math.round(Number(quote.cost_total || 0)),
      margin: Math.round(Number(quote.gross_margin || 0)),
      total: Math.round(Number(quote.total || 0)),
    }
  }

  const subtotal = items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0), 0)
  const cost = items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.cost_unit_mxn || 0), 0)
  const discount = quote.discount_amount
    ? Number(quote.discount_amount)
    : subtotal * Math.max(0, Number(quote.discount_percent || 0)) / 100
  const base = Math.max(0, subtotal - discount)
  const vat = quote.invoice_required ? base * Number(quote.vat_rate || 16) / 100 : 0
  const isr = quote.invoice_required ? base * Number(quote.sat_isr_rate || 0) / 100 : 0
  const otherTax = quote.invoice_required ? base * Number(quote.sat_other_tax_rate || 0) / 100 : 0
  const total = Math.max(0, base + vat + isr + otherTax)
  const margin = Math.max(0, base - cost)

  return {
    subtotal: Math.round(subtotal),
    discount: Math.round(discount),
    vat: Math.round(vat),
    isr: Math.round(isr),
    otherTax: Math.round(otherTax),
    cost: Math.round(cost),
    margin: Math.round(margin),
    total: Math.round(total),
  }
}

function displayQuoteAmount(amountMxn: number, quote: Pick<SalesQuote, 'currency' | 'exchange_rate_mxn_per_usd'>) {
  if (quote.currency === 'MXN') return amountMxn
  return Math.round((amountMxn / Math.max(1, Number(quote.exchange_rate_mxn_per_usd || 17.5))) * 100) / 100
}

function convertAmount(amount: number, form: QuoteDraft) {
  if (form.currency === 'MXN') return amount
  return Math.round((amount / Math.max(1, Number(form.exchange_rate_mxn_per_usd || 17.5))) * 100) / 100
}

function lineMeta(item: SalesQuoteItem) {
  const quantity = Number(item.quantity || 0)
  const unit = item.unit_type === 'hour' ? 'hora' : 'unidad'
  const plural = quantity === 1 ? unit : `${unit}s`
  return `${quantity} ${plural} x ${formatQuoteMoney(Number(item.unit_price || 0), 'MXN')}`
}

function futureDate(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

function downloadPdf(base64: string, filename: string) {
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
  const blob = new Blob([bytes], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
