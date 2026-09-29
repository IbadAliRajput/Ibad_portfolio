import { useLayoutEffect, useRef, useState } from 'react'
import VerticalVideo from '../components/VerticalVideo'
import SplitReveal from '../components/SplitReveal'
import ScrollWords from '../components/ScrollWords'
import { Eyebrow } from '../components/Primitives'
import { ArrowIcon } from '../components/Button'
import { TLink } from '../app/PageTransition'
import { useReady } from '../app/context'
import { gsap, useGSAP, EASE } from '../lib/gsap'
import { prefersReducedMotion } from '../lib/env'
import { toShort } from '../lib/timecode'
import { titleScale } from './caseData'
import './CaseHero.css'

/* The frame wipes up from its bottom edge. The clip finishes well outside the
   box so the drop shadow is uncovered by the wipe itself — clearing the
   clip-path afterwards changes nothing on screen. */
const CLIP_FROM = 'inset(100% -40% 0% -40%)'
const CLIP_TO = 'inset(-20% -40% -20% -40%)'

/**
 * 01 — Creative overview.
 * The final ad, immediately: breadcrumb, kicker, title and summary on the
 * left, the 9:16 master on the right (below on narrow screens) with a glow in
 * the project's tone. Beneath it, what was made (scroll-lit paragraph) and the
 * project's figures.
 *  Motion   intro waits for the preloader / route curtain, then choreographs
 *           crumbs → kicker → title chars → frame wipe + poster settle → meta.
 *  Reduced  short opacity fades; the scroll-lit paragraph stays static.
 */
