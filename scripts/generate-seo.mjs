import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const dist = path.join(root, 'dist')
const site = (process.env.VITE_SITE_URL || 'https://nodavexa.com').replace(/\/$/, '')
const servicePages = JSON.parse(await readFile(path.join(root, 'src/data/service-pages.json'), 'utf8'))
const allProducts = JSON.parse(await readFile(path.join(root, 'src/data/products.json'), 'utf8'))
const siteFaqs = JSON.parse(await readFile(path.join(root, 'src/data/site-faqs.json'), 'utf8'))
const resourcePages = JSON.parse(await readFile(path.join(root, 'src/data/resource-pages.json'), 'utf8'))
const envText = await readFile(path.join(root, '.env.local'), 'utf8').catch(() => '')
const env = Object.fromEntries(envText.split(/\r?\n/).filter(Boolean).map((line) => {
  const index = line.indexOf('=')
  return [line.slice(0, index), line.slice(index + 1)]
}))
const supabaseUrl = process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])
const plainText = (value) => String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
const organization = {
  '@type': 'Organization',
  '@id': `${site}/#organization`,
  name: 'Nodavexa',
  url: site,
  logo: `${site}/favicon.svg`,
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

async function fetchPublished(pathname) {
  if (!supabaseUrl || !supabaseKey) return null
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/${pathname}`, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return await response.json()
  } catch (error) {
    console.warn(`SEO: no se pudo leer ${pathname}; se utilizarán datos locales. ${error instanceof Error ? error.message : ''}`)
    return null
  }
}

const fallbackSolutions = [
  { slug: 'crm-gestion-comercial', name: 'CRM y gestión comercial a medida', excerpt: 'Centraliza prospectos, clientes, cotizaciones y seguimientos en un proceso comercial diseñado para tu empresa.', description: 'CRM adaptado al flujo comercial, roles y reportes de cada equipo.', category: 'CRM y gestión comercial' },
  { slug: 'inventarios-almacenes', name: 'Sistema de inventarios y almacenes', excerpt: 'Organiza productos, existencias y movimientos con un sistema adaptado a tu operación.', description: 'Herramientas de consulta y control para inventario y almacén.', category: 'Inventarios y almacenes' },
  { slug: 'sistemas-clinicas-consultorios-esteticas', name: 'Sistemas para clínicas, consultorios y estéticas', excerpt: 'Software a medida para organizar la operación de clínicas y consultorios.', description: 'Sistemas diseñados de acuerdo con procesos, necesidades y alcance de cada clínica.', category: 'Sistemas para clínicas' },
  { slug: 'integraciones-odoo-apis', name: 'Integraciones Odoo, APIs y sistemas externos', excerpt: 'Conecta herramientas y datos para reducir capturas repetidas entre sistemas.', description: 'Integraciones entre Odoo, APIs, formularios y aplicaciones existentes.', category: 'Integraciones' },
  { slug: 'automatizacion-inteligencia-artificial', name: 'Automatización e inteligencia artificial', excerpt: 'Automatiza tareas y flujos repetitivos para facilitar el trabajo operativo.', description: 'Automatizaciones diseñadas alrededor de procesos y herramientas actuales.', category: 'Automatización' },
  { slug: 'software-aplicaciones-web-medida', name: 'Desarrollo de software y aplicaciones web a medida', excerpt: 'Aplicaciones y sistemas construidos alrededor de los procesos de tu empresa.', description: 'Software web a medida, desarrollado por etapas y validado con el equipo.', category: 'Software a medida' },
].map((item) => ({ ...item, cover_url: '', seo_keywords: [], seo_description: item.excerpt, base_price_mxn: 0, vat_rate: 16, has_vat: true, sat_withholdings_enabled: false, isr_withholding_rate: 0, vat_withholding_rate: 0, item_type: 'solution' }))

const fallbackCases = [
  { slug: 'sistema-para-laboratorio-de-ciencias', title: 'Sistema para un laboratorio de ciencias', client_type: 'Laboratorio científico', problem: 'El laboratorio necesitaba un sistema digital alineado con sus procesos y requerimientos de trabajo.', result: 'Se desarrolló un sistema para el laboratorio de ciencias, adaptado al alcance definido para el proyecto.', description: 'Proyecto de software a medida para un laboratorio científico. La información pública se mantiene general para proteger los detalles de operación del cliente.' },
  { slug: 'sistema-para-clinica-estetica', title: 'Sistema para una clínica estética', client_type: 'Clínica estética', problem: 'La clínica requería una solución de software que respondiera a sus necesidades de operación.', result: 'Se desarrolló un sistema para la clínica estética de acuerdo con el alcance del proyecto.', description: 'Proyecto de software para una clínica estética. No publicamos información de pacientes ni detalles internos del negocio.' },
  { slug: 'sistema-para-empresa-de-venta-de-chamarras', title: 'Sistema para una empresa de venta de chamarras', client_type: 'Comercio de prendas', problem: 'La empresa necesitaba apoyo de software para una operación enfocada en la venta de chamarras.', result: 'Se desarrolló un sistema para la empresa, ajustado al alcance acordado.', description: 'Proyecto de software a medida para una empresa comercializadora de chamarras.' },
  { slug: 'bodegalia-sistema-de-control-de-inventarios-y-almacenes', title: 'Bodegalia: sistema de control de inventarios y almacenes', client_type: 'Proyecto de inventarios y almacenes', problem: 'Proyecto de software enfocado en el control de inventarios y almacenes.', result: 'Sistema de control de inventarios y almacenes.', description: 'Caso de proyecto relacionado con control de inventarios y almacenes. Consulta la solución Bodegalia para conocer sus funciones.' },
]

const publishedSolutions = await fetchPublished('solutions?select=slug,name,excerpt,description,category,item_type,cover_url,seo_keywords,seo_description,base_price_mxn,vat_rate,has_vat,sat_withholdings_enabled,isr_withholding_rate,vat_withholding_rate,updated_at,product_page&published=eq.true&order=updated_at.desc')
let solutions = publishedSolutions || fallbackSolutions
let cases = await fetchPublished('success_cases?select=slug,title,client_type,problem,result,description,cover_url,updated_at&published=eq.true&order=created_at.desc') || fallbackCases
if (!solutions.length) solutions = fallbackSolutions
if (!cases.length) cases = fallbackCases

const productSolutionSlugs = {
  'nodavexa-control': 'nodavexa-control',
  bodegalia: 'sistema-de-inventario-y-control-de-almacenes',
  'automatizacion-pesaje-etiquetado': 'automatizacion-pesaje-etiquetado',
}
const products = allProducts.filter((product) => publishedSolutions
  ? publishedSolutions.some((solution) => solution.slug === productSolutionSlugs[product.slug])
  : product.slug !== 'automatizacion-pesaje-etiquetado')
for (const product of products) {
  const solution = solutions.find((item) => item.slug === productSolutionSlugs[product.slug])
  if (solution?.product_page) {
    const localPrice = product.price
    Object.assign(product, solution.product_page, {
      product: solution.name,
      title: `${solution.name} | Nodavexa`,
      description: solution.seo_description || product.description,
      price: localPrice,
    })
  }
}

const packagingProduct = {
  slug: 'calculadora-de-embalaje-y-peso-volumetrico',
  name: 'Calculadora de embalaje y peso volumétrico',
  excerpt: 'Compara cajas, calcula peso volumétrico y encuentra acomodos factibles con las dimensiones reales de tus productos.',
  description: 'Base de productos con dimensiones y peso. Define embalajes, compara cajas disponibles, propone acomodos factibles y estima peso volumétrico.',
  category: 'Inventarios y almacenes',
  item_type: 'product',
  cover_url: '',
  seo_keywords: [],
  seo_description: 'Calculadora de embalaje con base de productos, dimensiones y peso.',
  base_price_mxn: 0,
  vat_rate: 16,
  has_vat: true,
  updated_at: new Date().toISOString(),
}
if (!solutions.some((item) => item.slug === packagingProduct.slug)) solutions.push(packagingProduct)

const base = await readFile(path.join(dist, 'index.html'), 'utf8')
function setMeta(html, attribute, name, content) {
  const escaped = escapeHtml(content)
  const matcher = new RegExp(`<meta ${attribute}=["']${name}["'][^>]*>`, 'i')
  const tag = `<meta ${attribute}="${name}" content="${escaped}" />`
  return matcher.test(html) ? html.replace(matcher, tag) : html.replace('</head>', `    ${tag}\n  </head>`)
}

function createPage({ title, description, route, body, image, imageAlt = 'Nodavexa, software para empresas', type = 'website', schema, noindex = false, canonical = `${site}${route}` }) {
  let html = base.replace(/<title>.*?<\/title>/s, `<title>${escapeHtml(title)}</title>`)
  html = setMeta(html, 'name', 'description', description)
  html = setMeta(html, 'name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1')
  html = setMeta(html, 'property', 'og:title', title)
  html = setMeta(html, 'property', 'og:type', type)
  html = setMeta(html, 'property', 'og:description', description)
  html = setMeta(html, 'property', 'og:url', canonical)
  html = setMeta(html, 'property', 'og:image', image || `${site}/og-nodavexa.jpg`)
  html = setMeta(html, 'property', 'og:image:alt', imageAlt)
  html = setMeta(html, 'name', 'twitter:title', title)
  html = setMeta(html, 'name', 'twitter:description', description)
  html = setMeta(html, 'name', 'twitter:image', image || `${site}/og-nodavexa.jpg`)
  html = html.replace(/<link rel="canonical"[^>]*>/i, `<link rel="canonical" href="${escapeHtml(canonical)}" />`)
  html = html.replace(/<script type="application\/ld\+json">.*?<\/script>/s, '')
  if (schema) html = html.replace('</head>', `    <script data-static-seo type="application/ld+json">${JSON.stringify(schema).replace(/</g, '\\u003c')}</script>\n  </head>`)
  return html.replace('<div id="root"></div>', `<div id="root">${body}</div>`)
}

function serviceMarkup(page) {
  const sections = page.sections.map((section) => {
    const list = section.items?.length ? `<ul>${section.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''
    const flow = section.flow ? '<div><h3>Antes: pasos manuales</h3><ol><li>Recibe información</li><li>Copia a Excel</li><li>Genera un documento</li><li>Envía un correo</li><li>Actualiza otro sistema</li></ol><h3>Después: flujo conectado</h3><ol><li>Recibe datos</li><li>Valida y procesa</li><li>Actualiza los sistemas</li><li>Genera el documento</li><li>Notifica al responsable</li></ol></div>' : ''
    return `<section><h2>${escapeHtml(section.heading)}</h2><p>${escapeHtml(section.copy)}</p>${list}${flow}</section>`
  }).join('')
  const faqs = page.faqs.map(([question, answer]) => `<details><summary>${escapeHtml(question)}</summary><p>${escapeHtml(answer)}</p></details>`).join('')
  const related = page.related.map((slug) => {
    const relatedPage = servicePages.find((item) => item.slug === slug)
    return relatedPage ? `<li><a href="${site}/${slug}">${escapeHtml(relatedPage.h1)}</a></li>` : ''
  }).join('')
  const productSlugs = {
    'crm-personalizado-guadalajara': ['nodavexa-control'],
    'sistemas-inventario-almacenes': ['bodegalia'],
    'automatizacion-procesos-guadalajara': ['automatizacion-pesaje-etiquetado'],
    'integraciones-odoo': products.map((product) => product.slug),
  }[page.slug] || []
  const productLinks = productSlugs.map((slug) => products.find((product) => product.slug === slug)).filter(Boolean)
    .map((product) => `<li><a href="${site}/${product.slug}">${escapeHtml(product.product)}</a></li>`).join('')
  const productSection = productLinks ? `<section><h2>Productos relacionados</h2><ul>${productLinks}</ul></section>` : ''
  return `<article data-seo-prerender><nav aria-label="Ruta de navegación"><a href="${site}/">Inicio</a> / <a href="${site}/soluciones">Soluciones</a></nav><h1>${escapeHtml(page.h1)}</h1><p>${escapeHtml(page.lead)}</p><p><a href="${site}/contacto?servicio=${page.slug}">Agendar demo</a> · <a href="https://wa.me/523338419644?text=${encodeURIComponent('Hola, vi Nodavexa y me gustaría conocer qué solución podría ayudar a mejorar la operación de mi empresa.')}">Hablar por WhatsApp</a></p>${productSection}${sections}<section><h2>Preguntas frecuentes</h2>${faqs}</section><nav><h2>Soluciones relacionadas</h2><ul>${related}</ul></nav></article>`
}

const homeTitle = 'CRM, inventarios y automatización en Guadalajara | Nodavexa'
const homeDescription = 'Software para PYMES en Guadalajara. Centraliza ventas, inventarios y procesos operativos con CRM, sistemas de almacén y automatización.'
const homeServices = servicePages.map((page) => `<li><a href="${site}/${page.slug}">${escapeHtml(page.h1)}</a></li>`).join('')
const productCards = products.map((product) => `<article><h3><a href="${site}/${product.slug}">${escapeHtml(product.product)}</a></h3><p>${escapeHtml(product.lead)}</p><p>${escapeHtml(product.intro)}</p><ul>${product.sections.find((section) => section.items)?.items.slice(0, 4).map((item) => `<li>${escapeHtml(item)}</li>`).join('') || ''}</ul><a href="${site}/${product.slug}">Conocer ${escapeHtml(product.product)}</a></article>`).join('')
const caseFocus = {
  'sistema-para-laboratorio-de-ciencias': 'Software a medida',
  'sistema-para-clinica-estetica': 'Sistemas para clínicas',
  'sistema-para-empresa-de-venta-de-chamarras': 'CRM y gestión comercial',
  'bodegalia-sistema-de-control-de-inventarios-y-almacenes': 'Inventarios y almacenes',
}
const homeCaseCards = cases.map((item) => `<li><strong>${escapeHtml(caseFocus[item.slug] || 'Proyecto de software')}</strong><br><a href="${site}/casos-de-exito/${item.slug}">${escapeHtml(item.title)}</a><p>${escapeHtml(plainText(item.description || item.result || item.problem))}</p></li>`).join('')
const weighProblemLink = products.some((product) => product.slug === 'automatizacion-pesaje-etiquetado') ? `<li><a href="${site}/automatizacion-pesaje-etiquetado">Pesaje y etiquetado manual: conecta equipos, etiquetas y sistemas.</a></li>` : ''
const homeBody = `<div data-seo-prerender><h1>Digitalizamos la operación de PYMES</h1><p>Ayudamos a empresas a controlar ventas, inventarios y procesos operativos mediante software e integraciones diseñadas alrededor de su operación.</p><p>Deja atrás Excel, WhatsApp y procesos manuales con herramientas que centralizan información, reducen errores y automatizan tareas.</p><p><a href="${site}/contacto">Agendar demo</a> · <a href="#productos">Ver soluciones</a> · <a href="https://wa.me/523338419644?text=${encodeURIComponent('Hola, vi Nodavexa y me gustaría conocer qué solución podría ayudar a mejorar la operación de mi empresa.')}">Hablar por WhatsApp</a></p><section><h2>Bodegalia: inventario claro, operación bajo control</h2><p>Software para consultar existencias por producto y almacén, registrar entradas, salidas y transferencias, y conservar el historial de movimientos y responsables.</p><p><a href="${site}/bodegalia">Conocer Bodegalia, sistema de control de inventarios y almacenes</a></p></section><section id="productos"><h2>Productos para necesidades operativas concretas</h2>${productCards}</section><section><h2>¿Qué parte de tu operación necesita más control?</h2><ul><li><a href="${site}/nodavexa-control">Ventas y cotizaciones sin seguimiento: centraliza clientes, responsables y próximos pasos.</a></li><li><a href="${site}/bodegalia">Existencias que no cuadran: registra movimientos y consulta inventario por almacén.</a></li>${weighProblemLink}<li><a href="${site}/software-a-medida-guadalajara">Procesos propios: desarrolla sistemas e integraciones a la medida.</a></li></ul></section><section><h2>Software conectado con tu operación</h2><p>Desarrollamos soluciones e integraciones con APIs, Odoo, Excel, bases de datos, básculas, impresoras, lectores de códigos de barras y RFID, de acuerdo con cada proyecto.</p></section><section><h2>Nuestras soluciones en proyectos reales</h2><p>Proyectos de software a medida, sistemas para clínicas y CRM comercial, aplicados a operaciones concretas.</p><ul>${homeCaseCards}</ul><a href="${site}/casos-de-exito">Ver proyectos y casos de éxito</a></section><section><h2>También desarrollamos soluciones especializadas</h2><ul>${homeServices}</ul></section><p><a href="${site}/como-trabajamos">Cómo trabajamos</a> · <a href="${site}/contacto">Cuéntanos tu proyecto</a></p></div>`
const homeSchema = {
  '@context': 'https://schema.org',
  '@graph': [
    organization,
    { '@type': 'WebSite', '@id': `${site}/#website`, url: site, name: 'Nodavexa', publisher: { '@id': `${site}/#organization` }, inLanguage: 'es-MX' },
    { '@type': 'WebPage', name: homeTitle, description: homeDescription, url: `${site}/`, isPartOf: { '@id': `${site}/#website` }, inLanguage: 'es-MX' },
  ],
}
const homeBodyForSeo = homeBody.replace(
  /(<h2>Bodegalia: inventario claro, operación bajo control<\/h2>[\s\S]*?)(<\/section>)/,
  '$1<p><strong>Plan gratuito disponible.</strong> Consulta funciones y condiciones en el sitio oficial de Bodegalia.</p>$2',
)
await writeFile(path.join(dist, 'index.html'), createPage({ title: homeTitle, description: homeDescription, route: '/', body: homeBodyForSeo, schema: homeSchema, canonical: `${site}/` }))

const corePages = [
  ['/soluciones', 'Soluciones de software para ventas, inventario y procesos | Nodavexa', 'Explora CRM y gestión comercial, inventarios, sistemas para clínicas, integraciones Odoo y APIs, automatización y aplicaciones web a medida.', '<h1>Soluciones de software para ventas, inventario y procesos</h1><p>Revisa sistemas publicados y áreas de trabajo de Nodavexa para digitalizar la operación de empresas.</p>'],
  ['/casos-de-exito', 'Proyectos de software para empresas | Nodavexa', 'Conoce proyectos publicados de sistemas de inventario, plataformas internas y herramientas digitales para distintas operaciones empresariales.', `<h1>Proyectos de software para distintas operaciones</h1><p>Casos y videos de soluciones publicadas por Nodavexa.</p><ul>${cases.map((item) => `<li><a href="${site}/casos-de-exito/${item.slug}">${escapeHtml(item.title)}</a></li>`).join('')}</ul>`],
  ['/como-trabajamos', 'Cómo trabajamos | Nodavexa', 'Conoce las etapas de diagnóstico, diseño, desarrollo e implementación de soluciones tecnológicas de Nodavexa.', '<h1>Cómo trabajamos</h1><p>Entendemos el proceso, definimos alcance y etapas, construimos y probamos la solución, y acompañamos su implementación.</p>'],
  ['/preguntas', 'Preguntas frecuentes sobre software a medida | Nodavexa', 'Resuelve tus dudas sobre CRM, desarrollo de software, integraciones, implementación, mantenimiento y soporte de Nodavexa.', `<h1>Respuestas para elegir la solución adecuada</h1><p>Conoce cómo trabajamos y qué esperar al desarrollar o integrar tecnología para tu empresa.</p>${siteFaqs.map(([question, answer]) => `<details><summary>${escapeHtml(question)}</summary><p>${escapeHtml(answer)}</p></details>`).join('')}`],
  ['/contacto', 'Cuéntanos tu proyecto de software | Nodavexa', 'Cuéntanos qué proceso quieres mejorar. Revisamos proyectos de CRM, inventarios, aplicaciones, automatización e integraciones en Guadalajara y México.', '<h1>Cuéntanos qué proceso necesita funcionar mejor</h1><p>Digitalizamos procesos comerciales e internos con CRM, inventarios, automatización e integraciones.</p><p>Contacto por WhatsApp: +52 33 3841 9644 · soporte@nodavexa.com</p>'],
  ['/nosotros', 'Nodavexa | Desarrollo de software en Guadalajara y México', 'Conoce Nodavexa, empresa de software que desarrolla sistemas para procesos comerciales y operaciones de empresas en Guadalajara y México.', '<h1>Nodavexa: software para digitalizar operaciones</h1><p>Diseñamos CRM, sistemas de inventario e integraciones según los procesos de cada empresa.</p>'],
  ['/distribuidoras-guadalajara', 'Software de ventas e inventario para distribuidoras en Guadalajara | Nodavexa', 'Sistemas comerciales e inventarios adaptados a distribuidoras en Guadalajara, Zapopan y Zona Metropolitana, con atención en todo México.', '<h1>Software de ventas e inventario para distribuidoras</h1><p>Digitalizamos procesos comerciales e inventario para empresas distribuidoras de Guadalajara y México.</p>'],
  ['/recursos', 'Herramientas gratuitas para datos y procesos | Nodavexa', 'Utilidades gratuitas para convertir Excel y CSV en formatos útiles para tu operación. Los archivos se procesan en el navegador.', '<h1>Herramientas gratuitas para datos y procesos</h1><p>Convierte archivos Excel y CSV localmente en herramientas para tu operación.</p>'],
  ['/recursos/excel-a-sqlite', 'Convertir Excel o CSV a SQLite | Nodavexa', 'Convierte archivos Excel y CSV a una base de datos SQLite .db desde el navegador, sin subir archivos a internet.', '<h1>Convertir Excel o CSV a SQLite</h1><p>Selecciona un archivo, define las tablas y descarga una base SQLite .db.</p>'],
  ['/recursos/csv-formato-texto', 'Convertidor CSV Formato Tipo Texto | Nodavexa', 'Convierte Excel o CSV a UTF-8 separado por comas, con campos entre comillas y opciones de primera fila.', '<h1>Convertidor CSV Formato Tipo Texto</h1><p>Genera un archivo CSV UTF-8 con opciones para delimitadores y primera fila.</p>'],
  ['/formularios/proyecto', 'Formulario de proyecto | Nodavexa', 'Comparte los requerimientos de tu sitio, aplicación web o software instalable para preparar una cotización.', '<h1>Formulario para cotizar un proyecto</h1><p>Comparte información de tu empresa y los requisitos iniciales del proyecto.</p>'],
  ['/privacidad', 'Aviso de privacidad | Nodavexa', 'Conoce cómo Nodavexa recaba, utiliza, protege y conserva datos personales relacionados con el sitio y los servicios de software.', '<h1>Aviso de privacidad</h1>'],
  ['/terminos', 'Términos y condiciones | Nodavexa', 'Condiciones generales del sitio y de los servicios de software a medida, mantenimiento e integraciones de Nodavexa.', '<h1>Términos y condiciones</h1>'],
]

const urls = [{ loc: `${site}/`, lastmod: new Date().toISOString().slice(0, 10) }]
const resourceMarkup = (page) => `<main data-seo-prerender><nav><a href="/">Nodavexa</a> / <a href="/recursos">Recursos</a></nav><h1>${escapeHtml(page.name)}</h1><p>${escapeHtml(page.description)}</p><p>Para utilizar esta herramienta necesitas iniciar sesión o crear una cuenta gratuita.</p><h2>Qué puedes hacer</h2><ul>${page.benefits.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul><h2>Preguntas frecuentes</h2>${page.faq.map(([question, answer]) => `<details><summary>${escapeHtml(question)}</summary><p>${escapeHtml(answer)}</p></details>`).join('')}<h2>Más herramientas para tu empresa</h2><ul>${resourcePages.filter(item => item.slug !== page.slug).map(item => `<li><a href="/recursos/${item.slug}">${escapeHtml(item.name)}</a></li>`).join('')}</ul><p><a href="/nodavexa-control">CRM y seguimiento de cotizaciones</a> · <a href="/bodegalia">Control de inventarios con Bodegalia</a> · <a href="/software-a-medida-guadalajara">Software a medida en Guadalajara</a></p></main>`
for (const page of resourcePages) {
  const route = `/recursos/${page.slug}`
  const previous = corePages.findIndex(item => item[0] === route)
  if (previous >= 0) corePages.splice(previous, 1)
  corePages.push([route, page.title, page.description, resourceMarkup(page)])
}
const resourceIndex = corePages.find(item => item[0] === '/recursos')
resourceIndex[1] = 'Herramientas empresariales gratis para PYMES | Nodavexa'
resourceIndex[2] = 'Herramientas gratuitas para emprendedores y PYMES: cotizaciones PDF, Excel a SQLite y CSV UTF-8. Crea tu cuenta y simplifica tareas de tu empresa.'
resourceIndex[3] = `<main data-seo-prerender><h1>Herramientas empresariales gratuitas para emprendedores y PYMES</h1><p>Prepara cotizaciones y archivos para tu operación con una cuenta gratuita de Nodavexa.</p>${resourcePages.map(page => `<section><h2><a href="/recursos/${page.slug}">${escapeHtml(page.name)}</a></h2><p>${escapeHtml(page.description)}</p></section>`).join('')}<p>Todos los recursos requieren cuenta. Consulta también nuestro <a href="/crm-personalizado-guadalajara">CRM personalizado</a>, <a href="/bodegalia">software de inventarios</a> y <a href="/automatizacion-procesos-guadalajara">automatización de procesos</a>.</p></main>`
for (const page of servicePages) {
  const route = `/${page.slug}`
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      organization,
      { '@type': 'WebPage', name: page.title, description: page.description, url: `${site}${route}`, inLanguage: 'es-MX', isPartOf: { '@id': `${site}/#website` } },
      { '@type': 'Service', '@id': `${site}${route}#service`, name: page.h1, serviceType: page.h1, description: page.description, provider: { '@id': `${site}/#organization` }, areaServed: ['Guadalajara', 'Jalisco', 'Mexico'], url: `${site}${route}` },
      { '@type': 'FAQPage', mainEntity: page.faqs.map(([question, answer]) => ({ '@type': 'Question', name: question, acceptedAnswer: { '@type': 'Answer', text: answer } })) },
      { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Inicio', item: `${site}/` }, { '@type': 'ListItem', position: 2, name: 'Soluciones', item: `${site}/soluciones` }, { '@type': 'ListItem', position: 3, name: page.h1, item: `${site}${route}` }] },
    ],
  }
  const html = createPage({ title: page.title, description: page.description, route, body: serviceMarkup(page), schema })
  const dir = path.join(dist, page.slug)
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, 'index.html'), html)
  urls.push({ loc: `${site}${route}`, lastmod: new Date().toISOString().slice(0, 10) })
}

