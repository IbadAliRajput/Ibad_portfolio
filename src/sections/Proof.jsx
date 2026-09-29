import { useRef } from 'react'
import { gsap, useGSAP, EASE } from '../lib/gsap'
import { prefersReducedMotion } from '../lib/env'
import { STATS, RETENTION_TECHNIQUES } from '../data/strategy'
import SplitReveal from '../components/SplitReveal'
import { Eyebrow, Counter, Marquee } from '../components/Primitives'
import './Proof.css'

const HALF = Math.ceil(RETENTION_TECHNIQUES.length / 2)
const TOOLKIT_ROWS = [
  { id: 'a', items: RETENTION_TECHNIQUES.slice(0, HALF), speed: 45, reverse: false },
  { id: 'b', items: RETENTION_TECHNIQUES.slice(HALF), speed: 55, reverse: true },
]

const pad2 = (n) => String(n).padStart(2, '0')
const statText = (s) => `${s.prefix ?? ''}${s.value}${s.suffix ?? ''}`

/** One marquee lane of retention techniques (visual only — the full list is read from .sr-only) */
function ToolkitLane({ items }) {
  return (
    <span className="pf-tk__list">
      {items.map((t) => (
        <span className="pf-tk__item" key={t}>
          <span className="pf-tk__word">{t}</span>
          <span className="pf-tk__dot" />
        </span>
      ))}
    </span>
  )
}

/**
 * 10 — Proof.
 * The claim, the process figures behind it, and the retention toolkit on
 * two counter-running lanes.
 */
export default function Proof() {
  const root = useRef(null)

  useGSAP(
    () => {
      const el = root.current
      const $ = (s) => el.querySelector(s)
      const $$ = (s) => Array.from(el.querySelectorAll(s))
      const once = (trigger, start = 'top 85%') => ({ trigger, start, once: true })

      const intro = $('.pf-intro')
      const stats = $('.pf-stats')
      const statBodies = $$('.pf-stat__body')
      const toolkit = $('.pf-tk')

      /* Reduced motion — short opacity fades only; the marquee lanes stay still */
      if (prefersReducedMotion()) {
        const fade = (targets, trigger) =>
          gsap.fromTo(
            targets,
            { opacity: 0 },
            {
              opacity: 1,
              duration: 0.7,
              ease: 'power1.out',
              stagger: 0.05,
              clearProps: 'opacity',
              scrollTrigger: once(trigger, 'top 88%'),
            },
          )
        fade($('.pf-intro__eyebrow'), intro)
        fade([...$$('.pf-stats__head > *'), ...statBodies], stats)
        fade($$('.pf-tk__head > *, .pf-tk__row'), toolkit)
        return
      }

      /* The eyebrow leads the headline's line reveal by a beat */
      gsap.from('.pf-intro__eyebrow', { autoAlpha: 0, y: 12, duration: 1, scrollTrigger: once(intro, 'top 90%') })

      /* Stats — the rule draws across, dividers drop, figures rise and count */
      gsap
        .timeline({ scrollTrigger: once(stats, 'top 86%') })
        .from('.pf-stats__head > *', { autoAlpha: 0, y: 12, duration: 0.9, stagger: 0.06 }, 0)
        .from('.pf-stats__rule', { scaleX: 0, duration: 1.5, ease: EASE.inOut }, 0)
        .from('.pf-stat__vr', { scaleY: 0, duration: 1.2, ease: EASE.inOut, stagger: 0.1 }, 0.3)
        .from('.pf-stat__hr', { scaleX: 0, duration: 1.2, ease: EASE.inOut, stagger: 0.1 }, 0.4)
        .from(statBodies, { autoAlpha: 0, y: 40, duration: 1.2, ease: EASE.out, stagger: 0.1 }, 0.2)

      /* Toolkit — heading settles, the two lanes glide in from opposite sides */
      gsap
        .timeline({ scrollTrigger: once(toolkit, 'top 85%') })
        .from('.pf-tk__head > *', { autoAlpha: 0, y: 14, duration: 1, stagger: 0.08 }, 0)
        .from(
          '.pf-tk__row',
          { autoAlpha: 0, xPercent: (i) => (i ? -8 : 8), duration: 1.8, ease: EASE.out, stagger: 0.12 },
          0.1,
        )
    },
    { scope: root },
  )

  return (
    <section ref={root} id="proof" className="section pf" data-hud="Proof">
      <div className="container">
        {/* 1 · The claim */}
        <header className="pf-intro">
          <div className="pf-intro__head">
            <Eyebrow index="10" className="pf-intro__eyebrow">
              Proof
            </Eyebrow>
            <SplitReveal as="h2" className="pf-intro__title t-h1">
              Raw footage in.
              <br />
              <em className="t-serif">Performance</em>{' '}
              <span className="nowrap">
                <em className="t-serif">creative</em> out.
              </span>
            </SplitReveal>
          </div>
          <SplitReveal as="p" className="pf-intro__lead t-lead" delay={0.12}>
            The point isn&rsquo;t to make footage look good. It&rsquo;s to make the viewer keep watching.
          </SplitReveal>
        </header>

        {/* 2 · Process figures */}
        <div className="pf-stats">
          <div className="pf-stats__head">
            <h3 className="pf-stats__title t-mono">The system, in numbers</h3>
            <p className="pf-stats__aside t-mono">Process, not promises</p>
          </div>
          <span className="pf-stats__rule" aria-hidden="true" />
          <ul className="pf-stats__grid">
            {STATS.map((s, i) => (
              <li className="pf-stat" key={s.label}>
                <span className="pf-stat__vr" aria-hidden="true" />
                <span className="pf-stat__hr" aria-hidden="true" />
                <div className="pf-stat__body">
                  <p className="pf-stat__num t-display">
                    <span aria-hidden="true">
                      <Counter value={s.value} prefix={s.prefix} suffix={s.suffix} />
                    </span>
                    <span className="sr-only">{statText(s)}</span>
                  </p>
                  <p className="pf-stat__label t-mono">
                    <span className="pf-stat__idx" aria-hidden="true">
                      {pad2(i + 1)}
                    </span>
                    {s.label}
                  </p>
                  <p className="pf-stat__note t-small">{s.note}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* 3 · Retention toolkit — full-bleed lanes */}
      <div className="pf-tk">
        <div className="container pf-tk__head">
          <h3 className="pf-tk__title t-mono">
            <span className="pf-tk__count">{pad2(RETENTION_TECHNIQUES.length)}</span>
            The retention toolkit
          </h3>
          <p className="pf-tk__aside t-small">
            No effect for the sake of an effect. Every cut supports the story or holds attention.
          </p>
        </div>
        <ul className="sr-only">
          {RETENTION_TECHNIQUES.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <div className="pf-tk__rows" aria-hidden="true">
          {TOOLKIT_ROWS.map((row) => (
            <Marquee
              key={row.id}
              speed={row.speed}
              reverse={row.reverse}
              repeat={1}
              className={`pf-tk__row pf-tk__row--${row.id}`}
            >
              <ToolkitLane items={row.items} />
            </Marquee>
          ))}
        </div>
      </div>
    </section>
  )
}
