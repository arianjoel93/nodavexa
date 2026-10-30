export type QuotePdfLine = { description: string; quantity: number; price: number; unit: string }
export type QuotePdfInput = { company: string; email: string; client: string; logo: string; currency: string; number: string; validUntil: string; discount: number; tax: number; notes: string; lines: QuotePdfLine[] }
const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100
export function quoteTotals(lines: QuotePdfLine[], discount: number, tax: number) {
  if (![discount, tax].every(value => Number.isFinite(value) && value >= 0 && value <= 100) || !lines.length || lines.some(line => !line.description.trim() || !Number.isFinite(line.quantity) || line.quantity <= 0 || !Number.isFinite(line.price) || line.price < 0)) throw new Error('Revisa las cantidades, precios, IVA y descuento.')
  const subtotal = round(lines.reduce((sum, line) => sum + round(line.quantity * line.price), 0))
  const discountAmount = round(subtotal * discount / 100)
  const net = round(subtotal - discountAmount)
  const vat = round(net * tax / 100)
  const total = round(net + vat)
  if (!Number.isFinite(total)) throw new Error('Revisa los importes de la cotización.')
  return { subtotal, discountAmount, net, vat, total }
}
export function createQuotePdf(input: QuotePdfInput) {
  const totals = quoteTotals(input.lines, input.discount, input.tax)
  const pdf = new jsPDF()
  const money = (value: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: input.currency }).format(value)
  let y = 22
  const brown = [111, 65, 47] as const
  const rule = () => { pdf.setDrawColor(224, 216, 209); pdf.line(18, y, 192, y) }
  function text(value: string, size = 10) {
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(size); pdf.setTextColor(55, 46, 40)
    for (const row of pdf.splitTextToSize(value, 172) as string[]) {
      if (y > 268) { pdf.addPage(); y = 24 }
      pdf.text(row, 18, y); y += size * .45 + 2
    }
    y += 3
  }
  pdf.setFillColor(...brown); pdf.rect(0, 0, 210, 7, 'F')
  pdf.setTextColor(...brown); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(25)
  pdf.text('Cotización', 18, y)
  y += 10
  text(input.number, 12)
  let logoSkipped = false
  if (input.logo) {
    try {
      const image = pdf.getImageProperties(input.logo)
      const scale = Math.min(35 / image.width, 22 / image.height)
      pdf.addImage(input.logo, 192 - image.width * scale, 17, image.width * scale, image.height * scale)
    } catch { logoSkipped = true }
  }
  y = Math.max(y, 48)
  text(input.company, 14); text(input.email)
  rule(); y += 9
  text(`Preparada para: ${input.client}`, 11)
  text(`Emisión: ${new Date().toLocaleDateString('es-MX')}    Vigencia: ${input.validUntil}    Moneda: ${input.currency}`, 9)
  y += 5
  function tableHead() {
    pdf.setFillColor(...brown); pdf.rect(18, y, 174, 10, 'F')
    pdf.setTextColor(255, 255, 255); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9)
    pdf.text('Producto / servicio', 21, y + 6.5)
    pdf.text('Cant.', 111, y + 6.5, { align: 'right' })
    pdf.text('Unidad', 116, y + 6.5)
    pdf.text('Precio unitario', 158, y + 6.5, { align: 'right' })
    pdf.text('Importe', 189, y + 6.5, { align: 'right' })
    y += 10
  }
  tableHead()
  input.lines.forEach((line, index) => {
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9)
    const wrapped = pdf.splitTextToSize(line.description, 77) as string[]
    let offset = 0
    while (offset < wrapped.length) {
      if (y > 251) { pdf.addPage(); y = 22; tableHead() }
      const available = Math.max(1, Math.floor((264 - y - 6) / 4.5))
      const chunk = wrapped.slice(offset, offset + available)
      const height = Math.max(12, chunk.length * 4.5 + 6)
      if (index % 2 === 0) pdf.setFillColor(248, 245, 241)
      else pdf.setFillColor(255, 255, 255)
      pdf.rect(18, y, 174, height, 'F')
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor(55, 46, 40)
      pdf.text(chunk, 21, y + 6, { lineHeightFactor: 1.42 })
      if (offset === 0) {
        pdf.text(String(line.quantity), 111, y + 6, { align: 'right' })
        pdf.text(line.unit, 116, y + 6)
        pdf.setFontSize(8)
        pdf.text(money(line.price), 158, y + 6, { align: 'right' })
        pdf.text(money(round(line.quantity * line.price)), 189, y + 6, { align: 'right' })
      }
      y += height; rule(); offset += chunk.length
      if (offset < wrapped.length) { pdf.addPage(); y = 22; tableHead() }
    }
  })
  y += 9
  const totalsHeight = 34 + (input.discount > 0 ? 18 : 0) + (input.tax > 0 ? 9 : 0)
  if (y + totalsHeight > 270) { pdf.addPage(); y = 24 }
  function totalRow(label: string, value: number) {
    pdf.setFontSize(10); pdf.setTextColor(55, 46, 40)
    pdf.text(label, 110, y); pdf.text(money(value), 189, y, { align: 'right' }); y += 9
  }
  totalRow('Subtotal:', totals.subtotal)
  if (input.discount > 0) { totalRow(`Descuento (${input.discount}%):`, totals.discountAmount); totalRow('Subtotal con descuento:', totals.net) }
  if (input.tax > 0) totalRow(`IVA (${input.tax}%):`, totals.vat)
  pdf.setFillColor(...brown); pdf.rect(106, y - 3, 86, 13, 'F')
  pdf.setTextColor(255, 255, 255); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11)
  pdf.text('Total', 110, y + 5); pdf.text(`${money(totals.total)} ${input.currency}`, 189, y + 5, { align: 'right' })
  y += 24
  if (input.notes.trim()) { text('Condiciones y notas', 12); text(input.notes) }
  const pageCount = pdf.getNumberOfPages()
  for (let page = 1; page <= pageCount; page++) {
    pdf.setPage(page); pdf.setDrawColor(224, 216, 209); pdf.line(18, 280, 192, 280)
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(125, 113, 104)
    pdf.text('Propuesta comercial. No es una factura fiscal.', 18, 286)
    pdf.text(`${page} / ${pageCount}`, 192, 286, { align: 'right' })
  }
  return { blob: new Blob([pdf.output('arraybuffer')], { type: 'application/pdf' }), logoSkipped }
}
import { jsPDF } from 'jspdf'

