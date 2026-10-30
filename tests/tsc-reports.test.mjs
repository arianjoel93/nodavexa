import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const temp = await mkdtemp(path.join(tmpdir(), 'nodavexa-tsc-'))
await build({ entryPoints: ['src/lib/tsc-reports.ts'], outfile: path.join(temp, 'parser.mjs'), bundle: true, platform: 'node', format: 'esm', logLevel: 'silent' })
await build({ entryPoints: ['src/lib/tsc-reports-analytics.ts'], outfile: path.join(temp, 'analytics.mjs'), bundle: true, platform: 'node', format: 'esm', logLevel: 'silent' })
const { parseTscCsv, compareTscRows } = await import(pathToFileURL(path.join(temp, 'parser.mjs')).href)
const { aggregateTscTrend, calculateTscAnalytics, comparableReportFamily, findPreviousComparableUpload } = await import(pathToFileURL(path.join(temp, 'analytics.mjs')).href)
const bytes = text => new TextEncoder().encode(text).buffer
test('interpreta CSV UTF-8 separado por coma, comillas y campos con coma', () => {
  const parsed = parseTscCsv('LOG.CSV', bytes('FOLIO,FECHA,DESCRIPCION,PESO NETO\n12,2026-10-27,"Caja, grande",1.25\n'))
  assert.equal(parsed.delimiter, ',')
  assert.equal(parsed.encoding, 'utf-8')
  assert.equal(parsed.solution, 'basculas')
  assert.equal(parsed.rows[0].raw.DESCRIPCION, 'Caja, grande')
  assert.equal(parsed.rows[0].normalized.peso_neto, 1.25)
  assert.equal(parsed.rows[0].normalized.fecha, '2026-10-27')
})
test('interpreta separador punto y coma, decimal con coma y fechas día/mes/año', () => {
  const parsed = parseTscCsv('REP.CSV', bytes('Folio;Fecha;Placa;Total\n1;27/10/2026;JAL-123;1250,75\n'))
  assert.equal(parsed.delimiter, ';')
  assert.equal(parsed.solution, 'estacionamiento')
  assert.equal(parsed.rows[0].normalized.total, 1250.75)
  assert.equal(parsed.rows[0].normalized.fecha, '2026-10-27')
})
test('usa Windows-1252 cuando el archivo no es UTF-8 válido', () => {
  const source = Uint8Array.from([0x50,0x52,0x4f,0x44,0x55,0x43,0x54,0x4f,0x3b,0x44,0x45,0x53,0x43,0x52,0x49,0x50,0x43,0x49,0x4f,0x4e,0x0a,0x31,0x3b,0x43,0x61,0x66,0xe9])
  const parsed = parseTscCsv('REPIND.CSV', source.buffer)
  assert.equal(parsed.encoding, 'windows-1252')
  assert.equal(parsed.rows[0].normalized.producto, '1')
  assert.equal(parsed.rows[0].normalized.descripcion, 'Café')
})
test('advierte filas en blanco, encabezados duplicados y filas con columnas faltantes', () => {
  const parsed = parseTscCsv('HISTO.CSV', bytes('\nCODIGO,CODIGO,FECHA\nA,A2,27/10/2026\nB\n'))
  assert.ok(parsed.warnings.some(w => w.code === 'blank_leading_row'))
  assert.ok(parsed.warnings.some(w => w.code === 'duplicate_header'))
  assert.ok(parsed.warnings.some(w => w.code === 'duplicate_mapping'))
  assert.ok(parsed.warnings.some(w => w.code === 'column_count' && w.rowNumber === 4))
  assert.equal(parsed.rows.length, 2)
  assert.equal(parsed.rows[0].raw['CODIGO [2]'], 'A2')
})
test('mantiene filas de registros repetidos y los identifica en advertencias', () => {
  const parsed = parseTscCsv('BDHISTO.CSV', bytes('FOLIO,FECHA,HORA,CODIGO,EVENTO\n1,27/10/2026,08:00,X,ENTRADA\n1,27/10/2026,08:00,X,ENTRADA\n'))
  assert.equal(parsed.rows.length, 2)
  assert.ok(parsed.warnings.some(w => w.code === 'duplicate_row'))
})
test('clasifica acumulativo y cuenta agregados, faltantes, repetidos y cambios', () => {
  const base = parseTscCsv('REP.CSV', bytes('FOLIO,FECHA,CODIGO,EVENTO,TOTAL\n1,2026-10-01,A,VENTA,10\n2,2026-10-02,B,VENTA,20\n')).rows
  const next = parseTscCsv('REP.CSV', bytes('FOLIO,FECHA,CODIGO,EVENTO,TOTAL\n1,2026-10-01,A,VENTA,12\n2,2026-10-02,B,VENTA,20\n3,2026-10-03,C,VENTA,30\n')).rows
  const result = compareTscRows(base, next)
  assert.equal(result.classification, 'acumulativo')
  assert.equal(result.added, 1)
  assert.equal(result.missing, 0)
  assert.equal(result.repeated, 2)
  assert.equal(result.changed, 1)
})
test('calcula KPIs de báscula y suma peso por producto, lote y operador', () => {
  const rows = parseTscCsv('BDHISTO.CSV', bytes('FECHA,FOLIO,PRODUCTO,LOTE,OPERADOR,PESO NETO,PESO BRUTO,TARA\n2026-10-01,1,Mango,A,Joel,2.5,2.9,0.4\n2026-10-01,2,Mango,B,Ana,2.75,3.1,0.35\n')).rows
  const report = calculateTscAnalytics(rows, 'basculas')
  const kpi = key => report.metrics.find(item => item.key === key)?.value
  assert.equal(kpi('weight_total'), 5.25)
  assert.equal(kpi('weight_average'), 2.625)
  assert.equal(kpi('weight_min'), 2.5)
  assert.equal(kpi('weight_max'), 2.75)
  assert.equal(kpi('tare_total'), 0.75)
  assert.equal(report.groups.find(g => g.title === 'Kilos por producto').rows[0].value, 5.25)
  assert.equal(report.daily[0].value, 5.25)
  assert.equal(report.metrics.find(item => item.key === 'net_yield').value, 87.5)
  assert.equal(report.metrics.find(item => item.key === 'tare_pct').value, 12.5)
})
test('agrupa pesajes por semana empezando el lunes', () => {
  const rows = parseTscCsv('BDHISTO.CSV', bytes('FECHA,FOLIO,PESO NETO\n2026-10-26,1,4\n2026-10-27,2,6\n2026-11-02,3,5\n')).rows
  assert.deepEqual(aggregateTscTrend(rows, '__weight__', 'weekly'), [
    { period:'2026-10-26', records:2, value:10 },
    { period:'2026-11-02', records:1, value:5 },
  ])
  assert.deepEqual(aggregateTscTrend(rows, '__weight__', 'monthly'), [
    { period:'2026-10-01', records:2, value:10 },
    { period:'2026-11-01', records:1, value:5 },
  ])
})
test('compara solo el reporte anterior de la misma solución y familia', () => {
  assert.equal(comparableReportFamily('BDHISTO3.CSV'), 'BDHISTO')
  const current = { id:'new',original_name:'BDHISTO3.CSV',solution_type:'basculas',uploaded_at:'2026-10-03T10:00:00Z',validation_status:'valid' }
  const candidates = [
    { ...current,id:'older',original_name:'BDHISTO.CSV',uploaded_at:'2026-10-01T10:00:00Z' },
    { ...current,id:'latest',original_name:'BDHISTO1.CSV',uploaded_at:'2026-10-02T10:00:00Z' },
    { ...current,id:'other-family',original_name:'BDHISF1.CSV',uploaded_at:'2026-10-02T11:00:00Z' },
    { ...current,id:'other-solution',solution_type:'generico',uploaded_at:'2026-10-02T12:00:00Z' },
  ]
  assert.equal(findPreviousComparableUpload(current,candidates)?.id,'latest')
})
test.after(async () => { await rm(temp, { recursive: true, force: true }) })
