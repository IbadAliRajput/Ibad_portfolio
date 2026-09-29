import { useRef, useState } from 'react'
import { gsap, ScrollTrigger, useGSAP, EASE } from '../lib/gsap'
import { prefersReducedMotion } from '../lib/env'
import { useFinePointer, useIsDesktop } from '../lib/hooks'
import { SectionHeader, Marquee } from '../components/Primitives'
import Glass from '../components/LiquidGlass'
import { AdCaption } from '../components/VerticalVideo'
import { SERVICES } from '../data/services'
import { SITE } from '../data/site'
import './Services.css'

const TOTAL = String(SERVICES.length).padStart(2, '0')
const NAV_KEYS = ['ArrowDown', 'ArrowUp', 'Home', 'End']
/** The differentiator word gets the caption highlight: "UGC", "VSL", "AI"… */
const keyword = (title) => title.split(' ')[0]

const SHOWN = 'inset(0% 0% 0% 0%)'
const FROM_BELOW = 'inset(100% 0% 0% 0%)'
const FROM_ABOVE = 'inset(0% 0% 100% 0%)'

/** One 9:16 "frame" inside the floating preview */
function Shot({ service }) {
  return (
    <div className="sv-shot">
      <img className="sv-shot__img" src={service.poster} alt="" loading="lazy" decoding="async" draggable="false" />
      <span className="sv-shot__shade" />
      <span className="sv-shot__crop cropmarks" />
      <div className="sv-shot__top t-mono">
        <span className="sv-shot__idx">
          <span className="sv-shot__dot" />
          {service.index} / {TOTAL}
        </span>
        <span>9:16</span>
      </div>
      <AdCaption className="sv-shot__cap" text={service.title} hl={keyword(service.title)} />
    </div>
  )
}

/** Inline poster shown inside an expanded row on touch / small screens */
function Thumb({ service }) {
  return (
    <figure className="sv-thumb" data-sv-reveal aria-hidden="true">
      <img className="sv-thumb__img" src={service.poster} alt="" loading="lazy" decoding="async" draggable="false" />
      <span className="sv-thumb__shade" />
      <span className="sv-thumb__idx t-mono">
        {service.index} / {TOTAL}
      </span>
      <AdCaption className="sv-thumb__cap" text={service.title} hl={keyword(service.title)} />
    </figure>
  )
}

