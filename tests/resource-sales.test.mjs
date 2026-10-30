import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { pathToFileURL } from 'node:url'
import path from 'node:path'
import { salesSummary, dailySales } from '../src/lib/resource-sales-metrics.ts'

const sale = { id: 'one', client_name: 'Cliente prueba', phone: '33 3000 0000', company: '', notes: 'Notas', amount: 100.50, created_at: '2026-10-23T18:00:00Z' }
test('totales y clientes únicos no duplican formatos del mismo teléfono', () => {
  assert.deepEqual(salesSummary([sale, { ...sale, id: 'two', phone: '3330000000', amount: 200 }]), { total: 300.5, count: 2, clients: 1, average: 150.25 })
  assert.deepEqual(salesSummary([]), { total: 0, count: 0, clients: 0, average: 0 })
})
test('gráfica diaria incluye días vacíos y agrupa en Ciudad de México', () => {
  const days = dailySales([{ ...sale, created_at: '2026-10-24T02:00:00Z' }], '2026-10-22T12:00:00Z', '2026-10-25T12:00:00Z')
  assert.equal(days.length, 4)
  assert.equal(days[0].amount, 0)
  assert.equal(days[1].day, '2026-10-23')
  assert.equal(days[1].amount, 100.5)
  assert.equal(days[1].count, 1)
})
test('reporte PDF multipágina conserva clientes y sus importes', async () => {
  const outfile = path.resolve('output/verification/resource-sales-pdf.mjs')
  await build({ entryPoints: ['src/lib/resource-sales-pdf.ts'], outfile, bundle: true, platform: 'node', format: 'esm', packages: 'external', logLevel: 'silent' })
  const { createSalesReport } = await import(pathToFileURL(outfile).href)
  const blob = createSalesReport({ period: { started_at: '2026-10-23T12:00:00Z', ends_at: '2026-11-23T12:00:00Z' }, sales: Array.from({ length: 100 }, (_, index) => ({ ...sale, id: String(index), notes: 'Un detalle de venta extenso. '.repeat(30) })) })
  const content = await blob.text()
  assert.equal(blob.type, 'application/pdf')
  assert.ok(content.startsWith('%PDF-'))
  assert.ok(content.includes('Cliente prueba'))
  assert.ok(content.includes('10,050.00'))
  assert.ok((content.match(/\/Type \/Page\b/g) || []).length > 1)
})
