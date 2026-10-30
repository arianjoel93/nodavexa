import { useEffect, useRef } from 'react'

const revealSelector = [
  '.home-section-heading', '.home-bodegalia-copy', '.home-bodegalia-visual',
  '.home-product-card', '.home-solution-card', '.home-challenge-card',
  '.home-problem-list > article', '.home-case-grid > article',
  '.home-method > div', '.home-method li', '.home-connected',
  '.solution-card', '.case-card', '.case-video-card',
  '.dist-timeline > article', '.values > article', '.about-story > div',
  '.crm-workflow > div', '.choice-guide > div', '.choice-guide li',
  '.service-content-section', '.service-related', '.service-bottom-cta',
  '.product-content-section', '.product-audience', '.product-bottom-cta',
  '.product-flow-step', '.solution-areas-heading', '.solution-areas-grid > details',
  '.faq-list > details', '.service-faq > details', '.dist-final',
].join(',')
const tiltSelector = '.home-product-card,.home-challenge-card,.solution-card,.case-card'

/** One motion lifecycle for public routes, including asynchronously loaded cards. */
export function useSiteMotion(pathname: string) {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)')
    const registered = new Set<HTMLElement>()
    let observer: IntersectionObserver | undefined
    let scrollFrame = 0
    let pointerFrame = 0
    let tilted: HTMLElement | null = null
    const show = (element: HTMLElement) => {
      element.classList.add('nx-motion-visible')
      observer?.unobserve(element)
    }
    const register = (parent: Element) => {
      const elements = [...(parent.matches(revealSelector) ? [parent] : []), ...parent.querySelectorAll(revealSelector)]
      elements.forEach((node) => {
        const element = node as HTMLElement
        if (registered.has(element)) return
        registered.add(element)
        const index = Array.from(element.parentElement?.children || []).indexOf(element)
        element.style.setProperty('--nx-delay', `${Math.min(Math.max(index, 0) % 4, 3) * 85}ms`)
        const direction = element.matches('.home-bodegalia-copy') ? -36
          : element.matches('.home-bodegalia-visual') ? 36
          : element.matches(tiltSelector) ? (index % 2 === 0 ? -26 : 26) : 0
        element.style.setProperty('--nx-entry-x', `${direction}px`)
        element.classList.add('nx-motion-item')
        if (reduced.matches || !observer) show(element)
        else observer.observe(element)
      })
    }
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) show(entry.target as HTMLElement)
        })
      }, { threshold: 0, rootMargin: '0px 0px -32px 0px' })
    }
    register(root)
    const mutations = new MutationObserver((records) => {
      records.forEach((record) => record.addedNodes.forEach((node) => {
        if (node instanceof Element) register(node)
      }))
      requestScroll()
    })
    const updateScroll = () => {
      scrollFrame = 0
      const available = document.documentElement.scrollHeight - window.innerHeight
      root.style.setProperty('--nx-page-progress', `${available > 0 ? Math.min(1, Math.max(0, window.scrollY / available)) : 0}`)
      root.classList.toggle('nx-scrolled', window.scrollY > 32)
      if (!reduced.matches && finePointer.matches) {
        root.querySelectorAll<HTMLElement>('.home-bodegalia-visual,.home-connect-tags').forEach((element) => {
          const rect = element.getBoundingClientRect()
          if (rect.bottom < 0 || rect.top > window.innerHeight) return
          const progress = (window.innerHeight / 2 - rect.top - rect.height / 2) / window.innerHeight
          element.style.setProperty('--nx-drift', `${Math.max(-18, Math.min(18, progress * 36))}px`)
        })
      }
    }
    function requestScroll() {
      if (!scrollFrame) scrollFrame = window.requestAnimationFrame(updateScroll)
    }
    const resetTilt = () => {
      window.cancelAnimationFrame(pointerFrame)
      pointerFrame = 0
      tilted?.style.removeProperty('--nx-tilt-x')
      tilted?.style.removeProperty('--nx-tilt-y')
      tilted = null
    }
    const pointerMove = (event: PointerEvent) => {
      if (reduced.matches || !finePointer.matches || event.pointerType !== 'mouse') return
      const card = event.target instanceof Element ? event.target.closest<HTMLElement>(tiltSelector) : null
      if (!card || !root.contains(card)) { resetTilt(); return }
      if (tilted !== card) { resetTilt(); tilted = card }
      window.cancelAnimationFrame(pointerFrame)
      pointerFrame = window.requestAnimationFrame(() => {
        pointerFrame = 0
        const rect = card.getBoundingClientRect()
        const x = Math.max(-1, Math.min(1, (event.clientX - rect.left) / rect.width * 2 - 1))
        const y = Math.max(-1, Math.min(1, (event.clientY - rect.top) / rect.height * 2 - 1))
        card.style.setProperty('--nx-tilt-x', `${-y * 3}deg`)
        card.style.setProperty('--nx-tilt-y', `${x * 3}deg`)
      })
    }
    const focus = (event: FocusEvent) => {
      if (event.target instanceof Element) {
        const target = event.target.closest<HTMLElement>('.nx-motion-item')
        if (target) show(target)
      }
    }
    const motionPreference = () => {
      if (reduced.matches) {
        registered.forEach(show)
        resetTilt()
        root.querySelectorAll<HTMLElement>('[style*="--nx-drift"]').forEach((element) => element.style.removeProperty('--nx-drift'))
      }
      requestScroll()
    }
    mutations.observe(root, { childList: true, subtree: true })
    window.addEventListener('scroll', requestScroll, { passive: true })
    window.addEventListener('resize', requestScroll, { passive: true })
    root.addEventListener('pointermove', pointerMove, { passive: true })
    root.addEventListener('pointerleave', resetTilt)
    root.addEventListener('pointercancel', resetTilt)
    root.addEventListener('focusin', focus)
    reduced.addEventListener('change', motionPreference)
    requestScroll()
    return () => {
      mutations.disconnect()
      observer?.disconnect()
      window.cancelAnimationFrame(scrollFrame)
      resetTilt()
      window.removeEventListener('scroll', requestScroll)
      window.removeEventListener('resize', requestScroll)
      root.removeEventListener('pointermove', pointerMove)
      root.removeEventListener('pointerleave', resetTilt)
      root.removeEventListener('pointercancel', resetTilt)
      root.removeEventListener('focusin', focus)
      reduced.removeEventListener('change', motionPreference)
      registered.forEach((element) => {
        element.classList.remove('nx-motion-item', 'nx-motion-visible')
        element.style.removeProperty('--nx-delay')
        element.style.removeProperty('--nx-entry-x')
      })
    }
  }, [pathname])
  return rootRef
}
