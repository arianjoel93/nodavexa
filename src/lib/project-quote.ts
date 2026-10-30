import type { ProjectQuote, ProjectRequest, QuoteLine } from '../types'

const mxn = (value: number) => Math.max(0, Math.round(value))

export function serviceLabel(service: ProjectRequest['service_type']) {
  const labels = {
    landing_page: 'Landing page de conversión',
    website: 'Sitio web',
    web_app: 'Aplicación web',
    installable_software: 'Software instalable',
  }
  return labels[service]
}

export function buildLandingQuote(request: ProjectRequest, discountPercent = 0, minReference = 12000, maxReference = 28000): ProjectQuote {
  const pages = Math.max(1, Number(request.pages_count || 1))
  const sectionCount = request.sections_needed?.length || 0
  const featureCount = request.features_needed?.length || 0
  const integrationCount = request.integrations_needed?.length || 0
  const min = mxn(Math.max(0, Number(minReference || 12000)))
  const max = mxn(Math.max(min, Number(maxReference || 28000)))
  const lines: QuoteLine[] = [
    {
      label: 'Estrategia, estructura y diseño responsive',
      description: 'Arquitectura de conversión, adaptación móvil y diseño visual personalizado.',
      amount: 6900,
    },
    {
      label: 'Desarrollo e implementación de landing page',
      description: 'Maquetación web, publicación base, optimización visual y formulario de contacto.',
      amount: 5200,
    },
  ]

  if (pages > 1) {
    lines.push({
      label: `Páginas o variantes adicionales (${pages - 1})`,
      description: 'Variantes internas, secciones extendidas o páginas de apoyo.',
      amount: (pages - 1) * 1800,
    })
  }
  if (sectionCount > 6) {
    lines.push({
      label: 'Arquitectura de contenido extendida',
      description: `${sectionCount} secciones solicitadas.`,
      amount: (sectionCount - 6) * 650,
    })
  }
  if (request.content_status !== 'ready') {
    lines.push({
      label: 'Apoyo en copy y organización de contenido',
      description: 'Ajuste de textos, mensajes principales y estructura comercial.',
      amount: request.content_status === 'partial' ? 1900 : 3400,
    })
  }
  if (featureCount) {
    lines.push({
      label: 'Funciones adicionales',
      description: `${featureCount} función(es) solicitada(s): ${request.features_needed.join(', ')}.`,
      amount: featureCount * 950,
    })
  }
  if (integrationCount) {
    lines.push({
      label: 'Integraciones y medición',
      description: `${integrationCount} integración(es): ${request.integrations_needed.join(', ')}.`,
      amount: integrationCount * 1400,
    })
  }
  const complexity = Math.min(1, (
    Math.max(0, pages - 1) * 0.16 +
    Math.max(0, sectionCount - 5) * 0.07 +
    featureCount * 0.08 +
    integrationCount * 0.1 +
    (request.content_status === 'needed' ? 0.18 : request.content_status === 'partial' ? 0.08 : 0)
  ))
  const targetSubtotal = mxn(min + (max - min) * complexity)
  const currentSubtotal = lines.reduce((sum, line) => sum + Number(line.amount || 0), 0)
  const scale = currentSubtotal > 0 ? targetSubtotal / currentSubtotal : 1
  const pricedLines = lines.map((line) => ({ ...line, amount: mxn(line.amount * scale) }))
  const drift = targetSubtotal - pricedLines.reduce((sum, line) => sum + line.amount, 0)
  if (pricedLines[0] && drift) pricedLines[0] = { ...pricedLines[0], amount: pricedLines[0].amount + drift }

  return finalizeQuote(request, pricedLines, discountPercent, 'Cotización estimada para landing page . No incluye pauta publicitaria, compra de dominio, licencias premium ni cambios fuera del alcance aprobado.')
}

export function buildManualQuote(request: ProjectRequest, amount: number, maintenance: number, updates: number, discountPercent = 0, notes = ''): ProjectQuote {
  const lines: QuoteLine[] = [
    {
      label: serviceLabel(request.service_type),
      description: 'Costo de desarrollo definido manualmente según alcance revisado.',
      amount,
    },
  ]
  if (updates > 0) lines.push({ label: 'Bolsa inicial de cambios o actualizaciones', amount: updates })
  const quote = finalizeQuote(request, lines, discountPercent, notes || 'Cotización manual sujeta a alcance técnico, tiempos de entrega y materiales entregados por el cliente.')
  quote.annual_maintenance_mxn = mxn(maintenance)
  quote.total = mxn(quote.subtotal - quote.discount_amount + quote.annual_maintenance_mxn)
  return quote
}

function finalizeQuote(request: ProjectRequest, lines: QuoteLine[], discountPercent: number, notes: string): ProjectQuote {
  const subtotal = mxn(lines.reduce((sum, line) => sum + Number(line.amount || 0), 0))
  const cleanDiscount = Math.min(60, Math.max(0, Number(discountPercent || 0)))
  const discountAmount = mxn(subtotal * cleanDiscount / 100)
  const annualMaintenance = mxn(request.annual_maintenance_mxn || 789)
  const created = new Date()
  const valid = new Date(created)
  valid.setDate(valid.getDate() + 15)

  return {
    quote_number: `NDX-${created.getFullYear()}${String(created.getMonth() + 1).padStart(2, '0')}-${String(request.id).slice(0, 6).toUpperCase()}`,
    currency: 'MXN',
    service_title: serviceLabel(request.service_type),
    lines,
    subtotal,
    discount_percent: cleanDiscount,
    discount_amount: discountAmount,
    annual_maintenance_mxn: annualMaintenance,
    total: mxn(subtotal - discountAmount + annualMaintenance),
    notes,
    valid_until: valid.toISOString(),
    created_at: created.toISOString(),
  }
}

export function formatMoney(value: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(value || 0)
}

export function convertQuoteCurrency(quote: ProjectQuote, currency: 'MXN' | 'USD', usdRate: number): ProjectQuote {
  if (currency === 'MXN') return { ...quote, currency: 'MXN', exchange_rate_mxn_per_usd: undefined }
  const rate = Math.max(1, Number(usdRate || 17.5))
  const convert = (value: number) => Math.round((Number(value || 0) / rate) * 100) / 100
  return {
    ...quote,
    currency: 'USD',
    lines: quote.lines.map((line) => ({ ...line, amount: convert(line.amount) })),
    subtotal: convert(quote.subtotal),
    discount_amount: convert(quote.discount_amount),
    annual_maintenance_mxn: convert(quote.annual_maintenance_mxn),
    total: convert(quote.total),
    exchange_rate_mxn_per_usd: rate,
  }
}

export function formatQuoteMoney(value: number, currency: 'MXN' | 'USD') {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency, maximumFractionDigits: currency === 'USD' ? 2 : 0 }).format(value || 0)
}
