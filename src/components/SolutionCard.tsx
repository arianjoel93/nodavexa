import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getSolutionPositioning, getSolutionPricePresentation } from '../lib/solution-positioning'
import { productSlugForSolution } from '../lib/product-solution-links'
import type { Solution } from '../types'

const fallback = [
  'linear-gradient(135deg,#8c4f37,#d9a184)',
  'linear-gradient(135deg,#33251f,#8c5d49)',
  'linear-gradient(135deg,#c99b83,#6f412f)',
]

export function SolutionCard({ solution, index = 0 }: { solution: Solution; index?: number }) {
  const positioning = getSolutionPositioning(solution)
  const price = getSolutionPricePresentation(solution)

  return (
    <article className={`solution-card solution-card-${positioning.group.toLowerCase().replaceAll(' ', '-')}`}>
      <div
        className="card-media"
        style={solution.cover_url ? { backgroundImage: `url(${solution.cover_url})` } : { background: fallback[index % 3] }}
      >
        <span>{positioning.label}</span>
      </div>
      <div className="card-body">
        <h3>{positioning.title}</h3>
        <p>{positioning.excerpt}</p>
        {price.show && (
          <div className="card-price software-card-price commercial-card-price">
            <small>{price.mode === 'diagnosis' ? 'Diagnóstico previo' : price.primaryLabel}</small>
            <b>{price.mode === 'diagnosis' ? 'Según alcance' : price.primary}</b>
            {price.secondary && <em>{price.secondary}</em>}
            <span>{price.mode === 'diagnosis' ? 'Sin precio genérico' : solution.has_vat !== false ? 'IVA incluido' : 'No incluye IVA'}</span>
          </div>
        )}
        <Link to={productSlugForSolution(solution.slug) ? `/${productSlugForSolution(solution.slug)}` : `/soluciones/${solution.slug}`}>
          {positioning.ctaLabel} <ArrowUpRight size={17} />
        </Link>
      </div>
    </article>
  )
}
