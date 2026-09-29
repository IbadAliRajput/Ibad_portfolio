import { useRef } from 'react'
import { ArrowIcon } from '../components/Button'
import { TLink } from '../app/PageTransition'
import { gsap, useGSAP, EASE } from '../lib/gsap'
import { hasFinePointer, prefersReducedMotion } from '../lib/env'
import { PROJECTS, nextProject } from '../data/projects'
import { pad2 } from './caseData'
import './CaseNext.css'

/**
 * Next project — one full-width link. Giant title that slides on hover, an
 * accent underline wipe, the next project's tone glowing in, and its 9:16
 * poster scaling in under the cursor, following it horizontally.
 *  Touch    the poster sits still beside the title.
 *  Reduced  no cursor follow (the poster simply fades in on hover); fades only.
 */
export default function CaseNext({ project }) {
  const root = useRef(null)
  const next = nextProject(project.slug)
  const n = PROJECTS.findIndex((p) => p.slug === next.slug) + 1
  const showFormat = next.formatLabel && next.formatLabel.toLowerCase() !== next.kicker.toLowerCase()

  useGSAP(
    () => {
      const el = root.current
      const link = el.querySelector('.cs-next__link')
      const thumb = el.querySelector('.cs-next__thumb')
      if (!link || !thumb) return
      const reduce = prefersReducedMotion()
      const st = { trigger: link, start: 'top 85%', once: true }

      if (reduce) {
        gsap.from(el.querySelectorAll('.cs-next__top, .cs-next__title, .cs-next__bottom'), {
          autoAlpha: 0,
          duration: 0.7,
          stagger: 0.05,
          ease: 'power1.out',
          scrollTrigger: st,
        })
        return
      }

      gsap
        .timeline({ scrollTrigger: st, defaults: { ease: EASE.out } })
        .from(el.querySelector('.cs-next__rule'), { scaleX: 0, transformOrigin: '0% 50%', duration: 1.5, ease: EASE.inOut }, 0)
        .from(el.querySelector('.cs-next__rise'), { yPercent: 105, duration: 1.4 }, 0.05)
        .from(el.querySelectorAll('.cs-next__top, .cs-next__bottom'), { autoAlpha: 0, y: 14, duration: 1, stagger: 0.08 }, 0.25)

      if (!hasFinePointer()) return

      // The poster rides the cursor horizontally while the block is hovered
      el.classList.add('cs-next--follow')
      gsap.set(thumb, { opacity: 0, scale: 0.4 })
      const xTo = gsap.quickTo(thumb, 'x', { duration: 0.75, ease: 'power3' })
      const show = () => gsap.to(thumb, { opacity: 1, scale: 1, duration: 0.9, ease: EASE.out, overwrite: 'auto' })
      const hide = () => gsap.to(thumb, { opacity: 0, scale: 0.4, duration: 0.6, ease: EASE.out, overwrite: 'auto' })
      const place = (clientX, instant) => {
        const b = link.getBoundingClientRect()
        const half = thumb.offsetWidth / 2
        const x = gsap.utils.clamp(half + 16, Math.max(half + 16, b.width - half - 16), clientX - b.left)
        if (instant) xTo(x, x)
        else xTo(x)
      }
      const onEnter = (e) => {
        if (e.pointerType === 'touch') return
        place(e.clientX, true)
        show()
      }
      const onMove = (e) => {
        if (e.pointerType !== 'touch') place(e.clientX, false)
      }
      // Keyboard parity: a focused link shows the poster beside the title
      const onFocus = () => {
        if (!link.matches(':focus-visible')) return
        const b = link.getBoundingClientRect()
        place(b.left + b.width * 0.78, true)
        show()
      }

      link.addEventListener('pointerenter', onEnter)
      link.addEventListener('pointermove', onMove)
      link.addEventListener('pointerleave', hide)
      link.addEventListener('focus', onFocus)
      link.addEventListener('blur', hide)
      return () => {
        link.removeEventListener('pointerenter', onEnter)
        link.removeEventListener('pointermove', onMove)
        link.removeEventListener('pointerleave', hide)
        link.removeEventListener('focus', onFocus)
        link.removeEventListener('blur', hide)
        el.classList.remove('cs-next--follow')
        gsap.killTweensOf(thumb)
      }
    },
    { scope: root },
  )

  return (
    <section ref={root} className="cs-next" data-hud="Next project" aria-labelledby="cs-next-h">
      <h2 id="cs-next-h" className="sr-only">
        Next project
      </h2>
      <TLink
        to={`/work/${next.slug}`}
        label={next.title}
        kicker="Case study"
        className="cs-next__link"
        data-cursor="next"
        aria-label={`Next project: ${next.title} — ${next.kicker}`}
      >
        <span className="cs-glow cs-next__glow" style={{ '--cs-glow-c': next.tone }} aria-hidden="true" />
        <div className="container cs-next__inner">
          <div className="cs-next__top t-mono">
            <span className="cs-next__label">
              <span className="cs-next__dot" aria-hidden="true" />
              Next project
            </span>
            <span className="tabular">
              {pad2(n)} / {pad2(PROJECTS.length)}
            </span>
          </div>
          <div className="cs-next__title t-display">
            <span className="cs-next__slide">
              <span className="cs-next__rise">{next.title}</span>
            </span>
          </div>
          <div className="cs-next__bottom">
            <span className="cs-next__kicker t-mono">
              {next.kicker}
              {showFormat && (
                <>
                  {' '}
                  <span aria-hidden="true">·</span> {next.formatLabel}
                </>
              )}
            </span>
            <span className="cs-next__arrow" aria-hidden="true">
              <ArrowIcon />
            </span>
          </div>
          <span className="cs-next__rule" aria-hidden="true" />
        </div>
        <span className="cs-next__thumb" aria-hidden="true">
          <img className="cs-next__img" src={next.poster} alt="" loading="lazy" decoding="async" draggable="false" />
        </span>
      </TLink>
    </section>
  )
}
