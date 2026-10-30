import { useEffect, useState } from 'react'
import { SuccessCaseCard } from '../components/SuccessCaseCard'
import { SuccessCaseVideoCard } from '../components/SuccessCaseVideoCard'
import { demoSuccessCaseVideos, fetchSuccessCases, fetchSuccessCaseVideos } from '../lib/supabase'
import type { SuccessCase, SuccessCaseVideo } from '../types'

export function SuccessCases() {
  const [items, setItems] = useState<SuccessCase[]>([])
  const [videos, setVideos] = useState<SuccessCaseVideo[]>([])

  useEffect(() => {
    fetchSuccessCases().then(setItems).catch(() => {})
    fetchSuccessCaseVideos().then(setVideos).catch(() => setVideos(demoSuccessCaseVideos))
  }, [])

  return (
    <>
      <section className="page-hero">
        <span className="section-index">CASOS DE ÉXITO</span>
        <h1>
          Proyectos de software
          <br />
          <em>en distintas operaciones.</em>
        </h1>
        <p>
          Revisa los proyectos publicados por Nodavexa. Describimos el reto y el trabajo realizado sin añadir métricas no documentadas.
        </p>
      </section>
      <section className="cases-catalog">
        {items.length ? (
          <div className="cases-grid">{items.map((item) => <SuccessCaseCard item={item} key={item.id} />)}</div>
        ) : (
          <div className="empty">Próximamente publicaremos nuevos casos de éxito.</div>
        )}
      </section>
      {videos.length > 0 && (
        <section className="case-videos-section">
          <div className="section-heading">
            <div>
              <span className="section-index">VIDEOS DE CASOS</span>
              <h2>
                Otros proyectos
                <br />
                <em>en operación.</em>
              </h2>
            </div>
            <p>
              Una vista rápida de soluciones reales: exportaciones, verificación de precios e inventarios funcionando en
              procesos concretos.
            </p>
          </div>
          <div className="case-videos-grid">
            {videos.map((video) => (
              <SuccessCaseVideoCard video={video} key={video.id} />
            ))}
          </div>
        </section>
      )}
    </>
  )
}
