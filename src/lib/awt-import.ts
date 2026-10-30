import type { SqlJsStatic } from 'sql.js'

export const AWT_HEADERS = ['PLU', 'Descripción', 'Peso por pieza'] as const
const PLU_COLUMNS = ['id', 'upc', 'name', 'desc1', 'desc2', 'desc3', 'localTare', 'scale2Tare', 'scale3Tare', 'scale4Tare', 'scale5Tare', 'pcwt', 'pcwtVariance', 'pcwtUncert', 'uom', 'resampleTimer', 'lastSampleTime'] as const

export type AwtCell = string | number | boolean | Date | null
export type AwtSheet = { name: string; rows: AwtCell[][]; rowNumbers: number[] }
export type AwtIssue = { row: number; field: string; message: string }
export type AwtProduct = { row: number; id: string; desc1: string; pcwt: number }
export type AwtDuplicate = { id: string; rows: { row: number; description: AwtCell; weight: AwtCell }[] }
export type AwtReview = {
  products: AwtProduct[]
  preview: { row: number; cells: AwtCell[] }[]
  issues: AwtIssue[]
  duplicates: AwtDuplicate[]
  total: number
  uniquePlu: number
}

function csvRows(text: string): AwtSheet {
  const source = text.replace(/^\uFEFF/, '')
  const firstLine = source.match(/^[^\r\n]*/)?.[0] ?? ''
  const counts = [',', ';'].map((separator) => {
    let quoted = false
    let count = 0
    for (let index = 0; index < firstLine.length; index += 1) {
      if (firstLine[index] === '"') {
        if (quoted && firstLine[index + 1] === '"') index += 1
        else quoted = !quoted
      } else if (!quoted && firstLine[index] === separator) count += 1
    }
    return count
  })
  const separator = counts[1] > counts[0] ? ';' : ','
  const rows: AwtCell[][] = []
  const rowNumbers: number[] = []
  let cells: AwtCell[] = []
  let value = ''
  let quoted = false
  let closedQuote = false
  let line = 1
  let rowStart = 1

  const finishRow = () => {
    cells.push(value)
    rows.push(cells)
    rowNumbers.push(rowStart)
    cells = []
    value = ''
    closedQuote = false
  }

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') { value += '"'; index += 1 }
        else { quoted = false; closedQuote = true }
      } else {
        value += char
        if (char === '\n') line += 1
      }
    } else if (char === '"') {
      if (value || closedQuote) throw new Error(`El CSV tiene comillas incorrectas en la fila ${rowStart}.`)
      quoted = true
    } else if (char === separator) {
      cells.push(value)
      value = ''
      closedQuote = false
    } else if (char === '\n' || char === '\r') {
      finishRow()
      if (char === '\r' && source[index + 1] === '\n') index += 1
      line += 1
      rowStart = line
    } else {
      if (closedQuote && char !== ' ' && char !== '\t') throw new Error(`El CSV tiene texto después de las comillas en la fila ${rowStart}.`)
      if (!closedQuote) value += char
    }
  }
  if (quoted) throw new Error('El CSV contiene comillas sin cerrar.')
  if (cells.length || value || !rows.length) finishRow()
  return { name: 'CSV', rows, rowNumbers }
}

function excelCell(value: unknown): AwtCell {
  if (value === null || value === undefined) return null
  if (value instanceof Date || ['string', 'number', 'boolean'].includes(typeof value)) return value as AwtCell
  if (typeof value === 'object') {
    const cell = value as { result?: unknown; text?: unknown; richText?: Array<{ text?: string }>; error?: unknown }
    if ('result' in cell) return excelCell(cell.result)
    if (Array.isArray(cell.richText)) return cell.richText.map((part) => part.text ?? '').join('')
    if ('text' in cell) return String(cell.text ?? '')
    if ('error' in cell) return String(cell.error ?? '')
  }
  return String(value)
}

