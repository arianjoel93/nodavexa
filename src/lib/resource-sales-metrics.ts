export type ResourceSale = { id: string; client_name: string; phone: string; company: string; notes: string; amount: number; created_at: string }
export type SalesWorkspace = { period: { period_id: string; started_at: string; ends_at: string }; expired: boolean; server_now: string; sales: ResourceSale[] }
export const salesMoney = (value: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value)
export function salesSummary(sales: ResourceSale[]) {
  const total = sales.reduce((sum, sale) => sum + Math.round(Number(sale.amount) * 100), 0) / 100
  const clients = new Set(sales.map(sale => sale.phone.replace(/\D/g, '') || `${sale.client_name.trim().toLowerCase()}|${sale.company.trim().toLowerCase()}`)).size
  return { total, count: sales.length, clients, average: sales.length ? total / sales.length : 0 }
}
export const salesDay = (date: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(date))
export function dailySales(sales: ResourceSale[], start: string, end: string) {
  const buckets = new Map<string, { amount: number; count: number }>()
  for (const sale of sales) {
    const day = salesDay(sale.created_at)
    const value = buckets.get(day) || { amount: 0, count: 0 }
    value.amount += Number(sale.amount); value.count++
    buckets.set(day, value)
  }
  const result = []
  const cursor = new Date(`${salesDay(start)}T12:00:00Z`)
  const last = salesDay(end)
  for (let count = 0; count < 33 && cursor.toISOString().slice(0, 10) <= last; count++) {
    const day = cursor.toISOString().slice(0, 10)
    result.push({ day, amount: buckets.get(day)?.amount || 0, count: buckets.get(day)?.count || 0 })
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return result
}
