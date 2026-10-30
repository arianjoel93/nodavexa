import { supabase } from './supabase'
import type { SalesWorkspace } from './resource-sales-metrics'
export { dailySales, salesDay, salesMoney, salesSummary } from './resource-sales-metrics'
export type { ResourceSale, SalesWorkspace } from './resource-sales-metrics'

export async function fetchSalesWorkspace(): Promise<SalesWorkspace> {
  const { data, error } = await supabase.rpc('resource_sales_workspace')
  if (error) throw new Error('No pudimos cargar las ventas. Vuelve a iniciar sesión e inténtalo de nuevo.')
  return data as SalesWorkspace
}
export async function addResourceSale(period: string, sale: { client: string; phone: string; company: string; notes: string; amount: number }) {
  const { error } = await supabase.rpc('resource_sales_add', { p_period: period, p_client: sale.client, p_phone: sale.phone, p_company: sale.company, p_notes: sale.notes, p_amount: sale.amount })
  if (error) throw new Error(error.code === 'P0001' ? error.message : 'No pudimos guardar la venta. Revisa los datos e inténtalo de nuevo.')
}
export async function closeResourceSalesPeriod(period: string, choice: 'downloaded' | 'discarded') {
  const { error } = await supabase.rpc('resource_sales_close', { p_period: period, p_choice: choice })
  if (error) throw new Error(error.code === 'P0001' ? error.message : 'No pudimos iniciar el nuevo periodo. Inténtalo de nuevo.')
}
