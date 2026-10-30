import { Plus, Trash2 } from 'lucide-react'
import type { ProductPageContent } from '../types'

const lines = (value: string) => value.split('\n').map((item) => item.trim()).filter(Boolean)

export function ProductPageEditor({ value, onChange }: { value: ProductPageContent; onChange: (value: ProductPageContent) => void }) {
  const set = <K extends keyof ProductPageContent>(key: K, next: ProductPageContent[K]) => onChange({ ...value, [key]: next })
  const updateSection = (index: number, patch: Partial<ProductPageContent['sections'][number]>) =>
    set('sections', value.sections.map((section, current) => current === index ? { ...section, ...patch } : section))

  return <section>
    <h3>Página del producto</h3>
    <p>Este contenido aparece en la página pública de la solución.</p>
    <div className="field-grid">
      <label className="full">Titular principal<input required value={value.h1} onChange={(event) => set('h1', event.target.value)} /></label>
      <label className="full">Resumen del producto<textarea required rows={2} value={value.lead} onChange={(event) => set('lead', event.target.value)} /></label>
      <label className="full">Introducción<textarea required rows={3} value={value.intro} onChange={(event) => set('intro', event.target.value)} /></label>
      <label className="full">Mensaje de WhatsApp<input value={value.whatsapp} onChange={(event) => set('whatsapp', event.target.value)} /></label>
      <label className="full">Pasos del flujo (uno por línea)<textarea rows={5} value={value.flow.join('\n')} onChange={(event) => set('flow', lines(event.target.value))} /></label>
      <label className="full">Proceso manual (uno por línea; opcional)<textarea rows={5} value={(value.manualFlow || []).join('\n')} onChange={(event) => set('manualFlow', lines(event.target.value))} /></label>
      <label className="full">Empresas a las que se dirige (una por línea)<textarea rows={4} value={value.audiences.join('\n')} onChange={(event) => set('audiences', lines(event.target.value))} /></label>
      <label className="full">Texto de precio (opcional)<input value={value.price || ''} onChange={(event) => set('price', event.target.value)} /></label>
      <label className="full">Nota de precio (opcional)<textarea rows={2} value={value.priceNote || ''} onChange={(event) => set('priceNote', event.target.value)} /></label>
    </div>
    <div className="section-title"><h3>Secciones de contenido</h3><button type="button" onClick={() => set('sections', [...value.sections, { heading: '', copy: '', items: [] }])}><Plus /> Agregar sección</button></div>
    {value.sections.map((section, index) => <div className="equipment-form" key={index}>
      <div><b>Sección {index + 1}</b><button type="button" aria-label={`Eliminar sección ${index + 1}`} onClick={() => set('sections', value.sections.filter((_, current) => current !== index))}><Trash2 /></button></div>
      <label className="full">Título<input required value={section.heading} onChange={(event) => updateSection(index, { heading: event.target.value })} /></label>
      <label className="full">Descripción<textarea required rows={3} value={section.copy} onChange={(event) => updateSection(index, { copy: event.target.value })} /></label>
      <label className="full">Puntos destacados (uno por línea)<textarea rows={4} value={(section.items || []).join('\n')} onChange={(event) => updateSection(index, { items: lines(event.target.value) })} /></label>
    </div>)}
  </section>
}
