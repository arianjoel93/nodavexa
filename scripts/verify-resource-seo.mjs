import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const pages = JSON.parse(readFileSync('src/data/resource-pages.json', 'utf8'))
const sitemap = readFileSync('dist/sitemap.xml', 'utf8')
for (const page of pages) {
  const route = `/recursos/${page.slug}`
  const html = readFileSync(`dist${route}/index.html`, 'utf8')
  assert.equal((html.match(/<h1>/g) || []).length, 1, `${route}: un H1`)
  for (const text of [page.title, 'rel="canonical"', 'FAQPage', 'BreadcrumbList', 'name="description"']) assert.ok(html.includes(text), `${route}: falta ${text}`)
  assert.ok(sitemap.includes(`https://nodavexa.com${route}`), `${route}: sitemap`)
  assert.ok(html.includes('cuenta gratuita'), `${route}: acceso explicado`)
  console.log(`OK ${route}`)
}
console.log('HTML inicial, títulos, descriptions, canonical, FAQ, breadcrumbs y sitemap verificados.')
