import { useEffect } from 'react'

const site=(import.meta.env.VITE_SITE_URL||'https://nodavexa.com').replace(/\/$/,'')
const generalKeywords='soluciones tecnológicas México, software empresarial, desarrollo de software a medida, CRM, básculas industriales, impresoras térmicas TSC, automatización industrial, etiquetado con peso'
type Props={title:string;description:string;path?:string;image?:string;keywords?:string[];jsonLd?:Record<string,unknown>;noindex?:boolean}

export function Seo({title,description,path='/',image,keywords=[],jsonLd,noindex=false}:Props){
 useEffect(()=>{const canonical=`${site}${path.startsWith('/')?path:`/${path}`}`;document.title=title
  const meta=(selector:string,attributes:Record<string,string>)=>{let element=document.head.querySelector(selector) as HTMLMetaElement|null;if(!element){element=document.createElement('meta');document.head.appendChild(element)}Object.entries(attributes).forEach(([key,value])=>element!.setAttribute(key,value))}
  meta('meta[name="description"]',{name:'description',content:description});meta('meta[name="keywords"]',{name:'keywords',content:[...keywords,generalKeywords].filter(Boolean).join(', ')});meta('meta[name="robots"]',{name:'robots',content:noindex?'noindex, nofollow':'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'});meta('meta[property="og:title"]',{property:'og:title',content:title});meta('meta[property="og:description"]',{property:'og:description',content:description});meta('meta[property="og:type"]',{property:'og:type',content:'website'});meta('meta[property="og:url"]',{property:'og:url',content:canonical});meta('meta[name="twitter:card"]',{name:'twitter:card',content:'summary_large_image'});if(image){meta('meta[property="og:image"]',{property:'og:image',content:image});meta('meta[name="twitter:image"]',{name:'twitter:image',content:image})}
  let link=document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement|null;if(!link){link=document.createElement('link');link.rel='canonical';document.head.appendChild(link)}link.href=canonical
  document.getElementById('page-jsonld')?.remove();if(jsonLd){const script=document.createElement('script');script.id='page-jsonld';script.type='application/ld+json';script.text=JSON.stringify(jsonLd);document.head.appendChild(script)}
 },[title,description,path,image,keywords,jsonLd,noindex]);return null
}

export const seoDefaults={site,generalKeywords}
