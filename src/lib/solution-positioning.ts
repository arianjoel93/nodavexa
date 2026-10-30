import type { Solution } from '../types'
import { calculatePublishedPrice } from './pricing'

export type CommercialGroup = 'CRM y ventas' | 'Inventarios y almacenes' | 'Aplicaciones a medida'
type PriceMode = 'diagnosis' | 'projectFrom' | 'monthly' | 'monthlyWithSetup'

type SolutionOverride = {
  title?: string
  excerpt?: string
  label?: string
  group: CommercialGroup
  ctaLabel?: string
  priceMode: PriceMode
  pricingTitle?: string
  pricingNote?: string
}

const softwareCategories = ['Software', 'CRM', 'Inventarios y almacenes', 'Reportes y datos', 'Integraciones']

const money = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 0,
})

const overrides: Record<string, SolutionOverride> = {
  'calculadora-de-embalaje-y-peso-volumetrico': {
    label: 'Producto para logística',
    group: 'Inventarios y almacenes',
    ctaLabel: 'Solicitar cotización',
    priceMode: 'projectFrom',
    pricingTitle: 'Implementación según tu operación',
    pricingNote: 'Definimos el catálogo, las reglas de acomodo, los embalajes y las integraciones necesarias para cotizar la solución.',
  },
  'aplicacion-a-la-medida-para-control-de-clientes': {
    title: 'CRM personalizado para clientes, ventas y seguimiento',
    excerpt:
      'Centraliza clientes, cotizaciones, vendedores, actividades y oportunidades para que ninguna venta se quede sin seguimiento.',
    label: 'CRM y ventas',
    group: 'CRM y ventas',
    ctaLabel: 'Solicitar diagnóstico',
    priceMode: 'diagnosis',
    pricingTitle: 'Diagnóstico y cotización según alcance',
    pricingNote:
      'Primero revisamos usuarios, etapas comerciales, reportes, datos a migrar e integraciones. Con eso definimos una propuesta clara y sin módulos innecesarios.',
  },
  'sistema-de-inventario-y-control-de-almacenes': {
    title: 'Bodegalia: inventario y control de almacenes',
    label: 'Inventario SaaS',
    group: 'Inventarios y almacenes',
    ctaLabel: 'Solicitar demo',
    priceMode: 'monthly',
    pricingTitle: 'Plan mensual para operar inventarios',
    pricingNote:
      'Ideal cuando necesitas comenzar con un sistema de inventario listo para organizar productos, movimientos y almacenes.',
  },
  'sistema-de-control-de-productos-e-inventarios': {
    label: 'Inventarios',
    group: 'Inventarios y almacenes',
    ctaLabel: 'Cotizar implementación',
    priceMode: 'monthlyWithSetup',
    pricingTitle: 'Implementación con mensualidad',
    pricingNote:
      'Recomendado para operaciones que necesitan configurar flujos, productos, permisos y reportes antes de trabajar en vivo.',
  },
  'sistema-de-control-interno-de-usuarios-y-trabajadores': {
    label: 'Aplicación a medida',
    group: 'Aplicaciones a medida',
    ctaLabel: 'Cotizar implementación',
    priceMode: 'projectFrom',
  },
  'sistema-de-gestion-de-pacientes': {
    label: 'Aplicación a medida',
    group: 'Aplicaciones a medida',
    ctaLabel: 'Cotizar implementación',
    priceMode: 'projectFrom',
  },
  'plataforma-de-gestion-de-estudiantes': {
    label: 'Aplicación a medida',
    group: 'Aplicaciones a medida',
    ctaLabel: 'Cotizar implementación',
    priceMode: 'projectFrom',
  },
}

function fallbackGroup(solution: Solution): CommercialGroup {
  const text = `${solution.name} ${solution.category} ${solution.excerpt}`.toLowerCase()
  if (/\bcrm\b|\bclientes?\b|\bventas?\b/.test(text)) return 'CRM y ventas'
  if (text.includes('inventario') || text.includes('almacen') || text.includes('almacén') || text.includes('producto')) return 'Inventarios y almacenes'
  return 'Aplicaciones a medida'
}

function fiscalInput(solution: Solution) {
  const isSoftware = softwareCategories.includes(solution.category)
  return {
    has_vat: solution.has_vat,
    vat_rate: solution.vat_rate,
    sat_withholdings_enabled: isSoftware && solution.sat_withholdings_enabled,
    isr_withholding_rate: solution.isr_withholding_rate,
    vat_withholding_rate: solution.vat_withholding_rate,
  }
}

