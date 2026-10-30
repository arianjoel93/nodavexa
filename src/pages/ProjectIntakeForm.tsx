import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, CheckCircle2, FileText, Send } from 'lucide-react'
import { fetchSiteSettings, supabase } from '../lib/supabase'
import type { ProjectServiceType, SiteSettings } from '../types'
import { formatMoney } from '../lib/project-quote'

const sectionOptions = ['Hero / portada', 'Servicios', 'Beneficios', 'Proceso', 'Casos o portafolio', 'Testimonios', 'Preguntas frecuentes', 'Contacto', 'Precios', 'Galería']
const featureOptions = ['Formulario avanzado', 'WhatsApp', 'Mapa', 'Blog', 'Animaciones', 'Multiidioma', 'SEO base', 'Panel administrativo', 'Agenda / reservas', 'Descarga de archivos']
const integrationOptions = ['Google Analytics', 'Meta Pixel', 'CRM', 'Email marketing', 'Pasarela de pago', 'Calendly / agenda', 'Google Sheets', 'Supabase / base de datos']

const initialForm = {
  service_type: 'landing_page' as ProjectServiceType,
  company_name: '',
  contact_name: '',
  email: '',
  phone: '',
  country: '',
  company_website: '',
  company_description: '',
  project_goal: '',
  target_audience: '',
  references_text: '',
  brand_assets: '',
  content_status: 'partial',
  sections_needed: [] as string[],
  features_needed: [] as string[],
  integrations_needed: [] as string[],
  pages_count: 1,
  technical_notes: '',
  maintenance_ack: false,
  updates_ack: false,
  website: '',
}

