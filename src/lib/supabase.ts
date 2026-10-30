import { createClient } from '@supabase/supabase-js'
import type { HomepageHeroSlide, ProjectRequest, QuoteClient, QuoteProduct, SalesOrder, SalesQuote, SiteSettings, Solution, SuccessCase, SuccessCaseVideo } from '../types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined
export const isSupabaseReady = Boolean(url && key && !url.includes('TU-PROYECTO'))
export const supabase = createClient(url || 'https://placeholder.supabase.co', key || 'placeholder')

export function spanishSupabaseError(cause: unknown, fallback = 'No fue posible completar la operación.') {
  const raw = typeof cause === 'string'
    ? cause
    : cause && typeof cause === 'object' && 'message' in cause && typeof cause.message === 'string'
      ? cause.message
      : cause instanceof Error ? cause.message : ''
  const message = raw.toLowerCase()
  if (!raw) return fallback
  if (message.includes('column') && (message.includes('does not exist') || message.includes('schema cache'))) return 'Falta actualizar la estructura de datos de Supabase. Aplica las migraciones pendientes.'
  if (message.includes('permission denied') || message.includes('row-level security') || message.includes('not allowed')) return 'No tienes permisos suficientes para realizar esta acción.'
  if (message.includes('duplicate key') || message.includes('already exists')) return 'El registro ya existe. Revisa los datos e inténtalo de nuevo.'
  if (message.includes('failed to fetch') || message.includes('network')) return 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.'
  if (/[áéíóúñ]|\b(no|el|la|los|las|se|una|un|error|falta|puede|debe)\b/i.test(raw)) return raw
  return fallback
}

export async function fetchSolutions(admin = false): Promise<Solution[]> {
  if (!isSupabaseReady) return admin ? demoSolutions : withPackagingCalculator(demoSolutions)
  let query = supabase.from('solutions').select('*, equipment(*), documents(*)').order('created_at', { ascending: false })
  if (!admin) query = query.eq('published', true)
  const { data, error } = await query
  if (error) throw error
  const solutions = (data || []) as Solution[]
  return admin ? solutions : withPackagingCalculator(solutions)
}

function withPackagingCalculator(solutions: Solution[]) {
  if (solutions.some((solution) => solution.slug === packagingCalculatorProduct.slug)) return solutions
  return [packagingCalculatorProduct, ...solutions]
}

export const defaultHomepageHeroSlides: HomepageHeroSlide[] = [
  {
    image_url: 'https://images.pexels.com/photos/4483942/pexels-photo-4483942.jpeg?auto=compress&cs=tinysrgb&w=2000',
    alt: 'Personal de almacén escanea productos para registrar movimientos de inventario',
  },
  {
    image_url: 'https://images.pexels.com/photos/38136632/pexels-photo-38136632.jpeg?auto=compress&cs=tinysrgb&w=2000',
    alt: 'Personal consulta existencias en una tableta dentro del almacén',
  },
  {
    image_url: 'https://images.pexels.com/photos/30625284/pexels-photo-30625284.jpeg?auto=compress&cs=tinysrgb&w=2000',
    alt: 'Pasillos y estanterías con productos organizados en un almacén',
  },
]

