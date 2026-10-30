import { useState } from 'react'
import { ArrowLeft, ArrowRight, Check, RotateCcw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { trackEvent } from '../../lib/analytics'

const sectors = ['Comercialización y distribución', 'Laboratorio o servicios técnicos', 'Clínica, consultorio o estética', 'Manufactura u operación', 'Servicios profesionales', 'Otro sector']
const challenges = [
  'Seguimiento de prospectos, clientes o cotizaciones',
  'Inventario, pedidos o movimientos',
  'Agenda, expedientes o atención',
  'Captura repetida entre sistemas',
  'Reportes y visibilidad de pendientes',
  'Tareas manuales y aprobaciones',
]
const currentTools = ['Principalmente Excel, papel o mensajes', 'Varias herramientas que no están conectadas', 'Un sistema que no se adapta a nuestro proceso', 'Todavía estamos definiendo el flujo']

type Answers = { sector: string; challenges: string[]; tools: string }

export function ProcessDiagnostic() {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Answers>({ sector: '', challenges: [], tools: '' })
  const [complete, setComplete] = useState(false)

  const toggleChallenge = (value: string) => {
    setAnswers((current) => ({
      ...current,
      challenges: current.challenges.includes(value)
        ? current.challenges.filter((item) => item !== value)
        : [...current.challenges, value],
    }))
  }

  const reset = () => {
    setStep(0)
    setComplete(false)
    setAnswers({ sector: '', challenges: [], tools: '' })
  }

  const canContinue = step === 0 ? Boolean(answers.sector) : step === 1 ? answers.challenges.length > 0 : Boolean(answers.tools)
  const opportunity = answers.challenges.length >= 4 || answers.tools === currentTools[0]
    ? 'Conviene revisar el flujo de punta a punta'
    : answers.challenges.length >= 2 || answers.tools === currentTools[1]
      ? 'Hay oportunidad de conectar y ordenar procesos'
      : 'Podemos enfocar el análisis en un proceso puntual'
  const contactHref = '/contacto?origen=autodiagnostico'

  const continueFlow = () => {
    if (step < 2) setStep((current) => current + 1)
    else {
      setComplete(true)
      trackEvent('diagnostic_complete', { sector: answers.sector, challenges: answers.challenges.length })
    }
  }

  return (
    <section className="process-diagnostic" id="diagnostico-proceso" aria-labelledby="diagnostic-title">
      <div className="diagnostic-intro">
        <span className="section-index">UNA PRIMERA ORIENTACIÓN</span>
        <h2 id="diagnostic-title">¿Qué parte de tu operación conviene ordenar primero?</h2>
        <p>Responde tres preguntas. Recibirás una orientación inicial, no una cotización automática ni una auditoría.</p>
        <div className="diagnostic-points">
          <span><Check /> Toma menos de un minuto</span>
          <span><Check /> No necesitas crear una cuenta</span>
          <span><Check /> Tu operación puede ser de cualquier sector</span>
        </div>
      </div>

      <div className="diagnostic-panel" aria-live="polite">
        {!complete ? <>
          <div className="diagnostic-progress">
            <span>Paso {step + 1} de 3</span>
            <div role="progressbar" aria-label="Progreso del diagnóstico" aria-valuemin={1} aria-valuemax={3} aria-valuenow={step + 1}>
              <i style={{ width: `${((step + 1) / 3) * 100}%` }} />
            </div>
          </div>

          {step === 0 && <fieldset className="diagnostic-question">
            <legend>¿En qué tipo de empresa trabajas?</legend>
            <div className="diagnostic-options">
              {sectors.map((sector) => <label key={sector} className={answers.sector === sector ? 'selected' : ''}>
                <input type="radio" name="sector" value={sector} checked={answers.sector === sector} onChange={() => setAnswers((current) => ({ ...current, sector }))} />
                <span>{sector}</span><Check aria-hidden="true" />
              </label>)}
            </div>
          </fieldset>}

          {step === 1 && <fieldset className="diagnostic-question">
            <legend>¿Qué te está costando más controlar?</legend>
            <p className="diagnostic-hint">Elige todas las que apliquen.</p>
            <div className="diagnostic-options">
              {challenges.map((challenge) => <label key={challenge} className={answers.challenges.includes(challenge) ? 'selected' : ''}>
                <input type="checkbox" checked={answers.challenges.includes(challenge)} onChange={() => toggleChallenge(challenge)} />
                <span>{challenge}</span><Check aria-hidden="true" />
              </label>)}
            </div>
          </fieldset>}

          {step === 2 && <fieldset className="diagnostic-question">
            <legend>¿Con qué herramientas llevan hoy ese proceso?</legend>
            <div className="diagnostic-options">
              {currentTools.map((tool) => <label key={tool} className={answers.tools === tool ? 'selected' : ''}>
                <input type="radio" name="tools" value={tool} checked={answers.tools === tool} onChange={() => setAnswers((current) => ({ ...current, tools: tool }))} />
                <span>{tool}</span><Check aria-hidden="true" />
              </label>)}
            </div>
          </fieldset>}

          <div className="diagnostic-actions">
            {step > 0 && <button className="diagnostic-back" type="button" onClick={() => setStep((current) => current - 1)}><ArrowLeft /> Anterior</button>}
            <button className="btn primary" type="button" disabled={!canContinue} onClick={continueFlow}>{step === 2 ? 'Ver orientación' : 'Continuar'} <ArrowRight /></button>
          </div>
        </> : <div className="diagnostic-result">
          <span className="diagnostic-result-icon"><Check /></span>
          <span className="section-index">ORIENTACIÓN INICIAL</span>
          <h3>{opportunity}</h3>
          <p>Para <b>{answers.sector.toLowerCase()}</b>, mencionas {answers.challenges.length} área{answers.challenges.length === 1 ? '' : 's'} por mejorar. El primer paso sería mapear cómo fluye la información y qué herramientas deben participar.</p>
          <div className="diagnostic-summary"><b>Temas seleccionados</b><ul>{answers.challenges.map((challenge) => <li key={challenge}>{challenge}</li>)}</ul></div>
          <p className="diagnostic-disclaimer">Esta orientación es una referencia para iniciar la conversación; el alcance depende de revisar tu proceso y tus sistemas actuales.</p>
          <div className="diagnostic-actions diagnostic-result-actions">
            <button className="diagnostic-back" type="button" onClick={reset}><RotateCcw /> Empezar de nuevo</button>
            <Link className="btn primary" to={contactHref} onClick={() => { try { sessionStorage.setItem('nodavexa-process-diagnostic', JSON.stringify(answers)) } catch { /* Storage may be unavailable in private browsing. */ } }}>Revisar mi caso <ArrowRight /></Link>
          </div>
        </div>}
      </div>
    </section>
  )
}
