import { useEffect,useState } from 'react'
import { defaultSiteSettings,fetchSiteSettings } from './supabase'
import type { SiteSettings } from '../types'
export function useSiteSettings(){const[settings,setSettings]=useState<SiteSettings>(defaultSiteSettings);useEffect(()=>{fetchSiteSettings().then(setSettings).catch(()=>{})},[]);return settings}