export default function CaseHero({ project }) {
  const root = useRef(null)
  const { ready } = useReady()
  // A first visit mounts under the preloader, client navigation under the route
  // curtain — both lift bottom → top, so hold the intro until the top is clear.
  const [delay] = useState(() => (ready ? 0.55 : 0.4))

  const {
    title,
    kicker,
    client,
    year,
    runtime,
    formatLabel,
    platforms,
    summary,
    overview,
    stats,
    poster,
    video,
    full,
    caption,
    captionHl,
  } = project

  const meta = [
    { k: 'Client', v: client },
    { k: 'Format', v: formatLabel },
    { k: 'Runtime', v: toShort(runtime) },
    { k: 'Platforms', v: platforms.join(' · ') },
  ]

  /* Intro — gated on the preloader */
  useGSAP(
    () => {
      if (!ready) return
      const q = gsap.utils.selector(root)
      const frame = q('.cs-hero__frame')[0]
      const posterImg = frame?.querySelector('.vv__poster')
      const glow = q('.cs-hero__glow')
      const crumbs = q('.cs-crumbs__item')
      const kickerIn = q('.cs-hero__kicker-in')
      const rule = q('.cs-meta__rule')
      const cells = q('.cs-meta__cell, .cs-hero__cue')

      if (prefersReducedMotion()) {
        gsap.from([...crumbs, ...kickerIn, frame, ...glow, ...rule, ...cells].filter(Boolean), {
          autoAlpha: 0,
          duration: 0.8,
          ease: 'power1.out',
          delay,
        })
        return
      }

      const tl = gsap.timeline({ delay, defaults: { ease: EASE.out } })
      tl.from(crumbs, { autoAlpha: 0, y: 12, duration: 1, stagger: 0.07 }, 0)
        .from(kickerIn, { yPercent: 115, duration: 1.1 }, 0.05)
        .from(glow, { autoAlpha: 0, scale: 0.55, duration: 2.8, ease: EASE.soft }, 0)
      if (frame) {
        tl.fromTo(
          frame,
          { clipPath: CLIP_FROM },
          { clipPath: CLIP_TO, duration: 1.6, ease: EASE.inOut, clearProps: 'clipPath' },
          0.05,
        )
      }
      if (posterImg) {
        // GSAP owns the poster's transform for the settle — drop the component's CSS transition meanwhile
        gsap.set(posterImg, { transition: 'none' })
        tl.fromTo(posterImg, { scale: 1.32 }, { scale: 1, duration: 2.2, clearProps: 'transform,transition' }, 0.1)
      }
      tl.from(rule, { scaleX: 0, duration: 1.5, ease: EASE.inOut }, 0.5).from(
        cells,
        { autoAlpha: 0, y: 16, duration: 1.1, stagger: 0.07 },
        0.65,
      )
    },
    { scope: root, dependencies: [ready, delay] },
  )

  /* Overview figures — hairlines draw, values rise out of their masks */
  useGSAP(
    () => {
      const q = gsap.utils.selector(root)
      const ov = q('.cs-ov')[0]
      const wrap = q('.cs-stats')[0]
      const cells = q('.cs-stat')
      if (!ov || !wrap || !cells.length) return
      const reduce = prefersReducedMotion()

      gsap.from(q('.cs-ov__eyebrow'), {
        autoAlpha: 0,
        y: reduce ? 0 : 12,
        duration: reduce ? 0.7 : 1,
        ease: reduce ? 'power1.out' : EASE.out,
        scrollTrigger: { trigger: ov, start: 'top 85%', once: true },
      })

      const st = { trigger: wrap, start: 'top 88%', once: true }
      if (reduce) {
        gsap.from(cells, { autoAlpha: 0, duration: 0.7, stagger: 0.05, ease: 'power1.out', scrollTrigger: st })
        return
      }
      gsap
        .timeline({ scrollTrigger: st, defaults: { ease: EASE.out } })
        .fromTo(cells, { '--cs-rule': 0 }, { '--cs-rule': 1, duration: 1.4, stagger: 0.09, ease: EASE.inOut }, 0)
        .from(q('.cs-stat__k'), { autoAlpha: 0, y: 10, duration: 0.9, stagger: 0.09 }, 0.2)
        .from(q('.cs-stat__in'), { yPercent: 110, duration: 1.3, stagger: 0.09 }, 0.25)
    },
    { scope: root },
  )

  /* Figures stay on one line — a word-length value ("1st person") shrinks to
     its column. Its width in ems is measured once (again when the webfont
     lands) and the CSS turns that into a size for any column width. */
  useLayoutEffect(() => {
    const els = root.current.querySelectorAll('.cs-stat__in')
    const measure = () =>
      els.forEach((el) => {
        const em = el.getBoundingClientRect().width / parseFloat(getComputedStyle(el).fontSize)
        el.style.setProperty('--fit', em.toFixed(3))
      })
    measure()
    let live = true
    document.fonts?.ready.then(() => live && measure())
    return () => {
      live = false
    }
  }, [stats])

  return (
    <section ref={root} className="cs-hero" data-hud="Overview">
      <span className="cs-glow cs-hero__wash" aria-hidden="true" />

      <div className="container cs-hero__grid">
        <nav className="cs-crumbs" aria-label="Breadcrumb">
          <ol className="cs-crumbs__list t-mono">
            <li className="cs-crumbs__item">
              <TLink to="/work" label="All work" kicker="Index" className="cs-crumbs__link">
                <span className="cs-crumbs__back" aria-hidden="true">
                  <ArrowIcon dir="left" />
                </span>
                Work
              </TLink>
            </li>
            <li className="cs-crumbs__item">{formatLabel}</li>
            <li className="cs-crumbs__item" aria-current="page">
              <span className="tabular">{year}</span>
            </li>
          </ol>
        </nav>

        <div className="cs-hero__head">
          <p className="cs-hero__kicker t-mono t-accent">
            <span className="cs-mask">
              <span className="cs-hero__kicker-in">{kicker}</span>
            </span>
          </p>
          <SplitReveal
            as="h1"
            id="cs-title"
            type="chars"
            trigger="ready"
            delay={delay + 0.08}
            className={`cs-hero__title ${titleScale(title)}`}
          >
            {title}
          </SplitReveal>
        </div>

        <SplitReveal as="p" type="lines" trigger="ready" delay={delay + 0.42} className="cs-hero__summary t-lead">
          {summary}
        </SplitReveal>

        <div className="cs-hero__media">
          <span className="cs-glow cs-hero__glow" aria-hidden="true" />
          <div className="cs-hero__frame">
            <VerticalVideo
              src={video}
              poster={poster}
              priority
              cropmarks
              mode="auto"
              label={formatLabel}
              meta={toShort(runtime)}
              caption={caption}
              captionHl={captionHl}
              expand={{ src: full, title, kicker, meta: summary }}
              className="cs-hero__vv"
            />
          </div>
          <p className="cs-hero__cue t-mono" aria-hidden="true">
            <span className="cs-hero__cue-play">
              <svg className="cs-hero__cue-icon" viewBox="0 0 10 10" width="9" height="9">
                <path d="M2.2 1.3v7.4L8.6 5z" fill="currentColor" />
              </svg>
              Play the final cut
            </span>
            <span>Sound on</span>
          </p>
        </div>

        <div className="cs-meta">
          <span className="cs-meta__rule" aria-hidden="true" />
          <dl className="cs-meta__list">
            {meta.map((m) => (
              <div className="cs-meta__cell" key={m.k}>
                <dt className="cs-meta__k t-mono">{m.k}</dt>
                <dd className="cs-meta__v">{m.v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className="container cs-ov">
        <div className="cs-ov__grid">
          <Eyebrow index="01" className="cs-ov__eyebrow">
            Creative overview
          </Eyebrow>
          <ScrollWords as="p" className="cs-ov__text t-h3">
            {overview}
          </ScrollWords>
        </div>
        <dl className="cs-stats">
          {stats.map((s) => (
            <div className="cs-stat" key={s.k}>
              <dt className="cs-stat__k t-mono">{s.k}</dt>
              <dd className="cs-stat__v t-h1 tabular">
                <span className="cs-stat__in">{s.v}</span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
