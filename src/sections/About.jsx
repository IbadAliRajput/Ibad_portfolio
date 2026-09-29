import { Fragment, useRef } from 'react'
import { gsap, useGSAP, EASE } from '../lib/gsap'
import { hasFinePointer, prefersReducedMotion } from '../lib/env'
import { MEDIA, SITE } from '../data/site'
import { PILLARS, ROLES } from '../data/strategy'
import Glass from '../components/LiquidGlass'
import SplitReveal from '../components/SplitReveal'
import ScrollWords from '../components/ScrollWords'
import { Eyebrow } from '../components/Primitives'
import './About.css'

const pad2 = (n) => String(n).padStart(2, '0')

/** Pillar grid column count per breakpoint — drives the row-wise stagger */
const PILLAR_COLS = {
  one: '(max-width: 639px)',
  two: '(min-width: 640px) and (max-width: 1023px)',
  three: '(min-width: 1024px)',
}

/**
 * 11 — About.
 * Positioned around the work, not a biography: portrait + positioning copy,
 * the four-role equation on liquid glass, and the six pillars.
 */
export default function About() {
  const root = useRef(null)

  useGSAP(
    () => {
      const el = root.current
      const $ = (s) => el.querySelector(s)
      const $$ = (s) => Array.from(el.querySelectorAll(s))
      const once = (trigger, start = 'top 84%') => ({ trigger, start, once: true })

      const main = $('.ab-main')
      const media = $('.ab-media')
      const portrait = $('.ab-portrait')
      const img = $('.ab-portrait__img')
      const roles = $('.ab-roles')
      const pills = $$('.ab-pill')
      const pluses = $$('.ab-eq__plus')
      const sum = $('.ab-eq__sum')
      const pillars = $('.ab-pillars')
      const cells = $$('.ab-pillar')

      /* Reduced motion — no parallax, no curtains, no pointer light: short fades only */
      if (prefersReducedMotion()) {
        const fade = (targets, trigger) =>
          gsap.fromTo(
            targets,
            { autoAlpha: 0 },
            {
              autoAlpha: 1,
              duration: 0.7,
              ease: 'power1.out',
              stagger: 0.05,
              clearProps: 'opacity,visibility',
              scrollTrigger: once(trigger, 'top 88%'),
            },
          )
        fade($('.ab-eyebrow'), main)
        fade([portrait, ...$$('.ab-caption > *')], media)
        fade([...$$('.ab-eq > *'), sum], roles)
        fade([...$$('.ab-pillars__head > *'), ...cells], pillars)
        return
      }

      gsap.from('.ab-eyebrow', { autoAlpha: 0, y: 12, duration: 1, scrollTrigger: once(main, 'top 82%') })

      /* Portrait — a curtain rises from the bottom while the image settles */
      gsap
        .timeline({ scrollTrigger: once(media, 'top 82%') })
        .fromTo(
          portrait,
          { clipPath: 'inset(100% 0% 0% 0% round 24px)' },
          { clipPath: 'inset(0% 0% 0% 0% round 24px)', duration: 1.4, ease: EASE.inOut, clearProps: 'clipPath' },
          0,
        )
        .fromTo(img, { scale: 1.24 }, { scale: 1, duration: 2, ease: EASE.out }, 0.05)
        .from('.ab-portrait__crop, .ab-portrait__tag', { autoAlpha: 0, duration: 0.9, stagger: 0.1, ease: EASE.out }, 1)
        .from('.ab-caption > *', { autoAlpha: 0, y: 10, duration: 1, stagger: 0.08, ease: EASE.out }, 0.85)

      /* …and drifts through the frame as the section scrolls */
      gsap.fromTo(
        img,
        { yPercent: -8 },
        { yPercent: 8, ease: 'none', scrollTrigger: { trigger: media, start: 'top bottom', end: 'bottom top', scrub: true } },
      )

      /* Roles equation — each term lands, its "+" turns into place behind it */
      const eq = gsap.timeline({ scrollTrigger: once(roles, 'top 80%') })
      pills.forEach((pill, i) => {
        const at = i * 0.13
        // Animate the Glass element itself so its backdrop keeps sampling the scene
        eq.from(pill, { autoAlpha: 0, y: 34, duration: 1.1, ease: EASE.out, clearProps: 'opacity,visibility' }, at)
        if (pluses[i]) {
          eq.from(pluses[i], { autoAlpha: 0, rotate: -90, scale: 0.5, duration: 1, ease: EASE.out }, at + 0.09)
        }
      })
      eq.from(sum, { autoAlpha: 0, y: 14, duration: 1, ease: EASE.out }, pills.length * 0.13 + 0.12)

      /* Pillars — per cell, staggered along each row of the current grid */
      const mm = gsap.matchMedia()
      mm.add(PILLAR_COLS, (ctx) => {
        const { three, two } = ctx.conditions
        const cols = three ? 3 : two ? 2 : 1
        gsap.from('.ab-pillars__head > *', {
          autoAlpha: 0,
          y: 12,
          duration: 0.9,
          stagger: 0.06,
          scrollTrigger: once(pillars, 'top 88%'),
        })
        cells.forEach((cell, i) => {
          const d = (i % cols) * 0.1
          gsap
            .timeline({ scrollTrigger: once(cell, 'top 90%') })
            .from(cell.querySelector('.ab-pillar__line'), { scaleX: 0, duration: 1.3, ease: EASE.inOut }, d)
            .from(cell.querySelector('.ab-pillar__body'), { autoAlpha: 0, y: 26, duration: 1.1, ease: EASE.out }, d + 0.15)
        })
      })

      /* A warm light follows the pointer behind the glass so the bezels have something to bend */
      let detach = null
      if (hasFinePointer()) {
        const glow = $('.ab-roles__glow')
        const xTo = gsap.quickTo(glow, 'x', { duration: 1.4, ease: EASE.soft })
        const yTo = gsap.quickTo(glow, 'y', { duration: 1.4, ease: EASE.soft })
        const onMove = (e) => {
          const b = roles.getBoundingClientRect()
          xTo((e.clientX - b.left - b.width / 2) * 0.85)
          yTo((e.clientY - b.top - b.height / 2) * 0.85)
        }
        const onLeave = () => {
          xTo(0)
          yTo(0)
        }
        roles.addEventListener('pointermove', onMove)
        roles.addEventListener('pointerleave', onLeave)
        detach = () => {
          roles.removeEventListener('pointermove', onMove)
          roles.removeEventListener('pointerleave', onLeave)
        }
      }

      return () => {
        detach?.()
        mm.revert()
      }
    },
    { scope: root },
  )

  return (
    <section ref={root} id="about" className="section ab" data-hud="About" aria-labelledby="ab-title">
      <h2 id="ab-title" className="sr-only">
        About Ibad
      </h2>
      <div className="container">
        <div className="ab-main">
          <Eyebrow index="11" className="ab-eyebrow">
            About
          </Eyebrow>

          <figure className="ab-media">
            <div className="ab-portrait">
              <img
                className="ab-portrait__img"
                src={MEDIA.about}
                alt="Portrait of Ibad"
                loading="lazy"
                decoding="async"
                draggable="false"
              />
              <span className="ab-portrait__crop cropmarks" aria-hidden="true" />
              <span className="ab-portrait__tag t-mono" aria-hidden="true">
                <span className="rec-dot" />
                A-Cam · 4:5
              </span>
            </div>
            <figcaption className="ab-caption t-mono">
              <span>Ibad — Performance creative</span>
              <span className="ab-caption__loc">{SITE.location}</span>
            </figcaption>
          </figure>

          <ScrollWords as="p" className="ab-intro t-h3">
            I specialise in turning scripts, raw footage and creative concepts into short-form performance
            advertisements. My workflow combines traditional editing, direct-response storytelling, UGC,
            AI-generated visuals, voiceover, motion graphics and sound design to create ads built around attention
            and retention.
          </ScrollWords>

          <SplitReveal as="p" className="ab-goal t-h2">
            The goal isn&rsquo;t just a polished video. The goal is a creative that gives the viewer{' '}
            <em className="t-serif t-accent">a reason to keep watching.</em>
          </SplitReveal>
        </div>

        {/* Video Editor + Creative Strategist + AI Visual Producer + Performance Ad Specialist */}
        <div className="ab-roles">
          <span className="ab-roles__glow" aria-hidden="true" />
          <div className="ab-eq" role="list" aria-label="Roles">
            {ROLES.map((role, i) => (
              <Fragment key={role}>
                {i > 0 && <span className="ab-eq__plus" aria-hidden="true" />}
                <Glass className="ab-pill" tone="dark" radius={999} role="listitem">
                  <span className="ab-pill__txt t-h4">{role}</span>
                </Glass>
              </Fragment>
            ))}
          </div>
          <p className="ab-eq__sum">
            <span className="ab-eq__equals" aria-hidden="true" />
            <span>
              One person. <em className="t-serif ab-eq__whole">The whole creative.</em>
            </span>
          </p>
        </div>

        <div className="ab-pillars">
          <div className="ab-pillars__head">
            <h3 className="ab-pillars__title t-mono">Six pillars</h3>
            <p className="ab-pillars__aside t-mono" aria-hidden="true">
              Strategy → Performance
            </p>
          </div>
          <ul className="ab-pillars__grid">
            {PILLARS.map((p, i) => (
              <li className="ab-pillar" key={p.name}>
                <span className="ab-pillar__line" aria-hidden="true" />
                <span className="ab-pillar__hl" aria-hidden="true" />
                <div className="ab-pillar__body">
                  <span className="ab-pillar__idx t-mono" aria-hidden="true">
                    {pad2(i + 1)}
                  </span>
                  <h4 className="ab-pillar__name t-h4">{p.name}</h4>
                  <p className="ab-pillar__desc t-small">{p.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
