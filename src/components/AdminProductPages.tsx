import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink, Save } from 'lucide-react'
import products from '../data/products.json'
import { spanishSupabaseError, supabase } from '../lib/supabase'
import { solutionSlugForProduct } from '../lib/product-solution-links'
import type { ProductPageContent, Solution } from '../types'
import { ProductPageEditor } from './ProductPageEditor'

type ProductRecord = (typeof products)[number]

const productContent = (product: ProductRecord): ProductPageContent => ({
  h1: product.h1,
  lead: product.lead,
  intro: product.intro,
  whatsapp: product.whatsapp,
  flow: product.flow,
  manualFlow: 'manualFlow' in product ? product.manualFlow : undefined,
  sections: product.sections,
  audiences: product.audiences,
  price: product.price,
  priceNote: product.priceNote,
})

export function AdminProductPages({ items, onSaved }: { items: Solution[]; onSaved: () => void }) {
  const [slug, setSlug] = useState(products[0].slug)
  const [page, setPage] = useState<ProductPageContent>(productContent(products[0]))
  const [name, setName] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [seoDescription, setSeoDescription] = useState('')
  const [published, setPublished] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const product = products.find((item) => item.slug === slug) || products[0]
  const solution = items.find((item) => item.slug === solutionSlugForProduct(slug))

  useEffect(() => {
    setPage(solution?.product_page ? { ...productContent(product), ...solution.product_page, price: product.price } : productContent(product))
    setName(solution?.name || product.product)
    setExcerpt(solution?.excerpt || product.lead)
    setSeoDescription(solution?.seo_description || product.description)
    setPublished(solution?.published ?? true)
  }, [solution, product])

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!page.flow.length || !page.sections.length) {
      setMessage('Agrega al menos un paso de flujo y una sección de contenido.')
      return
    }
    setBusy(true)
    setMessage('')
    const payload = {
      name: name.trim(),
      excerpt: excerpt.trim(),
      seo_description: seoDescription.trim(),
      product_page: page,
      published,
      updated_at: new Date().toISOString(),
    }
    const result = solution
      ? await supabase.from('solutions').update(payload).eq('id', solution.id).select('id').single()
      : await supabase.from('solutions').insert({ ...payload, slug, description: '', category: slug === 'nodavexa-control' ? 'CRM' : 'Inventarios y almacenes', item_type: 'product', software_pricing_model: 'deposit_monthly' }).select('id').single()
    setBusy(false)
    if (result.error) {
      setMessage(`No se pudo guardar: ${spanishSupabaseError(result.error)}`)
      return
    }
    setMessage('Contenido guardado en Supabase.')
    onSaved()
  }

  return <>
    <header><div><span>PÁGINAS DE PRODUCTO</span><h1>Contenido de soluciones</h1><p>Administra las páginas públicas de Nodavexa Control, Bodegalia y Nodavexa Weigh &amp; Label.</p></div></header>
    <div className="categories" role="group" aria-label="Elegir producto">
      {products.map((item) => <button type="button" className={slug === item.slug ? 'active' : ''} onClick={() => { setSlug(item.slug); setMessage('') }} key={item.slug}>{item.product}</button>)}
    </div>
    <form className="admin-product-page-form" onSubmit={(event) => void save(event)}>
      <div className="field-grid">
        <label className="full">Nombre del producto<input required value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label className="full">Descripción corta<textarea required rows={2} maxLength={220} value={excerpt} onChange={(event) => setExcerpt(event.target.value)} /></label>
        <label className="full">Descripción SEO<textarea required rows={2} maxLength={160} value={seoDescription} onChange={(event) => setSeoDescription(event.target.value)} /></label>
      </div>
      <ProductPageEditor value={page} onChange={setPage} />
      <label className="publish-options"><input type="checkbox" checked={published} onChange={(event) => setPublished(event.target.checked)} /> Publicada en el catálogo</label>
      {message && <p role="status">{message}</p>}
      <div className="admin-product-page-actions"><button className="btn primary" type="submit" disabled={busy}><Save /> {busy ? 'Guardando…' : 'Guardar contenido'}</button><Link className="btn ghost" to={`/${slug}`} target="_blank" rel="noreferrer">Ver página <ExternalLink /></Link></div>
    </form>
  </>
}
