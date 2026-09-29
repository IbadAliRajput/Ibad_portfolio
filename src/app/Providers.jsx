import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Lenis from 'lenis'
import { gsap, ScrollTrigger } from '../lib/gsap'
import { prefersReducedMotion } from '../lib/env'
import { ReadyContext, ScrollContext, VideoContext } from './context'

export function ReadyProvider({ children }) {
  const [ready, setReady] = useState(false)
  const value = useMemo(() => ({ ready, setReady }), [ready])
  return <ReadyContext.Provider value={value}>{children}</ReadyContext.Provider>
}

/**
 * Lenis smooth scroll, driven by GSAP's ticker so ScrollTrigger and Lenis
 * share one clock (no double-rAF drift). Reduced motion → native scroll.
 * The helpers read the live instance from a ref, so callers that captured
 * them before Lenis existed (the preloader) still stop/start the real thing.
 */
export function ScrollProvider({ children }) {
  const [lenis, setLenis] = useState(null)
  const lenisRef = useRef(null)

  useEffect(() => {
    if (prefersReducedMotion()) return
    const l = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 1.3,
    })
    l.on('scroll', ScrollTrigger.update)
    const tick = (time) => l.raf(time * 1000)
    gsap.ticker.add(tick)
    gsap.ticker.lagSmoothing(0)
    if (document.documentElement.classList.contains('is-scroll-locked')) l.stop()
    lenisRef.current = l
    // syncing React with an external system (the Lenis instance) is exactly what effects are for
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLenis(l)
    window.__lenis = l
    return () => {
      gsap.ticker.remove(tick)
      l.destroy()
      if (lenisRef.current === l) lenisRef.current = null
      delete window.__lenis
      setLenis(null)
    }
  }, [])

  const scrollTo = useCallback((target, opts = {}) => {
    const offset = opts.offset ?? 0
    const l = lenisRef.current
    if (l) {
      let to = target
      if (opts.immediate) {
        // jumps follow layout changes (route swaps, new pins): re-measure so the target isn't clamped to a stale limit
        l.resize()
        // …and resolve elements against the real scroll position — a ScrollTrigger refresh can leave
        // Lenis's own value briefly at a pin's measuring position, which would offset the jump by it
        if (typeof to !== 'number') {
          const el = typeof to === 'string' ? document.querySelector(to) : to
          if (!el) return
          to = el.getBoundingClientRect().top + window.scrollY
        }
      }
      l.scrollTo(to, { duration: 1.6, easing: (t) => 1 - Math.pow(1 - t, 4), ...opts, offset })
      return
    }
    const el = typeof target === 'number' ? null : typeof target === 'string' ? document.querySelector(target) : target
    if (typeof target !== 'number' && !el) return
    const y = el ? el.getBoundingClientRect().top + window.scrollY + offset : target
    window.scrollTo({ top: y, behavior: opts.immediate ? 'auto' : 'smooth' })
    // Let ScrollTrigger see the new position now (Lenis does this through its scroll event):
    // a refresh that runs before it has, measures pins out of order after a native jump
    if (opts.immediate) ScrollTrigger.update()
  }, [])
  const stop = useCallback(() => {
    lenisRef.current?.stop()
    document.documentElement.classList.add('is-scroll-locked')
  }, [])
  const start = useCallback(() => {
    lenisRef.current?.start()
    document.documentElement.classList.remove('is-scroll-locked')
  }, [])

  const value = useMemo(() => ({ lenis, scrollTo, stop, start }), [lenis, scrollTo, stop, start])
  return <ScrollContext.Provider value={value}>{children}</ScrollContext.Provider>
}

export function VideoProvider({ children, render }) {
  const [item, setItem] = useState(null)
  const openVideo = useCallback((v) => setItem(v), [])
  const closeVideo = useCallback(() => setItem(null), [])
  const value = useMemo(() => ({ openVideo, closeVideo, item }), [openVideo, closeVideo, item])
  return (
    <VideoContext.Provider value={value}>
      {children}
      {render?.(item, closeVideo)}
    </VideoContext.Provider>
  )
}
