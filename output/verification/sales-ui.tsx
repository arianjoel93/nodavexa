// Local verification fixture. Not routed or included in the production build.
import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { supabase } from '../../src/lib/supabase'
import '../../src/styles.css'
import '../../src/rishi-site.css'
import '../../src/resources.css'
import '../../src/quote-resource.css'
import '../../src/sales-resource.css'
import { SalesResource } from '../../src/pages/SalesResource'
import { Link } from 'react-router-dom'
import { Calculator, Database, FileSpreadsheet, TrendingUp } from 'lucide-react'

const expired = new URLSearchParams(location.search).has('expired')
let workspace = {
  period: { period_id: 'fixture-period', started_at: expired ? '2026-09-20T12:00:00Z' : new Date().toISOString(), ends_at: expired ? '2026-10-20T12:00:00Z' : new Date(Date.now() + 30 * 86400000).toISOString() },
  server_now: new Date().toISOString(), expired,
  sales: [{ id: 'fixture-1', client_name: 'Cliente de ejemplo', phone: '3330000000', company: 'Empresa de ejemplo', notes: 'Entrega en almacén', amount: 1500, created_at: new Date().toISOString() }],
}
supabase.rpc = (async (name: string, args: Record<string, unknown>) => {
  if (name === 'resource_sales_add') workspace.sales.push({ id: crypto.randomUUID(), client_name: String(args.p_client), phone: String(args.p_phone), company: String(args.p_company), notes: String(args.p_notes), amount: Number(args.p_amount), created_at: new Date().toISOString() })
  if (name === 'resource_sales_close') workspace = { ...workspace, expired: false, sales: [], period: { ...workspace.period, period_id: 'fixture-new-period', ends_at: new Date(Date.now() + 30 * 86400000).toISOString() } }
  return { data: structuredClone(workspace), error: null }
}) as typeof supabase.rpc
supabase.auth.getUser = (async () => ({ data: { user: null }, error: null })) as typeof supabase.auth.getUser
supabase.from = (() => {
  const chain = { select: () => chain, eq: () => chain, gt: () => chain, order: () => chain, range: async () => ({ data: [], error: null }) }
  return chain
}) as typeof supabase.from

const apps = [{ slug: 'crear-cotizacion', title: 'Creador de cotizaciones', Icon: Calculator }, { slug: 'excel-a-sqlite', title: 'Excel o CSV a SQLite', Icon: Database }, { slug: 'csv-formato-texto', title: 'Convertidor CSV Formato Tipo Texto', Icon: FileSpreadsheet }, { slug: 'control-ventas', title: 'Mis ventas', Icon: TrendingUp }]
createRoot(document.getElementById('root')!).render(<BrowserRouter><div className="resource-apps-panel"><div className="resource-app-grid">{apps.map(({ slug, title, Icon }) => <div className={`resource-app app-${slug}`} key={slug}><Link to="#" title={title}><span className="resource-app-icon"><Icon size={34} /></span><strong>{title}</strong></Link></div>)}</div></div><SalesResource /></BrowserRouter>)
