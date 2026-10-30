import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import { SolutionCard } from '../components/SolutionCard'
import { ProcessDiagnostic } from '../components/landing/ProcessDiagnostic'
import { getSolutionPositioning, type CommercialGroup } from '../lib/solution-positioning'
import { fetchSolutions } from '../lib/supabase'
import type { Solution } from '../types'

const groups: Array<'Todas' | CommercialGroup> = [
  'Todas',
  'CRM y ventas',
  'Inventarios y almacenes',
  'Aplicaciones a medida',
]

export function Solutions() {
  const [items, setItems] = useState<Solution[]>([])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<'Todas' | CommercialGroup>('Todas')

  useEffect(() => {
    fetchSolutions().then(setItems).catch(() => {})
  }, [])

  const shown = useMemo(
    () =>
      items.filter((solution) => {
        const positioning = getSolutionPositioning(solution)
        const matchesCategory = category === 'Todas' || positioning.group === category
        const searchText = `${positioning.title} ${positioning.excerpt} ${positioning.group} ${solution.name} ${solution.excerpt}`.toLowerCase()
        return matchesCategory && searchText.includes(query.toLowerCase())
      }),
    [items, query, category],
  )

  return (
    <>
      <section className="page-hero solutions-hero">
        <span className="section-index">SOLUCIONES Y PRODUCTOS</span>
        <h1>
          CRM, inventarios y apps
          <br />
          <em>para operar mejor.</em>
        </h1>
        <p>
          Nuestro enfoque principal es construir sistemas que resuelven trabajo real: seguimiento de clientes, control de
          ventas, inventarios, procesos internos y herramientas a medida para equipos que ya no quieren depender de hojas
          dispersas.
        </p>
      </section>
      <section className="catalog">
        <div className="catalog-tools">
          <div className="categories">
            {groups.map((group) => (
              <button className={group === category ? 'active' : ''} onClick={() => setCategory(group)} key={group}>
                {group}
              </button>
            ))}
          </div>
          <label>
            <Search />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar CRM, inventario o proceso" />
          </label>
        </div>
        <p className="catalog-note">
          Para CRM y desarrollos a medida recomendamos diagnosticar antes de cotizar. Cuando la solución ya está
          paquetizada, mostramos un precio base para ayudarte a decidir más rápido.
        </p>
        <div className="solutions-grid">{shown.map((solution, index) => <SolutionCard key={solution.id} solution={solution} index={index} />)}</div>
        {!shown.length && <div className="empty">No encontramos soluciones con esos criterios.</div>}
      </section>
      <ProcessDiagnostic />
      <section className="solution-areas">
        <div className="solution-areas-heading">
          <span className="section-index">QUÉ PODEMOS RESOLVER</span>
          <h2>Conoce las áreas en las que podemos ayudarte.</h2>
          <p>Partimos de tu proceso actual y definimos si conviene configurar, integrar o desarrollar una herramienta.</p>
        </div>
        <div className="solution-areas-grid">
          <details><summary>CRM y gestión comercial</summary><p>Centraliza prospectos, clientes, cotizaciones, responsables y seguimientos para que el equipo tenga claro el estado de cada oportunidad y el siguiente paso.</p></details>
          <details><summary>Inventarios y almacenes</summary><p>Registra existencias, entradas, salidas y movimientos con consultas y reportes que ayuden a mantener la información operativa al día.</p></details>
          <details><summary>Sistemas para clínicas y servicios</summary><p>Organiza agenda, atención, expedientes y tareas administrativas de acuerdo con la forma de trabajo de clínicas, consultorios y negocios de servicios.</p></details>
          <details><summary>Integraciones Odoo, APIs y sistemas externos</summary><p>Conecta plataformas y fuentes de datos para reducir recapturas y mantener información consistente entre herramientas.</p></details>
          <details><summary>Automatización de procesos e IA</summary><p>Identifica tareas repetitivas que pueden automatizarse y define controles para que el flujo siga siendo claro y supervisable.</p></details>
          <details><summary>Software y aplicaciones a medida</summary><p>Desarrolla portales, aplicaciones web y sistemas internos cuando las herramientas disponibles no cubren los requisitos de tu operación.</p></details>
        </div>
        <Link className="btn primary" to="/contacto">Cuéntanos qué necesitas resolver <ArrowRight size={17} /></Link>
      </section>
    </>
  )
}
