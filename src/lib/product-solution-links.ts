const productSolutionSlugs: Record<string, string> = {
  'nodavexa-control': 'nodavexa-control',
  bodegalia: 'sistema-de-inventario-y-control-de-almacenes',
  'automatizacion-pesaje-etiquetado': 'automatizacion-pesaje-etiquetado',
}

export const solutionSlugForProduct = (slug: string) => productSolutionSlugs[slug] || slug

export const productSlugForSolution = (slug: string) =>
  Object.keys(productSolutionSlugs).find((productSlug) => productSolutionSlugs[productSlug] === slug)