for (const product of products) {
  const route = `/${product.slug}`
  const flow = product.flow.map((step, index) => `<li><span>${index + 1}.</span> ${escapeHtml(step)}</li>`).join('')
  const sections = product.sections.map((section) => `<section><h2>${escapeHtml(section.heading)}</h2><p>${escapeHtml(section.copy)}</p>${section.items?.length ? `<ul>${section.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''}</section>`).join('')
  const compare = product.manualFlow?.length ? `<section><h2>Proceso manual</h2><ol>${product.manualFlow.map((step) => `<li>${escapeHtml(step)}</li>`).join('')}</ol><h2>Flujo conectado</h2><ol>${product.flow.map((step) => `<li>${escapeHtml(step)}</li>`).join('')}</ol></section>` : ''
  const price = product.price ? `<p><strong>${escapeHtml(product.price)}</strong> ${escapeHtml(product.priceNote)}</p>` : product.priceNote ? `<p>${escapeHtml(product.priceNote)}</p>` : ''
  const content = `<article data-seo-prerender><nav aria-label="Ruta de navegación"><a href="${site}/">Inicio</a> / <a href="${site}/soluciones">Soluciones</a> / ${escapeHtml(product.product)}</nav><h1>${escapeHtml(product.h1)}</h1><p>${escapeHtml(product.lead)}</p><p>${escapeHtml(product.intro)}</p><p><a href="${site}/contacto?producto=${product.slug}">Agendar demo</a> · <a href="https://wa.me/523338419644?text=${encodeURIComponent(product.whatsapp)}">Hablar por WhatsApp</a></p><section><h2>Flujo de trabajo</h2><ol>${flow}</ol></section>${compare}${sections}<section><h2>Para quién</h2><ul>${product.audiences.map((audience) => `<li>${escapeHtml(audience)}</li>`).join('')}</ul></section>${price}<p><a href="${site}/contacto?producto=${product.slug}">Solicitar diagnóstico</a></p></article>`
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [organization,
      { '@type': 'WebPage', name: product.title, description: product.description, url: `${site}${route}`, inLanguage: 'es-MX', isPartOf: { '@id': `${site}/#website` } },
      { '@type': 'Service', '@id': `${site}${route}#service`, name: product.product, serviceType: product.product, description: product.description, provider: { '@id': `${site}/#organization` }, areaServed: ['Guadalajara', 'Jalisco', 'Mexico'], url: `${site}${route}` },
      { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Inicio', item: `${site}/` }, { '@type': 'ListItem', position: 2, name: 'Soluciones', item: `${site}/soluciones` }, { '@type': 'ListItem', position: 3, name: product.product, item: `${site}${route}` }] },
    ],
  }
  const html = createPage({ title: product.title, description: product.description, route, body: content, schema })
  const dir = path.join(dist, product.slug)
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, 'index.html'), html)
  urls.push({ loc: `${site}${route}`, lastmod: new Date().toISOString().slice(0, 10) })
}

