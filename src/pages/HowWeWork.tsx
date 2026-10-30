import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { processSteps } from '../lib/landing-content'
import { trackEvent } from '../lib/analytics'
import { MotionNumber } from '../components/MotionNumber'

export function HowWeWork() {
  return (
    <div className="how-we-work-page">
      <section className="page-hero">
        <span className="section-index">COMO TRABAJAMOS</span>
        <h1>De un proceso complejo a una herramienta que sí funciona.</h1>
        <p>Trabajamos contigo por etapas para entender la operación, priorizar lo importante y entregar una solución que tu equipo pueda usar.</p>
      </section>
      <section className="dist-section nx-process how-we-work-steps">
        <span className="section-index">UN CAMINO CLARO</span>
        <h2>Construimos con claridad en cada etapa.</h2>
        <div className="dist-timeline">
          {processSteps.map(([number, title, text]) => <article key={number}><small><MotionNumber value={number} /></small><h3>{title}</h3><p>{text}</p></article>)}
        </div>
        <Link className="btn primary" to="/contacto" onClick={() => trackEvent('demo_cta_click', { page_slug: 'como-trabajamos' })}>Agendar demo <ArrowRight size={18} /></Link>
      </section>
    </div>
  )
}
