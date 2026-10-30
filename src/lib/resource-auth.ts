import type { User } from '@supabase/supabase-js'
import { supabase } from './supabase'

export type ResourceProfile = {
  user_id: string
  full_name: string
  email: string
  phone: string
  sector: string
  created_at?: string
  updated_at?: string
}

export type ResourceTool = {
  id: string
  slug: string
  title: string
  description: string
  route: string
  icon_key: string
  label: string
  published: boolean
  requires_auth: boolean
  position: number
}

export type InstalledResourceTool = {
  id: string
  user_id: string
  tool_id: string
  installed_at: string
  resource_tools?: ResourceTool | ResourceTool[] | null
}

export type ResourceActivity = {
  id: string
  user_id: string
  tool_id: string | null
  tool_slug: string
  action: string
  quantity: number
  metadata: Record<string, unknown>
  country_code: string
  country_name: string
  region: string
  city: string
  timezone: string
  locale: string
  device_type: string
  browser: string
  operating_system: string
  user_agent: string
  session_id: string
  created_at: string
}

export const resourceSectors = [
  'Agricultura',
  'Alimentos y bebidas',
  'Automotriz',
  'Construcción',
  'Comercio y retail',
  'Educación',
  'Energía',
  'Finanzas y seguros',
  'Gobierno',
  'Industria manufacturera',
  'Logística y transporte',
  'Medicina y salud',
  'Minería',
  'Servicios profesionales',
  'Tecnología',
  'Turismo y hospitalidad',
  'Otro',
] as const

export async function fetchResourceProfile(user: User) {
  const { data, error } = await supabase.from('resource_profiles').select('*').eq('user_id', user.id).maybeSingle()
  if (error) throw error
  return data as ResourceProfile | null
}

export async function saveResourceProfile(user: User, profile: Pick<ResourceProfile, 'full_name' | 'email' | 'phone' | 'sector'>) {
  const { data, error } = await supabase.from('resource_profiles').upsert({
    user_id: user.id,
    full_name: profile.full_name.trim(),
    email: profile.email.trim().toLowerCase(),
    phone: profile.phone.trim(),
    sector: profile.sector,
    updated_at: new Date().toISOString(),
  }).select().single()
  if (error) throw error
  return data as ResourceProfile
}

export async function fetchResourceTools() {
  const { data, error } = await supabase.from('resource_tools').select('*').order('position', { ascending: true })
  if (error) throw error
  return (data || []) as ResourceTool[]
}

export async function fetchInstalledResourceTools(userId: string) {
  const { data, error } = await supabase
    .from('resource_user_tools')
    .select('id, user_id, tool_id, installed_at, resource_tools(*)')
    .eq('user_id', userId)
    .order('installed_at', { ascending: true })
  if (error) throw error
  return (data || []) as InstalledResourceTool[]
}

export async function installResourceTool(userId: string, toolId: string) {
  const { data, error } = await supabase
    .from('resource_user_tools')
    .insert({ user_id: userId, tool_id: toolId })
    .select('id, user_id, tool_id, installed_at, resource_tools(*)')
    .single()
  if (error) throw error
  return data as InstalledResourceTool
}

export async function uninstallResourceTool(userId: string, toolId: string) {
  const { error } = await supabase
    .from('resource_user_tools')
    .delete()
    .eq('user_id', userId)
    .eq('tool_id', toolId)
  if (error) throw error
}

export async function fetchResourceActivity(userId: string) {
  const now = new Date()
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
  const { data, error } = await supabase
    .from('resource_activity')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', periodStart)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw error
  return (data || []) as ResourceActivity[]
}

export async function logResourceActivity(input: {
  userId: string
  toolSlug: string
  action: string
  quantity?: number
  metadata?: Record<string, unknown>
}) {
  const clientContext = resourceClientContext()
  const { error: functionError } = await supabase.functions.invoke('track-resource-activity', {
    body: {
      toolSlug: input.toolSlug,
      action: input.action,
      quantity: input.quantity,
      metadata: input.metadata,
      ...clientContext,
    },
  })
  if (!functionError) return

  const tool = await supabase.from('resource_tools').select('id').eq('slug', input.toolSlug).maybeSingle()
  if (tool.error) throw tool.error
  const { error } = await supabase.from('resource_activity').insert({
    user_id: input.userId,
    tool_id: tool.data?.id ?? null,
    tool_slug: input.toolSlug,
    action: input.action,
    quantity: Math.max(1, Math.round(input.quantity ?? 1)),
    metadata: input.metadata ?? {},
    timezone: clientContext.timezone,
    locale: clientContext.locale,
    device_type: clientDeviceType(clientContext.userAgent, clientContext.screenWidth),
    user_agent: clientContext.userAgent,
    session_id: clientContext.sessionId,
  })
  if (error) throw error
}

function resourceClientContext() {
  const userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent
  const screenWidth = typeof window === 'undefined' ? 0 : window.screen.width
  let sessionId = ''
  if (typeof window !== 'undefined') {
    try {
      sessionId = window.sessionStorage.getItem('nodavexa-resource-session') || crypto.randomUUID()
      window.sessionStorage.setItem('nodavexa-resource-session', sessionId)
    } catch {
      sessionId = ''
    }
  }
  return {
    locale: typeof navigator === 'undefined' ? 'es-MX' : navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
    userAgent,
    screenWidth,
    sessionId,
  }
}

function clientDeviceType(userAgent: string, screenWidth: number) {
  if (/ipad|tablet|playbook|silk/i.test(userAgent)) return 'Tablet'
  if (/mobi|android|iphone|ipod/i.test(userAgent) || (screenWidth > 0 && screenWidth < 768)) return 'Móvil'
  return 'Escritorio'
}