for (const [route, title, description, body] of corePages) {
  const noindex = route === '/formularios/proyecto'
  const resourcePage = resourcePages.find(page => route === `/recursos/${page.slug}`)
  const schema = resourcePage ? { '@context': 'https://schema.org', '@graph': [organization, { '@type': 'WebPage', name: title, description, url: `${site}${route}`, inLanguage: 'es-MX' }, { '@type': 'FAQPage', mainEntity: resourcePage.faq.map(([question, answer]) => ({ '@type': 'Question', name: question, acceptedAnswer: { '@type': 'Answer', text: answer } })) }, { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Inicio', item: `${site}/` }, { '@type': 'ListItem', position: 2, name: 'Recursos', item: `${site}/recursos` }, { '@type': 'ListItem', position: 3, name: resourcePage.name, item: `${site}${route}` }] }] } : route === '/preguntas'
    ? { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: siteFaqs.map(([question, answer]) => ({ '@type': 'Question', name: question, acceptedAnswer: { '@type': 'Answer', text: answer } })) }
    : { '@context': 'https://schema.org', '@type': 'WebPage', name: title, description, url: `${site}${route}`, inLanguage: 'es-MX', isPartOf: { '@id': `${site}/#website` } }
  const html = createPage({ title, description, route, body: `<div data-seo-prerender>${body}</div>`, schema, noindex })
  const dir = path.join(dist, route.slice(1))
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, 'index.html'), html)
  if (!noindex) urls.push({ loc: `${site}${route}`, lastmod: new Date().toISOString().slice(0, 10) })
}

for (const item of cases) {
  if (!item.slug || !item.title) continue
  const route = `/casos-de-exito/${item.slug}`
  const title = `${item.title} | Caso de proyecto | Nodavexa`
  const description = plainText(item.result || item.problem).slice(0, 300)
  const relatedProduct = `${item.slug} ${item.title}`.toLowerCase().includes('bodegalia') ? `<p><a href="${site}/bodegalia">Conoce Bodegalia, software de inventarios y almacenes.</a></p>` : ''
  const content = `<article data-seo-prerender><nav aria-label="Ruta de navegación"><a href="${site}/">Inicio</a> / <a href="${site}/casos-de-exito">Casos de éxito</a></nav><h1>${escapeHtml(item.title)}</h1><p>${escapeHtml(item.client_type)}</p><section><h2>Problema</h2><p>${escapeHtml(item.problem)}</p></section>${item.description ? `<section><h2>Solución e implementación</h2><p>${escapeHtml(plainText(item.description))}</p></section>` : ''}<section><h2>Resultado operativo</h2><p>${escapeHtml(item.result)}</p></section>${relatedProduct}<p><a href="${site}/contacto">Cuéntanos tu proyecto</a></p></article>`
  const html = createPage({ title, description, route, body: content, image: item.cover_url || undefined, imageAlt: `Caso de proyecto: ${item.title}`, type: 'article', schema: { '@context': 'https://schema.org', '@type': 'Article', headline: item.title, description, mainEntityOfPage: `${site}${route}`, author: { '@type': 'Organization', name: 'Nodavexa' }, publisher: { '@type': 'Organization', name: 'Nodavexa', logo: { '@type': 'ImageObject', url: `${site}/favicon.svg` } }, image: item.cover_url || undefined } })
  const dir = path.join(dist, 'casos-de-exito', item.slug)
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, 'index.html'), html)
  urls.push({ loc: `${site}${route}`, lastmod: String(item.updated_at || '').slice(0, 10) || new Date().toISOString().slice(0, 10) })
}