export async function readAwtFile(file: File): Promise<AwtSheet[]> {
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (extension !== 'csv' && extension !== 'xlsx') throw new Error('Solo se aceptan archivos Excel (.xlsx) y CSV (.csv).')
  const bytes = await file.arrayBuffer()
  if (extension === 'csv') {
    let text: string
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes) }
    catch { throw new Error('El CSV debe estar codificado en UTF-8.') }
    return [csvRows(text)]
  }

  const [{ default: ExcelJS }, { default: JSZip }] = await Promise.all([import('exceljs'), import('jszip')])
  let archive: import('jszip')
  try { archive = await JSZip.loadAsync(bytes) }
  catch { throw new Error('El archivo .xlsx no es un libro de Excel válido.') }
  const workbookFile = archive.file('xl/workbook.xml')
  if (!workbookFile) throw new Error('El archivo .xlsx no contiene un libro de Excel válido.')
  const workbookXml = await workbookFile.async('string')
  let workbookData: ArrayBuffer = bytes
  if (/<x:workbook\b/.test(workbookXml)) {
    const xmlFiles = Object.keys(archive.files).filter((path) => path.startsWith('xl/') && path.endsWith('.xml'))
    await Promise.all(xmlFiles.map(async (path) => {
      const entry = archive.file(path)
      if (!entry) return
      const xml = await entry.async('string')
      archive.file(path, xml.replace(/<x:/g, '<').replace(/<\/x:/g, '</'))
    }))
    workbookData = await archive.generateAsync({ type: 'arraybuffer' })
  }
  const workbook = new ExcelJS.Workbook()
  try { await workbook.xlsx.load(workbookData) }
  catch { throw new Error('No se pudo leer el Excel. Comprueba que no esté dañado o protegido.') }
  return workbook.worksheets.map((worksheet) => {
    const rows: AwtCell[][] = []
    const rowNumbers: number[] = []
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      const values = row.values as unknown[]
      const cells = Array.from({ length: Math.max(0, values.length - 1) }, (_, index) => excelCell(values[index + 1]))
      if (typeof cells[0] === 'number' && /^0+$/.test(row.getCell(1).numFmt)) {
        cells[0] = String(cells[0]).padStart(row.getCell(1).numFmt.length, '0')
      }
      rows.push(cells)
      rowNumbers.push(row.number)
    })
    return { name: worksheet.name, rows, rowNumbers }
  }).filter((sheet) => sheet.rows.length > 0)
}

const present = (value: AwtCell) => value !== null && value !== undefined && String(value).trim() !== ''

function canonicalDecimal(value: string) {
  const [integer, fraction = ''] = value.replace(',', '.').split('.')
  const whole = (integer || '0').replace(/^0+(?=\d)/, '')
  const decimals = fraction.replace(/0+$/, '')
  return decimals ? `${whole}.${decimals}` : whole
}

function canonicalNumber(value: number) {
  const text = String(value)
  if (!text.includes('e')) return canonicalDecimal(text)
  const [mantissa, exponentText] = text.split('e')
  const digits = mantissa.replace('.', '')
  const point = (mantissa.includes('.') ? mantissa.indexOf('.') : mantissa.length) + Number(exponentText)
  const expanded = point <= 0 ? `0.${'0'.repeat(-point)}${digits}`
    : point >= digits.length ? `${digits}${'0'.repeat(point - digits.length)}`
      : `${digits.slice(0, point)}.${digits.slice(point)}`
  return canonicalDecimal(expanded)
}

