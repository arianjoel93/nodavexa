import { Link } from 'react-router-dom'
import { ArrowRight, FileText } from 'lucide-react'
import pages from '../data/resource-pages.json'
import { Seo } from './Seo'

export function ResourceWelcome({ slug, onAccess }: { slug?: string; onAccess: () => void }) {
  const page = pages.find(item => item.slug === slug)
  const title = page?.title || 'Herramientas empresariales gratis para PYMES | Nodavexa'
  const description = page?.description || 'Herramientas gratuitas para emprendedores y PYMES: cotizaciones PDF, Excel a SQLite y CSV UTF-8. Crea tu cuenta y simplifica tareas de tu empresa.'
  const route = page ? `/recursos/${page.slug}` : '/recursos'
  return <section className="resources-welcome"><Seo title={title} description={description} path={route} jsonLd={page ? { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: page.faq.map(([question, answer]) => ({ '@type': 'Question', name: question, acceptedAnswer: { '@type': 'Answer', text: answer } })) } : undefined} /><span className="section-index">RECURSOS NODAVEXA · ACCESO GRATUITO</span><h1>{page?.name || 'Herramientas empresariales gratuitas para emprendedores y PYMES'}</h1><p>{description}</p><div className="hero-actions"><button className="btn primary" onClick={onAccess}>Iniciar sesión o crear cuenta <ArrowRight size={18} /></button><Link className="btn ghost" to={page ? '/recursos' : '/'}>{page ? 'Ver todos los recursos' : 'Volver a Nodavexa'}</Link></div><p>Necesitas una cuenta para utilizar cualquier recurso. Los archivos generados se guardan de forma privada en tu cuenta durante 30 días.</p>{page ? <><h2>Qué puedes hacer con esta herramienta</h2><ul>{page.benefits.map(item => <li key={item}>{item}</li>)}</ul><h2>Preguntas frecuentes</h2>{page.faq.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</> : <div className="resources-welcome-grid">{pages.map(item => <article key={item.slug}><FileText /><h2>{item.name}</h2><p>{item.description}</p><Link to={`/recursos/${item.slug}`}>Conocer herramienta <ArrowRight size={16} /></Link></article>)}</div>}<p>Cuando necesites conectar ventas e inventarios, conoce <Link to="/nodavexa-control">Nodavexa Control</Link> y <Link to="/bodegalia">Bodegalia</Link>. También desarrollamos <Link to="/software-a-medida-guadalajara">software a medida en Guadalajara y México</Link>.</p></section>
}
