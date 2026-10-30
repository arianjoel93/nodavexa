import { jsPDF } from 'jspdf'
import { salesMoney, salesSummary, type SalesWorkspace } from './resource-sales-metrics'

export function createSalesReport(workspace: SalesWorkspace) {
  const pdf = new jsPDF()
  const summary = salesSummary(workspace.sales)
  let y = 24
  const text = (value: string, size = 10) => {
    pdf.setFontSize(size)
    for (const line of pdf.splitTextToSize(value, 174) as string[]) {
      if (y > 269) { pdf.addPage(); y = 22 }
      pdf.text(line, 18, y); y += size * .46 + 2
    }
    y += 3
  }
  pdf.setFillColor(111, 65, 47); pdf.rect(0, 0, 210, 7, 'F')
  text('Reporte de ventas', 23)
  text(`${new Date(workspace.period.started_at).toLocaleDateString('es-MX')} al ${new Date(workspace.period.ends_at).toLocaleDateString('es-MX')}`)
  text(`Vendido antes de IVA: ${salesMoney(summary.total)}`, 14)
  text(`${summary.count} ventas | ${summary.clients} clientes | Ticket promedio: ${salesMoney(summary.average)}`)
  text('Importes en MXN, antes de impuestos. Clientes identificados por teléfono.')
  const header = () => {
    pdf.setFillColor(240, 232, 222); pdf.rect(18, y, 174, 10, 'F'); pdf.setFontSize(9)
    pdf.text('Fecha', 20, y + 6); pdf.text('Cliente / empresa / notas', 47, y + 6); pdf.text('Total sin IVA', 189, y + 6, { align: 'right' }); y += 10
  }
  header()
  for (const sale of workspace.sales) {
    pdf.setFontSize(9)
    const details = [sale.client_name, sale.phone, sale.company, sale.notes].filter(Boolean).join(' · ')
    const lines = pdf.splitTextToSize(details, 97) as string[]
    for (let offset = 0; offset < lines.length;) {
      if (y > 252) { pdf.addPage(); y = 22; header() }
      const chunk = lines.slice(offset, offset + Math.max(1, Math.floor((266 - y - 5) / 4.5)))
      pdf.setFontSize(9); pdf.setTextColor(55, 46, 40)
      if (!offset) { pdf.text(new Date(sale.created_at).toLocaleDateString('es-MX'), 20, y + 6); pdf.text(salesMoney(Number(sale.amount)), 189, y + 6, { align: 'right' }) }
      pdf.text(chunk, 47, y + 6, { lineHeightFactor: 1.42 })
      y += Math.max(15, chunk.length * 4.5 + 6); pdf.setDrawColor(225, 217, 210); pdf.line(18, y, 192, y)
      offset += chunk.length
      if (offset < lines.length) { pdf.addPage(); y = 22; header() }
    }
  }
  for (let page = 1; page <= pdf.getNumberOfPages(); page++) {
    pdf.setPage(page); pdf.setFontSize(8); pdf.setTextColor(130)
    pdf.text('Reporte operativo. No es una factura fiscal.', 18, 286)
    pdf.text(`${page} / ${pdf.getNumberOfPages()}`, 192, 286, { align: 'right' })
  }
  return new Blob([pdf.output('arraybuffer')], { type: 'application/pdf' })
}