for (const solution of solutions) {
  if (!solution.slug || !solution.name) continue
  const route = `/soluciones/${solution.slug}`
  const productSlug = Object.keys(productSolutionSlugs).find((slug) => productSolutionSlugs[slug] === solution.slug)
  if (productSlug) {
    const canonical = `${site}/${productSlug}`
    const body = `<main data-seo-prerender><h1>${escapeHtml(solution.name)}</h1><p>Esta solución tiene una página de producto actualizada.</p><a href="${canonical}">Ver ${escapeHtml(solution.name)}</a></main>`
    const html = createPage({ title: `${solution.name} | Nodavexa`, description: solution.seo_description || solution.excerpt, route, body, canonical, noindex: true })
    const dir = path.join(dist, 'soluciones', solution.slug)
    await mkdir(dir, { recursive: true })
    await writeFile(path.join(dir, 'index.html'), html)
    continue
  }
  const canonical = `${site}${route}`
  const description = solution.seo_description || solution.excerpt
  const hasPrice = Number(solution.base_price_mxn) > 0
  const vat = solution.has_vat === false ? 0 : Number(solution.vat_rate || 0) / 100
  const isr = solution.sat_withholdings_enabled ? Number(solution.isr_withholding_rate || 0) / 100 : 0
  const vatRetention = solution.sat_withholdings_enabled ? Number(solution.vat_withholding_rate || 0) / 100 : 0
  const factor = 1 + vat - isr - vatRetention
  const price = Number(solution.base_price_mxn) / (factor > 0 ? factor : 1) * (1 + vat)
  const schemaType = solution.item_type === 'product' ? 'Product' : 'Service'
  const schema = {
    '@context': 'https://schema.org',
    '@type': schemaType,
    name: solution.name,
    description,
    url: canonical,
    category: solution.category,
    image: solution.cover_url || undefined,
    ...(schemaType === 'Product' ? { brand: { '@type': 'Brand', name: 'Nodavexa' } } : { provider: { '@id': `${site}/#organization` }, areaServed: ['Guadalajara', 'Jalisco', 'Mexico'] }),
    ...(hasPrice ? { offers: { '@type': 'Offer', price: price.toFixed(2), priceCurrency: 'MXN', url: canonical, availability: 'https://schema.org/InStock' } } : {}),
  }
  const content = `<article data-seo-prerender><nav aria-label="Ruta de navegación"><a href="${site}/">Inicio</a> / <a href="${site}/soluciones">Soluciones</a></nav><h1>${escapeHtml(solution.name)}</h1><p>${escapeHtml(solution.excerpt)}</p><div>${escapeHtml(plainText(solution.description))}</div>${hasPrice ? `<p>Precio publicado: ${price.toFixed(2)} MXN${solution.has_vat === false ? '' : ', IVA incluido'}.</p>` : ''}<p><a href="${site}/contacto">Solicitar diagnóstico</a></p></article>`
  const html = createPage({ title: `${solution.name} | Nodavexa`, description, route, body: content, image: solution.cover_url || undefined, schema })
  const dir = path.join(dist, 'soluciones', solution.slug)
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, 'index.html'), html)
  urls.push({ loc: canonical, lastmod: String(solution.updated_at || '').slice(0, 10) || new Date().toISOString().slice(0, 10) })
}

