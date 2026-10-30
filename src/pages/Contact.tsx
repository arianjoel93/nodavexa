import { useRef, useState } from 'react'
import { Mail, MapPin, MessageCircle, Send } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useSiteSettings } from '../lib/useSiteSettings'
import posthog from '../lib/posthog'
import { posthogLogs } from '../lib/posthog-logs'
import { trackEvent } from '../lib/analytics'

type ContactForm = { name: string; company: string; email: string; phone: string; need: string; message: string; website: string }

function initialContactForm(): ContactForm {
  const initial: ContactForm = { name: '', company: '', email: '', phone: '', need: '', message: '', website: '' }
  try {
    const requestedService = new URLSearchParams(window.location.search).get('servicio')
    const requestedProduct = new URLSearchParams(window.location.search).get('producto')
    if (requestedProduct === 'nodavexa-control') {
      initial.need = 'CRM y ventas'
      initial.message = 'Me interesa Nodavexa Control. Me gustaría conocer cómo se adapta al proceso comercial de mi empresa.'
    } else if (requestedProduct === 'bodegalia') {
      initial.need = 'Inventario y almacén'
      initial.message = 'Me interesa Bodegalia para controlar inventarios y almacenes. Me gustaría revisar cómo funciona en mi empresa.'
    } else if (requestedProduct === 'automatizacion-pesaje-etiquetado') {
      initial.need = 'Integraciones y automatización'
      initial.message = 'Me interesa automatizar un proceso de pesaje y etiquetado. Me gustaría revisar los equipos y sistemas involucrados.'
    }
    if (requestedService === 'crm-personalizado-guadalajara') initial.need = 'CRM y ventas'
    else if (requestedService === 'sistemas-inventario-almacenes') initial.need = 'Inventario y almacén'
    else if (requestedService === 'integraciones-odoo' || requestedService === 'automatizacion-procesos-guadalajara') initial.need = 'Integraciones y automatización'
    else if (requestedService === 'software-a-medida-guadalajara') initial.need = 'Software o aplicación a medida'
    const raw = sessionStorage.getItem('nodavexa-process-diagnostic')
    if (raw) {
      const answers = JSON.parse(raw) as { sector?: string; challenges?: string[]; tools?: string }
      const topics = answers.challenges?.length ? answers.challenges.map((item) => `- ${item}`).join('\n') : '- Por definir'
      initial.message = `Llegué desde el autodiagnóstico de procesos.\n\nSector: ${answers.sector || 'No indicado'}\nHerramientas actuales: ${answers.tools || 'No indicadas'}\nÁreas que quiero revisar:\n${topics}\n\nQuiero conversar sobre el alcance y los siguientes pasos.`
      sessionStorage.removeItem('nodavexa-process-diagnostic')
    }
  } catch {
    return initial
  }
  return initial
}

export function Contact() {
  const settings = useSiteSettings()
  const [form, setForm] = useState<ContactForm>(initialContactForm)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const formStarted = useRef(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setStatus('idle')
    const message = form.need ? `Área que quiere resolver: ${form.need}\n\n${form.message}` : form.message
    const { error } = await supabase.functions.invoke('send-contact', {
      body: { name: form.name, company: form.company, email: form.email, phone: form.phone, message, website: form.website },
    })
    setBusy(false)
    if (error) {
      posthogLogs.contactSubmissionFailed()
      setStatus('error')
      return
    }
    posthog?.capture('contact_form_submitted')
    posthogLogs.contactSubmissionCompleted()
    const product = new URLSearchParams(window.location.search).get('producto')
    trackEvent('contact_form_submit', { page_slug: 'contacto', service: form.need || 'sin_especificar', ...(product ? { product, cta_location: 'product_page' } : {}) })
    setStatus('success')
    setForm({ name: '', company: '', email: '', phone: '', need: '', message: '', website: '' })
  }

  return <section className="contact-page">
    <div>
      <span className="section-index light">HABLEMOS DE TU OPERACIÓN</span>
      <h1>Cuéntanos qué proceso necesita funcionar mejor.</h1>
      <p>Puede ser un flujo comercial, inventario, atención, reportes, una integración o una aplicación propia. Revisaremos el contexto antes de recomendar una solución.</p>
      <ul>
        <li><MessageCircle /><span><small>WhatsApp</small>{settings.whatsapp}</span></li>
        <li><Mail /><span><small>Correo</small>{settings.email}</span></li>
        <li><MapPin /><span><small>Ubicación y cobertura</small>Guadalajara, Jalisco · Atención en México</span></li>
      </ul>
      <p className="contact-experience">Experiencia en proyectos para laboratorio de ciencias, clínica estética y venta de prendas.</p>
    </div>
    <form onSubmit={submit} onFocusCapture={() => {
      if (!formStarted.current) {
        formStarted.current = true
        trackEvent('contact_form_start', { page_slug: 'contacto' })
      }
    }}>
      <h2>Cuéntanos tu proyecto</h2>
      <p>Con esta información podremos preparar una primera conversación útil.</p>
      <div className="contact-fields">
        <label>Nombre<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Tu nombre" /></label>
        <label>Empresa<input required value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} placeholder="Nombre de tu empresa" /></label>
        <label>Correo<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="tu@empresa.com" /></label>
        <label>Teléfono o WhatsApp<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="33 0000 0000" /></label>
      </div>
      <label className="honeypot" aria-hidden="true">Sitio web<input tabIndex={-1} autoComplete="off" value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} /></label>
      <label>¿Qué área quieres resolver?<select value={form.need} onChange={(event) => setForm({ ...form, need: event.target.value })}>
        <option value="">Todavía no lo sé</option>
        <option>CRM y ventas</option>
        <option>Inventario y almacén</option>
        <option>Clínica, consultorio o servicios</option>
        <option>Integraciones y automatización</option>
        <option>Software o aplicación a medida</option>
        <option>Otro proceso</option>
      </select></label>
      <label>¿Qué proceso quieres mejorar?<textarea required minLength={20} rows={6} value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} placeholder="¿Cómo lo hacen hoy, qué herramientas usan y qué te gustaría que fuera diferente? No incluyas datos personales de clientes o pacientes." /></label>
      {status === 'success' && <div className="form-success">Recibimos tu solicitud. Te contactaremos muy pronto.</div>}
      {status === 'error' && <div className="form-error">No pudimos enviar el mensaje. Escríbenos a {settings.email}.</div>}
      <button id="cta_contacto_diagnostico" className="btn primary" disabled={busy}>{busy ? 'Enviando…' : 'Solicitar diagnóstico'} <Send /></button>
      <small>Tus datos se utilizarán únicamente para responder tu solicitud.</small>
    </form>
  </section>
}