export function isSoftwareSolution(solution: Solution) {
  return softwareCategories.includes(solution.category)
}

export function getSolutionPositioning(solution: Solution) {
  const override = overrides[solution.slug]
  const group = override?.group || fallbackGroup(solution)
  return {
    title: override?.title || solution.name,
    excerpt: override?.excerpt || solution.excerpt,
    label: override?.label || group,
    group,
    ctaLabel: override?.ctaLabel || 'Solicitar información',
    priceMode: override?.priceMode || (solution.payment_type === 'monthly' ? 'monthly' : 'projectFrom'),
    pricingTitle: override?.pricingTitle,
    pricingNote: override?.pricingNote,
  }
}

export function getSolutionPricePresentation(solution: Solution) {
  const positioning = getSolutionPositioning(solution)
  const fiscal = fiscalInput(solution)
  const price = calculatePublishedPrice(solution.base_price_mxn, fiscal)
  const initial = calculatePublishedPrice(Number(solution.initial_price_mxn) || 0, fiscal)
  const maintenance = calculatePublishedPrice(Number(solution.annual_maintenance_price_mxn) || 0, fiscal)
  const hasVat = solution.has_vat !== false

  if (positioning.priceMode === 'diagnosis') {
    return {
      show: true,
      mode: positioning.priceMode,
      eyebrow: 'INVERSIÓN',
      title: positioning.pricingTitle || 'Diagnóstico y cotización según alcance',
      primaryLabel: 'Primer paso',
      primary: 'Diagnóstico comercial',
      primaryText: 'Entendemos tu operación antes de definir pantallas, flujos, usuarios e integraciones.',
      secondaryLabel: 'Después',
      secondary: 'Cotización a medida',
      secondaryText: positioning.pricingNote || 'La inversión se define con el alcance real del proyecto.',
      note: 'Evita pagar por un CRM genérico que después no encaja con tu proceso.',
      schemaPrice: undefined,
    }
  }

  if (!price.publishedTotal) {
    return {
      show: false,
      mode: positioning.priceMode,
      eyebrow: 'INVERSIÓN',
      title: 'Cotización según alcance',
      primaryLabel: '',
      primary: '',
      primaryText: '',
      secondaryLabel: '',
      secondary: '',
      secondaryText: '',
      note: '',
      schemaPrice: undefined,
    }
  }

  if (positioning.priceMode === 'monthly' || positioning.priceMode === 'monthlyWithSetup') {
    return {
      show: true,
      mode: positioning.priceMode,
      eyebrow: 'INVERSIÓN',
      title: positioning.pricingTitle || 'Plan mensual',
      primaryLabel: 'Mensualidad',
      primary: `Desde ${money.format(price.publishedTotal)} / mes`,
      primaryText: 'Precio base publicado para iniciar con la solución.',
      secondaryLabel: positioning.priceMode === 'monthlyWithSetup' ? 'Implementación' : 'Incluye',
      secondary:
        positioning.priceMode === 'monthlyWithSetup' && initial.publishedTotal
          ? `Desde ${money.format(initial.publishedTotal)}`
          : 'Operación mensual',
      secondaryText:
        positioning.pricingNote ||
        'La configuración final puede ajustarse según usuarios, procesos y requerimientos.',
      note: hasVat ? 'Precios mostrados con IVA incluido.' : 'Precios mostrados sin IVA.',
      schemaPrice: price.publishedTotal,
    }
  }

  return {
    show: true,
    mode: positioning.priceMode,
    eyebrow: 'INVERSIÓN',
    title: positioning.pricingTitle || 'Proyecto a medida',
    primaryLabel: 'Implementación',
    primary: `Desde ${money.format(price.publishedTotal)}`,
    primaryText: 'Base para desarrollar o adaptar la solución al flujo de trabajo del cliente.',
    secondaryLabel: 'Mantenimiento',
    secondary: maintenance.publishedTotal ? `Desde ${money.format(maintenance.publishedTotal)} / año` : 'Según alcance',
    secondaryText:
      positioning.pricingNote ||
      'El precio final depende de usuarios, automatizaciones, datos, permisos e integraciones.',
    note: hasVat ? 'Precios mostrados con IVA incluido.' : 'Precios mostrados sin IVA.',
    schemaPrice: price.publishedTotal,
  }
}
