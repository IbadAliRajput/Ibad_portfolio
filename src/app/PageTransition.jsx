import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useNavigationType } from 'react-router'
import { gsap, ScrollTrigger, EASE } from '../lib/gsap'
import { prefersReducedMotion } from '../lib/env'
import { TransitionContext, usePageTransition, useScroll } from './context'
import './PageTransition.css'

const frames = (n = 2) =>
  new Promise((res) => {
    const step = (i) => (i <= 0 ? res() : requestAnimationFrame(() => step(i - 1)))
    step(n)
  })

const wait = (ms) => new Promise((res) => setTimeout(res, ms))

function labelFor(path) {
  if (path.startsWith('/work/')) return 'Case study'
  if (path.startsWith('/work')) return 'All work'
  return 'Home'
}

/** Lift the curtain (wipe up, or a fade in reduced motion) */
function uncover(root, reduce) {
  if (reduce) {
    return gsap
      .timeline()
      .to('.pt__panel', { autoAlpha: 0, duration: 0.4, ease: 'power1.out' })
      .set(root, { visibility: 'hidden' })
      .set('.pt__panel', { autoAlpha: 1, clipPath: 'inset(100% 0% 0% 0%)' })
  }
  return gsap
    .timeline()
    .to('.pt__meta > *', { yPercent: -110, duration: 0.5, stagger: 0.04, ease: EASE.inOut })
    .to('.pt__panel', { clipPath: 'inset(0% 0% 100% 0%)', duration: 0.85, ease: EASE.inOut }, 0.15)
    .set(root, { visibility: 'hidden' })
}

/**
 * Curtain transition between routes. The panel wipes up, the route swaps
 * underneath while covered, scroll resets, ScrollTrigger re-measures, then
 * the panel exits upward — an edit-suite "cut to black" between scenes.
 *
 * Router updates render in a React transition, so the swap is awaited (the
 * commit resolves `arrived`) before anything measures the new page.
 * Browser back/forward hard-cuts to the curtain, swaps, and returns to where
 * that history entry was left.
 */
