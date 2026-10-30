import { useEffect, useState } from 'react'
import { ArrowUpRight, Image, RotateCcw, Save } from 'lucide-react'
import { defaultHomepageHeroSlides, defaultSiteSettings, fetchSiteSettings, spanishSupabaseError, supabase } from '../lib/supabase'
import type { HomepageHeroSlide, SiteSettings } from '../types'
import posthog from '../lib/posthog'

export function AdminSettings() {
  const [form, setForm] = useState<SiteSettings>(defaultSiteSettings)
  const [slides, setSlides] = useState<HomepageHeroSlide[]>(defaultHomepageHeroSlides)
  const [notice, setNotice] = useState('')
  const [slideNotice, setSlideNotice] = useState('')

  useEffect(() => {
    fetchSiteSettings().then((settings) => {
      setForm(settings)
      setSlides(settings.homepage_hero_slides || defaultHomepageHeroSlides)
    }).catch((error: Error) => {
      setNotice(spanishSupabaseError(error, 'No se pudieron cargar los datos de configuración.'))
    })
  }, [])

  const saveContact = async (event: React.FormEvent) => {
    event.preventDefault()
    setNotice('')
    const { error } = await supabase.from('site_settings').update({
      whatsapp: form.whatsapp,
      email: form.email,
      address: form.address,
      updated_at: new Date().toISOString(),
    }).eq('id', true)
    if (!error) posthog?.capture('admin_contact_settings_saved')
    setNotice(error ? spanishSupabaseError(error) : 'Datos de contacto guardados correctamente.')
  }

  const saveSlides = async (event: React.FormEvent) => {
    event.preventDefault()
    setSlideNotice('')
    if (slides.length !== 3 || slides.some((slide) => !slide.image_url.trim() || !slide.alt.trim())) {
      setSlideNotice('Completa la URL y el texto alternativo de las tres imágenes.')
      return
    }
    const { error } = await supabase.from('site_settings').update({
      homepage_hero_slides: slides,
      updated_at: new Date().toISOString(),
    }).eq('id', true)
    if (!error) posthog?.capture('admin_homepage_hero_saved')
    setSlideNotice(error
      ? error.message.includes('homepage_hero_slides')
        ? 'Falta aplicar la migración supabase/migrations/20261020120000_homepage_hero_slides.sql en el proyecto Supabase.'
        : spanishSupabaseError(error)
      : 'Las tres imágenes del banner se guardaron correctamente.')
  }

  const updateSlide = (index: number, key: keyof HomepageHeroSlide, value: string) => {
    setSlides((current) => current.map((slide, slideIndex) => slideIndex === index ? { ...slide, [key]: value } : slide))
  }

  return <div className="admin-settings-stack">
    <form className="admin-settings" onSubmit={saveContact}>
      <h2>Datos de contacto</h2>
      <p>Estos datos se mostrarán en el encabezado, botón de WhatsApp, contacto y pie de página.</p>
      <label>Número de WhatsApp<input required value={form.whatsapp} onChange={(event) => setForm({ ...form, whatsapp: event.target.value })} placeholder="523338419644" /></label>
      <label>Correo electrónico<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
      <label>Dirección o cobertura<textarea required rows={3} value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></label>
      {notice && <div className="notice" role="status">{notice}</div>}
      <button className="btn primary"><Save /> Guardar contacto</button>
    </form>

    <form className="admin-settings admin-hero-settings" onSubmit={saveSlides}>
      <div className="admin-hero-topline">
        <span className="admin-hero-mark"><Image aria-hidden="true" /></span>
        <div className="admin-hero-heading-copy">
          <span className="admin-settings-eyebrow">PORTADA DEL SITIO</span>
          <h2>Banner de inicio</h2>
          <p>Administra las tres imágenes del carrusel principal. Revisa cómo se ven, actualiza su URL y descripción, y guarda los cambios para publicarlos.</p>
        </div>
        <button className="admin-hero-reset" type="button" onClick={() => { setSlides(defaultHomepageHeroSlides); setSlideNotice('Se restauraron las imágenes de ejemplo. Guarda para publicar el cambio.') }}><RotateCcw /> Restaurar ejemplos</button>
      </div>
      <div className="admin-hero-slide-list">
        {slides.map((slide, index) => <fieldset className="admin-hero-slide" key={index}>
          <legend><span>{String(index + 1).padStart(2, '0')}</span> Imagen del carrusel</legend>
          <div className="admin-hero-preview">
            {slide.image_url.trim() ? <img src={slide.image_url} alt="" loading="lazy" /> : <div className="admin-hero-preview-empty"><Image /><span>Agrega la URL de una imagen</span></div>}
            <span className="admin-hero-preview-tag">VISTA PREVIA</span>
          </div>
          <label><span>URL de la imagen</span><input required type="url" value={slide.image_url} onChange={(event) => updateSlide(index, 'image_url', event.target.value)} placeholder="https://..." /></label>
          <label><span>Descripción accesible</span><input required value={slide.alt} onChange={(event) => updateSlide(index, 'alt', event.target.value)} placeholder="Describe lo que aparece en la imagen" /></label>
          <a className="admin-hero-open-image" href={slide.image_url} target="_blank" rel="noreferrer">Abrir imagen original <ArrowUpRight /></a>
        </fieldset>)}
      </div>
      <div className="admin-hero-footer">
        <p><strong>3 imágenes</strong><span>El orden de las tarjetas es el orden del carrusel.</span></p>
        <div>{slideNotice && <div className="notice" role="status">{slideNotice}</div>}<button className="btn primary"><Save /> Guardar cambios del banner</button></div>
      </div>
    </form>
  </div>
}
