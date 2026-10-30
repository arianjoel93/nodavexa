import { useEffect, useState } from 'react'
import products from '../data/products.json'
import { fetchSolutions, isSupabaseReady } from './supabase'
import { solutionSlugForProduct } from './product-solution-links'

const defaultProducts = products.filter((product) => product.slug !== 'automatizacion-pesaje-etiquetado')

export function usePublishedProducts() {
  const [publishedProducts, setPublishedProducts] = useState(defaultProducts)

  useEffect(() => {
    if (!isSupabaseReady) return
    let active = true
    fetchSolutions().then((solutions) => {
      if (active) setPublishedProducts(products.filter((product) => solutions.some((solution) => solution.slug === solutionSlugForProduct(product.slug))))
    }).catch(() => {})
    return () => { active = false }
  }, [])

  return publishedProducts
}