export function TransitionProvider({ children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const navType = useNavigationType()
  const { scrollTo, stop, start } = useScroll()
  const rootRef = useRef(null)
  const busy = useRef(false)
  const arrived = useRef(null)
  const lastPath = useRef(location.pathname)
  const lastKey = useRef(location.key)
  const positions = useRef(new Map())
  const [label, setLabel] = useState({ kicker: '', title: '' })

  // A refresh that lands just after the jump (fonts, late pins, the app's own
  // re-measure) can restore a stale position — keep the landing target until
  // the curtain has lifted
  const holdAnchor = useCallback(
    (target) => {
      const reanchor = () => {
        if (busy.current) scrollTo(target, { immediate: true, force: true })
      }
      ScrollTrigger.addEventListener('refresh', reanchor)
      return () => ScrollTrigger.removeEventListener('refresh', reanchor)
    },
    [scrollTo],
  )

  // Where each history entry was last scrolled to (read before a back/forward
  // swap can clamp it)
  useEffect(() => {
    const onScroll = () => {
      if (!busy.current) positions.current.set(lastKey.current, window.scrollY)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Back/forward: React commits popstate updates synchronously, so this runs
  // before the first paint of the new page — hard-cut to the curtain, let the
  // page measure, return to where the entry was left, then lift.
  const settlePop = useCallback(
    async (target) => {
      busy.current = true
      gsap.killTweensOf('.pt__panel, .pt__meta > *, .pt__bar')
      gsap.set(rootRef.current, { visibility: 'visible' })
      gsap.set('.pt__panel', { autoAlpha: 1, clipPath: 'inset(0% 0% 0% 0%)' })
      gsap.set('.pt__meta > *', { yPercent: -110 })
      gsap.set('.pt__bar', { scaleX: 0 })
      stop()
      await frames(2)
      ScrollTrigger.sort()
      ScrollTrigger.refresh()
      scrollTo(target, { immediate: true, force: true })
      const release = holdAnchor(target)
      start()
      await uncover(rootRef.current, prefersReducedMotion())
      release()
      busy.current = false
    },
    [scrollTo, stop, start, holdAnchor],
  )

  useLayoutEffect(() => {
    const prevPath = lastPath.current
    lastPath.current = location.pathname
    lastKey.current = location.key
    const done = arrived.current
    if (done) {
      arrived.current = null
      done()
      return
    }
    if (navType !== 'POP' || busy.current || prevPath === location.pathname) return
    const y = positions.current.get(location.key)
    settlePop(y == null && location.hash ? location.hash : (y ?? 0))
  }, [location.key, location.pathname, location.hash, navType, settlePop])

  const go = useCallback(
    async (to, opts = {}) => {
      if (busy.current) return
      const [path, hash] = to.split('#')
      const targetPath = path || location.pathname

      // Same page → just glide to the anchor
      if (targetPath === location.pathname) {
        if (hash) scrollTo(`#${hash}`)
        else scrollTo(0)
        return
      }

      busy.current = true
      const root = rootRef.current
      const reduce = prefersReducedMotion()
      setLabel({ kicker: opts.kicker ?? labelFor(targetPath), title: opts.label ?? '' })
      stop()

      if (reduce) {
        await gsap
          .timeline()
          .set(root, { visibility: 'visible' })
          .set('.pt__panel', { clipPath: 'inset(0% 0% 0% 0%)' })
          .fromTo('.pt__panel', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.35, ease: 'power1.out' })
      } else {
        await gsap
          .timeline()
          .set(root, { visibility: 'visible' })
          .fromTo('.pt__panel', { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.8, ease: EASE.inOut })
          .fromTo('.pt__bar', { scaleX: 0 }, { scaleX: 1, duration: 0.9, ease: EASE.inOut }, 0.05)
          .fromTo('.pt__meta > *', { yPercent: 110 }, { yPercent: 0, duration: 0.7, stagger: 0.06 }, 0.3)
      }

      positions.current.set(location.key, window.scrollY)
      scrollTo(0, { immediate: true, force: true })
      const committed = new Promise((res) => {
        arrived.current = res
      })
      navigate(to)
      await Promise.race([committed, wait(4000)])
      arrived.current = null
      await frames(2)
      ScrollTrigger.sort()
      ScrollTrigger.refresh()
      if (hash) await frames(1)
      const target = hash ? `#${hash}` : 0
      scrollTo(target, { immediate: true, force: true })
      const release = holdAnchor(target)
      start()

      await uncover(root, reduce)
      release()
      window.dispatchEvent(new CustomEvent('page:enter', { detail: { path: targetPath } }))
      busy.current = false
    },
    [location.pathname, location.key, navigate, scrollTo, stop, start, holdAnchor],
  )

  const value = useMemo(() => ({ go }), [go])

  return (
    <TransitionContext.Provider value={value}>
      {children}
      <div ref={rootRef} className="pt" aria-hidden="true">
        <div className="pt__panel">
          <div className="pt__meta">
            <span className="t-mono t-mute">
              <span className="rec-dot" /> {label.kicker}
            </span>
            <span className="pt__title t-h2">{label.title}</span>
          </div>
          <div className="pt__track">
            <span className="pt__bar" />
          </div>
        </div>
      </div>
    </TransitionContext.Provider>
  )
}

/**
 * Internal link that routes through the curtain transition.
 * Modifier-clicks fall through to the browser (new tab, etc).
 */
export function TLink({ to, label, kicker, onClick, children, ...rest }) {
  const { go } = usePageTransition()
  const handle = (e) => {
    onClick?.(e)
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    go(to, { label, kicker })
  }
  return (
    <a href={to} onClick={handle} {...rest}>
      {children}
    </a>
  )
}
