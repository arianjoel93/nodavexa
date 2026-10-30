import { HelpCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { faqs } from '../lib/landing-content'
import { trackEvent } from '../lib/analytics'

export function Questions() {
  return (
    <div className="questions-page">
      <section className="page-hero">
        <span className="section-index">PREGUNTAS FRECUENTES</span>
        <h1>Respuestas para elegir la solución adecuada.</h1>
        <p>Conoce cómo trabajamos y qué esperar al desarrollar o integrar tecnología para tu empresa.</p>
      </section>
      <section className="questions-content">
        <div className="faq-list">{faqs.map(([question, answer]) => <details key={question}><summary><HelpCircle /> {question}</summary><p>{answer}</p></details>)}</div>
        <div className="questions-cta"><div><span className="section-index">¿NO VES TU PREGUNTA?</span><h2>Cuéntanos qué necesitas resolver.</h2></div><Link className="btn primary" to="/contacto" onClick={() => trackEvent('demo_cta_click', { page_slug: 'preguntas' })}>Agendar demo</Link></div>
      </section>
    </div>
  )
}
