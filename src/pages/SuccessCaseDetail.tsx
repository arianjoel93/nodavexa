import { useEffect, useState } from 'react'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { Seo, seoDefaults } from '../components/Seo'
import { trackEvent } from '../lib/analytics'
import { fetchSuccessCases } from '../lib/supabase'
import type { SuccessCase } from '../types'

export function SuccessCaseDetail() {
  const { slug = '' } = useParams()
  const [item, setItem] = useState<SuccessCase | null>()

  useEffect(() => {
    fetchSuccessCases()
      .then((items) => {
        const found = items.find((candidate) => candidate.slug === slug) || null
        setItem(found)
        if (found) trackEvent('case_study_view', { page_slug: found.slug })
      })
      .catch(() => setItem(null))
  }, [slug])

  if (item === undefined) return <div className="loading">Cargando caso…</div>
  if (item === null) return <NotFoundCase />

  const path = `/casos-de-exito/${item.slug}`
  const bodegaliaCase = `${item.slug} ${item.title}`.toLowerCase().includes('bodegalia')
  const description = item.result || item.problem
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: item.title,
    description,
    mainEntityOfPage: `${seoDefaults.site}${path}`,
    author: { '@type': 'Organization', name: 'Nodavexa' },
    publisher: { '@type': 'Organization', name: 'Nodavexa', logo: { '@type': 'ImageObject', url: `${seoDefaults.site}/favicon.svg` } },
    image: item.cover_url || undefined,
  }

  return <>
    <Seo title={`${item.title} | Caso de proyecto | Nodavexa`} description={description} path={path} image={item.cover_url || undefined} imageAlt={`Proyecto: ${item.title}`} type="article" jsonLd={schema} />
    <nav className="breadcrumbs" aria-label="Ruta de navegación">
      <Link to="/">Inicio</Link><span aria-hidden="true">/</span><Link to="/casos-de-exito">Casos de éxito</Link><span aria-hidden="true">/</span><span aria-current="page">{item.title}</span>
    </nav>
    <section className="case-detail-hero">
      <div><Link to="/casos-de-exito"><ArrowLeft /> Volver a casos de éxito</Link><span>{item.client_type}</span><h1>{item.title}</h1><p>{item.problem}</p></div>
      <div className="case-detail-image" role="img" aria-label={`Imagen del proyecto: ${item.title}`} style={item.cover_url ? { backgroundImage: `url(${item.cover_url})` } : undefined} />
    </section>
    <section className="case-story">
      <article><span>PROBLEMA</span><h2>El reto de la operación</h2><p>{item.problem}</p></article>
      {item.description && <article className="case-description rich-content"><span>SOLUCIÓN E IMPLEMENTACIÓN</span><h2>Trabajo realizado</h2><div dangerouslySetInnerHTML={{ __html: item.description }} /></article>}
      <article className="case-result"><CheckCircle2 /><span>RESULTADO OPERATIVO</span><h2>Resultado descrito</h2><p>{item.result}</p></article>
    </section>
    {bodegaliaCase && <section className="case-product-link"><span className="section-index">PRODUCTO RELACIONADO</span><h2>Conoce Bodegalia</h2><p>Explora el sistema de inventarios y almacenes relacionado con este proyecto.</p><Link className="btn primary" to="/bodegalia">Ver Bodegalia</Link></section>}
  </>
}

function NotFoundCase() {
  return <>
    <Seo title="Caso no encontrado | Nodavexa" description="El caso solicitado no está disponible." path={window.location.pathname} noindex />
    <section className="not-found-page"><span className="section-index">CASO NO DISPONIBLE</span><h1>No encontramos este proyecto.</h1><p>Revisa otros casos publicados o cuéntanos qué necesitas resolver.</p><div><Link className="btn ghost" to="/casos-de-exito">Ver casos</Link><Link className="btn primary" to="/contacto">Contactar</Link></div></section>
  </>
}
