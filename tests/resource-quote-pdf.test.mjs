import test from 'node:test'
import assert from 'node:assert/strict'
import { createQuotePdf, quoteTotals } from '../src/lib/resource-quote-pdf.ts'

const lines = [{ description: 'Consultoría operativa', quantity: 2, price: 500, unit: 'Hora' }]
const input = { company: 'Empresa de prueba', email: 'prueba@example.com', client: 'Cliente', logo: '', currency: 'MXN', number: 'TEST-001', validUntil: '2026-12-01', discount: 10, tax: 16, notes: 'Condiciones de prueba', lines }
test('subtotal, descuento e IVA coinciden con el total', () => {
  assert.deepEqual(quoteTotals(lines, 10, 16), { subtotal: 1000, discountAmount: 100, net: 900, vat: 144, total: 1044 })
  assert.equal(quoteTotals(lines, 0, 0).total, 1000)
  assert.throws(() => quoteTotals(lines, 101, 16))
})
test('PDF contiene subtotal, IVA y total calculado', async () => {
  const { blob } = await createQuotePdf(input)
  assert.equal(blob.type, 'application/pdf')
  const content = await blob.text()
  assert.ok(content.startsWith('%PDF-'))
  for (const label of ['Subtotal:', 'IVA', '1,044.00']) assert.ok(content.includes(label), label)
})
test('logotipo inválido no impide generar la cotización', async () => {
  const result = await createQuotePdf({ ...input, logo: 'data:image/png;base64,invalid' })
  assert.equal(result.logoSkipped, true)
  assert.ok(result.blob.size > 0)
})
test('PDF extenso y USD funcionan sin almacenar documentos localmente', async () => {
  const { blob } = await createQuotePdf({ ...input, currency: 'USD', lines: Array.from({ length: 100 }, () => lines[0]) })
  const content = await blob.text()
  assert.ok((content.match(/\/Type \/Page\b/g) || []).length > 1)
})
