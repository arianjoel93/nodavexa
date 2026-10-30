import { useEffect, useState } from 'react'
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  BrainCircuit,
  CheckCircle2,
  DatabaseZap,
  HelpCircle,
  Layers3,
  MessageCircle,
  Pause,
  PackageSearch,
  Play,
  Send,
  Smartphone,
  Stethoscope,
  Users,
  Workflow,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { MotionNumber } from '../MotionNumber'
import { defaultHomepageHeroSlides, supabase } from '../../lib/supabase'
import type { HomepageHeroSlide } from '../../types'
import { whatsapp } from '../Layout'
import { useSiteSettings, useSiteSettingsWithStatus } from '../../lib/useSiteSettings'
import { trackEvent } from '../../lib/analytics'
import { faqs, processSteps } from '../../lib/landing-content'
import { usePublishedProducts } from '../../lib/usePublishedProducts'
import workflowImage from '../../assets/nodavexa-software-workflow-optimized.jpg'
import homeHeroImage from '../../assets/nodavexa-home-hero-optimized.jpg'

const problemItems = [
  ['Excel decide demasiado', 'Archivos duplicados, formulas rotas y versiones distintas para ventas, inventario o agenda.'],
  ['Procesos manuales', 'Capturas repetidas, autorizaciones por mensaje y tareas que dependen de recordar el siguiente paso.'],
  ['Informacion dispersa', 'Clientes, pacientes, productos, reportes y documentos viviendo en herramientas desconectadas.'],
  ['Tareas repetitivas', 'Seguimientos, avisos, reportes y validaciones que pueden automatizarse sin perder control.'],
  ['Falta de control', 'Direccion no ve oportunidades, entregas, margenes o pendientes hasta que alguien arma un reporte.'],
]

const heroBenefits = [
  [CheckCircle2, 'Diseñado a la medida', 'Un sistema que refleja los procesos reales de tu empresa.'],
  [Workflow, 'Implementación por etapas', 'Alcance y avances claros desde el primer paso.'],
  [MessageCircle, 'Acompañamiento cercano', 'Capacitación y soporte después de ponerlo en marcha.'],
] as const

const serviceSolutions = [
  {
    icon: Users,
    title: 'CRM y gestion comercial',
    problem: 'Prospectos, clientes y cotizaciones se pierden entre WhatsApp, Excel y conversaciones.',
    solution: 'Centralizamos oportunidades, historial, responsables, cotizaciones, seguimientos y cierres.',
    benefits: ['Pipeline visible', 'Propuestas mas rapidas', 'Alertas de seguimiento'],
  },
  {
    icon: PackageSearch,
    title: 'Inventarios y almacenes',
    problem: 'Existencias, movimientos y pedidos dependen de archivos o de preguntar al equipo.',
    solution: 'Creamos sistemas para consultar stock, registrar entradas/salidas y controlar productos.',
    benefits: ['Stock actualizado', 'Menos errores', 'Reportes de movimiento'],
  },
  {
    icon: Stethoscope,
    title: 'Clinicas, consultorios y esteticas',
    problem: 'Agenda, pacientes, servicios, pagos y recordatorios viven separados.',
    solution: 'Diseñamos herramientas para citas, expedientes, paquetes, seguimiento y control operativo.',
    benefits: ['Agenda organizada', 'Historial de pacientes', 'Recordatorios automatizados'],
  },
  {
    icon: DatabaseZap,
    title: 'Integraciones Odoo, APIs y sistemas externos',
    problem: 'Tus sistemas no se hablan y el equipo captura la misma informacion dos veces.',
    solution: 'Conectamos Odoo, formularios, hojas, APIs, paneles y servicios externos en flujos claros.',
    benefits: ['Menos recaptura', 'Datos conectados', 'Operaciones escalables'],
  },
  {
    icon: BrainCircuit,
    title: 'Automatizacion e inteligencia artificial',
    problem: 'Hay tareas repetitivas que consumen tiempo y reportes que llegan tarde.',
    solution: 'Automatizamos recordatorios, clasificacion, reportes, generacion de documentos y asistentes internos.',
    benefits: ['Ahorro de tiempo', 'Respuestas mas rapidas', 'Procesos medibles'],
  },
  {
    icon: Layers3,
    title: 'Software y aplicaciones web a medida',
    problem: 'Un software generico no coincide con la forma real en que trabaja tu empresa.',
    solution: 'Desarrollamos plataformas web, portales, apps internas y sistemas instalables alrededor de tu operacion.',
    benefits: ['Flujos a medida', 'Roles y permisos', 'Crecimiento por etapas'],
  },
]