export function validateAwtSheets(sheets: AwtSheet[], selectedRows: ReadonlyMap<string, number> = new Map()): AwtReview {
  const review: AwtReview = { products: [], preview: [], issues: [], duplicates: [], total: 0, uniquePlu: 0 }
  if (sheets.length !== 1) {
    review.issues.push({ row: 1, field: 'Archivo', message: sheets.length ? 'El Excel debe contener una sola hoja con datos.' : 'El archivo no contiene una hoja con datos.' })
    return review
  }
  const sheet = sheets[0]
  const headers = sheet.rows[0] ?? []
  if (sheet.rowNumbers[0] !== 1) review.issues.push({ row: 1, field: 'Encabezados', message: 'Los encabezados deben estar en la primera fila.' })
  if (headers.length !== 3) review.issues.push({ row: sheet.rowNumbers[0] ?? 1, field: 'Encabezados', message: 'Se requieren exactamente tres columnas, sin columnas adicionales.' })
  AWT_HEADERS.forEach((header, index) => {
    if (String(headers[index] ?? '').trim() !== header) review.issues.push({ row: sheet.rowNumbers[0] ?? 1, field: header, message: `La columna ${index + 1} debe llamarse exactamente "${header}".` })
  })
  if (review.issues.length) return review

  const occurrences = new Map<string, AwtDuplicate['rows']>()
  const validProducts = new Map<number, AwtProduct>()
  sheet.rows.slice(1).forEach((cells, index) => {
    if (!cells.some(present)) return
    const row = sheet.rowNumbers[index + 1] ?? index + 2
    review.total += 1
    if (review.preview.length < 10) review.preview.push({ row, cells })
    if (cells.length !== 3) review.issues.push({ row, field: 'Columnas', message: 'La fila debe tener exactamente tres columnas.' })

    const rawId = cells[0]
    const id = typeof rawId === 'string' || typeof rawId === 'number' ? String(rawId) : ''
    if (!id.trim()) review.issues.push({ row, field: 'PLU', message: 'El PLU es obligatorio.' })
    else {
      const entries = occurrences.get(id) ?? []
      entries.push({ row, description: cells[1] ?? null, weight: cells[2] ?? null })
      occurrences.set(id, entries)
    }

    const description = cells[1]
    if (typeof description !== 'string' || !description.trim()) review.issues.push({ row, field: 'Descripción', message: 'La descripción es obligatoria y debe ser texto.' })

    const rawWeight = cells[2]
    const weightText = typeof rawWeight === 'number' || typeof rawWeight === 'string' ? String(rawWeight).trim() : ''
    const validDecimal = /^(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(weightText)
    const weight = validDecimal ? Number(weightText.replace(',', '.')) : NaN
    const precise = validDecimal && Number.isFinite(weight) && canonicalDecimal(weightText) === canonicalNumber(weight)
    if (!validDecimal || !Number.isFinite(weight) || weight <= 0) {
      review.issues.push({ row, field: 'Peso por pieza', message: 'Escribe un número decimal positivo en kg, mayor que cero.' })
    } else if (!precise) {
      review.issues.push({ row, field: 'Peso por pieza', message: 'El peso tiene más precisión decimal de la que SQLite puede representar sin redondear.' })
    }
    if (cells.length === 3 && id.trim() && typeof description === 'string' && description.trim() && precise && weight > 0) {
      validProducts.set(row, { row, id, desc1: description, pcwt: weight })
    }
  })
  review.uniquePlu = occurrences.size
  for (const [id, rows] of occurrences) {
    if (rows.length > 1) review.duplicates.push({ id, rows })
    const selectedRow = rows.length === 1 ? rows[0].row : selectedRows.get(id)
    if (selectedRow === undefined || !rows.some((entry) => entry.row === selectedRow)) {
      review.issues.push({ row: rows[0].row, field: 'PLU', message: `El PLU "${id}" aparece en ${rows.length} filas. Selecciona cuál conservar.` })
    } else {
      const product = validProducts.get(selectedRow)
      if (product) review.products.push(product)
    }
  }
  if (!review.total) review.issues.push({ row: 2, field: 'Productos', message: 'El archivo no contiene productos.' })
  return review
}

function queryValue(db: import('sql.js').Database, sql: string) {
  return db.exec(sql)[0]?.values[0]?.[0]
}

export function createAwtDatabase(SQL: SqlJsStatic, template: Uint8Array, products: AwtProduct[]): Uint8Array {
  if (!products.length) throw new Error('No hay productos válidos para generar AWT.DB.')
  if (new Set(products.map((product) => product.id)).size !== products.length) throw new Error('Selecciona un solo registro por cada PLU duplicado.')
  const db = new SQL.Database(template)
  let transaction = false
  try {
    if (queryValue(db, 'PRAGMA integrity_check') !== 'ok') throw new Error('La plantilla AWT no supera la verificación de integridad.')
    const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")[0]?.values.map(([name]) => String(name)) ?? []
    if (tables.length !== 16 || !tables.includes('tblPlu')) throw new Error('La plantilla AWT debe contener exactamente 16 tablas, incluida tblPlu.')
    const columns = db.exec('PRAGMA table_info("tblPlu")')[0]?.values.map((value) => String(value[1])) ?? []
    if (columns.length !== PLU_COLUMNS.length || columns.some((name, index) => name !== PLU_COLUMNS[index])) throw new Error('La tabla tblPlu no tiene las 17 columnas esperadas.')
    const schema = JSON.stringify(db.exec("SELECT type, name, tbl_name, sql FROM sqlite_master ORDER BY type, name"))
    const otherTables = tables.filter((name) => name !== 'tblPlu')
    const original = otherTables.map((name) => JSON.stringify(db.exec(`SELECT * FROM "${name.replace(/"/g, '""')}"`)))
    db.run('BEGIN TRANSACTION')
    transaction = true
    db.run('DELETE FROM "tblPlu"')
    const statement = db.prepare(`INSERT INTO "tblPlu" (${PLU_COLUMNS.map((name) => `"${name}"`).join(', ')}) VALUES (${PLU_COLUMNS.map(() => '?').join(', ')})`)
    try {
      for (const product of products) {
        statement.run([product.id, '', '', product.desc1, '', '', 0, 0, 0, 0, 0, product.pcwt, 0, 0, 'kg', 0, 0])
      }
    } finally { statement.free() }
    if (queryValue(db, 'PRAGMA integrity_check') !== 'ok') throw new Error('La base generada no supera la verificación de integridad SQLite.')
    if (Number(queryValue(db, 'SELECT COUNT(*) FROM "tblPlu"')) !== products.length) throw new Error('La cantidad de PLU en SQLite no coincide con el archivo validado.')
    if (JSON.stringify(db.exec("SELECT type, name, tbl_name, sql FROM sqlite_master ORDER BY type, name")) !== schema || otherTables.some((name, index) => JSON.stringify(db.exec(`SELECT * FROM "${name.replace(/"/g, '""')}"`)) !== original[index])) {
      throw new Error('Una tabla ajena a tblPlu cambió durante la conversión.')
    }
    db.run('COMMIT')
    transaction = false
    return db.export()
  } catch (error) {
    if (transaction) {
      try { db.run('ROLLBACK') } catch { /* Keep the original conversion error. */ }
    }
    throw error
  } finally { db.close() }
}
