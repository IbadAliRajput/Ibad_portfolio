import { useRef } from 'react'
import VerticalVideo from '../components/VerticalVideo'
import { SectionHeader } from '../components/Primitives'
import { gsap, useGSAP, EASE } from '../lib/gsap'
import { prefersReducedMotion } from '../lib/env'
import { toShort } from '../lib/timecode'
import { hookDesc, pad2 } from './caseData'
import './CaseVariations.css'

/** Four-up by default; a five-hook test gets a fifth column */
const MIN_COLS = 4
const CLIP_FROM = 'inset(100% -30% 0% -30%)'
const CLIP_TO = 'inset(-12% -30% -12% -30%)'

/**
 * Hook variations — the same body with different first three seconds.
 *  Wide     four 9:16 cards in a row (a "body locked" card fills the row when a
 *           project has three hooks), then a timeline strip: hook lanes feeding
 *           one locked body. Hovering / focusing a card lights its lane.
 *  Narrow   native scroll-snap carousel, same strip beneath.
 *  Motion   frames wipe up in sequence, posters settle, lanes draw in.
 *  Reduced  short fades.
 */
export default function CaseVariations({ project }) {
  const root = useRef(null)
  const { hooks, runtime, title } = project
  const n = hooks.length
  const cols = Math.max(MIN_COLS, n)
  // the openings run different lengths — the strip marks the longest
  const hookLen = Math.round(Math.max(...hooks.map((h) => h.dur)))
  const bodyLen = Math.max(0, runtime - hookLen)

  useGSAP(
    () => {
      const q = gsap.utils.selector(root)
      const list = q('.cs-var__list')[0]
      const strip = q('.cs-var__strip')[0]
      if (!list || !strip) return
      const reduce = prefersReducedMotion()
      const listST = { trigger: list, start: 'top 80%', once: true }
      const stripST = { trigger: strip, start: 'top 90%', once: true }

      if (reduce) {
        gsap.from(q('.cs-var__item'), { autoAlpha: 0, duration: 0.7, stagger: 0.06, ease: 'power1.out', scrollTrigger: listST })
        gsap.from(strip, { autoAlpha: 0, duration: 0.7, ease: 'power1.out', scrollTrigger: stripST })
        return
      }

      const posters = q('.cs-var__frame .vv__poster')
      // GSAP owns the poster transforms for the settle — the hover transition returns on clearProps
      gsap.set(posters, { transition: 'none' })
      gsap
        .timeline({ scrollTrigger: listST, defaults: { ease: EASE.out } })
        .fromTo(
          q('.cs-var__frame, .cs-var__ghost'),
          { clipPath: CLIP_FROM },
          { clipPath: CLIP_TO, duration: 1.4, stagger: 0.1, ease: EASE.inOut, clearProps: 'clipPath' },
          0,
        )
        .fromTo(posters, { scale: 1.3 }, { scale: 1, duration: 1.9, stagger: 0.1, clearProps: 'transform,transition' }, 0.05)
        .from(q('.cs-var__info'), { autoAlpha: 0, y: 14, duration: 1, stagger: 0.1 }, 0.45)

      gsap
        .timeline({ scrollTrigger: stripST, defaults: { ease: EASE.inOut } })
        .from(q('.cs-var__lane'), { scaleX: 0, duration: 1.1, stagger: 0.08 }, 0)
        .fromTo(
          q('.cs-var__body'),
          { clipPath: 'inset(0% 100% 0% 0%)' },
          { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.5, clearProps: 'clipPath' },
          0.3,
        )
        .from(q('.cs-var__scale > *'), { autoAlpha: 0, duration: 0.8, stagger: 0.06, ease: EASE.out }, 0.55)
    },
    { scope: root },
  )

  return (
    <section ref={root} className="section cs-var" data-hud="Variations">
      <div className="container">
        <SectionHeader
          eyebrow="Hook variations"
          aside={`${pad2(n)} openings — 01 body`}
          title={
            <>
              Same body. <em className="t-serif">Different</em> first seconds.
            </>
          }
          lead={`One locked body, ${n} openings — each built to test a different reason to stop the scroll.`}
        />

        <ul className="cs-var__list" style={{ '--cs-var-cols': cols }}>
          {hooks.map((h, i) => (
            <li className="cs-var__item" key={h.id}>
              <div className="cs-var__frame">
                <VerticalVideo
                  src={h.video}
                  poster={h.poster}
                  mode="auto"
                  label={`Hook ${h.id}`}
                  meta={toShort(h.dur)}
                  caption={h.line}
                  expand={{ title: `Hook ${h.id} — ${h.type}`, kicker: title, meta: h.line }}
                  className="cs-var__vv"
                />
              </div>
              <div className="cs-var__info">
                <p className="cs-var__id t-mono">
                  <span className="cs-var__id-k">Hook {h.id}</span>
                  <span className="cs-var__bar" aria-hidden="true" />
                  <span>
                    {pad2(i + 1)} / {pad2(n)}
                  </span>
                </p>
                <h3 className="cs-var__type t-h4">{h.type} hook</h3>
                <p className="cs-var__desc t-small">{hookDesc(h.type)}</p>
              </div>
            </li>
          ))}
          {n < cols && (
            <li className="cs-var__item cs-var__item--body">
              <div className="cs-var__ghost">
                <span className="cs-var__ghost-crop cropmarks" aria-hidden="true" />
                <p className="cs-var__ghost-tc t-mono">
                  {toShort(hookLen)} <span aria-hidden="true">→</span>
                  <span className="sr-only">to</span> {toShort(runtime)}
                </p>
                <p className="cs-var__ghost-title t-h3">
                  Body <em className="t-serif">locked.</em>
                </p>
                <p className="cs-var__ghost-copy t-small">
                  Only the opening changes — so every result is a clean read on the hook.
                </p>
              </div>
            </li>
          )}
        </ul>

        <div
          className="cs-var__strip"
          role="img"
          aria-label={`${n} interchangeable hooks of up to ${hookLen} seconds feeding one locked ${bodyLen}-second body`}
        >
          <div className="cs-var__track">
            <div className="cs-var__lanes">
              {hooks.map((h) => (
                <span className="cs-var__lane t-mono" key={h.id}>
                  <span className="cs-var__lane-id">{h.id}</span>
                  <span className="cs-var__lane-type">{h.type}</span>
                </span>
              ))}
            </div>
            <div className="cs-var__body t-mono">
              <span>Body — locked</span>
              <span className="cs-var__body-len">{toShort(bodyLen)}</span>
            </div>
          </div>
          <div className="cs-var__scale t-mono">
            <span>0:00</span>
            <span className="cs-var__scale-mid">{toShort(hookLen)}</span>
            <span>{toShort(runtime)}</span>
          </div>
        </div>
      </div>
    </section>
  )
}