const successCases = [
  { slug: 'sistema-para-laboratorio-de-ciencias', solution: 'SOFTWARE A MEDIDA', title: 'Sistema para laboratorio de ciencias', description: 'Dashboard, inventario y registro de pacientes para apoyar la operación de un laboratorio.' },
  { slug: 'sistema-para-clinica-estetica', solution: 'SISTEMAS PARA CLÍNICAS', title: 'Sistema para clínica estética', description: 'Herramienta digital de gestión de citas y clientes, diseñada alrededor de los procesos de una clínica estética.' },
  { slug: 'sistema-para-empresa-de-venta-de-chamarras', solution: 'CRM Y GESTIÓN COMERCIAL', title: 'CRM para empresa de venta de chamarras', description: 'Sistema de gestión de ventas para acompañar la operación comercial de una empresa de chamarras.' },
]

type LandingVariant = 'home' | 'guadalajara'

export function DistributorLanding({ variant = 'home' }: { variant?: LandingVariant }) {
  const {settings,loaded} = useSiteSettingsWithStatus()
  const isLocal = variant === 'guadalajara'
  const whatsappHref = whatsapp('Hola, vi Nodavexa y me gustaría conocer qué solución podría ayudar a mejorar la operación de mi empresa.', settings.whatsapp)

  return (
    <>
      {!isLocal ? <HomeLanding whatsappHref={whatsappHref} slides={loaded ? settings.homepage_hero_slides || defaultHomepageHeroSlides : null} /> : <>
      <section className="dist-hero nx-hero">
        <div className="rishi-hero-photo" aria-hidden="true">
          <img src={homeHeroImage} alt="" />
        </div>
        <div className="dist-hero-copy">
          <span className="section-index">{isLocal ? 'SOFTWARE PARA EMPRESAS EN GUADALAJARA Y MÉXICO' : 'SOFTWARE A MEDIDA PARA LA OPERACIÓN DE TU EMPRESA'}</span>
          <h1>Ordenamos procesos de empresas con sistemas a la medida</h1>
          <p>
            Diseñamos software para conectar ventas, inventario, atención y procesos internos.
          </p>
          <div className="hero-actions">
            <Link className="btn primary" to="/contacto" onClick={() => trackEvent('demo_cta_hero', { variant })}>
              Cuéntanos tu proyecto <ArrowRight />
            </Link>
            <Link className="btn ghost" to="/soluciones" onClick={() => trackEvent('demo_cta_hero', { variant, cta: 'soluciones' })}>
              Explorar soluciones
            </Link>
          </div>
        </div>
      </section>

      <section className="rishi-benefit-band" aria-label="Ventajas de trabajar con Nodavexa">
        <div className="rishi-benefit-grid">
          {heroBenefits.map(([Icon, title, text]) => (
            <article key={title}>
              <span className="rishi-benefit-icon"><Icon strokeWidth={1.8} /></span>
              <div><h2>{title}</h2><p>{text}</p></div>
            </article>
          ))}
        </div>
      </section>

      <LocalMarketSection />
      <ProblemsSection />
      <ServicesSection />
      <ShowcaseSection />
      <SuccessCasesSection />
      <ProcessSection />
      <DemoSection />
      <FaqSection />
      <DemoFormSection />
      <FinalCta whatsappHref={whatsappHref} />
      </>}
    </>
  )
}

