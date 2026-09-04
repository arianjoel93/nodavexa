import { createClient } from '@supabase/supabase-js'
import type { SiteSettings, Solution, SuccessCase } from '../types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined
export const isSupabaseReady = Boolean(url && key && !url.includes('TU-PROYECTO'))
export const supabase = createClient(url || 'https://placeholder.supabase.co', key || 'placeholder')

export async function fetchSolutions(admin = false): Promise<Solution[]> {
  if (!isSupabaseReady) return demoSolutions
  let query = supabase.from('solutions').select('*, equipment(*), documents(*)').order('created_at', { ascending: false })
  if (!admin) query = query.eq('published', true)
  const { data, error } = await query
  if (error) throw error
  return (data || []) as Solution[]
}

export const defaultSiteSettings: SiteSettings = { whatsapp:'523338419644', email:'soporte@nodavexa.com', address:'Atención en todo México' }
export async function fetchSiteSettings(): Promise<SiteSettings> {
  if (!isSupabaseReady) return defaultSiteSettings
  const { data, error } = await supabase.from('site_settings').select('whatsapp,email,address').eq('id', true).single()
  if (error) throw error
  return data as SiteSettings
}
export async function fetchSuccessCases(admin = false): Promise<SuccessCase[]> {
  if (!isSupabaseReady) return []
  let query = supabase.from('success_cases').select('*').order('created_at', { ascending:false })
  if (!admin) query = query.eq('published', true)
  const { data, error } = await query
  if (error) throw error
  return (data || []) as SuccessCase[]
}

export const demoSolutions: Solution[] = [
  { id:'demo-1', slug:'pesaje-etiquetado-inteligente', name:'Pesaje y etiquetado inteligente', excerpt:'Integra bÃ¡scula, impresiÃ³n tÃ©rmica y software en un flujo preciso y trazable.', description:'<h2>Convierte cada pesaje en informaciÃ³n Ãºtil</h2><p>Una soluciÃ³n diseÃ±ada para reducir capturas manuales, evitar errores y generar etiquetas listas para operaciÃ³n. Integramos el equipo, la programaciÃ³n y el software a la medida de tu proceso.</p><ul><li>Lectura automÃ¡tica de peso</li><li>Etiquetas variables y cÃ³digos de barras</li><li>ConexiÃ³n con tus sistemas existentes</li></ul>', category:'AutomatizaciÃ³n', cover_url:'', featured:true, published:true, seo_keywords:['pesaje inteligente'],seo_description:'Integra pesaje inteligente, impresiÃ³n tÃ©rmica y software para reducir errores y automatizar el etiquetado de tu operaciÃ³n.',base_price_mxn:0,vat_rate:16,quote_enabled:false,item_type:'solution',has_vat:true,payment_type:'one_time',shipping_weight_kg:0,shipping_length_cm:0,shipping_width_cm:0,shipping_height_cm:0,equipment:[{name:'BÃ¡scula industrial',weight:'18 kg',length:'50 cm',width:'40 cm',height:'12 cm'},{name:'Impresora tÃ©rmica',weight:'3.7 kg',length:'31 cm',width:'21 cm',height:'19 cm'}], documents:[] },
  { id:'demo-2', slug:'programacion-impresoras-tsc', name:'ProgramaciÃ³n para impresoras TSC', excerpt:'Plantillas, automatizaciÃ³n e integraciÃ³n para que tu impresora trabaje como parte de tu sistema.', description:'<h2>MÃ¡s que imprimir etiquetas</h2><p>Desarrollamos configuraciones y programas para automatizar la impresiÃ³n, capturar datos y conectar dispositivos perifÃ©ricos.</p>', category:'ImpresiÃ³n tÃ©rmica', cover_url:'', featured:true, published:true,seo_keywords:['programaciÃ³n TSC'],seo_description:'ProgramaciÃ³n e integraciÃ³n de impresoras TSC para automatizar etiquetas, datos variables y procesos de impresiÃ³n tÃ©rmica.',base_price_mxn:0,vat_rate:16,quote_enabled:false,item_type:'solution',has_vat:true,payment_type:'one_time',shipping_weight_kg:0,shipping_length_cm:0,shipping_width_cm:0,shipping_height_cm:0, equipment:[{name:'Impresora TSC',weight:'SegÃºn modelo',length:'â€”',width:'â€”',height:'â€”'}], documents:[] },
  { id:'demo-3', slug:'crm-operacion-comercial', name:'CRM y control comercial', excerpt:'Centraliza clientes, seguimientos, ventas y operaciÃ³n en software construido para tu empresa.', description:'<h2>Tu proceso, convertido en una herramienta</h2><p>DiseÃ±amos plataformas claras, escalables y accesibles desde cualquier lugar.</p>', category:'Software', cover_url:'', featured:true, published:true,seo_keywords:['CRM a medida'],seo_description:'CRM a medida para centralizar clientes, seguimientos, ventas y operaciÃ³n comercial en una plataforma diseÃ±ada para tu empresa.',base_price_mxn:0,vat_rate:16,quote_enabled:false,item_type:'solution',has_vat:true,payment_type:'one_time',shipping_weight_kg:0,shipping_length_cm:0,shipping_width_cm:0,shipping_height_cm:0, equipment:[], documents:[] }
]

