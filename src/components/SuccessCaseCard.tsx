import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { SuccessCase } from '../types'
export function SuccessCaseCard({item}:{item:SuccessCase}){return <article className="case-card"><Link to={`/casos-de-exito/${item.slug}`} className="case-media" style={item.cover_url?{backgroundImage:`url(${item.cover_url})`}:undefined}><span>{item.client_type}</span></Link><div><small>CASO DE ÉXITO</small><h3>{item.title}</h3><p>{item.result}</p><Link to={`/casos-de-exito/${item.slug}`}>Ver caso completo <ArrowUpRight/></Link></div></article>}
