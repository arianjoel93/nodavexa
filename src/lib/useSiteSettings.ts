import { useEffect,useState } from 'react'
import { defaultSiteSettings,fetchSiteSettings } from './supabase'
import type { SiteSettings } from '../types'
export function useSiteSettingsWithStatus(){
  const [settings,setSettings]=useState<SiteSettings>(defaultSiteSettings)
  const [loaded,setLoaded]=useState(false)
  useEffect(()=>{
    let current=true
    fetchSiteSettings().then(value=>{if(current)setSettings(value)}).catch(()=>{}).finally(()=>{if(current)setLoaded(true)})
    return ()=>{current=false}
  },[])
  return {settings,loaded}
}
export function useSiteSettings(){return useSiteSettingsWithStatus().settings}
