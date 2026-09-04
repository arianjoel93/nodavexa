import { useEffect,useState } from 'react'
import { fetchSuccessCases } from '../lib/supabase'
import type { SuccessCase } from '../types'
import { SuccessCaseCard } from '../components/SuccessCaseCard'
export function SuccessCases(){const[items,setItems]=useState<SuccessCase[]>([]);useEffect(()=>{fetchSuccessCases().then(setItems).catch(()=>{})},[]);return <><section className="page-hero"><span className="section-index">CASOS DE ÉXITO</span><h1>Resultados que hablan<br/><em>por nuestro trabajo.</em></h1><p>Conoce cómo convertimos retos operativos en mejoras medibles para nuestros clientes.</p></section><section className="cases-catalog">{items.length?<div className="cases-grid">{items.map(item=><SuccessCaseCard item={item} key={item.id}/>)}</div>:<div className="empty">Próximamente publicaremos nuevos casos de éxito.</div>}</section></>}