export default function Services() {
  const rootRef = useRef(null)
  const listRef = useRef(null)
  const previewRef = useRef(null)
  const prevOpen = useRef(-1)
  const [open, setOpen] = useState(-1)
  const fine = useFinePointer()
  const desktop = useIsDesktop()
  const previewOn = fine && desktop

  /* 1 · Entrance — hairlines draw in, titles rise out of their masks */
  useGSAP(
    () => {
      const list = listRef.current
      const rows = gsap.utils.toArray(list.querySelectorAll('.sv-row'))
      const listRule = list.querySelector('.sv-list__rule')

      if (prefersReducedMotion()) {
        // Fade the row contents, never the rows: their opacity belongs to the CSS hover-dim
        gsap.from(list.querySelectorAll('.sv-list__rule, .sv-row__btn, .sv-row__rule'), {
          opacity: 0,
          duration: 0.7,
          stagger: 0.03,
          ease: 'power1.out',
          scrollTrigger: { trigger: list, start: 'top 85%', once: true },
        })
        return
      }

      gsap.from(listRule, {
        scaleX: 0,
        duration: 1.6,
        ease: EASE.inOut,
        scrollTrigger: { trigger: list, start: 'top 90%', once: true },
      })

      const intros = new Map()
      rows.forEach((row) => {
        const tl = gsap.timeline({ paused: true })
        tl.from(row.querySelector('.sv-row__rule'), { scaleX: 0, duration: 1.5, ease: EASE.inOut }, 0)
          .from(row.querySelector('.sv-row__tin'), { yPercent: 108, duration: 1.25, ease: EASE.out }, 0.08)
          .from(
            row.querySelectorAll('.sv-row__idx, .sv-row__short, .sv-row__icon'),
            { opacity: 0, y: 14, duration: 1, stagger: 0.07, ease: EASE.out },
            0.22,
          )
        intros.set(row, tl)
      })

      ScrollTrigger.batch(rows, {
        start: 'top 92%',
        once: true,
        onEnter: (batch) => batch.forEach((row, k) => intros.get(row)?.delay(k * 0.09).restart(true)),
      })
    },
    { scope: rootRef },
  )

  /* 2 · Accordion — one row open at a time; height animates from/to auto */
  useGSAP(
    () => {
      const prev = prevOpen.current
      if (prev === open) return
      prevOpen.current = open

      const rows = gsap.utils.toArray(listRef.current.querySelectorAll('.sv-row'))
      const reduced = prefersReducedMotion()
      const tl = gsap.timeline({ onComplete: () => ScrollTrigger.refresh() })

      if (prev >= 0 && rows[prev]) {
        const panel = rows[prev].querySelector('.sv-row__panel')
        tl.to(
          panel.querySelectorAll('[data-sv-reveal]'),
          { opacity: 0, y: -6, duration: reduced ? 0.2 : 0.35, ease: 'power2.out', overwrite: true },
          0,
        )
        tl.to(
          panel,
          {
            height: 0,
            duration: reduced ? 0 : 0.75,
            ease: EASE.inOut,
            overwrite: true,
            onComplete: () => gsap.set(panel, { visibility: 'hidden' }),
          },
          0,
        )
      }

      if (open >= 0 && rows[open]) {
        const panel = rows[open].querySelector('.sv-row__panel')
        tl.fromTo(
          panel,
          { height: panel.offsetHeight, visibility: 'visible' },
          { height: 'auto', visibility: 'visible', duration: reduced ? 0 : 0.85, ease: EASE.inOut, overwrite: true },
          0,
        )
        tl.fromTo(
          panel.querySelectorAll('[data-sv-reveal]'),
          { opacity: 0, y: reduced ? 0 : 22 },
          { opacity: 1, y: 0, duration: reduced ? 0.35 : 1, stagger: reduced ? 0 : 0.07, ease: EASE.out, overwrite: true },
          reduced ? 0 : 0.18,
        )
      }
    },
    { scope: rootRef, dependencies: [open] },
  )

  /* 3 · Floating glass preview — desktop + fine pointer only */
  useGSAP(
    () => {
      const list = listRef.current
      const preview = previewRef.current
      if (!previewOn || !list || !preview) return

      const glass = preview.querySelector('.sv-preview__glass')
      const shots = gsap.utils.toArray(preview.querySelectorAll('.sv-shot'))
      const imgs = shots.map((s) => s.querySelector('.sv-shot__img'))
      const overlays = shots.map((s) => s.querySelectorAll('.sv-shot__top, .sv-shot__cap'))
      const reduced = prefersReducedMotion()
      const clampRot = gsap.utils.clamp(-6, 6)

      gsap.set(preview, { xPercent: -50, yPercent: -50, x: 0, y: 0, rotation: 0 })
      gsap.set(glass, { autoAlpha: 0, scale: 0.55 })
      gsap.set(shots, { clipPath: FROM_BELOW })

      const xTo = gsap.quickTo(preview, 'x', { duration: 0.6, ease: 'power3' })
      const yTo = gsap.quickTo(preview, 'y', { duration: 0.6, ease: 'power3' })
      const rTo = gsap.quickTo(preview, 'rotation', { duration: 0.5, ease: 'power3' })

      let active = false
      let ticking = false
      let cur = -1
      let z = 1
      let px = 0
      let py = 0
      let lastX = null

      // Lean follows the preview's own (lagged) horizontal velocity, so it settles on its own
      const tick = (time, dt) => {
        const x = gsap.getProperty(preview, 'x')
        if (lastX !== null && dt > 0) rTo(clampRot(((x - lastX) / (dt / 16.667)) * 0.32))
        lastX = x
      }

      const place = (instant) => {
        const r = list.getBoundingClientRect()
        const half = preview.offsetWidth / 2
        const x = gsap.utils.clamp(half + 8, Math.max(half + 8, r.width - half - 8), px - r.left)
        const y = py - r.top
        if (instant) {
          xTo(x, x)
          yTo(y, y)
        } else {
          xTo(x)
          yTo(y)
        }
      }

      const swap = (i) => {
        if (i === cur || !shots[i]) return
        const next = shots[i]
        const hadPrev = cur >= 0
        const down = !hadPrev || i > cur
        z += 1
        next.style.zIndex = String(z)

        if (!hadPrev || reduced) {
          // First frame (or reduced motion): a clean hard cut, the bezel does the entrance
          gsap.set(next, { clipPath: SHOWN, overwrite: true })
          gsap.set(overlays[i], { yPercent: 0, opacity: 1, overwrite: true })
          if (reduced) gsap.set(imgs[i], { yPercent: 0, scale: 1, overwrite: true })
          else gsap.fromTo(imgs[i], { yPercent: 0, scale: 1.14 }, { scale: 1, duration: 1.3, ease: EASE.out, overwrite: true })
        } else {
          gsap.fromTo(
            next,
            { clipPath: down ? FROM_BELOW : FROM_ABOVE },
            { clipPath: SHOWN, duration: 0.9, ease: EASE.out, overwrite: true },
          )
          gsap.fromTo(
            imgs[i],
            { yPercent: down ? 8 : -8, scale: 1.2 },
            { yPercent: 0, scale: 1, duration: 1.2, ease: EASE.out, overwrite: true },
          )
          gsap.fromTo(
            overlays[i],
            { yPercent: 40, opacity: 0 },
            { yPercent: 0, opacity: 1, duration: 0.8, delay: 0.16, stagger: 0.05, ease: EASE.out, overwrite: true },
          )
          gsap.to(imgs[cur], { yPercent: down ? -8 : 8, duration: 0.9, ease: EASE.out, overwrite: true })
        }
        cur = i
      }

      const show = () => {
        if (active) return
        active = true
        gsap.to(glass, { autoAlpha: 1, scale: 1, duration: reduced ? 0.35 : 0.85, ease: EASE.out, overwrite: 'auto' })
        if (!reduced && !ticking) {
          lastX = null
          gsap.ticker.add(tick)
          ticking = true
        }
      }

      const hide = () => {
        if (!active) return
        active = false
        gsap.to(glass, { autoAlpha: 0, scale: 0.55, duration: reduced ? 0.25 : 0.55, ease: 'power3.out', overwrite: 'auto' })
        if (ticking) {
          gsap.ticker.remove(tick)
          ticking = false
        }
        rTo(0)
      }

      const evaluate = (target) => {
        const el = target instanceof Element && list.contains(target) ? target : null
        const row = el?.closest('.sv-row')
        // Reading an expanded row: get out of the way
        if (!row || el.closest('.sv-row.is-open .sv-row__panel')) {
          hide()
          return
        }
        place(!active)
        swap(Number(row.dataset.i))
        show()
      }

      const onMove = (e) => {
        if (e.pointerType === 'touch') return
        px = e.clientX
        py = e.clientY
        evaluate(e.target)
      }
      const onLeave = () => hide()
      // Content scrolls under a resting cursor: keep the frame pinned to it
      const onScroll = () => {
        if (active) evaluate(document.elementFromPoint(px, py))
      }

      list.addEventListener('pointermove', onMove)
      list.addEventListener('pointerleave', onLeave)
      window.addEventListener('scroll', onScroll, { passive: true })

      return () => {
        list.removeEventListener('pointermove', onMove)
        list.removeEventListener('pointerleave', onLeave)
        window.removeEventListener('scroll', onScroll)
        gsap.ticker.remove(tick)
        gsap.killTweensOf([preview, glass, ...shots, ...imgs, ...overlays.flatMap((o) => Array.from(o))])
      }
    },
    { scope: rootRef, dependencies: [previewOn], revertOnUpdate: true },
  )

  // WAI-ARIA accordion keys: ↑ ↓ Home End move between row headers
  const onKeyNav = (e) => {
    if (!NAV_KEYS.includes(e.key)) return
    const btns = Array.from(e.currentTarget.querySelectorAll('.sv-row__btn'))
    const i = btns.indexOf(document.activeElement)
    if (i < 0) return
    e.preventDefault()
    const n = btns.length
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : (i + (e.key === 'ArrowDown' ? 1 : -1) + n) % n
    btns[next].focus()
  }

  return (
    <section id="services" className="section sv" data-hud="Services" ref={rootRef}>
      <div className="container">
        <SectionHeader
          index="04"
          eyebrow="What I do"
          aside={`${TOTAL} disciplines — one objective`}
          title={
            <>
              Not video editing. <em className="t-serif">Ad creative.</em>
            </>
          }
          lead="From the first hook to the final CTA, I turn scripts and raw assets into scroll-stopping advertisements designed for modern paid-social platforms."
        />

        <div className={`sv-list${previewOn ? ' has-preview' : ''}`} ref={listRef}>
          <span className="sv-list__rule" aria-hidden="true" />
          <ul className="sv-rows" role="list" onKeyDown={onKeyNav}>
            {SERVICES.map((s, i) => {
              const isOpen = open === i
              return (
                <li key={s.id} className={`sv-row${isOpen ? ' is-open' : ''}`} data-i={i}>
                  <h3 className="sv-row__h">
                    <button
                      type="button"
                      className="sv-row__btn"
                      id={`sv-btn-${s.id}`}
                      aria-expanded={isOpen}
                      aria-controls={`sv-panel-${s.id}`}
                      onClick={() => setOpen((o) => (o === i ? -1 : i))}
                    >
                      <span className="sv-row__idx t-mono" aria-hidden="true">
                        {s.index}
                      </span>
                      <span className="sv-row__tmask">
                        <span className="sv-row__tin">{s.title}</span>
                      </span>
                      <span className="sv-row__short t-body">{s.short}</span>
                      <span className="sv-row__icon" aria-hidden="true">
                        <span className="sv-row__plus" />
                      </span>
                    </button>
                  </h3>
                  <div className="sv-row__panel" id={`sv-panel-${s.id}`} role="region" aria-labelledby={`sv-btn-${s.id}`}>
                    <div className="sv-row__inner">
                      <p className="sv-row__body t-lead" data-sv-reveal>
                        {s.body}
                      </p>
                      <ul className="sv-row__tags" role="list" aria-label="Focus areas" data-sv-reveal>
                        {s.tags.map((t) => (
                          <li className="chip sv-row__tag" key={t}>
                            {t}
                          </li>
                        ))}
                      </ul>
                      <Thumb service={s} />
                    </div>
                  </div>
                  <span className="sv-row__rule" aria-hidden="true" />
                  <span className="sv-row__line" aria-hidden="true" />
                </li>
              )
            })}
          </ul>

          {previewOn && (
            <div className="sv-preview" ref={previewRef} aria-hidden="true">
              <Glass className="sv-preview__glass" radius={30} refract bezel={0.09} depth={1.15} interactive={false}>
                <div className="sv-preview__media">
                  {SERVICES.map((s) => (
                    <Shot key={s.id} service={s} />
                  ))}
                </div>
              </Glass>
            </div>
          )}
        </div>
      </div>

      <div className="sv-platforms">
        <div className="container sv-platforms__head">
          <p className="t-mono t-mute">
            Optimised for<span className="sr-only">: {SITE.platforms.join(', ')}</span>
          </p>
          <p className="t-mono t-faint" aria-hidden="true">
            9:16 — 4:5 — 1:1
          </p>
        </div>
        <div className="sv-platforms__mq" aria-hidden="true">
          <Marquee speed={40} repeat={3}>
            {SITE.platforms.map((p) => (
              <span className="sv-plat" key={p}>
                <span className="sv-plat__txt">{p}</span>
                <span className="sv-plat__dot" />
              </span>
            ))}
          </Marquee>
        </div>
      </div>
    </section>
  )
}