function HomeLanding({ whatsappHref, slides }: { whatsappHref: string; slides: HomepageHeroSlide[] | null }) {
  return <>
    <section className="dist-hero nx-hero home-hero">
      {slides ? <HomeHeroCarousel slides={slides} /> : <div className="rishi-hero-photo home-hero-carousel" aria-busy="true" aria-label="Cargando imágenes del banner" />}
      <div className="dist-hero-copy">
        <span className="section-index">CRM · INVENTARIOS · AUTOMATIZACIÓN</span>
        <h1>Digitalizamos la operación de PYMES</h1>
        <p>Ayudamos a empresas a controlar ventas, inventarios y procesos operativos mediante software e integraciones diseñadas alrededor de su operación.</p>
        <p className="home-hero-secondary">Deja atrás Excel, WhatsApp y tareas manuales con herramientas que centralizan información y dan más control a tu equipo.</p>
        <div className="hero-actions">
          <Link className="btn primary" to="/contacto" onClick={() => trackEvent('demo_cta_click', { page_slug: 'home', cta_location: 'hero_primary' })}>Agendar demo <ArrowRight /></Link>
          <Link className="btn ghost" to="/soluciones" onClick={() => trackEvent('demo_cta_click', { page_slug: 'home', cta_location: 'hero_secondary' })}>Ver soluciones</Link>
        </div>
        <div className="home-proof-line"><span>Guadalajara, Jalisco</span><span>Atención en todo México</span><span>Implementaciones por etapas</span></div>
      </div>
    </section>
    <BodegaliaFeature />
    <HomeProductSolutions />
    <HomeProblemsSection />
    <HomeCapabilities />
    <HomeResourcesSection />
    <HomeMovingBand />
    <HomeMethodSection />
    <FinalCta whatsappHref={whatsappHref} />
  </>
}

function HomeResourcesSection() {
  return <section className="dist-section home-resources-feature home-scroll-reveal" aria-labelledby="home-resources-title">
    <div className="home-resources-photo"><img src="https://images.pexels.com/photos/4481323/pexels-photo-4481323.jpeg?auto=compress&cs=tinysrgb&w=1000" alt="Equipo trabajando en la operación de un almacén" width="1000" height="750" loading="lazy" decoding="async" /><span>RECURSOS GRATUITOS NODAVEXA</span></div>
    <div className="home-resources-copy"><span className="section-index">UN APOYO PARA EMPRENDER</span><h2>Más tiempo para tu negocio.<br /><em>Menos complicaciones para llevar el control.</em></h2><p>Emprender ya exige tomar muchas decisiones. Encontrar una herramienta para organizar tus ventas, preparar una cotización o controlar tus existencias no debería quitarte tiempo de lo importante: atender a tus clientes y hacer avanzar tu operación.</p><p>Por eso creamos recursos gratuitos para emprendedores y pequeñas empresas. Herramientas sencillas para resolver tareas del día a día, empezar con más orden y dar el siguiente paso a tu ritmo.</p><ul><li><CheckCircle2 aria-hidden="true" /> Cotizaciones y registro de ventas</li><li><CheckCircle2 aria-hidden="true" /> Entradas, salidas y existencias de inventario</li><li><CheckCircle2 aria-hidden="true" /> Conversión de archivos Excel, CSV y SQLite</li></ul><Link className="btn primary" to="/recursos" onClick={() => trackEvent('resource_cta_click', { page_slug: 'home', cta_location: 'resources_feature' })}>Explorar herramientas gratuitas <ArrowRight /></Link><small>Crea tu cuenta gratis y elige las herramientas que necesitas. Cada recurso muestra su alcance y sus límites de uso.</small></div>
  </section>
}

