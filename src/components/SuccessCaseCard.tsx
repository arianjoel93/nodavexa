import { ArrowUpRight, CheckCircle2, SearchCheck } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { SuccessCase } from '../types'

function CaseBrief({
  icon,
  label,
  text,
}: {
  icon: ReactNode
  label: string
  text: string
}) {
  if (!text) return null

  return (
    <div className="case-card-brief">
      {icon}
      <p>
        <b>{label}</b>
        {text}
      </p>
    </div>
  )
}

export function SuccessCaseCard({ item }: { item: SuccessCase }) {
  return (
    <article className="case-card">
      <Link
        to={`/casos-de-exito/${item.slug}`}
        className={`case-media ${item.cover_url ? '' : 'case-media-empty'}`}
        style={item.cover_url ? { backgroundImage: `url(${item.cover_url})` } : undefined}
      >
        <span>{item.client_type}</span>
        {!item.cover_url && <b>{item.title}</b>}
      </Link>
      <div>
        <small>CASO DE ÉXITO</small>
        <h3>{item.title}</h3>
        <div className="case-card-briefs">
          <CaseBrief icon={<SearchCheck />} label="Problema" text={item.problem} />
          <CaseBrief icon={<CheckCircle2 />} label="Resultado" text={item.result} />
        </div>
        <Link to={`/casos-de-exito/${item.slug}`}>
          Ver caso completo <ArrowUpRight />
        </Link>
      </div>
    </article>
  )
}