export const defaultSiteSettings: SiteSettings = {
  whatsapp:'523338419644',
  email:'soporte@nodavexa.com',
  address:'Atención en todo México',
  form_maintenance_mxn: 789,
  form_extra_changes_note: 'Los cambios, nuevas secciones, integraciones o actualizaciones fuera del alcance aprobado se cotizan por separado.',
  form_landing_quote_min_mxn: 12000,
  form_landing_quote_max_mxn: 28000,
  homepage_hero_slides: defaultHomepageHeroSlides,
}
export async function fetchSiteSettings(): Promise<SiteSettings> {
  if (!isSupabaseReady) return defaultSiteSettings
  const columns = 'whatsapp,email,address,form_maintenance_mxn,form_extra_changes_note,form_landing_quote_min_mxn,form_landing_quote_max_mxn'
  const { data, error } = await supabase.from('site_settings').select(`${columns},homepage_hero_slides`).eq('id', true).single()
  if (error && /homepage_hero_slides|column .* does not exist/i.test(error.message)) {
    const fallback = await supabase.from('site_settings').select(columns).eq('id', true).single()
    if (fallback.error) throw fallback.error
    return { ...defaultSiteSettings, ...(fallback.data as Partial<SiteSettings>), homepage_hero_slides: defaultHomepageHeroSlides }
  }
  if (error) throw error
  const configuredSlides = data.homepage_hero_slides
  return {
    ...defaultSiteSettings,
    ...(data as Partial<SiteSettings>),
    homepage_hero_slides: Array.isArray(configuredSlides) && configuredSlides.length === 3
      ? configuredSlides as HomepageHeroSlide[]
      : defaultHomepageHeroSlides,
  }
}
export async function fetchProjectRequests(): Promise<ProjectRequest[]> {
  if (!isSupabaseReady) return []
  const { data, error } = await supabase.from('project_requests').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data || []) as ProjectRequest[]
}
export async function fetchQuoteClients(): Promise<QuoteClient[]> {
  if (!isSupabaseReady) return []
  const { data, error } = await supabase.from('quote_clients').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data || []) as QuoteClient[]
}
export async function fetchQuoteProducts(activeOnly = false): Promise<QuoteProduct[]> {
  if (!isSupabaseReady) return []
  let query = supabase.from('quote_products').select('*').order('created_at', { ascending: false })
  if (activeOnly) query = query.eq('active', true)
  const { data, error } = await query
  if (error) throw error
  return (data || []) as QuoteProduct[]
}
export async function fetchSalesQuotes(): Promise<SalesQuote[]> {
  if (!isSupabaseReady) return []
  const { data, error } = await supabase
    .from('sales_quotes')
    .select('*, quote_clients(*), sales_quote_items(*)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []) as SalesQuote[]
}
export async function fetchSalesOrders(): Promise<SalesOrder[]> {
  if (!isSupabaseReady) return []
  const { data, error } = await supabase
    .from('sales_orders')
    .select('*, quote_clients(*), sales_order_items(*)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []) as SalesOrder[]
}
export async function fetchSuccessCases(admin = false): Promise<SuccessCase[]> {
  if (!isSupabaseReady) return admin ? [] : demoSuccessCases
  let query = supabase.from('success_cases').select('*').order('created_at', { ascending:false })
  if (!admin) query = query.eq('published', true)
  const { data, error } = await query
  if (error) return admin ? [] : demoSuccessCases
  if (!admin && !data?.length) return demoSuccessCases
  return (data || []) as SuccessCase[]
}

export async function fetchSuccessCaseVideos(admin = false): Promise<SuccessCaseVideo[]> {
  if (!isSupabaseReady) return demoSuccessCaseVideos
  let query = supabase.from('success_case_videos').select('*').order('position', { ascending: true }).order('created_at', { ascending: false })
  if (!admin) query = query.eq('published', true)
  const { data, error } = await query
  if (error) return demoSuccessCaseVideos
  return data?.length ? (data as SuccessCaseVideo[]) : demoSuccessCaseVideos
}

export const demoSolutions: Solution[] = [
  { id:'demo-1', slug:'pesaje-etiquetado-inteligente', name:'Pesaje y etiquetado inteligente', excerpt:'Integra bÃ¡scula, impresiÃ³n tÃ©rmica y software en un flujo preciso y trazable.', description:'<h2>Convierte cada pesaje en informaciÃ³n Ãºtil</h2><p>Una soluciÃ³n diseÃ±ada para reducir capturas manuales, evitar errores y generar etiquetas listas para operaciÃ³n. Integramos el equipo, la programaciÃ³n y el software a la medida de tu proceso.</p><ul><li>Lectura automÃ¡tica de peso</li><li>Etiquetas variables y cÃ³digos de barras</li><li>ConexiÃ³n con tus sistemas existentes</li></ul>', category:'AutomatizaciÃ³n', cover_url:'', featured:true, published:true, seo_keywords:['pesaje inteligente'],seo_description:'Integra pesaje inteligente, impresiÃ³n tÃ©rmica y software para reducir errores y automatizar el etiquetado de tu operaciÃ³n.',base_price_mxn:0,vat_rate:16,quote_enabled:false,item_type:'solution',has_vat:true,payment_type:'one_time',shipping_weight_kg:0,shipping_length_cm:0,shipping_width_cm:0,shipping_height_cm:0,equipment:[{name:'BÃ¡scula industrial',weight:'18 kg',length:'50 cm',width:'40 cm',height:'12 cm'},{name:'Impresora tÃ©rmica',weight:'3.7 kg',length:'31 cm',width:'21 cm',height:'19 cm'}], documents:[] },
  { id:'demo-2', slug:'programacion-impresoras-tsc', name:'ProgramaciÃ³n para impresoras TSC', excerpt:'Plantillas, automatizaciÃ³n e integraciÃ³n para que tu impresora trabaje como parte de tu sistema.', description:'<h2>MÃ¡s que imprimir etiquetas</h2><p>Desarrollamos configuraciones y programas para automatizar la impresiÃ³n, capturar datos y conectar dispositivos perifÃ©ricos.</p>', category:'ImpresiÃ³n tÃ©rmica', cover_url:'', featured:true, published:true,seo_keywords:['programaciÃ³n TSC'],seo_description:'ProgramaciÃ³n e integraciÃ³n de impresoras TSC para automatizar etiquetas, datos variables y procesos de impresiÃ³n tÃ©rmica.',base_price_mxn:0,vat_rate:16,quote_enabled:false,item_type:'solution',has_vat:true,payment_type:'one_time',shipping_weight_kg:0,shipping_length_cm:0,shipping_width_cm:0,shipping_height_cm:0, equipment:[{name:'Impresora TSC',weight:'SegÃºn modelo',length:'â€”',width:'â€”',height:'â€”'}], documents:[] },
  { id:'demo-3', slug:'crm-operacion-comercial', name:'CRM y control comercial', excerpt:'Centraliza clientes, seguimientos, ventas y operaciÃ³n en software construido para tu empresa.', description:'<h2>Tu proceso, convertido en una herramienta</h2><p>DiseÃ±amos plataformas claras, escalables y accesibles desde cualquier lugar.</p>', category:'Software', cover_url:'', featured:true, published:true,seo_keywords:['CRM a medida'],seo_description:'CRM a medida para centralizar clientes, seguimientos, ventas y operaciÃ³n comercial en una plataforma diseÃ±ada para tu empresa.',base_price_mxn:0,vat_rate:16,quote_enabled:false,item_type:'solution',has_vat:true,payment_type:'one_time',shipping_weight_kg:0,shipping_length_cm:0,shipping_width_cm:0,shipping_height_cm:0, equipment:[], documents:[] }
]

const packagingCalculatorProduct: Solution = {
  id: 'catalog-calculadora-embalaje',
  slug: 'calculadora-de-embalaje-y-peso-volumetrico',
  name: 'Calculadora de embalaje y peso volumétrico',
  excerpt: 'Compara cajas, calcula peso volumétrico y encuentra acomodos factibles con las dimensiones reales de tus productos.',
  description: '<h2>Prepara cada envío con mejores datos</h2><p>Una herramienta para registrar productos con sus dimensiones y peso, definir los embalajes disponibles y comparar alternativas antes de despachar.</p><ul><li>Base de datos de productos con dimensiones y peso.</li><li>Configuración de cajas y embalajes disponibles.</li><li>Comparación de cajas y propuestas de acomodo factible.</li><li>Estimación de peso volumétrico para planear y cotizar envíos.</li></ul><p>La implementación se cotiza según el catálogo, reglas de acomodo e integraciones que necesite tu operación.</p>',
  category: 'Inventarios y almacenes', cover_url: '', featured: false, published: true,
  seo_keywords: ['calculadora de embalaje', 'peso volumétrico', 'acomodo de productos', 'optimización de envíos'],
  seo_description: 'Calculadora de embalaje con base de productos, dimensiones y peso. Define cajas, compara opciones, propone acomodos factibles y estima peso volumétrico.',
  base_price_mxn: 0, vat_rate: 16, quote_enabled: false, item_type: 'product', has_vat: true,
  payment_type: 'one_time', shipping_weight_kg: 0, shipping_length_cm: 0, shipping_width_cm: 0,
  shipping_height_cm: 0, equipment: [], documents: [],
}

export const demoSuccessCaseVideos: SuccessCaseVideo[] = [
  {
    id: 'video-exportaciones',
    slug: 'software-para-control-de-exportaciones',
    title: 'Software para control de exportaciones',
    video_url: 'https://youtube.com/shorts/uhbGHaKrOGc?si=coqEImA9YopQG6Wd',
    youtube_id: 'uhbGHaKrOGc',
    description: 'Caso en video sobre software para controlar y organizar procesos de exportación.',
    position: 1,
    published: true,
  },
  {
    id: 'video-verificador-precios',
    slug: 'verificador-de-precios',
    title: 'Verificador de precios',
    video_url: 'https://youtube.com/shorts/PxC8HnzTb48?si=qylzcHDeO0QS-fRC',
    youtube_id: 'PxC8HnzTb48',
    description: 'Caso en video de una herramienta para consulta y verificación de precios.',
    position: 2,
    published: true,
  },
  {
    id: 'video-control-inventarios',
    slug: 'control-de-inventarios',
    title: 'Control de inventarios',
    video_url: 'https://youtube.com/shorts/ozsz3vmR4Y4?si=c1eNz6bo38GHiLGP',
    youtube_id: 'ozsz3vmR4Y4',
    description: 'Caso en video enfocado en control operativo de inventarios.',
    position: 3,
    published: true,
  },
]

export const demoSuccessCases: SuccessCase[] = [
  {
    id: 'case-laboratorio-ciencias',
    slug: 'sistema-para-laboratorio-de-ciencias',
    title: 'Sistema para un laboratorio de ciencias',
    client_type: 'Laboratorio científico',
    problem: 'El laboratorio necesitaba un sistema digital alineado con sus procesos y requerimientos de trabajo.',
    result: 'Se desarrolló un sistema para el laboratorio de ciencias, adaptado al alcance definido para el proyecto.',
    description: '<p>Proyecto de software a medida para un laboratorio científico. La información pública se mantiene general para proteger los detalles de operación del cliente.</p>',
    cover_url: '',
    featured: true,
    published: true,
  },
  {
    id: 'case-clinica-estetica',
    slug: 'sistema-para-clinica-estetica',
    title: 'Sistema para una clínica estética',
    client_type: 'Clínica estética',
    problem: 'La clínica requería una solución de software que respondiera a sus necesidades de operación.',
    result: 'Se desarrolló un sistema para la clínica estética de acuerdo con el alcance del proyecto.',
    description: '<p>Proyecto de software para una clínica estética. No publicamos información de pacientes ni detalles internos del negocio.</p>',
    cover_url: '',
    featured: true,
    published: true,
  },
  {
    id: 'case-venta-chamarras',
    slug: 'sistema-para-empresa-de-venta-de-chamarras',
    title: 'Sistema para una empresa de venta de chamarras',
    client_type: 'Comercio de prendas',
    problem: 'La empresa necesitaba apoyo de software para una operación enfocada en la venta de chamarras.',
    result: 'Se desarrolló un sistema para la empresa, ajustado al alcance acordado.',
    description: '<p>Proyecto de software a medida para una empresa comercializadora de chamarras. Los detalles se comparten con autorización del cliente.</p>',
    cover_url: '',
    featured: true,
    published: true,
  },
]