const notFoundBody = '<main><span>ERROR 404</span><h1>No encontramos esa página.</h1><p>Vuelve al inicio o explora las soluciones de Nodavexa.</p><p><a href="/">Inicio</a> · <a href="/soluciones">Ver soluciones</a> · <a href="/contacto">Contactar</a></p></main>'
let notFoundHtml = createPage({ title: 'Página no encontrada | Nodavexa', description: 'La página solicitada no está disponible.', route: '/404.html', body: notFoundBody, noindex: true, canonical: `${site}/404.html` })
notFoundHtml = notFoundHtml.replace(/<link rel="canonical"[^>]*>/i, '')
await writeFile(path.join(dist, '404.html'), notFoundHtml)

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((item) => `  <url><loc>${escapeHtml(item.loc)}</loc><lastmod>${item.lastmod}</lastmod></url>`).join('\n')}\n</urlset>\n`
await writeFile(path.join(dist, 'sitemap.xml'), sitemap)
await writeFile(path.join(dist, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /admin/\nDisallow: /formularios/\n\nSitemap: ${site}/sitemap.xml\n`)

const adminDir = path.join(dist, 'admin')
await mkdir(adminDir, { recursive: true })
await writeFile(path.join(adminDir, 'index.html'), base.replace('<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />', '<meta name="robots" content="noindex, nofollow" />').replace(/<title>.*?<\/title>/s, '<title>Administración | Nodavexa</title>'))
console.log(`SEO generado: ${servicePages.length} páginas de servicio, ${cases.length} casos, ${solutions.length} soluciones y ${urls.length} URLs en sitemap.`)
