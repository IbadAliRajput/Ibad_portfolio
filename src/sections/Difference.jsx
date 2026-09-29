import { Fragment, useRef } from 'react'
import { gsap, ScrollTrigger, useGSAP, EASE } from '../lib/gsap'
import { prefersReducedMotion } from '../lib/env'
import { useReducedMotion } from '../lib/hooks'
import { toTimecode, toShort } from '../lib/timecode'
import { Eyebrow } from '../components/Primitives'
import SplitReveal from '../components/SplitReveal'
import { TRADITIONAL, PERFORMANCE, PHILOSOPHY } from '../data/strategy'
import './Difference.css'

const pad2 = (n) => String(n).padStart(2, '0')

/* Pinned choreography, as fractions of the scroll distance */
const TRAD_END = 0.18 // the grey playhead zips through the short edit and stops…
const PERF_START = 0.22 // …then the accent playhead scrubs the real one
const PERF_END = 0.9
const STAMP_AT = 0.9 // the last 10% holds the verdict
const AD_SECONDS = 60

/* Philosophy ticker */
const HOLD = 1.8
const ROLL = 0.8
/* Travel beyond the mask, including the italic's ascender/descender overhang */
const SLOT_Y = 132

const LANES = [
  { id: 'trad', track: 'V1', name: 'Traditional video editor', sub: 'Footage in → export out', steps: TRADITIONAL },
  { id: 'perf', track: 'V2', name: 'Performance creative editor', sub: 'Brief in → testable ads out', steps: PERFORMANCE },
]
const RULER = [0, 15, 30, 45, 60]

const PHIL_SENTENCE = `${PHILOSOPHY.slice(0, -1).join(', ')} or ${PHILOSOPHY.at(-1)}`.toLowerCase()

/** Steps the playhead has reached at lane progress r (step i sits at i / (n - 1)) */
const litCount = (r, n) => (r <= 0 ? 0 : Math.min(n, Math.floor(r * (n - 1) + 1e-6) + 1))

function Lane({ lane }) {
  const n = lane.steps.length
  const perf = lane.id === 'perf'
  const labelId = `df-lane-${lane.id}`

  return (
    <div className={`df-lane df-lane--${lane.id}`} role="group" aria-labelledby={labelId}>
      <div className="df-lane__head">
        <div className="df-lane__meta">
          <span className="df-lane__track t-mono" aria-hidden="true">
            {lane.track}
          </span>
          <div className="df-lane__names">
            <p className="df-lane__name t-mono" id={labelId}>
              {lane.name}
            </p>
            <p className="df-lane__sub t-mono">{lane.sub}</p>
          </div>
        </div>

        {perf && (
          <p className="df-stamp">
            <span className="chip chip--accent df-stamp__chip">The second one is the service.</span>
          </p>
        )}

        <p className="df-count">
          <span className="df-count__n" data-count aria-hidden="true">
            {pad2(n)}
          </span>
          <span className="df-count__u t-mono" aria-hidden="true">
            steps
          </span>
          <span className="sr-only">{n} steps</span>
        </p>
      </div>

      <div className="df-track">
        <span className="df-track__line" aria-hidden="true" />
        <span className="df-track__fill" aria-hidden="true" />
        <span className="df-range" aria-hidden="true">
          {perf && (
            <span className="df-ruler">
              {RULER.map((s) => (
                <span key={s} className="df-ruler__l t-mono" style={{ '--p': s / AD_SECONDS }}>
                  {toShort(s)}
                </span>
              ))}
            </span>
          )}
        </span>

        <ol className="df-nodes">
          {lane.steps.map((step, i) => (
            <li key={step} className={`df-node ${i % 2 ? 'is-below' : 'is-above'}`} style={{ '--t': i / (n - 1) }}>
              <span className="df-node__dot" aria-hidden="true">
                <span className="df-node__on" />
              </span>
              <span className="df-node__stem" aria-hidden="true" />
              {/* Vertical connector to the next step (phones / tablets) */}
              {(i < n - 1 || !perf) && (
                <span className="df-node__seg" aria-hidden="true">
                  <span className="df-node__segfill" />
                </span>
              )}
              <span className="df-node__txt">
                <span className="df-node__i t-mono" aria-hidden="true">
                  {pad2(i + 1)}
                </span>
                <span className="df-node__label">{step}</span>
              </span>
            </li>
          ))}
        </ol>

        {!perf && (
          <span className="df-track__end" aria-hidden="true">
            <span className="df-track__cap t-mono">Export.</span>
            <span className="df-track__ghost" />
          </span>
        )}

        <span className={`df-ph df-ph--${lane.id}`} aria-hidden="true">
          <span className="df-ph__line" />
          <span className="df-ph__knob" />
          {perf && <span className="df-ph__flag t-mono">{toTimecode(0)}</span>}
        </span>
      </div>
    </div>
  )
}