function HomeHeroCarousel({ slides }: { slides: HomepageHeroSlide[] }) {
  const safeSlides = slides.length === 3 ? slides : defaultHomepageHeroSlides
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = window.setInterval(() => setActive((index) => (index + 1) % safeSlides.length), 6500)
    return () => window.clearInterval(timer)
  }, [paused, safeSlides.length])

  const select = (direction: number) => setActive((index) => (index + direction + safeSlides.length) % safeSlides.length)

  return <div className="rishi-hero-photo home-hero-carousel" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false) }}>
    {safeSlides.map((slide, index) => <img key={`${index}-${slide.image_url}`} className={index === active ? 'is-active' : ''} src={slide.image_url} alt={slide.alt} aria-hidden={index !== active} fetchPriority={index === 0 ? 'high' : 'auto'} loading={index === 0 ? 'eager' : 'lazy'} />)}
    <div className="home-hero-carousel-controls" role="group" aria-label="Controles del banner">
      <button type="button" aria-label="Imagen anterior" onClick={() => select(-1)}><ChevronLeft /></button>
      <div className="home-hero-carousel-dots">{safeSlides.map((slide, index) => <button key={slide.image_url} type="button" aria-label={`Mostrar imagen ${index + 1}`} aria-pressed={index === active} onClick={() => setActive(index)} />)}</div>
      <button type="button" aria-label="Imagen siguiente" onClick={() => select(1)}><ChevronRight /></button>
    </div>
  </div>
}

function BodegaliaFeature() {
  return <section className="home-bodegalia-feature home-scroll-reveal" aria-labelledby="home-bodegalia-title">
    <div className="home-bodegalia-copy">
      <span className="section-index">PRODUCTO DESARROLLADO POR NODAVEXA</span>
      <h2 id="home-bodegalia-title">Bodegalia: inventario claro, operación bajo control.</h2>
      <p>Un sistema para saber qué tienes, dónde está y cómo se mueve. Reúne existencias, movimientos y almacenes en una vista práctica para el trabajo diario.</p>
      <ul><li>Existencias por producto y almacén</li><li>Entradas, salidas y transferencias</li><li>Historial de movimientos y responsables</li></ul>
      <Link className="home-bodegalia-link" to="/bodegalia" onClick={() => trackEvent('product_card_click', { product: 'Bodegalia', page_slug: 'home', cta_location: 'featured_product' })}>Conocer Bodegalia y visitar su sitio oficial <ArrowRight /></Link>
    </div>
    <div className="home-bodegalia-visual">
      <img src="https://images.pexels.com/photos/4483942/pexels-photo-4483942.jpeg?auto=compress&cs=tinysrgb&w=1400" alt="Operador escanea cajas en un almacén para mantener el inventario actualizado" loading="lazy" />
      <div className="home-bodegalia-caption"><span>CONTROL DIARIO</span><strong>Del movimiento al inventario actualizado</strong></div>
      <div className="home-bodegalia-stat"><PackageSearch aria-hidden="true" /><span><b>Existencias</b>por ubicación</span></div>
    </div>
  </section>
}

function HomeMovingBand() {
  const companies = [
    { name: 'Instituto de Neurociencias', image: 'instituto-neurociencias.png' },
    { name: 'Mediterranean Multiservices', image: 'mediterranean.png' },
    { name: 'Cardoza', image: 'cardoza.png' },
    { name: 'Daniela Makeup', image: 'daniela-makeup.jpeg' },
    { name: 'Augen', image: 'augen.png' },
    { name: 'Bodegalia', image: 'bodegalia.png' },
  ]
  const [paused, setPaused] = useState(false)
  return <section className={`home-moving-band home-trusted-band${paused ? ' is-paused' : ''}`} aria-label="Empresas que confían en nosotros">
    <div className="home-trusted-intro"><span className="section-index">CONFIANZA QUE NOS CONECTA</span><h2 className="home-trusted-heading">Empresas que <em>confían en nosotros.</em></h2><span className="home-trusted-rule" aria-hidden="true" /></div>
    <div className="home-moving-window">
      <div className="home-moving-track">{[0, 1].map((copy) => <div className="home-moving-group" key={copy} aria-hidden={copy === 1}>{companies.map((company) => <span className="home-trusted-company" key={company.name}><img src={`/images/trusted/${company.image}`} alt={copy === 0 ? company.name : ''} width="180" height="80" loading="lazy" /><small>{company.name}</small><i /></span>)}</div>)}</div>
    </div>
    <button className="home-moving-toggle" type="button" title={paused ? 'Reanudar movimiento' : 'Pausar movimiento'} aria-label={paused ? 'Reanudar movimiento' : 'Pausar movimiento'} aria-pressed={paused} onClick={() => setPaused((value) => !value)}>{paused ? <Play /> : <Pause />}</button>
  </section>
}

