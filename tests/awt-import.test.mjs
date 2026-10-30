import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ExcelJS from 'exceljs'
import initSqlJs from 'sql.js'
import { AWT_HEADERS, createAwtDatabase, readAwtFile, validateAwtSheets } from '../src/lib/awt-import.ts'

const template = new Uint8Array(readFileSync(new URL('../public/resources/awt-template.db', import.meta.url)))
const SQL = await initSqlJs()
const csv = (body, name = 'productos.csv') => new File([body], name)
const review = async (file) => validateAwtSheets(await readAwtFile(file))

async function excel(rows, extraSheet = false) {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Cualquier nombre')
  rows.forEach((row) => sheet.addRow(row))
  if (extraSheet) workbook.addWorksheet('Otra hoja').addRow(AWT_HEADERS)
  return new File([await workbook.xlsx.writeBuffer()], 'productos.xlsx')
}

test('A: Excel correcto con encabezados recortados y hoja arbitraria', async () => {
  const result = await review(await excel([['PLU', 'Descripción ', 'Peso por pieza '], ['0007', 'Descripción áé', 0.001]]))
  assert.equal(result.issues.length, 0)
  assert.deepEqual(result.products[0], { row: 2, id: '0007', desc1: 'Descripción áé', pcwt: 0.001 })
})

test('B: CSV UTF-8 con BOM y delimitador punto y coma', async () => {
  const result = await review(csv('\uFEFFPLU;Descripción;Peso por pieza\r\nAB-1;Módulo;0,002\r\n'))
  assert.equal(result.issues.length, 0)
  assert.equal(result.products[0].pcwt, 0.002)
})

test('C y D: rechaza columnas sobrantes y faltantes', async () => {
  for (const input of ['PLU,Descripción,Peso por pieza,Extra\nA,x,1,y', 'PLU,Descripción\nA,x']) {
    const result = await review(csv(input))
    assert.ok(result.issues.some((issue) => issue.field === 'Encabezados'))
  }
})

test('E: permite elegir una fila de cada PLU duplicado', async () => {
  const sheets = await readAwtFile(csv('PLU,Descripción,Peso por pieza\nA,x,1\nA,y,2\nB,z,3'))
  const pending = validateAwtSheets(sheets)
  assert.deepEqual(pending.duplicates[0].rows.map(({ row }) => row), [2, 3])
  assert.match(pending.issues.find((issue) => issue.field === 'PLU')?.message ?? '', /Selecciona cuál conservar/)
  const selected = validateAwtSheets(sheets, new Map([['A', 3]]))
  assert.equal(selected.issues.length, 0)
  assert.equal(selected.uniquePlu, 2)
  assert.deepEqual(selected.products.map(({ row, id, desc1 }) => ({ row, id, desc1 })), [
    { row: 3, id: 'A', desc1: 'y' }, { row: 4, id: 'B', desc1: 'z' },
  ])
  assert.deepEqual(validateAwtSheets(sheets, new Map([['A', 99]])).issues.map(({ field }) => field), ['PLU'])
})

test('F: rechaza pesos negativos, cero, vacíos e inválidos', async () => {
  const result = await review(csv('PLU,Descripción,Peso por pieza\nA,x,-1\nB,x,0\nC,x,\nD,x,NaN\nE,x,Infinity'))
  assert.equal(result.issues.filter((issue) => issue.field === 'Peso por pieza').length, 5)
})

test('rechaza pesos que perderían dígitos al convertirse a DOUBLE', async () => {
  const result = await review(csv('PLU,Descripción,Peso por pieza\nA,x,2.3456789012345678'))
  assert.match(result.issues.find((issue) => issue.field === 'Peso por pieza')?.message ?? '', /precisión/)
})

test('G y H: conserva guiones y ceros iniciales', async () => {
  const result = await review(csv('PLU,Descripción,Peso por pieza\nAB-07,x,1\n0007,y,0.25\n"M16878/1-BEB-0",z,3\n"COD #1 con espacio",w,4\n"O\'Brien, México",v,5'))
  assert.equal(result.issues.length, 0)
  assert.deepEqual(result.products.map((product) => product.id), ['AB-07', '0007', 'M16878/1-BEB-0', 'COD #1 con espacio', "O'Brien, México"])
})

test('I: rechaza archivo vacío, hoja adicional y formato incorrecto', async () => {
  assert.ok((await review(csv(''))).issues.length)
  assert.ok((await review(await excel([AWT_HEADERS, ['A', 'x', 1]], true))).issues.length)
  await assert.rejects(readAwtFile(csv('PLU,Descripción,Peso por pieza', 'productos.pdf')), /Solo se aceptan/)
  await assert.rejects(readAwtFile(new File(['no es excel'], 'productos.xlsx')), /válido/)
})

test('J, K y L: SQLite íntegra, solo tblPlu cambia y recuento coincide', async () => {
  const products = (await review(csv('PLU,Descripción,Peso por pieza\n0007,área y pieza,0.001\nA-8,Producto especial,2.3456789\n"Código / # y espacios",Otro producto,1.5'))).products
  const result = createAwtDatabase(SQL, template, products)
  const source = new SQL.Database(template)
  const output = new SQL.Database(result)
  try {
    assert.equal(output.exec('PRAGMA integrity_check')[0].values[0][0], 'ok')
    assert.deepEqual(output.exec("SELECT type,name,tbl_name,sql FROM sqlite_master ORDER BY type,name"), source.exec("SELECT type,name,tbl_name,sql FROM sqlite_master ORDER BY type,name"))
    const tables = source.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")[0].values.map(([name]) => String(name))
    assert.equal(tables.length, 16)
    for (const table of tables.filter((name) => name !== 'tblPlu')) {
      assert.deepEqual(output.exec(`SELECT * FROM "${table}"`), source.exec(`SELECT * FROM "${table}"`), table)
    }
    assert.equal(output.exec('SELECT COUNT(*) FROM tblPlu')[0].values[0][0], products.length)
    assert.deepEqual(output.exec('SELECT id,desc1,pcwt,uom,upc,localTare FROM tblPlu ORDER BY id')[0].values, [
      ['0007', 'área y pieza', 0.001, 'kg', '', 0],
      ['A-8', 'Producto especial', 2.3456789, 'kg', '', 0],
      ['Código / # y espacios', 'Otro producto', 1.5, 'kg', '', 0],
    ])
  } finally { source.close(); output.close() }
})

test('Excel adjunto: acepta PLU libres y permite resolver el duplicado', async () => {
  const bytes = readFileSync('C:/Users/Johana/Downloads/bd-ejemplo.xlsx')
  const sheets = await readAwtFile(new File([bytes], 'bd-ejemplo.xlsx'))
  const result = validateAwtSheets(sheets)
  assert.equal(result.total, 856)
  assert.equal(result.issues.length, 1)
  assert.deepEqual(result.duplicates.map(({ id }) => id), ['A0611'])
  assert.ok(result.products.some(({ id }) => id === 'M16878/1-BEB-0'))
  const selected = validateAwtSheets(sheets, new Map([['A0611', 781]]))
  assert.equal(selected.issues.length, 0)
  assert.equal(selected.products.length, 855)
  assert.equal(selected.products.find(({ id }) => id === 'A0611')?.row, 781)
})
