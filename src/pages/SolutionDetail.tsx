import { useEffect,useState } from 'react'
import { useParams,Link } from 'react-router-dom'
import { ArrowLeft,Download,ExternalLink,MessageCircle,Package } from 'lucide-react'
import { fetchSolutions } from '../lib/supabase'
import type { Solution } from '../types'
import { whatsapp } from '../components/Layout'
import { QuoteCalculator } from '../components/QuoteCalculator'
import { Seo,seoDefaults } from '../components/Seo'

export function SolutionDetail(){
 const{slug}=useParams();const[s,setS]=useState<Solution|null>(null)
 useEffect(()=>{fetchSolutions().then(x=>setS(x.find(i=>i.slug===slug)||null)).catch(()=>{})},[slug])
 if(!s)return <div className="loading">Cargando solución…</div>
 const path=`/soluciones/${s.slug}`,price=Number(s.base_price_mxn)*(s.has_vat!==false?1+Number(s.vat_rate)/100:1),schema:Record<string,unknown>={'@context':'https://schema.org','@type':'Product',name:s.name,description:s.seo_description||s.excerpt,url:`${seoDefaults.site}${path}`,brand:{'@type':'Brand',name:'Nodavexa'},category:s.category,image:s.cover_url?[s.cover_url]:undefined,offers:price>0?{'@type':'Offer',price:price.toFixed(2),priceCurrency:'MXN',url:`${seoDefaults.site}${path}`,availability:'https://schema.org/InStock'}:undefined}
 return <><Seo title={`${s.name} | Nodavexa`} description={s.seo_description||s.excerpt} path={path} image={s.cover_url||undefined} keywords={s.seo_keywords||[]} jsonLd={schema}/><section className="detail-hero"><div><Link to="/soluciones"><ArrowLeft/> Volver a soluciones</Link><span>{s.category}</span><h1>{s.name}</h1><p>{s.excerpt}</p><div className="detail-actions"><a className="btn primary" href={whatsapp(`Hola, me interesa la solución: ${s.name}`)} target="_blank" rel="noreferrer"><MessageCircle/> Solicitar información</a>{s.website_url&&<a className="btn ghost" href={s.website_url} target="_blank" rel="noreferrer"><ExternalLink/> Visitar sitio web</a>}</div></div><div className="detail-visual" style={s.cover_url?{backgroundImage:`url(${s.cover_url})`}:undefined}><Package/></div></section>{s.quote_enabled&&Number(s.base_price_mxn)>0&&<QuoteCalculator solution={s}/>}<section className="detail-content"><article className="rich-content" dangerouslySetInnerHTML={{__html:s.description}}/><aside><h3>Equipos incluidos</h3>{s.equipment.length?s.equipment.map((e,i)=><div className="equipment" key={i}><b>{e.name}</b><dl><div><dt>Peso</dt><dd>{e.weight||'—'}</dd></div><div><dt>Dimensiones</dt><dd>{[e.length,e.width,e.height].filter(Boolean).join(' × ')||'—'}</dd></div></dl></div>):<p>La configuración se define según tu proyecto.</p>}{s.documents.length>0&&<><h3>Documentación</h3>{s.documents.map(d=><a className="doc-link" href={d.url} target="_blank" rel="noreferrer" key={d.id||d.name}><Download/>{d.name}</a>)}</>}</aside></section></>
}