const productCardMeta: Record<string, { icon: typeof Users; eyebrow: string }> = {
  'nodavexa-control': { icon: Users, eyebrow: 'CRM Y CONTROL COMERCIAL' },
  bodegalia: { icon: PackageSearch, eyebrow: 'INVENTARIOS Y ALMACENES' },
  'automatizacion-pesaje-etiquetado': { icon: Workflow, eyebrow: 'PESAJE Y ETIQUETADO' },
}

function HomeProductSolutions() {
  const products = usePublishedProducts()
  return <section className="dist-section home-products home-scroll-reveal" id="soluciones">
    <div className="home-section-heading"><div><span className="section-index">SOLUCIONES NODAVEXA</span><h2>Productos para necesidades operativas concretas.</h2></div><p>Partimos de problemas frecuentes y ajustamos la implementación al proceso, los equipos y las herramientas de cada empresa.</p></div>
    <div className="home-product-grid">{products.map((product) => {
      const { icon: Icon, eyebrow } = productCardMeta[product.slug] || { icon: Layers3, eyebrow: 'SOLUCIONES NODAVEXA' }
      const benefits = product.sections.find((section) => 'items' in section && section.items)?.items?.slice(0, 4) || []
      return <article className="home-product-card" key={product.slug}>
      <span className="home-product-icon"><Icon aria-hidden="true" /></span><small>{eyebrow}</small><h3>{product.product}</h3><p>{product.lead}</p>
      <ul>{benefits.map((benefit) => <li key={benefit}>{benefit}</li>)}</ul><p className="home-product-fit">{product.intro}</p>
      <Link to={`/${product.slug}`} onClick={() => trackEvent('product_card_click', { product: product.product, page_slug: 'home', cta_location: 'product_grid' })}>Conocer {product.product} <ArrowRight /></Link>
    </article>})}</div>
  </section>
}

function HomeCapabilities() {
  const products = usePublishedProducts()
  const problems = [
    ['Ventas y cotizaciones sin seguimiento', '/nodavexa-control', 'Reúne clientes, responsables y próximos pasos en un flujo comercial visible.'],
    ['Existencias que no cuadran', '/bodegalia', 'Consulta movimientos y existencias por almacén con registro de responsables.'],
    ['Pesaje y etiquetado manual', '/automatizacion-pesaje-etiquetado', 'Conecta equipos para reducir recapturas entre báscula, etiqueta e inventario.'],
    ['Un proceso propio que no encaja', '/software-a-medida-guadalajara', 'Diseñamos sistemas internos e integraciones alrededor del flujo real de tu empresa.'],
  ].filter(([, href]) => href !== '/automatizacion-pesaje-etiquetado' || products.some((product) => product.slug === 'automatizacion-pesaje-etiquetado'))
  return <section className="dist-section home-capabilities home-scroll-reveal">
    <div className="home-section-heading"><div><span className="section-index">IDENTIFICA TU RETO</span><h2>¿Qué parte de tu operación necesita más control?</h2></div><p>Si tu necesidad va más allá de un producto, también desarrollamos e integramos herramientas a medida.</p></div>
    <div className="home-problem-list">{problems.map(([title, href, text]) => <article key={title}><h3>{title}</h3><p>{text}</p><Link to={href}>Explorar solución <ArrowRight /></Link></article>)}</div>
    <div className="home-connected"><div><span className="section-index">SOFTWARE + OPERACIÓN</span><h3>Conectamos sistemas con los equipos y procesos que tu empresa ya utiliza.</h3><p>Desarrollo a medida, APIs e integraciones con Odoo, Excel, básculas, impresoras y lectores, según los requerimientos del proyecto.</p></div><div className="home-connect-tags">{['Odoo y APIs', 'Excel y bases de datos', 'Básculas', 'Impresoras', 'Códigos de barras', 'RFID'].map((label) => <span key={label}>{label}</span>)}</div></div>
  </section>
}

