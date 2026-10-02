import { useRef } from 'react'
import { gsap, useGSAP, ScrollTrigger } from '../lib/gsap'
import { prefersReducedMotion } from '../lib/env'
import SplitReveal from './SplitReveal'
import './Primitives.css'

/** Mono section label:  03 ── SELECTED WORK */
export function Eyebrow({ index, children, className = '' }) {
  return (
    <p className={`eyebrow t-mono ${className}`}>
      {index && <span className="eyebrow__idx">{index}</span>}
      <span className="eyebrow__bar" aria-hidden="true" />
      <span className="eyebrow__txt">{children}</span>
    </p>
  )
}

/**
 * Standard section header: eyebrow row (+ optional right-aligned aside),
 * masked headline reveal, optional lead paragraph.
 */
export function SectionHeader({
  index,
  eyebrow,
  title,
  lead,
  aside,
  as = 'h2',
  titleClass = 't-h1',
  className = '',
  children,
}) {
  return (
    <header className={`sh ${className}`}>
      <div className="sh__top">
        <Eyebrow index={index}>{eyebrow}</Eyebrow>
        {aside && <p className="sh__aside t-mono t-mute">{aside}</p>}
      </div>
      <div className="sh__main">
        <SplitReveal as={as} className={`sh__title ${titleClass}`}>
          {title}
        </SplitReveal>
        {lead && (
          <SplitReveal as="p" className="sh__lead t-lead" delay={0.12}>
            {lead}
          </SplitReveal>
        )}
      </div>
      {children}
    </header>
  )
}

/** Number that counts up when it scrolls into view */
export function Counter({ value, prefix = '', suffix = '', decimals = 0, duration = 2.2, className = '' }) {
  const ref = useRef(null)
  useGSAP(
    () => {
      const el = ref.current
      const fmt = (n) => `${prefix}${n.toFixed(decimals)}${suffix}`
      const o = { v: 0 }
      let shown = el.textContent
      gsap.to(o, {
        v: value,
        duration,
        ease: 'expo.out',
        scrollTrigger: { trigger: el, start: 'top 92%', once: true },
        onUpdate: () => {
          // the expo tail repeats the same figure for many frames — rewriting display-size
          // text re-lays it out and repaints it, so only write when it changes
          const next = fmt(o.v)
          if (next === shown) return
          shown = next
          el.textContent = next
        },
      })
    },
    { scope: ref },
  )
  return (
    <span ref={ref} className={`counter tabular ${className}`}>
      {`${prefix}${(0).toFixed(decimals)}${suffix}`}
    </span>
  )
}

/**
 * Infinite marquee that speeds up (and leans) with scroll velocity.
 *  speed    seconds per loop
 *  reverse  scroll right instead of left
 *  repeat   copies of children per half (make each half wider than the viewport)
 */
export function Marquee({ children, speed = 30, reverse = false, repeat = 2, className = '', velocity = true }) {
  const ref = useRef(null)
  useGSAP(
    () => {
      const track = ref.current.querySelector('.mq__track')
      if (prefersReducedMotion()) return
      const loop = gsap.fromTo(
        track,
        { xPercent: reverse ? -50 : 0 },
        { xPercent: reverse ? 0 : -50, duration: speed, ease: 'none', repeat: -1 },
      )
      // idle while off screen (IntersectionObserver sees the real, pinned position)
      const io = new IntersectionObserver(([e]) => loop.paused(!e.isIntersecting))
      io.observe(ref.current)
      if (!velocity) return () => io.disconnect()
      // Scroll speed → loop speed: a quick rise (~0.2s) and a long settle (~1.2s) back to 1×,
      // eased by one ticker callback that runs only while boosted. (Two fresh tweens per
      // scroll frame used to churn the garbage collector.)
      let rate = 1
      let target = 1
      let lastBoost = 0
      let ticking = false
      const tick = (time, dt) => {
        if (performance.now() - lastBoost > 200) target = 1
        const k = target > rate ? 0.2 : 0.045 // per 60fps frame
        rate += (target - rate) * (1 - Math.pow(1 - k, dt / 16.67))
        if (target === 1 && Math.abs(rate - 1) < 0.005) {
          rate = 1
          ticking = false
          gsap.ticker.remove(tick)
        }
        loop.timeScale(rate)
      }
      const st = ScrollTrigger.create({
        trigger: ref.current,
        start: 'top bottom',
        end: 'bottom top',
        onUpdate(self) {
          target = 1 + Math.min(Math.abs(self.getVelocity()) / 350, 5)
          lastBoost = performance.now()
          if (!ticking) {
            ticking = true
            gsap.ticker.add(tick)
          }
        },
      })
      return () => {
        io.disconnect()
        st.kill()
        gsap.ticker.remove(tick)
      }
    },
    { scope: ref },
  )
  const half = Array.from({ length: repeat }, (_, i) => (
    <div className="mq__item" key={i} aria-hidden={i > 0 || undefined}>
      {children}
    </div>
  ))
  return (
    <div ref={ref} className={`mq ${className}`}>
      <div className="mq__track">
        <div className="mq__half">{half}</div>
        <div className="mq__half" aria-hidden="true">
          {half}
        </div>
      </div>
    </div>
  )
}
