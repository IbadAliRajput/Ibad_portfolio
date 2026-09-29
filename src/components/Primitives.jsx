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
      gsap.to(o, {
        v: value,
        duration,
        ease: 'expo.out',
        scrollTrigger: { trigger: el, start: 'top 92%', once: true },
        onUpdate: () => {
          el.textContent = fmt(o.v)
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
      const st = ScrollTrigger.create({
        trigger: ref.current,
        start: 'top bottom',
        end: 'bottom top',
        onUpdate(self) {
          const v = Math.min(Math.abs(self.getVelocity()) / 350, 5)
          gsap.to(loop, { timeScale: 1 + v, duration: 0.2, overwrite: true })
          gsap.to(loop, { timeScale: 1, duration: 1.2, delay: 0.2, ease: 'power2.out' })
        },
      })
      return () => {
        io.disconnect()
        st.kill()
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
