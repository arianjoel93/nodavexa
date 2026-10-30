import { ArrowLeft, ArrowRight } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { Seo, seoDefaults } from '../components/Seo'

export function NotFound() {
  const { pathname } = useLocation()
  return <>
    <Seo title="Página no encontrada | Nodavexa" description="La página que buscas no está disponible. Explora las soluciones de software de Nodavexa o contáctanos." path={pathname} noindex />
    <section className="not-found-page">
      <span className="section-index">ERROR 404</span>
      <h1>No encontramos esa página.</h1>
      <p>Puede que el enlace haya cambiado. Puedes volver al inicio o conocer las soluciones de Nodavexa.</p>
      <div><Link className="btn ghost" to="/"><ArrowLeft /> Inicio</Link><Link className="btn primary" to="/soluciones">Ver soluciones <ArrowRight /></Link></div>
      <a href={`${seoDefaults.site}/contacto`}>¿Necesitas ayuda? Contactar</a>
    </section>
  </>
}