function Philosophy({ reduced }) {
  return (
    <div className="container df-phil">
      <div className="df-phil__head">
        <p className="t-mono df-phil__label">Editing philosophy</p>
        {!reduced && (
          <>
            <div className="df-bars" aria-hidden="true">
              {PHILOSOPHY.map((w) => (
                <span className="df-bars__seg" key={w}>
                  <span className="df-bars__fill" />
                </span>
              ))}
            </div>
            <p className="t-mono df-phil__count" aria-hidden="true">
              <span className="df-phil__cur" data-phil-i>
                01
              </span>{' '}
              / {pad2(PHILOSOPHY.length)}
            </p>
          </>
        )}
      </div>

      <p className="df-phil__line t-h1">
        <span className="df-phil__lead">Every cut should</span>
        {reduced ? (
          <span className="df-phil__static">
            {PHILOSOPHY.map((w, i) => (
              <Fragment key={w}>
                {i > 0 && <span className="df-phil__sep"> · </span>}
                <em className="t-serif t-accent">{w}</em>
              </Fragment>
            ))}
          </span>
        ) : (
          <>
            <span className="df-slot" aria-hidden="true">
              {PHILOSOPHY.map((w) => (
                <span className="df-slot__w t-serif t-accent" key={w}>
                  {w}.
                </span>
              ))}
            </span>
            <span className="sr-only"> {PHIL_SENTENCE}.</span>
          </>
        )}
      </p>

      <div className="df-phil__foot">
        <p className="df-phil__note t-lead">
          Don’t edit just to make footage look good. Edit to make the viewer{' '}
          <span className="t-fg">keep watching.</span>
        </p>
      </div>
    </div>
  )
}

/**
 * 05 — The Difference. The site's core message: the same brief handed to two
 * editors, played back as two timeline tracks. One is five steps and an export;
 * the other is the service.
 */
