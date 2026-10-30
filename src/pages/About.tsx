import { Lightbulb, HeartHandshake, ShieldCheck, CheckCircle2 } from 'lucide-react'

export function About() {
  return (
    <>
      <section className="page-hero about">
        <span className="section-index">QUIÉNES SOMOS</span>
        <h1>
          La tecnología debe adaptarse
          <br />
          <em>a las personas.</em>
        </h1>
        <p>
          Diseñamos software para que las empresas ordenen su operación, conecten información y trabajen con herramientas
          que sí corresponden a sus procesos.
        </p>
      </section>
      <section className="about-story">
        <div>
          <span className="section-index">NUESTRA VISIÓN</span>
          <h2>
            Tu forma de trabajar, <em>convertida en software.</em>
          </h2>
        </div>
        <div>
          <p>
            En Nodavexa desarrollamos CRM, sistemas para inventarios y atención, aplicaciones web e integraciones. Hemos
            realizado proyectos para un laboratorio de ciencias, una clínica estética y una empresa de venta de chamarras.
          </p>
          <p>
            No partimos de una industria única ni de un producto rígido: partimos de tu proceso. Definimos contigo una
            primera etapa realista y construimos herramientas útiles, fáciles de adoptar y preparadas para crecer.
          </p>
        </div>
      </section>
      <section className="crm-workflow">
        <div className="about-video">
          <iframe
            title="Nodavexa en operación"
            src="https://www.youtube.com/embed/uhbGHaKrOGc?autoplay=1&mute=1&playsinline=1&loop=1&playlist=uhbGHaKrOGc&rel=0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            loading="lazy"
          />
        </div>
        <div>
          <span className="section-index">DISEÑADO CONTIGO</span>
          <h2>
            De información dispersa a <em>una visión clara.</em>
          </h2>
          <p>
            Partimos de lo que tu equipo necesita resolver. Definimos las funciones, organizamos los datos y validamos
            cada flujo contigo antes de llevarlo a la operación.
          </p>
          <p>Desde un CRM hasta una aplicación interna o un panel de reportes: el alcance se adapta a tu proyecto.</p>
          <small>Video de presentación de Nodavexa.</small>
        </div>
      </section>
      <section className="choice-guide">
        <div>
          <span className="section-index">CÓMO TE AYUDAMOS A DECIDIR</span>
          <h2>
            Si tu operación ya creció,
            <br />
            <em>tu sistema debe crecer contigo.</em>
          </h2>
          <p>
            Elegir Nodavexa tiene sentido cuando necesitas una solución clara, acompañada y construida con intención para
            resolver problemas reales del día a día.
          </p>
        </div>
        <ul>
          <li>
            <CheckCircle2 />
            <span>
              <b>Detectamos el punto crítico</b> Revisamos dónde se pierde tiempo, información o control.
            </span>
          </li>
          <li>
            <CheckCircle2 />
            <span>
              <b>Traducimos el proceso a pantallas</b> Convertimos tus reglas, permisos y pasos internos en una
              herramienta usable.
            </span>
          </li>
          <li>
            <CheckCircle2 />
            <span>
              <b>Medimos lo que importa</b> Creamos reportes para ver avances, pendientes, resultados y oportunidades.
            </span>
          </li>
          <li>
            <CheckCircle2 />
            <span>
              <b>Acompañamos la adopción</b> Ajustamos contigo para que el sistema sí se use en la operación real.
            </span>
          </li>
        </ul>
      </section>
      <section className="values">
        <article>
          <Lightbulb />
          <h3>Ingenio aplicado</h3>
          <p>Convertimos retos particulares en soluciones claras y replicables.</p>
        </article>
        <article>
          <HeartHandshake />
          <h3>Cercanía real</h3>
          <p>Hablamos tu idioma y te acompañamos durante todo el camino.</p>
        </article>
        <article>
          <ShieldCheck />
          <h3>Compromiso técnico</h3>
          <p>Diseñamos con precisión, seguridad y visión de largo plazo.</p>
        </article>
      </section>
    </>
  )
}
