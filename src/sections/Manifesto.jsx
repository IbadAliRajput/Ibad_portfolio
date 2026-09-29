import { Fragment, useRef } from 'react'
import ScrollWords from '../components/ScrollWords'
import SplitReveal from '../components/SplitReveal'
import { Eyebrow } from '../components/Primitives'
import { gsap, useGSAP } from '../lib/gsap'
import { prefersReducedMotion } from '../lib/env'
import { toShort } from '../lib/timecode'
import { POSTERS } from '../data/site'
import { AD_STRUCTURE, FUNNEL } from '../data/strategy'
import './Manifesto.css'

/* The home page is cut like an ad: this section is its "problem" beat */
const BEAT = AD_STRUCTURE.find((b) => b.id === 'problem')

/* Each funnel stage owns a slice of the 60-second ad skeleton */
const STAGES = FUNNEL.map((name) => {
  const beats = AD_STRUCTURE.filter((b) => b.stage === name)
  if (!beats.length) return { name, range: '' }
  const from = Math.min(...beats.map((b) => b.range[0]))
  const to = Math.max(...beats.map((b) => b.range[1]))
  return { name, range: `${toShort(from)}–${toShort(to)}` }
})

/*
 * Kinetic principles. `pill` is the word index the 9:16 media pill sits before;
 * `drift` is the scrubbed xPercent travel (from → to) around the centred line,
 * alternating direction line to line.
 */
const LINES = [
  { id: 'attention', words: ['Built', 'for'], pill: 1, serif: 'attention.', poster: POSTERS[0], drift: [14, -12] },
  { id: 'retention', words: ['Edited', 'for'], pill: 2, serif: 'retention.', accent: true, poster: POSTERS[1], drift: [-15, 10] },
  { id: 'convert', words: ['Created', 'to'], pill: 1, serif: 'convert.', poster: POSTERS[2], drift: [12, -14] },
]

function Pill({ src }) {
  return (
    <span className="mf-pill" aria-hidden="true">
      <img className="mf-pill__img" src={src} alt="" loading="lazy" decoding="async" draggable="false" />
    </span>
  )
}

function KineticLine({ line }) {
  const parts = []
  line.words.forEach((w, i) => {
    if (i === line.pill) parts.push(<Pill key="pill" src={line.poster} />)
    parts.push(
      <span key={w} className="mf-line__word">
        {w}
      </span>,
    )
  })
  if (line.pill >= line.words.length) parts.push(<Pill key="pill" src={line.poster} />)
  parts.push(
    <em key="serif" className={`t-serif mf-line__serif${line.accent ? ' t-accent' : ''}`}>
      {line.serif}
    </em>,
  )
  return (
    <div className="mf-row">
      <p className="mf-line">
        {parts.map((p, i) => (
          <Fragment key={i}>
            {i > 0 && ' '}
            {p}
          </Fragment>
        ))}
      </p>
    </div>
  )
}

/**
 * 02 — Manifesto. The breath between the reel and the work: one problem
 * statement that brightens as it's read, the attention → action funnel lighting
 * stage by stage, then three oversized principles drifting against each other.
 */
export default function Manifesto() {
  const root = useRef(null)

  useGSAP(
    () => {
      const q = gsap.utils.selector(root)

      /* Funnel — each stage lights in sequence as you read down. Scrubbed and
         visitor-driven, so it stays in reduced-motion mode (it's progress). */
      const list = q('.mf-stages')[0]
      if (list) {
        const tl = gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: { trigger: list, start: 'top 88%', end: 'bottom 52%', scrub: 0.6 },
        })
        q('.mf-stage').forEach((el, i) => {
          tl.fromTo(el.querySelector('.mf-stage__text'), { opacity: 0.26 }, { opacity: 1, duration: 0.6 }, i)
          tl.fromTo(el.querySelector('.mf-stage__dot-fill'), { scale: 0 }, { scale: 1, duration: 0.5, ease: 'power2.out' }, i)
          const fill = el.querySelector('.mf-stage__fill')
          if (fill) tl.fromTo(fill, { scaleX: 0 }, { scaleX: 1, duration: 0.7 }, i + 0.3)
        })
      }

      // Decorative drift — static and centred in reduced-motion mode
      if (prefersReducedMotion()) return

      q('.mf-row').forEach((row, i) => {
        const cfg = LINES[i]
        if (!cfg) return
        const [from, to] = cfg.drift
        const range = { trigger: row, start: 'top bottom', end: 'bottom top' }
        gsap.fromTo(
          row.querySelector('.mf-line'),
          { xPercent: from },
          { xPercent: to, ease: 'none', scrollTrigger: { ...range, scrub: 0.8 } },
        )
        // The frame inside the type drifts the other way — a window, not a sticker
        const img = row.querySelector('.mf-pill__img')
        if (img) {
          gsap.fromTo(
            img,
            { yPercent: -7, scale: 1.2 },
            { yPercent: 7, scale: 1.2, ease: 'none', scrollTrigger: { ...range, scrub: true } },
          )
        }
      })
    },
    { scope: root },
  )

  return (
    <section ref={root} id="manifesto" className="section mf" data-hud="Manifesto" aria-labelledby="mf-title">
      <h2 id="mf-title" className="sr-only">
        Manifesto: the problem
      </h2>

      {/* Part 1 — the problem -------------------------------------------- */}
      <div className="container">
        <div className="mf-top">
          <Eyebrow index="02">The problem</Eyebrow>
          {BEAT && (
            <p className="mf-top__aside t-mono t-mute">
              {BEAT.label} <span className="mf-top__sep" aria-hidden="true">·</span>{' '}
              <span className="tabular">
                {toShort(BEAT.range[0])}–{toShort(BEAT.range[1])}
              </span>
            </p>
          )}
        </div>

        <ScrollWords as="p" className="mf-statement">
          A script alone doesn&rsquo;t make an ad. The visual execution decides whether people{' '}
          <em className="t-serif t-accent mf-statement__em">keep watching.</em>
        </ScrollWords>

        <div className="mf-funnel">
          <p className="mf-funnel__cap t-mono">Every editing decision serves one of these stages.</p>
          <ol className="mf-stages" aria-label="The performance funnel, from attention to action">
            {STAGES.map((s, i) => (
              <li key={s.name} className="mf-stage">
                <span className="mf-stage__dot" aria-hidden="true">
                  <span className="mf-stage__dot-fill" />
                </span>
                <span className="mf-stage__text">
                  <span className="mf-stage__label t-mono">{s.name}</span>
                  {s.range && <span className="mf-stage__range t-mono tabular">{s.range}</span>}
                </span>
                {i < STAGES.length - 1 && (
                  <span className="mf-stage__link" aria-hidden="true">
                    <span className="mf-stage__fill" />
                  </span>
                )}
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* Part 2 — three principles, full bleed ---------------------------- */}
      <div className="mf-lines">
        {LINES.map((line) => (
          <KineticLine key={line.id} line={line} />
        ))}
      </div>

      <div className="container">
        <div className="mf-coda">
          <p className="mf-coda__label t-mono t-mute">
            Edit principles <span className="mf-coda__count">(03)</span>
          </p>
          <SplitReveal as="p" className="mf-coda__text t-lead">
            No effects for the sake of effects. Every cut, caption and sound either moves the story forward or holds
            attention.
          </SplitReveal>
        </div>
      </div>
    </section>
  )
}