function HomeProblemsSection() {
  const problems = [
    ['Información dispersa', 'Datos repartidos entre archivos, mensajes y sistemas que no se conectan.'],
    ['Trabajo manual', 'Capturas repetidas, seguimientos y tareas que dependen de la memoria del equipo.'],
    ['Poco control', 'Cuesta saber qué está pendiente, quién lo atiende y qué requiere una decisión.'],
  ]

  return <section className="dist-section home-problems home-scroll-reveal">
    <span className="section-index">EL PROBLEMA QUE ATENDEMOS</span>
    <div className="home-section-heading"><h2>Cuando la operación depende de hojas sueltas y mensajes, crecer se vuelve difícil.</h2><p>Empezamos por entender el proceso y encontrar dónde un sistema puede ayudar de verdad.</p></div>
    <div className="home-problem-list">{problems.map(([title, text]) => <article key={title}><h3>{title}</h3><p>{text}</p></article>)}</div>
  </section>
}

function HomeMethodSection() {
  const stages = [['01', 'Entendemos el proceso'], ['02', 'Definimos alcance y etapas'], ['03', 'Construimos y probamos'], ['04', 'Acompañamos la implementación']]
  return <section className="dist-section home-method home-scroll-reveal">
    <div><span className="section-index">CÓMO TRABAJAMOS</span><h2>Un camino claro, desde el primer diagnóstico.</h2><Link className="home-text-link" to="/como-trabajamos">Conocer el proceso completo <ArrowRight /></Link></div>
    <ol>{stages.map(([number, title]) => <li key={number}><MotionNumber value={number} />{title}</li>)}</ol>
  </section>
}

function ShowcaseSection() {
  return (
    <section className="dist-section nx-showcase">
      <div className="nx-showcase-copy">
        <span className="section-index">OPERACION VISUAL</span>
        <h2>Paneles claros para vender, controlar inventario, coordinar citas y medir avances.</h2>
        <p>
          Cada proyecto se diseña para que el equipo vea lo importante primero: tareas pendientes, responsables, datos clave y siguientes acciones. La meta no es llenar pantallas, sino hacer que la operacion sea mas facil de dirigir.
        </p>
        <div className="showcase-pills" aria-label="Areas que puede controlar un sistema Nodavexa">
          <span>Ventas</span>
          <span>Inventario</span>
          <span>Citas</span>
          <span>Reportes</span>
        </div>
      </div>
      <figure className="workflow-visual">
        <img src={workflowImage} alt="Sistema de inventario y operacion mostrado en laptop y tablet" loading="lazy" />
        <figcaption>Una vista conectada para consultar existencias, movimientos y actividad del equipo.</figcaption>
      </figure>
    </section>
  )
}

function LocalMarketSection() {
  return (
    <section className="dist-section local-market">
      <span className="section-index">GUADALAJARA Y TODO MEXICO</span>
      <h2>Para empresas que necesitan tecnologia practica, no proyectos eternos.</h2>
      <p>Trabajamos con PYMES que necesitan ordenar ventas, inventario, citas, proyectos o datos internos sin perder la forma real en que opera su equipo.</p>
    </section>
  )
}

function ProblemsSection() {
  return (
    <section className="dist-section dist-problems nx-problems">
      <span className="section-index">PROBLEMAS QUE RESOLVEMOS</span>
      <h2>Cuando la operacion depende de memoria, mensajes y hojas sueltas, crecer se vuelve pesado.</h2>
      <div className="dist-problem-grid nx-problem-grid">
        {problemItems.map(([title, text], index) => (
          <article key={title}>
            <b>{String(index + 1).padStart(2, '0')}</b>
            <h3>{title}</h3>
            <p>{text}</p>
          </article>
        ))}
      </div>
      <p className="dist-section-note">No empezamos vendiendo tecnologia. Empezamos entendiendo que parte de tu operacion esta frenando ventas, servicio, control o rentabilidad.</p>
    </section>
  )
}

