import { useEffect, useRef, useSyncExternalStore } from 'react'
import { gsap } from './gsap'
import { MQ, isBrowser, prefersReducedMotion } from './env'

/** Reactive media query */
export function useMediaQuery(query) {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query)
      m.addEventListener('change', cb)
      return () => m.removeEventListener('change', cb)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

export const useIsMobile = () => useMediaQuery(MQ.mobile)
export const useIsDesktop = () => useMediaQuery(MQ.desktop)
export const useFinePointer = () => useMediaQuery(MQ.fine)
/** Effective motion preference (OS default, user override) — stable for the page's lifetime */
export const useReducedMotion = () => prefersReducedMotion()

/**
 * Magnetic pull toward the pointer (fine pointers only).
 * Attach the returned ref to the element; `strength` ≈ fraction of the offset followed.
 */
export function useMagnetic(strength = 0.35, { inner } = {}) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el || !isBrowser || !window.matchMedia(MQ.fine).matches) return
    const xTo = gsap.quickTo(el, 'x', { duration: 0.8, ease: 'elastic.out(1, 0.45)' })
    const yTo = gsap.quickTo(el, 'y', { duration: 0.8, ease: 'elastic.out(1, 0.45)' })
    const innerEl = inner ? el.querySelector(inner) : null
    const ixTo = innerEl && gsap.quickTo(innerEl, 'x', { duration: 0.8, ease: 'elastic.out(1, 0.45)' })
    const iyTo = innerEl && gsap.quickTo(innerEl, 'y', { duration: 0.8, ease: 'elastic.out(1, 0.45)' })
    const move = (e) => {
      const b = el.getBoundingClientRect()
      const dx = e.clientX - (b.left + b.width / 2)
      const dy = e.clientY - (b.top + b.height / 2)
      xTo(dx * strength)
      yTo(dy * strength)
      if (ixTo) { ixTo(dx * strength * 0.45); iyTo(dy * strength * 0.45) }
    }
    const leave = () => {
      xTo(0); yTo(0)
      if (ixTo) { ixTo(0); iyTo(0) }
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerleave', leave)
    return () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerleave', leave)
      gsap.killTweensOf(el)
      if (innerEl) gsap.killTweensOf(innerEl)
    }
  }, [strength, inner])
  return ref
}

/** Fires callback once when the element first comes near the viewport */
export function useInViewOnce(ref, cb, rootMargin = '200px') {
  const cbRef = useRef(cb)
  useEffect(() => { cbRef.current = cb })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { cbRef.current(); io.disconnect() }
    }, { rootMargin })
    io.observe(el)
    return () => io.disconnect()
  }, [ref, rootMargin])
}
