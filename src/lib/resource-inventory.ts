import { supabase } from './supabase'
export type InventoryProduct = { id: string; sku: string; name: string; unit: string; minimum: number; stock: number; active: boolean }
export type InventoryMovement = { id: string; product_id: string; kind: 'in' | 'out'; quantity: number; reference: string; notes: string; created_at: string }
export type InventoryWorkspace = { account: { anchor_at: string | null; period_end: string | null; used: number }; server_now: string; products: InventoryProduct[]; movements: InventoryMovement[]; movement_count: number }
export async function inventoryAction(action: string, data: Record<string, unknown> = {}) {
  const result = await supabase.rpc('resource_inventory_action', { p_action: action, p_data: data })
  if (result.error) throw new Error(result.error.code === 'P0001' ? result.error.message : 'No pudimos completar la operación. Revisa los datos y tu conexión e inténtalo de nuevo.')
  return result.data as InventoryWorkspace
}
export const inventoryNumber = (n: number) => new Intl.NumberFormat('es-MX', { maximumFractionDigits: 6 }).format(Number(n))