function ServicesSection() {
  return (
    <section id="que-incluye" className="dist-section nx-services">
      <div className="dist-section-heading">
        <div>
          <span className="section-index">SOLUCIONES ESPECIALIZADAS</span>
          <h2>No somos un producto unico. Diseñamos sistemas para distintas areas de tu PYME.</h2>
        </div>
        <p>Cada solucion puede implementarse como proyecto independiente o conectarse con otras areas cuando la empresa necesita una operacion mas integrada.</p>
      </div>
      <div className="nx-service-grid">
        {serviceSolutions.map(({ icon: Icon, title, problem, solution, benefits }) => (
          <article key={title} className="nx-service-card">
            <div className="service-card-icon" aria-hidden="true">
              <Icon strokeWidth={1.7} />
            </div>
            <h3>{title}</h3>
            <p><b>Problema:</b> {problem}</p>
            <p><b>Solucion:</b> {solution}</p>
            <ul>{benefits.map((benefit) => <li key={benefit}><CheckCircle2 /> {benefit}</li>)}</ul>
            <Link to="/contacto" onClick={() => trackEvent('demo_cta_click', { page_slug: 'distribuidoras-guadalajara', location: 'solution_card' })}>Revisar mi caso <ArrowRight /></Link>
          </article>
        ))}
      </div>
    </section>
  )
}

function SuccessCasesSection() {
  return (
    <section id="casos" className="dist-section example-case nx-cases">
      <span className="section-index">EXPERIENCIA APLICADA</span>
      <h2>Nuestras soluciones en proyectos reales.</h2>
      <p className="nx-cases-intro">Proyectos de software a medida, sistemas para clínicas y CRM comercial. Describimos el trabajo realizado sin divulgar información confidencial ni atribuir resultados no documentados.</p>
      <div className="example-case-grid">
        {successCases.map((item) => (
          <article key={item.slug}>
            <small>{item.solution}</small>
            <h3>{item.title}</h3>
            <p>{item.description}</p>
            <Link to={`/casos-de-exito/${item.slug}`}>Ver proyecto <ArrowRight /></Link>
          </article>
        ))}
      </div>
      <Link className="btn ghost case-link" to="/casos-de-exito">Conocer los proyectos <ArrowRight /></Link>
    </section>
  )
}

function ProcessSection() {
  return (
    <section id="como-funciona" className="dist-section nx-process">
      <span className="section-index">COMO TRABAJAMOS</span>
      <h2>Un proceso claro para pasar de idea o caos operativo a una herramienta funcionando.</h2>
      <div className="dist-timeline">
        {processSteps.map(([number, title, text]) => <article key={number}><small>{number}</small><h3>{title}</h3><p>{text}</p></article>)}
      </div>
    </section>
  )
}

function DemoSection() {
  return (
    <section id="demo" className="dist-section dist-demo">
      <div>
        <span className="section-index">MUESTRA DE TRABAJO</span>
        <h2>Mira un ejemplo de sistema en operacion.</h2>
        <p>Este tipo de herramienta puede adaptarse a inventarios, ventas, clinicas, control interno o paneles operativos.</p>
        <Link className="btn primary" to="/agendar-demo" onClick={() => trackEvent('video_demo_play')}>
          Quiero verlo con mi proceso <ArrowRight />
        </Link>
      </div>
      <div className="demo-video-frame" onPointerEnter={() => trackEvent('video_demo_play')}>
        <iframe
          title="Demo de control de inventarios Nodavexa"
          src="https://www.youtube.com/embed/ozsz3vmR4Y4?autoplay=1&mute=1&playsinline=1&loop=1&playlist=ozsz3vmR4Y4&controls=1&rel=0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          loading="lazy"
        />
      </div>
    </section>
  )
}