export function ProjectIntakeForm() {
  const [settings, setSettings] = useState<SiteSettings>()
  const [usdRate, setUsdRate] = useState(17.5)
  const [accepted, setAccepted] = useState(false)
  const [form, setForm] = useState(initialForm)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')

  useEffect(() => {
    fetchSiteSettings().then(setSettings).catch(() => setSettings({ whatsapp: '', email: 'soporte@nodavexa.com', address: '', form_maintenance_mxn: 789 }))
    fetch('https://api.exchangerate.host/latest?base=USD&symbols=MXN')
      .then((response) => response.json())
      .then((data) => {
        const rate = Number(data?.rates?.MXN)
        if (rate > 0) setUsdRate(rate)
      })
      .catch(() => {})
  }, [])

  const maintenance = Number(settings?.form_maintenance_mxn || 789)
  const maintenanceUsd = useMemo(() => Math.round(maintenance / usdRate), [maintenance, usdRate])

  const toggle = (key: 'sections_needed' | 'features_needed' | 'integrations_needed', value: string) => {
    setForm((current) => {
      const list = current[key]
      return { ...current, [key]: list.includes(value) ? list.filter((item) => item !== value) : [...list, value] }
    })
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (form.website) return
    setBusy(true)
    setStatus('idle')
    const { website, ...formData } = form
    void website
    const payload = {
      ...formData,
      annual_maintenance_mxn: maintenance,
      pages_count: Number(form.pages_count || 1),
      company_name: form.company_name.trim(),
      contact_name: form.contact_name.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim(),
    }
    const { error } = await supabase.from('project_requests').insert(payload)
    setBusy(false)
    if (error) {
      setStatus('error')
      return
    }
    setStatus('success')
    setForm(initialForm)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (status === 'success') {
    return (
      <section className="project-form-success">
        <CheckCircle2 />
        <h1>Tu información ha sido enviada.</h1>
        <p>Gracias. En breve recibirás la cotización en tu correo.</p>
      </section>
    )
  }

  return (
    <section className="project-form-page">
      {!accepted && (
        <div className="form-disclaimer-overlay" role="dialog" aria-modal="true">
          <div className="form-disclaimer">
            <FileText />
            <h2>Antes de llenar el formulario</h2>
            <p>
              Además del costo de desarrollo, el proyecto considera un mantenimiento anual de <b>{formatMoney(maintenance)} MXN</b>
              {' '}aprox. <b>${maintenanceUsd} USD</b>.
            </p>
            <p>{settings?.form_extra_changes_note || 'Los cambios o actualizaciones fuera del alcance aprobado se cotizan por separado.'}</p>
            <label>
              <input type="checkbox" checked={form.maintenance_ack && form.updates_ack} onChange={(event) => setForm({ ...form, maintenance_ack: event.target.checked, updates_ack: event.target.checked })} />
              Entiendo el mantenimiento anual y que cambios o actualizaciones extras pueden tener costo adicional.
            </label>
            <button className="btn primary" disabled={!form.maintenance_ack || !form.updates_ack} onClick={() => setAccepted(true)}>
              Continuar <ArrowRight />
            </button>
          </div>
        </div>
      )}

      <div className="project-form-hero">
        <span className="section-index">FORMULARIO DE PROYECTO</span>
        <h1>Cuéntanos lo necesario para cotizar tu web, app o software.</h1>
        <p>Mientras más detalle agregues, más precisa será la propuesta.</p>
      </div>

      <form className="project-intake-form" onSubmit={submit}>
        <fieldset>
          <legend>Datos de empresa y contacto</legend>
          <label>Tipo de proyecto<select value={form.service_type} onChange={(event) => setForm({ ...form, service_type: event.target.value as ProjectServiceType })}><option value="landing_page">Landing page</option><option value="website">Sitio web</option><option value="web_app">Aplicación web</option><option value="installable_software">Software instalable</option></select></label>
          <label>Nombre de la empresa<input required value={form.company_name} onChange={(event) => setForm({ ...form, company_name: event.target.value })} /></label>
          <label>Nombre de contacto<input required value={form.contact_name} onChange={(event) => setForm({ ...form, contact_name: event.target.value })} /></label>
          <label>Correo<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
          <label>Teléfono / WhatsApp<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
          <label>País<input value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value })} /></label>
          <label className="full">Sitio web actual o redes<input value={form.company_website} onChange={(event) => setForm({ ...form, company_website: event.target.value })} /></label>
        </fieldset>

        <fieldset>
          <legend>Contexto y objetivo</legend>
          <label className="full">Describe tu empresa<textarea required minLength={20} rows={4} value={form.company_description} onChange={(event) => setForm({ ...form, company_description: event.target.value })} /></label>
          <label className="full">¿Qué quieres lograr con este proyecto?<textarea required minLength={20} rows={4} value={form.project_goal} onChange={(event) => setForm({ ...form, project_goal: event.target.value })} /></label>
          <label className="full">¿A quién va dirigido?<textarea rows={3} value={form.target_audience} onChange={(event) => setForm({ ...form, target_audience: event.target.value })} /></label>
          <label className="full">Referencias o sitios que te gustan<textarea rows={3} value={form.references_text} onChange={(event) => setForm({ ...form, references_text: event.target.value })} /></label>
        </fieldset>

        <fieldset>
          <legend>Alcance</legend>
          <label>Número aproximado de páginas o vistas<input type="number" min={1} value={form.pages_count} onChange={(event) => setForm({ ...form, pages_count: Number(event.target.value) })} /></label>
          <label>Estado del contenido<select value={form.content_status} onChange={(event) => setForm({ ...form, content_status: event.target.value })}><option value="ready">Ya tengo textos e imágenes</option><option value="partial">Tengo parte del contenido</option><option value="needed">Necesito ayuda con textos/contenido</option></select></label>
          <label className="full">Logo, marca o materiales disponibles<textarea rows={3} value={form.brand_assets} onChange={(event) => setForm({ ...form, brand_assets: event.target.value })} /></label>
          <OptionGroup title="Secciones necesarias" options={sectionOptions} values={form.sections_needed} onToggle={(value) => toggle('sections_needed', value)} />
          <OptionGroup title="Funciones" options={featureOptions} values={form.features_needed} onToggle={(value) => toggle('features_needed', value)} />
          <OptionGroup title="Integraciones" options={integrationOptions} values={form.integrations_needed} onToggle={(value) => toggle('integrations_needed', value)} />
        </fieldset>

        <fieldset>
          <legend>Requerimientos especiales</legend>
          <label className="full">Notas técnicas, requerimientos especiales o comentarios<textarea rows={4} value={form.technical_notes} onChange={(event) => setForm({ ...form, technical_notes: event.target.value })} /></label>
          <label className="honeypot" aria-hidden="true">Sitio<input tabIndex={-1} value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} /></label>
        </fieldset>

        {status === 'error' && <div className="form-error">No pudimos enviar el formulario. Inténtalo de nuevo o escríbenos a {settings?.email || 'soporte@nodavexa.com'}.</div>}
        <button className="btn primary" disabled={busy || !form.maintenance_ack || !form.updates_ack}>
          {busy ? 'Enviando…' : 'Enviar información'} <Send />
        </button>
      </form>
    </section>
  )
}

function OptionGroup({ title, options, values, onToggle }: { title: string; options: string[]; values: string[]; onToggle: (value: string) => void }) {
  return (
    <div className="option-group full">
      <b>{title}</b>
      <div>
        {options.map((option) => (
          <label key={option}>
            <input type="checkbox" checked={values.includes(option)} onChange={() => onToggle(option)} />
            {option}
          </label>
        ))}
      </div>
    </div>
  )
}
