import { useEffect } from 'react'

const site = (import.meta.env.VITE_SITE_URL || 'https://nodavexa.com').replace(/\/$/, '')
type Props = {
  title: string
  description: string
  path?: string
  image?: string
  imageAlt?: string
  type?: 'website' | 'article'
  jsonLd?: Record<string, unknown>
  noindex?: boolean
}

export function Seo({ title, description, path = '/', image, imageAlt = 'Nodavexa, software para empresas', type = 'website', jsonLd, noindex = false }: Props) {
  useEffect(() => {
    const canonical = `${site}${path.startsWith('/') ? path : `/${path}`}`
    const socialImage = image || `${site}/og-nodavexa.jpg`
    document.title = title

    const meta = (selector: string, attributes: Record<string, string>) => {
      let element = document.head.querySelector(selector) as HTMLMetaElement | null
      if (!element) {
        element = document.createElement('meta')
        document.head.appendChild(element)
      }
      Object.entries(attributes).forEach(([key, value]) => element!.setAttribute(key, value))
    }

    meta('meta[name="description"]', { name: 'description', content: description })
    meta('meta[name="robots"]', { name: 'robots', content: noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1' })
    meta('meta[property="og:site_name"]', { property: 'og:site_name', content: 'Nodavexa' })
    meta('meta[property="og:locale"]', { property: 'og:locale', content: 'es_MX' })
    meta('meta[property="og:type"]', { property: 'og:type', content: type })
    meta('meta[property="og:title"]', { property: 'og:title', content: title })
    meta('meta[property="og:description"]', { property: 'og:description', content: description })
    meta('meta[property="og:url"]', { property: 'og:url', content: canonical })
    meta('meta[property="og:image"]', { property: 'og:image', content: socialImage })
    meta('meta[property="og:image:alt"]', { property: 'og:image:alt', content: imageAlt })
    meta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' })
    meta('meta[name="twitter:title"]', { name: 'twitter:title', content: title })
    meta('meta[name="twitter:description"]', { name: 'twitter:description', content: description })
    meta('meta[name="twitter:image"]', { name: 'twitter:image', content: socialImage })

    let canonicalLink = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null
    if (!canonicalLink) {
      canonicalLink = document.createElement('link')
      canonicalLink.rel = 'canonical'
      document.head.appendChild(canonicalLink)
    }
    canonicalLink.href = canonical

    document.getElementById('page-jsonld')?.remove()
    document.querySelector('script[data-static-seo]')?.remove()
    if (jsonLd) {
      const script = document.createElement('script')
      script.id = 'page-jsonld'
      script.type = 'application/ld+json'
      script.text = JSON.stringify(jsonLd)
      document.head.appendChild(script)
    }
  }, [title, description, path, image, imageAlt, type, jsonLd, noindex])

  return null
}

export const seoDefaults = { site }