export default function Difference() {
  const rootRef = useRef(null)
  const reduced = useReducedMotion()

  useGSAP(
    () => {
      const root = rootRef.current
      const q = gsap.utils.selector(root)
      const reducedNow = prefersReducedMotion()
      const mm = gsap.matchMedia()

      gsap.from(q('.df-eyebrow'), {
        autoAlpha: 0,
        y: reducedNow ? 0 : 12,
        duration: reducedNow ? 0.7 : 1.1,
        scrollTrigger: { trigger: q('.df-intro')[0], start: 'top 85%', once: true },
      })

      const lane = (id) => {
        const el = q(`.df-lane--${id}`)[0]
        return {
          el,
          nodes: Array.from(el.querySelectorAll('.df-node')),
          range: el.querySelector('.df-range'),
          ph: el.querySelector('.df-ph'),
          fill: el.querySelector('.df-track__fill'),
          count: el.querySelector('[data-count]'),
          stamp: el.querySelector('.df-stamp'),
        }
      }

      /* ---------------------------------------------------------------
         Desktop — pinned; two timeline tracks scrubbed by scroll
         --------------------------------------------------------------- */
      mm.add('(min-width: 1024px)', () => {
        const pin = q('.df-pin')[0]
        const trad = lane('trad')
        const perf = lane('perf')
        const flag = perf.el.querySelector('.df-ph__flag')
        const hint = q('.df-stage__hint')[0]
        const travel = PERF_END - PERF_START

        if (!reducedNow) {
          gsap
            .timeline({ scrollTrigger: { trigger: pin, start: 'top 72%', once: true } })
            .from(q('.df-track__line'), { scaleX: 0, duration: 1.6, ease: EASE.inOut, stagger: 0.2 }, 0)
            .from(q('.df-lane__meta, .df-count, .df-track__end'), { opacity: 0, y: 12, duration: 1.1, stagger: 0.08 }, 0.1)
            .from(q('.df-node__dot'), { scale: 0, duration: 0.9, stagger: 0.035 }, 0.4)
            .from(q('.df-node__stem, .df-node__txt'), { opacity: 0, y: 8, duration: 1, stagger: 0.025 }, 0.5)
            .from(q('.df-ruler, .df-ph'), { opacity: 0, duration: 1 }, 0.9)
        }

        const tl = gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: {
            trigger: pin,
            start: 'top top',
            end: '+=250%',
            pin: true,
            scrub: reducedNow ? true : 1,
            anticipatePin: 1,
            invalidateOnRefresh: true,
          },
        })

        // Discrete DOM changes only when a value actually changes
        let lastTrad = -1
        let lastPerf = -1
        let lastCode = ''
        let hinted = null
        const sync = () => {
          const t = tl.progress()
          const a = litCount(t / TRAD_END, trad.nodes.length)
          const r = (t - PERF_START) / travel
          const b = litCount(r, perf.nodes.length)
          if (a !== lastTrad) {
            lastTrad = a
            trad.nodes.forEach((el, i) => el.classList.toggle('is-lit', i < a))
            trad.count.textContent = pad2(a)
            trad.el.classList.toggle('is-done', a === trad.nodes.length)
          }
          if (b !== lastPerf) {
            lastPerf = b
            perf.nodes.forEach((el, i) => el.classList.toggle('is-lit', i < b))
            perf.count.textContent = pad2(b)
            perf.el.classList.toggle('is-done', b === perf.nodes.length)
          }
          const code = toTimecode(gsap.utils.clamp(0, 1, r) * AD_SECONDS)
          if (code !== lastCode) {
            lastCode = code
            flag.textContent = code
          }
          const h = t > 0.012
          if (h !== hinted) {
            hinted = h
            hint?.classList.toggle('is-gone', h)
          }
        }
        tl.eventCallback('onUpdate', sync)

        tl.fromTo(trad.ph, { x: 0 }, { x: () => trad.range.offsetWidth, duration: TRAD_END }, 0)
          .fromTo(trad.fill, { scaleX: 0 }, { scaleX: 1, duration: TRAD_END }, 0)
          .fromTo(perf.el, { opacity: 0.4 }, { opacity: 1, duration: 0.05 }, TRAD_END - 0.01)
          .to(trad.el, { opacity: 0.5, duration: 0.05 }, TRAD_END)
          .fromTo(perf.ph, { x: 0 }, { x: () => perf.range.offsetWidth, duration: travel }, PERF_START)
          .fromTo(perf.fill, { scaleX: 0 }, { scaleX: 1, duration: travel }, PERF_START)
          // The timecode flag slides across its pole so it never leaves the track
          .fromTo(flag, { x: 8, xPercent: 0 }, { x: -8, xPercent: -100, duration: travel }, PERF_START)
          .fromTo(perf.stamp, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.05, ease: 'power2.out' }, STAMP_AT)
          .set({}, {}, 1)

        sync()

        return () => {
          ;[...trad.nodes, ...perf.nodes].forEach((el) => el.classList.remove('is-lit'))
          trad.el.classList.remove('is-done')
          perf.el.classList.remove('is-done')
          trad.count.textContent = pad2(trad.nodes.length)
          perf.count.textContent = pad2(perf.nodes.length)
          flag.textContent = toTimecode(0)
          hint?.classList.remove('is-gone')
        }
      })

      /* ---------------------------------------------------------------
         Phones / tablets — no pin. Two vertical lists; the performance
         steps light one by one as they cross 75% of the viewport, and
         each connector fills on its way to the next step.
         --------------------------------------------------------------- */
      mm.add('(max-width: 1023px)', () => {
        const perf = lane('perf')
        const triggers = []
        let last = -1

        // A step counts once the scroll has passed its start — read straight
        // off each step's own trigger, so nothing needs measuring
        const recount = () => {
          let c = 0
          for (const st of triggers) if (st.progress > 0) c += 1
          if (c === last) return
          last = c
          perf.count.textContent = pad2(c)
          perf.el.classList.toggle('is-done', c === perf.nodes.length)
        }

        perf.nodes.forEach((node) => {
          const tl = gsap.timeline({
            scrollTrigger: {
              trigger: node,
              start: 'top 75%',
              end: 'top 60%',
              scrub: true,
              onUpdate: recount,
              onRefresh: recount,
            },
          })
          tl.fromTo(node.querySelector('.df-node__on'), { opacity: 0, scale: 0.3 }, { opacity: 1, scale: 1, ease: 'none' }, 0)
            .fromTo(node.querySelector('.df-node__txt'), { opacity: 0.32 }, { opacity: 1, ease: 'none' }, 0)
          triggers.push(tl.scrollTrigger)

          const seg = node.querySelector('.df-node__segfill')
          if (seg) {
            gsap.fromTo(
              seg,
              { scaleY: 0 },
              { scaleY: 1, ease: 'none', scrollTrigger: { trigger: node, start: 'top 75%', end: 'bottom 75%', scrub: true } },
            )
          }
        })

        gsap.fromTo(
          perf.stamp,
          { opacity: 0, y: 12 },
          {
            opacity: 1,
            y: 0,
            ease: 'none',
            scrollTrigger: { trigger: perf.stamp, start: 'top 94%', end: 'top 80%', scrub: true },
          },
        )
        recount()

        return () => {
          perf.count.textContent = pad2(perf.nodes.length)
          perf.el.classList.remove('is-done')
        }
      })

      /* ---------------------------------------------------------------
         Philosophy ticker — rolls only while in view; static when reduced
         --------------------------------------------------------------- */
      if (reducedNow) return

      const phil = q('.df-phil')[0]
      const words = gsap.utils.toArray(phil.querySelectorAll('.df-slot__w'))
      const bars = gsap.utils.toArray(phil.querySelectorAll('.df-bars__fill'))
      const idxEl = phil.querySelector('[data-phil-i]')
      const n = words.length
      let cur = 0
      let hold = null
      let inView = false
      let alive = true

      gsap.set(words, { yPercent: SLOT_Y })
      gsap.set(words[0], { yPercent: 0 })
      gsap.set(bars, { scaleX: 0 })

      // These tweens are born in callbacks (outside the context) and are
      // killed explicitly on cleanup, so nothing outlives the section.
      function startHold() {
        hold = gsap.fromTo(
          bars[cur],
          { scaleX: 0 },
          { scaleX: 1, duration: HOLD, ease: 'none', paused: !inView, overwrite: true, onComplete: advance },
        )
      }
      function advance() {
        if (!alive) return
        const next = (cur + 1) % n
        gsap.to(words[cur], { yPercent: -SLOT_Y, duration: ROLL, ease: EASE.snap, overwrite: true })
        gsap.fromTo(words[next], { yPercent: SLOT_Y }, { yPercent: 0, duration: ROLL, ease: EASE.snap, overwrite: true })
        if (next === 0) gsap.to(bars.slice(1), { scaleX: 0, duration: 0.6, ease: EASE.inOut, overwrite: true })
        cur = next
        if (idxEl) idxEl.textContent = pad2(cur + 1)
        startHold()
      }

      ScrollTrigger.create({
        trigger: phil,
        start: 'top 85%',
        end: 'bottom 15%',
        onToggle: (self) => {
          inView = self.isActive
          if (!hold) return
          if (inView) hold.resume()
          else hold.pause()
        },
      })
      startHold()

      return () => {
        alive = false
        hold?.kill()
        gsap.killTweensOf([...words, ...bars])
      }
    },
    { scope: rootRef },
  )

  return (
    <section id="difference" className="df" data-hud="The Difference" ref={rootRef}>
      <div className="container df-intro">
        <Eyebrow index="05" className="df-eyebrow">
          Why performance editing
        </Eyebrow>
        <SplitReveal as="h2" className="df-title t-display">
          Don’t just edit the video.
          <br />
          <em className="t-serif t-accent">Build the creative.</em>
        </SplitReveal>
        <SplitReveal as="p" className="df-lead t-lead" delay={0.15}>
          Most edits start with footage and end at export. Performance creative starts with the brief — and ends with
          ads built to be tested.
        </SplitReveal>
      </div>

      <div className="df-pin">
        <div className="container df-stage">
          <div className="df-stage__head">
            <p className="t-mono df-stage__label">
              <span className="rec-dot" aria-hidden="true" />
              Same brief — two editors
            </p>
            <p className="t-mono df-stage__hint" aria-hidden="true">
              Scroll to play
              <span className="df-stage__arrow">↓</span>
            </p>
          </div>
          <div className="df-lanes">
            {LANES.map((l, i) => (
              <Fragment key={l.id}>
                {/* Its own element, so dimming a lane never dims the hairline */}
                {i > 0 && <span className="df-lanes__rule" aria-hidden="true" />}
                <Lane lane={l} />
              </Fragment>
            ))}
          </div>
        </div>
      </div>

      <Philosophy reduced={reduced} />
    </section>
  )
}
