import { ArrowRight, Check, ChevronRight } from 'lucide-react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useEffect } from 'react'
import servicePages from '../data/service-pages.json'
import { trackEvent } from '../lib/analytics'
import { useSiteSettings } from '../lib/useSiteSettings'
import { whatsapp } from '../components/Layout'
import { Seo } from '../components/Seo'
import { usePublishedProducts } from '../lib/usePublishedProducts'

type ServicePageData = (typeof servicePages)[number]

const bySlug = new Map<string, ServicePageData>(servicePages.map((page) => [page.slug, page]))
const titleBySlug = new Map(servicePages.map((page) => [page.slug, page.h1]))
const productLinksByService: Record<string, { slug: string; product: string }[]> = {
  'crm-personalizado-guadalajara': [{ slug: 'nodavexa-control', product: 'Nodavexa Control' }],
  'sistemas-inventario-almacenes': [{ slug: 'bodegalia', product: 'Bodegalia' }],
  'automatizacion-procesos-guadalajara': [{ slug: 'automatizacion-pesaje-etiquetado', product: 'Nodavexa Weigh & Label' }],
  'integraciones-odoo': [
    { slug: 'nodavexa-control', product: 'Nodavexa Control' },
    { slug: 'bodegalia', product: 'Bodegalia' },
    { slug: 'automatizacion-pesaje-etiquetado', product: 'Nodavexa Weigh & Label' },
  ],
}

export function ServiceLanding() {
  const { slug = '' } = useParams()
  const settings = useSiteSettings()
  const publishedProducts = usePublishedProducts()
  const page = bySlug.get(slug)
  const relatedProducts = (productLinksByService[slug] || []).filter((item) => publishedProducts.some((product) => product.slug === item.slug))

  useEffect(() => {
    if (page) trackEvent('seo_service_page_view', { page_slug: page.slug })
  }, [page])

  if (!page) return <ServiceNotFound />

  const contactUrl = `/contacto?servicio=${encodeURIComponent(page.slug)}`
  const whatsappUrl = whatsapp(`Hola, vi Nodavexa y me gustaría conocer cómo podrían digitalizar un proceso de mi empresa. Me interesa: ${page.h1}`, settings.whatsapp)
  return <div className="service-landing">
    <nav className="breadcrumbs" aria-label="Ruta de navegación">
      <Link to="/">Inicio</Link><ChevronRight aria-hidden="true" /><Link to="/soluciones">Soluciones</Link><ChevronRight aria-hidden="true" /><span aria-current="page">{page.h1}</span>
    </nav>
    <header className="service-hero">
      <span className="section-index">SOLUCIONES PARA EMPRESAS</span>
      <h1>{page.h1}</h1>
      <p>{page.lead}</p>
      <div className="service-hero-actions">
        <Link className="btn primary" to={contactUrl} onClick={() => trackEvent('demo_cta_click', { page_slug: page.slug })}>Agendar demo <ArrowRight /></Link>
        <a className="service-whatsapp" href={whatsappUrl} target="_blank" rel="noreferrer" onClick={() => trackEvent('whatsapp_click', { page_slug: page.slug })}>Hablar por WhatsApp</a>
      </div>
    </header>
    {relatedProducts.length > 0 && <nav className="service-products" aria-label="Productos relacionados"><span className="section-index">PRODUCTOS NODAVEXA</span><div>{relatedProducts.map(({ slug: productSlug, product }) => <Link key={productSlug} to={`/${productSlug}`} onClick={() => trackEvent('product_card_click', { product, page_slug: page.slug, cta_location: 'service_page' })}>{product} <ArrowRight /></Link>)}</div></nav>}
    <main className="service-content">
      {page.sections.map((section) => <section className="service-content-section" key={section.heading}>
        <span className="section-index">{page.h1}</span>
        <h2>{section.heading}</h2>
        <p>{section.copy}</p>
        {'items' in section && section.items && <ul className="service-check-list">{section.items.map((item) => <li key={item}><Check aria-hidden="true" />{item}</li>)}</ul>}
        {'flow' in section && section.flow && <div className="process-flow" aria-label="Comparación conceptual de un proceso manual y uno automatizado">
          <article><h3>Antes · pasos manuales</h3><ol><li>Recibe información</li><li>Copia a Excel</li><li>Genera un documento</li><li>Envía un correo</li><li>Actualiza otro sistema</li></ol></article>
          <article><h3>Después · flujo conectado</h3><ol><li>Recibe datos</li><li>Valida y procesa</li><li>Actualiza los sistemas</li><li>Genera el documento</li><li>Notifica al responsable</li></ol></article>
        </div>}
      </section>)}
      <section className="service-faq" aria-labelledby="service-faq-heading">
        <span className="section-index">PREGUNTAS FRECUENTES</span><h2 id="service-faq-heading">Resolvamos algunas dudas.</h2>
        {page.faqs.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}
      </section>
      <nav className="service-related" aria-label="Soluciones relacionadas">
        <h2>También puede interesarte</h2>
        <div>{page.related.map((relatedSlug) => <Link key={relatedSlug} to={`/${relatedSlug}`}>{titleBySlug.get(relatedSlug)} <ArrowRight /></Link>)}</div>
      </nav>
      <section className="service-bottom-cta"><div><span className="section-index">SIGUIENTE PASO</span><h2>Revisemos el proceso antes de elegir la herramienta.</h2><p>Cuéntanos cómo trabaja hoy tu equipo y qué te gustaría mejorar.</p></div><Link className="btn primary" to={contactUrl} onClick={() => trackEvent('demo_cta_click', { page_slug: page.slug, location: 'bottom' })}>Agendar demo <ArrowRight /></Link></section>
    </main>
  </div>
}

function ServiceNotFound() {
  const { pathname } = useLocation()
  return <><Seo title="Página no encontrada | Nodavexa" description="La página que buscas no está disponible." path={pathname} noindex /><section className="not-found-page"><span className="section-index">SOLUCIÓN NO ENCONTRADA</span><h1>Esta página no está disponible.</h1><p>Explora las soluciones publicadas o cuéntanos qué proceso buscas mejorar.</p><div><Link className="btn primary" to="/soluciones">Ver soluciones</Link><Link to="/contacto">Contactar a Nodavexa</Link></div></section></>
}

export { bySlug as servicePagesBySlug, titleBySlug as servicePageTitles }