function FaqSection() {
  return (
    <section id="preguntas" className="dist-section faq-section dist-faq">
      <div>
        <span className="section-index">PREGUNTAS FRECUENTES</span>
        <h2>Antes de solicitar diagnostico.</h2>
      </div>
      <div className="faq-list">{faqs.map(([question, answer]) => <details key={question}><summary><HelpCircle /> {question}</summary><p>{answer}</p></details>)}</div>
    </section>
  )
}

function DemoFormSection() {
  const [form, setForm] = useState({ name: '', company: '', email: '', phone: '', need: '', currentProcess: '', website: '' })
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const settings = useSiteSettings()

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setStatus('idle')
    const message = `Solicitud de diagnostico Nodavexa

Necesidad principal: ${form.need || 'No indicada'}

Como trabajan actualmente:
${form.currentProcess}`
    const { error } = await supabase.functions.invoke('send-contact', {
      body: { name: form.name, company: form.company, email: form.email, phone: form.phone, message, website: form.website },
    })
    setBusy(false)
    if (error) {
      setStatus('error')
      return
    }
    trackEvent('demo_form_submit')
    setStatus('success')
    setForm({ name: '', company: '', email: '', phone: '', need: '', currentProcess: '', website: '' })
  }

  return (
    <section id="demo-form" className="dist-section demo-form-section">
      <div>
        <span className="section-index">CUENTANOS TU PROYECTO</span>
        <h2>Solicita un diagnostico y te decimos por donde conviene empezar.</h2>
        <p>Comparte el problema, herramientas actuales y objetivo. Con eso podemos orientar la primera fase del sistema.</p>
      </div>
      <form onSubmit={submit} aria-live="polite">
        <label>Nombre<input required value={form.name} onFocus={() => trackEvent('demo_form_start')} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
        <label>Empresa<input required value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} /></label>
        <label>Correo<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
        <label>WhatsApp<input required value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
        <label className="full">Que necesitas resolver<select required value={form.need} onChange={(event) => setForm({ ...form, need: event.target.value })}>
          <option value="" disabled>Selecciona una opcion</option>
          <option>CRM y ventas</option>
          <option>Inventario o almacen</option>
          <option>Clinica, consultorio o estetica</option>
          <option>Integracion Odoo / APIs</option>
          <option>Automatizacion e IA</option>
          <option>Software a medida</option>
        </select></label>
        <label className="honeypot" aria-hidden="true">Sitio web<input tabIndex={-1} autoComplete="off" value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} /></label>
        <label className="full">Como trabajan actualmente<textarea required minLength={20} rows={5} value={form.currentProcess} onChange={(event) => setForm({ ...form, currentProcess: event.target.value })} /></label>
        {status === 'success' && <div className="form-success">Recibimos tu solicitud. Te contactaremos para revisar el diagnostico.</div>}
        {status === 'error' && <div className="form-error">No pudimos enviar la solicitud. Escríbenos a {settings.email}.</div>}
        <button className="btn primary" disabled={busy}>{busy ? 'Enviando...' : 'Solicitar diagnostico'} <Send /></button>
      </form>
    </section>
  )
}

function FinalCta({ whatsappHref }: { whatsappHref: string }) {
  return (
    <section className="impact crm-final-cta dist-final">
      <Smartphone />
      <span>DIAGNOSTICO DE OPERACION</span>
      <h2>Si tu equipo ya trabaja mas de lo que tus herramientas permiten, es momento de ordenar el sistema.</h2>
      <p>Cuentanos que quieres resolver y diseñamos contigo la primera etapa.</p>
      <div className="hero-actions final-actions">
      <Link className="btn primary" to="/contacto" onClick={() => trackEvent('demo_cta_click', { page_slug: 'home', location: 'final' })}>Agendar demo <ArrowRight /></Link>
        <a className="btn ghost" href={whatsappHref} target="_blank" rel="noreferrer" onClick={() => trackEvent('whatsapp_click', { location: 'final_cta', page_slug: 'home' })}>WhatsApp <MessageCircle /></a>
      </div>
      <Link to="/soluciones" className="local-link">Ver soluciones publicadas</Link>
    </section>
  )
}
