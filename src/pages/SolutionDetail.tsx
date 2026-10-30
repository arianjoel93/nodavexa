import { useEffect, useState } from 'react'
import { useParams, Link, Navigate } from 'react-router-dom'
import { ArrowLeft, Download, ExternalLink, MessageCircle, Package } from 'lucide-react'
import { fetchSolutions } from '../lib/supabase'
import { productSlugForSolution } from '../lib/product-solution-links'
import type { Solution } from '../types'
import { whatsapp } from '../components/Layout'
import { QuoteCalculator } from '../components/QuoteCalculator'
import { Seo, seoDefaults } from '../components/Seo'
import posthog from '../lib/posthog'
import { trackEvent } from '../lib/analytics'
import {
  getSolutionPositioning,
  getSolutionPricePresentation,
  isSoftwareSolution,
} from '../lib/solution-positioning'

export function SolutionDetail() {
  const { slug } = useParams()
  const productSlug = productSlugForSolution(slug || '')
  const [solution, setSolution] = useState<Solution | null>(null)

  useEffect(() => {
    fetchSolutions().then((items) => setSolution(items.find((item) => item.slug === slug) || null)).catch(() => {})
  }, [slug])

  if (productSlug) return <Navigate to={`/${productSlug}`} replace />
  if (!solution) return <div className="loading">Cargando solución…</div>

  const path = `/soluciones/${solution.slug}`
  const positioning = getSolutionPositioning(solution)
  const price = getSolutionPricePresentation(solution)
  const isSoftware = isSoftwareSolution(solution)
  const schema: Record<string, unknown> = solution.item_type === 'product' ? {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: positioning.title,
    description: solution.seo_description || positioning.excerpt,
    url: `${seoDefaults.site}${path}`,
    brand: { '@type': 'Brand', name: 'Nodavexa' },
    category: positioning.group,
    image: solution.cover_url ? [solution.cover_url] : undefined,
    offers: price.schemaPrice
      ? {
          '@type': 'Offer',
          price: price.schemaPrice.toFixed(2),
          priceCurrency: 'MXN',
          url: `${seoDefaults.site}${path}`,
          availability: 'https://schema.org/InStock',
        }
        : undefined,
  } : {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: positioning.title,
    description: solution.seo_description || positioning.excerpt,
    url: `${seoDefaults.site}${path}`,
    serviceType: positioning.group,
    provider: { '@id': `${seoDefaults.site}/#organization` },
    areaServed: ['Guadalajara', 'Jalisco', 'Mexico'],
    image: solution.cover_url ? [solution.cover_url] : undefined,
  }

  return (
    <>
      <Seo
        title={`${positioning.title} | Nodavexa`}
        description={solution.seo_description || positioning.excerpt}
        path={path}
        image={solution.cover_url || undefined}
        jsonLd={schema}
      />
      <section className="detail-hero">
        <div>
          <Link to="/soluciones">
            <ArrowLeft /> Volver a soluciones
          </Link>
          <span>{positioning.label}</span>
          <h1>{positioning.title}</h1>
          <p>{positioning.excerpt}</p>
          <div className="detail-actions">
            <a
              className="btn primary"
              href={whatsapp(`Hola, quiero ${positioning.ctaLabel.toLowerCase()} para: ${positioning.title}`)}
              target="_blank"
              rel="noreferrer"
              onClick={() => { posthog?.capture('solution_inquiry_requested'); trackEvent('demo_cta_click', { page_slug: solution.slug }) }}
            >
              <MessageCircle /> {positioning.ctaLabel}
            </a>
            {solution.website_url && (
              <a className="btn ghost" href={solution.website_url} target="_blank" rel="noreferrer">
                <ExternalLink /> Visitar sitio web
              </a>
            )}
          </div>
        </div>
        <div className="detail-visual" style={solution.cover_url ? { backgroundImage: `url(${solution.cover_url})` } : undefined}>
          <Package />
        </div>
      </section>
      {isSoftware && price.show && (
        <section className={`public-software-pricing public-software-pricing-${price.mode}`}>
          <span>{price.eyebrow}</span>
          <h2>{price.title}</h2>
          <div>
            <article>
              <small>{price.primaryLabel}</small>
              <strong>{price.primary}</strong>
              <p>{price.primaryText}</p>
            </article>
            <article>
              <small>{price.secondaryLabel}</small>
              <strong>{price.secondary}</strong>
              <p>{price.secondaryText}</p>
            </article>
          </div>
          <p className="tax-note">{price.note}</p>
        </section>
      )}
      {solution.quote_enabled && !isSoftware && Number(solution.base_price_mxn) > 0 && <QuoteCalculator solution={solution} />}
      <section className="detail-content">
        <article className="rich-content" dangerouslySetInnerHTML={{ __html: solution.description }} />
        <aside>
          <h3>Equipos incluidos</h3>
          {solution.equipment.length ? (
            solution.equipment.map((equipment, index) => (
              <div className="equipment" key={index}>
                <b>{equipment.name}</b>
                <dl>
                  <div>
                    <dt>Peso</dt>
                    <dd>{equipment.weight || '—'}</dd>
                  </div>
                  <div>
                    <dt>Dimensiones</dt>
                    <dd>{[equipment.length, equipment.width, equipment.height].filter(Boolean).join(' × ') || '—'}</dd>
                  </div>
                </dl>
              </div>
            ))
          ) : (
            <p>La configuración se define según tu proyecto.</p>
          )}
          {solution.documents.length > 0 && (
            <>
              <h3>Documentación</h3>
              {solution.documents.map((document) => (
                <a className="doc-link" href={document.url} target="_blank" rel="noreferrer" key={document.id || document.name}>
                  <Download />
                  {document.name}
                </a>
              ))}
            </>
          )}
        </aside>
      </section>
    </>
  )
}
