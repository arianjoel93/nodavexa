import { useEffect, useState } from 'react'
import { ArrowRight, BadgeCheck, Check, ChevronRight, ExternalLink } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { whatsapp } from '../components/Layout'
import products from '../data/products.json'
import { trackEvent } from '../lib/analytics'
import { fetchSolutions, isSupabaseReady } from '../lib/supabase'
import { solutionSlugForProduct } from '../lib/product-solution-links'
import { Seo, seoDefaults } from '../components/Seo'
import { useSiteSettings } from '../lib/useSiteSettings'
import type { Solution } from '../types'

type ProductPageData = (typeof products)[number]

const productsBySlug = new Map<string, ProductPageData>(products.map((product) => [product.slug, product]))
const interestEvents: Record<string, 'control_interest' | 'bodegalia_interest' | 'weigh_label_interest'> = {
  'nodavexa-control': 'control_interest',
  bodegalia: 'bodegalia_interest',
  'automatizacion-pesaje-etiquetado': 'weigh_label_interest',
}

export function ProductLanding() {
  const { pathname } = useLocation()
  const slug = pathname.replace(/^\/+|\/+$/g, '')
  const settings = useSiteSettings()
  const [solution, setSolution] = useState<Solution | null>(null)
  const [remoteState, setRemoteState] = useState<'loading' | 'ready' | 'unavailable'>(isSupabaseReady ? 'loading' : 'unavailable')
  const fallback = productsBySlug.get(slug)
  const product = fallback && solution?.product_page
    ? { ...fallback, ...solution.product_page, price: fallback.price, product: solution.name, title: solution.name, description: solution.seo_description || fallback.description }
    : fallback

  useEffect(() => {
    let active = true
    setSolution(null)
    setRemoteState(isSupabaseReady ? 'loading' : 'unavailable')
    fetchSolutions().then((items) => {
      if (active) {
        setSolution(items.find((item) => item.slug === solutionSlugForProduct(slug)) || null)
        setRemoteState(isSupabaseReady ? 'ready' : 'unavailable')
      }
    }).catch(() => { if (active) setRemoteState('unavailable') })
    return () => { active = false }
  }, [slug])

  useEffect(() => {
    if (fallback) trackEvent('product_page_view', { product: fallback.product, page_slug: fallback.slug })
  }, [fallback])

  if (remoteState === 'loading') return <div className="loading">Cargando solución…</div>
  if (!product || !solution && (remoteState === 'ready' || slug === 'automatizacion-pesaje-etiquetado')) return <><Seo title="Solución no disponible | Nodavexa" description="Esta solución no está publicada actualmente." path={`/${slug}`} noindex /><section className="not-found-page"><span className="section-index">PRODUCTO NO DISPONIBLE</span><h1>No encontramos esta solución.</h1><p>Explora los productos de Nodavexa o cuéntanos qué necesita resolver tu operación.</p><div><Link className="btn primary" to="/">Ver soluciones</Link><Link to="/contacto">Contactar</Link></div></section></>

  const isBodegalia = product.slug === 'bodegalia'
  const officialUrl = isBodegalia ? solution?.website_url || 'https://bodegalia.nodavexa.com/' : ''
  const contactUrl = `/contacto?producto=${encodeURIComponent(product.slug)}`
  const chatUrl = whatsapp(product.whatsapp, settings.whatsapp)
  const trackInterest = (location: string) => trackEvent(interestEvents[product.slug], { product: product.product, page_slug: product.slug, cta_location: location })
  const requestDemo = (location: string) => {
    trackEvent('demo_cta_click', { product: product.product, page_slug: product.slug, cta_location: location })
    trackInterest(location)
  }

  return <article className={`product-page product-${product.slug}`}>
    <Seo
      title={solution ? `${solution.name} | Nodavexa` : product.title}
      description={product.description}
      path={`/${product.slug}`}
      jsonLd={{
        '@context': 'https://schema.org',
        '@type': 'Service',
        name: product.product,
        description: product.description,
        url: `${seoDefaults.site}/${product.slug}`,
        sameAs: officialUrl ? [officialUrl] : undefined,
        provider: { '@id': `${seoDefaults.site}/#organization` },
        areaServed: ['Guadalajara', 'Jalisco', 'Mexico'],
      }}
    />
    <nav className="breadcrumbs" aria-label="Ruta de navegación">
      <Link to="/">Inicio</Link><ChevronRight aria-hidden="true" /><span>Soluciones</span><ChevronRight aria-hidden="true" /><span aria-current="page">{product.product}</span>
    </nav>
    <header className="product-hero">
      <div className="product-hero-copy">
        <span className="section-index">{isBodegalia ? 'PRODUCTO DESARROLLADO POR NODAVEXA' : 'SOLUCIONES NODAVEXA'}</span>
        <h1>{product.h1}</h1>
        <p className="product-lead">{product.lead}</p>
        <p className="product-intro">{product.intro}</p>
        {isBodegalia && <p className="product-origin"><BadgeCheck aria-hidden="true" /><span><strong>Producto oficial de Nodavexa</strong>Consulta funciones, novedades y acceso comercial directamente en el sitio de Bodegalia.</span></p>}
        {isBodegalia && <p className="product-free-plan"><strong>Plan gratuito disponible.</strong> Consulta funciones y condiciones en el sitio oficial.</p>}
        <div className="product-actions">
          {isBodegalia
            ? <a className="btn primary" href={officialUrl} target="_blank" rel="noreferrer" onClick={() => trackInterest('official_site_hero')}>Visitar sitio oficial <ExternalLink /></a>
            : <Link className="btn primary" to={contactUrl} onClick={() => requestDemo('hero')}>{product.slug === 'automatizacion-pesaje-etiquetado' ? 'Solicitar diagnóstico' : 'Agendar demo'} <ArrowRight /></Link>}
          <a className="product-whatsapp" href={chatUrl} target="_blank" rel="noreferrer" onClick={() => { trackEvent('whatsapp_click', { product: product.product, page_slug: product.slug, cta_location: 'hero' }); trackInterest('whatsapp_hero') }}>Hablar por WhatsApp</a>
        </div>
        {product.price && <p className="product-price"><strong>{product.price}</strong><span>{product.priceNote}</span></p>}
      </div>
      <div className="product-visual" aria-label={`Flujo de ${product.product}`}>
        {product.flow.map((step, index) => <div className="product-flow-step" key={step}><span>{String(index + 1).padStart(2, '0')}</span><b>{step}</b></div>)}
      </div>
    </header>

    {Boolean(product.manualFlow?.length) && <section className="product-compare" aria-labelledby="manual-flow-title">
      <div><span className="section-index">MENOS CAPTURA MANUAL</span><h2>Conecta el proceso de pesaje con el registro y la etiqueta.</h2></div>
      <div className="product-flow-columns">
        <div><h3 id="manual-flow-title">Proceso manual</h3><ol>{product.manualFlow?.map((step) => <li key={step}>{step}</li>)}</ol></div>
        <div><h3>Con Nodavexa</h3><ol>{product.flow.map((step) => <li key={step}>{step}</li>)}</ol></div>
      </div>
    </section>}

    <div className="product-content">
      {product.sections.map((section, index) => <section className="product-content-section" key={section.heading}>
        <span className="section-index">{String(index + 1).padStart(2, '0')} / {product.product.toUpperCase()}</span>
        <h2>{section.heading}</h2>
        <p>{section.copy}</p>
        {'items' in section && section.items && <ul className="product-feature-list">{section.items.map((item) => <li key={item}><Check aria-hidden="true" />{item}</li>)}</ul>}
      </section>)}
      <section className="product-audience">
        <div><span className="section-index">PARA QUIÉN</span><h2>Una solución para la operación diaria.</h2></div>
        <ul>{product.audiences.map((audience) => <li key={audience}>{audience}</li>)}</ul>
      </section>
      <section className="product-bottom-cta">
        <div><span className="section-index">SIGUIENTE PASO</span><h2>{isBodegalia ? 'Conoce Bodegalia desde su sitio oficial.' : `Revisemos cómo encaja ${product.product} en tu operación.`}</h2><p>{isBodegalia ? 'Revisa la información actualizada del producto y continúa desde el espacio oficial de Bodegalia.' : 'El alcance se define contigo después de entender el proceso, los usuarios y las herramientas que ya utilizas.'}</p></div>
        <div className="product-actions">
          {isBodegalia
            ? <a className="btn primary" href={officialUrl} target="_blank" rel="noreferrer" onClick={() => trackInterest('official_site_bottom')}>Ir a Bodegalia <ExternalLink /></a>
            : <Link className="btn primary" to={contactUrl} onClick={() => requestDemo('bottom')}>Agendar demo <ArrowRight /></Link>}
          <a className="product-whatsapp" href={chatUrl} target="_blank" rel="noreferrer" onClick={() => { trackEvent('whatsapp_click', { product: product.product, page_slug: product.slug, cta_location: 'bottom' }); trackInterest('whatsapp_bottom') }}>Hablar por WhatsApp</a>
        </div>
      </section>
    </div>
  </article>
}

export { productsBySlug }
