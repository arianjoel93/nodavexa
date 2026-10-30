import { describe, expect, it } from 'vitest'
import { sanitizeRichText } from './sanitize-html'

describe('sanitizeRichText', () => {
  it('removes executable markup and unsafe attributes', () => {
    const safe = sanitizeRichText('<script>alert(1)</script><p onclick="alert(2)">Hola</p><img src=x onerror=alert(3)>')

    expect(safe).toBe('<p>Hola</p>')
  })

  it('keeps useful formatting and only permits safe link schemes', () => {
    const safe = sanitizeRichText('<h2>Inventario</h2><p><strong>Orden</strong> <a href="https://bodegalia.nodavexa.com/">ver producto</a> <a href="javascript:alert(1)">riesgo</a></p>')

    expect(safe).toContain('<h2>Inventario</h2>')
    expect(safe).toContain('href="https://bodegalia.nodavexa.com/"')
    expect(safe).toContain('rel="noopener noreferrer nofollow"')
    expect(safe).not.toContain('javascript:')
  })
})
