import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { ArrowDown, ArrowUpRight, Menu, MessageCircle, X } from 'lucide-react'
import { Logo } from './Logo'
import { Seo, seoDefaults } from './Seo'
import { useSiteSettings } from '../lib/useSiteSettings'
import { trackEvent } from '../lib/analytics'
import servicePages from '../data/service-pages.json'
import products from '../data/products.json'
import { usePublishedProducts } from '../lib/usePublishedProducts'
import { faqs } from '../lib/landing-content'
import { useSiteMotion } from '../lib/useSiteMotion'

export const whatsapp = (message = 'Hola, vi Nodavexa y me gustaría conocer qué solución podría ayudar a mejorar la operación de mi empresa.', number?: string) =>
  `https://wa.me/${(number || import.meta.env.VITE_WHATSAPP_NUMBER || '523338419644').replace(/\D/g, '')}?text=${encodeURIComponent(message)}`

export function Layout() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const motionRoot = useSiteMotion(location.pathname)
  const settings = useSiteSettings()
  const publishedProducts = usePublishedProducts()
  const isResourceArea = location.pathname === '/recursos' || location.pathname.startsWith('/recursos/')

  useEffect(() => {
    setOpen(false)
    if (location.hash) {
      window.setTimeout(() => document.querySelector(location.hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
    } else {
      window.scrollTo(0, 0)
    }
  }, [location.pathname, location.hash])

  const pages: Record<string, { title: string; description: string }> = {
    '/': {
      title: 'CRM, inventarios y automatización en Guadalajara | Nodavexa',
      description: 'Software para PYMES en Guadalajara. Centraliza ventas, inventarios y procesos operativos con CRM, sistemas de almacén y automatización.',
    },
    '/distribuidoras-guadalajara': {
      title: 'Software de ventas e inventario para distribuidoras en Guadalajara | Nodavexa',
      description: 'Sistema comercial para empresas en Guadalajara, Zapopan, Tlaquepaque, Tonalá y Zona Metropolitana. Centraliza clientes, cotizaciones e inventario.',
    },
    '/soluciones': {
      title: 'Soluciones de software para ventas, inventario y procesos | Nodavexa',
      description: 'Explora CRM y gestión comercial, inventarios, sistemas para clínicas, integraciones Odoo y APIs, automatización y aplicaciones web a medida.',
    },
    '/recursos': {
      title: 'Herramientas gratuitas para datos y procesos | Nodavexa',
      description: 'Utilidades gratuitas para transformar Excel y CSV en formatos útiles para tu operación. Los archivos se procesan localmente en tu navegador.',
    },
    '/recursos/excel-a-sqlite': {
      title: 'Convertir Excel o CSV a SQLite | Nodavexa',
      description: 'Convierte hojas de cálculo Excel y CSV en una base de datos SQLite .db desde tu navegador, sin subir tus archivos a internet.',
    },
    '/recursos/csv-formato-texto': {
      title: 'Convertidor CSV Formato Tipo Texto | Nodavexa',
      description: 'Convierte Excel o CSV a un archivo CSV UTF-8 separado por comas, con todos los campos delimitados por comillas dobles.',
    },
    '/como-trabajamos': {
      title: 'Cómo trabajamos | Nodavexa',
      description: 'Conoce las etapas de diagnóstico, diseño, desarrollo e implementación de soluciones tecnológicas de Nodavexa.',
    },
    '/preguntas': {
      title: 'Preguntas frecuentes | Nodavexa',
      description: 'Resuelve tus dudas sobre soluciones CRM, software a medida, integraciones, implementación, mantenimiento y soporte de Nodavexa.',
    },
    '/casos-de-exito': {
      title: 'Proyectos de software para empresas | Nodavexa',
      description: 'Conoce proyectos publicados de sistemas de inventario, plataformas internas y herramientas digitales para distintas operaciones empresariales.',
    },
    '/formularios/proyecto': {
      title: 'Formulario de proyecto | Nodavexa',
      description: 'Formulario para recopilar requerimientos de sitios web, landing pages, aplicaciones web y software instalable.',
    },
    '/nosotros': {
      title: 'Empresa de soluciones tecnológicas en México | Nodavexa',
      description: 'Conoce Nodavexa y nuestra experiencia creando sistemas para un laboratorio de ciencias, una clínica estética y una empresa comercial. Software adaptado a cada proceso.',
    },
    '/contacto': {
      title: 'Cuéntanos tu proyecto de software | Nodavexa',
      description: 'Cuéntanos qué proceso quieres mejorar. Revisamos proyectos de CRM, inventarios, aplicaciones, automatización e integraciones en Guadalajara y México.',
    },
    '/privacidad': {
      title: 'Aviso de Privacidad | Nodavexa',
      description: 'Conoce cómo Nodavexa recaba, utiliza, protege y conserva los datos personales relacionados con su sitio y servicios de software.',
    },
    '/terminos': {
      title: 'Términos y Condiciones | Nodavexa',
      description: 'Condiciones generales del sitio y de los servicios de CRM, software a medida, hosting, mantenimiento e integraciones de Nodavexa.',
    },
  }

  const servicePage = servicePages.find((page) => location.pathname === `/${page.slug}`)
  const productPage = products.find((product) => location.pathname === `/${product.slug}`)
  const current = pages[location.pathname] || (servicePage ? { title: servicePage.title, description: servicePage.description } : productPage ? { title: productPage.title, description: productPage.description } : undefined)
  const organization = {
    '@type': 'Organization',
    '@id': `${seoDefaults.site}/#organization`,
    name: 'Nodavexa',
    url: seoDefaults.site,
    logo: `${seoDefaults.site}/favicon.svg`,
    email: 'soporte@nodavexa.com',
    telephone: '+52 33 3841 9644',
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+52 33 3841 9644',
      email: 'soporte@nodavexa.com',
      contactType: 'sales',
      areaServed: 'MX',
      availableLanguage: ['Spanish'],
    },
    areaServed: [
      { '@type': 'City', name: 'Guadalajara' },
      { '@type': 'AdministrativeArea', name: 'Jalisco' },
      { '@type': 'Country', name: 'Mexico' },
    ],
  }
  const serviceJsonLd = servicePage ? {
    '@context': 'https://schema.org',
    '@graph': [
      organization,
      {
        '@type': 'Service',
        '@id': `${seoDefaults.site}/${servicePage.slug}#service`,
        name: servicePage.h1,
        serviceType: servicePage.h1,
        url: `${seoDefaults.site}/${servicePage.slug}`,
        description: servicePage.description,
        provider: { '@id': `${seoDefaults.site}/#organization` },
        areaServed: [
          { '@type': 'City', name: 'Guadalajara' },
          { '@type': 'AdministrativeArea', name: 'Jalisco' },
          { '@type': 'Country', name: 'Mexico' },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: servicePage.faqs.map(([question, answer]) => ({
          '@type': 'Question',
          name: question,
          acceptedAnswer: { '@type': 'Answer', text: answer },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Inicio', item: `${seoDefaults.site}/` },
          { '@type': 'ListItem', position: 2, name: 'Soluciones', item: `${seoDefaults.site}/soluciones` },
          { '@type': 'ListItem', position: 3, name: servicePage.h1, item: `${seoDefaults.site}/${servicePage.slug}` },
        ],
      },
    ],
  } : undefined
  const productJsonLd = productPage ? {
    '@context': 'https://schema.org',
    '@graph': [
      organization,
      {
        '@type': 'Service',
        '@id': `${seoDefaults.site}/${productPage.slug}#service`,
        name: productPage.product,
        serviceType: productPage.product,
        url: `${seoDefaults.site}/${productPage.slug}`,
        description: productPage.description,
        provider: { '@id': `${seoDefaults.site}/#organization` },
        areaServed: [
          { '@type': 'City', name: 'Guadalajara' },
          { '@type': 'AdministrativeArea', name: 'Jalisco' },
          { '@type': 'Country', name: 'Mexico' },
        ],
      },
    ],
  } : undefined
  const corporateJsonLd = ['/', '/distribuidoras-guadalajara'].includes(location.pathname) ? {
    '@context': 'https://schema.org',
    '@graph': [
      organization,
      { '@type': 'WebSite', '@id': `${seoDefaults.site}/#website`, url: seoDefaults.site, name: 'Nodavexa', publisher: { '@id': `${seoDefaults.site}/#organization` }, inLanguage: 'es-MX' },
    ],
  } : undefined
  const questionsJsonLd = location.pathname === '/preguntas' ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(([question, answer]) => ({ '@type': 'Question', name: question, acceptedAnswer: { '@type': 'Answer', text: answer } })),
  } : undefined

  return <div className="public-site" ref={motionRoot}>
    {current && !productPage && !isResourceArea && <Seo title={current.title} description={current.description} path={location.pathname} noindex={location.pathname === '/formularios/proyecto'} jsonLd={serviceJsonLd || productJsonLd || corporateJsonLd || questionsJsonLd} />}
    {!isResourceArea && <header className="site-header">
      <Link to="/"><Logo /></Link>
      <button className="menu-btn" onClick={() => setOpen(!open)} aria-label="Menú">{open ? <X /> : <Menu />}</button>
      <nav className={open ? 'open' : ''}>
        <Link to="/">Inicio</Link>
        <details className="nav-solutions">
          <summary>Soluciones <ArrowDown size={14} aria-hidden="true" /></summary>
          <div className="nav-solutions-menu">
            {publishedProducts.map((product) => <Link to={`/${product.slug}`} key={product.slug}>{product.product}</Link>)}
          </div>
        </details>
        <Link to="/casos-de-exito">Casos de éxito</Link>
        <Link to="/recursos">Recursos</Link>
        <Link to="/nosotros">Nosotros</Link>
        <Link to="/contacto">Contacto</Link>
        <Link className="nav-cta" to="/contacto" onClick={() => trackEvent('demo_cta_click', { page_slug: location.pathname.slice(1) || 'home', cta_location: 'header' })}>Agendar demo <ArrowUpRight size={16} /></Link>
      </nav>
    </header>}
    <main><Outlet /></main>
    <a className="whatsapp-float" href={whatsapp(undefined, settings.whatsapp)} target="_blank" rel="noreferrer" aria-label="Contactar a Nodavexa por WhatsApp" onClick={() => trackEvent('whatsapp_click', { location: 'floating_button', page_slug: location.pathname.slice(1) || 'home' })}><MessageCircle /><span>¿Hablamos?</span></a>
    <Footer />
  </div>
}

function Footer() {
  const settings = useSiteSettings()
  const publishedProducts = usePublishedProducts()
  return <footer>
    <div className="footer-main">
      <Logo light />
      <div>
        <h4>Productos</h4>
        {publishedProducts.map((product) => <Link to={`/${product.slug}`} key={product.slug}>{product.product}</Link>)}
      </div>
      <div>
        <h4>Soluciones</h4>
        <Link to="/crm-personalizado-guadalajara">CRM personalizado</Link>
        <Link to="/software-a-medida-guadalajara">Software a medida</Link>
        <Link to="/automatizacion-procesos-guadalajara">Automatización</Link>
        <Link to="/sistemas-inventario-almacenes">Inventarios</Link>
        <Link to="/integraciones-odoo">Integraciones Odoo</Link>
      </div>
      <div>
        <h4>Empresa</h4>
        <Link to="/recursos/crear-cotizacion">Cotizador gratuito</Link>
        <Link to="/como-trabajamos">Cómo trabajamos</Link>
        <Link to="/nosotros">Nosotros</Link>
        <Link to="/casos-de-exito">Casos de éxito</Link>
        <Link to="/contacto">Contacto</Link>
        <Link to="/recursos">Recursos</Link>
      </div>
      <div>
        <h4>Contacto</h4>
        <a href={`mailto:${settings.email}`}>{settings.email}</a>
        <a href={whatsapp(undefined, settings.whatsapp)} target="_blank" rel="noreferrer" onClick={() => trackEvent('whatsapp_click', { page_slug: 'footer', cta_location: 'footer' })}>Hablar por WhatsApp</a>
        <span>Guadalajara, Jalisco.</span>
        <span>Atención en todo México.</span>
      </div>
    </div>
    <div className="footer-bottom">
      <span>© {new Date().getFullYear()} Nodavexa</span>
      <div className="footer-legal">
        <Link to="/privacidad">Aviso de privacidad</Link>
        <Link to="/terminos">Términos y condiciones</Link>
        <Link to="/admin">Acceso administrativo</Link>
      </div>
    </div>
  </footer>
}
