import { useRef, useState } from 'react'
import { SectionHeader } from '../components/Primitives'
import { AdCaption } from '../components/VerticalVideo'
import Glass from '../components/LiquidGlass'
import { gsap, ScrollTrigger, useGSAP, EASE } from '../lib/gsap'
import { prefersReducedMotion } from '../lib/env'
import { toShort, toTimecode } from '../lib/timecode'
import { SITE } from '../data/site'
import { KIND_LABEL, beatShots, pad2 } from './caseData'
import './CaseBreakdown.css'

function Arrow() {
  return <span className="cs-bd__arrow">→</span>
}

/**
 * 03 — Script-to-visual breakdown: Voiceover → Visual → Edit, beat by beat.
 *  Desktop  the beats run down the right; a sticky 9:16 phone on the left shows
 *           the beat crossing the viewport centre — hard cut + punch-in, the
 *           line as a burned-in caption, its timecode and a segmented runtime.
 *           The active beat is discrete React state, set from ScrollTrigger toggles.
 *  Touch    beats become cards, each with its own small 9:16 still.
 *  Reduced  the sticky phone and the beat switching stay (visitor-driven);
 *           punch-in, flash frame and entrance moves become plain cuts / fades.
 */
export default function CaseBreakdown({ project }) {
  const root = useRef(null)
  const [active, setActive] = useState(0)
  const { breakdown: beats, runtime } = project
  const shots = beatShots(project)
  const cur = beats[active] ?? beats[0]
  const last = beats.length - 1
  // Beat lengths drive the segmented runtime bar on the phone
  const spans = beats.map((b, i) => Math.max(0.5, (i < last ? beats[i + 1].t : runtime) - b.t))

  useGSAP(
    () => {
      const el = root.current
      if (!el) return
      const rows = gsap.utils.toArray(el.querySelectorAll('.cs-bd__row'))
      if (!rows.length) return
      const reduce = prefersReducedMotion()
      const mm = gsap.matchMedia()

      mm.add('(min-width: 1024px)', () => {
        // The beat crossing the viewport centre drives the phone (discrete state only)
        rows.forEach((row, i) => {
          ScrollTrigger.create({
            trigger: row,
            start: 'top center',
            end: 'bottom center',
            onToggle: (self) => {
              if (self.isActive) setActive(i)
            },
          })
        })
        gsap.from(el.querySelector('.cs-bd__stick'), {
          autoAlpha: 0,
          y: reduce ? 0 : 64,
          duration: reduce ? 0.7 : 1.5,
          ease: reduce ? 'power1.out' : EASE.out,
          scrollTrigger: { trigger: el.querySelector('.cs-bd__body'), start: 'top 78%', once: true },
        })
      })

      // Beats settle in as they arrive (rows on desktop, cards on touch)
      gsap.set(rows, { autoAlpha: 0, y: reduce ? 0 : 36 })
      ScrollTrigger.batch(rows, {
        start: 'top 90%',
        once: true,
        onEnter: (batch) =>
          gsap.to(batch, {
            autoAlpha: 1,
            y: 0,
            duration: reduce ? 0.6 : 1.2,
            stagger: 0.09,
            ease: reduce ? 'power1.out' : EASE.out,
            overwrite: true,
          }),
      })

      return () => mm.revert()
    },
    { scope: root },
  )

  if (!cur) return null

  return (
    <section ref={root} className="section cs-bd" data-hud="Breakdown">
      <div className="container">
        <SectionHeader
          index="03"
          eyebrow="Script-to-visual breakdown"
          aside={`${pad2(beats.length)} beats — ${toShort(runtime)}`}
          title={
            <>
              Voiceover <Arrow /> Visual <Arrow /> <em className="t-serif">Edit.</em>
            </>
          }
          lead="Every line of the script is matched to a shot and an editing decision — so the picture carries the message, even with the sound off."
        />

        <div className="cs-bd__body">
          {/* Desktop monitor — decorative mirror of the active beat (the list holds the content) */}
          <div className="cs-bd__aside" aria-hidden="true">
            <div className="cs-bd__stick">
              <span className="cs-glow cs-bd__glow" />
              <div className="cs-phone">
                {beats.map((b, i) => (
                  <img
                    key={`${b.t}-${i}`}
                    className={`cs-phone__shot${i === active ? ' cs-phone__shot--on' : ''}`}
                    src={shots[i]}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    draggable="false"
                  />
                ))}
                <span key={`flash-${active}`} className="cs-phone__flash" />
                <span className="cs-phone__shade" />
                <span className="cs-phone__crop cropmarks" />
                <div className="cs-phone__ui">
                  <div className="cs-phone__segs">
                    {beats.map((b, i) => (
                      <span
                        key={`${b.t}-${i}`}
                        className={`cs-phone__seg${
                          i < active ? ' cs-phone__seg--past' : i === active ? ' cs-phone__seg--on' : ''
                        }`}
                        style={{ flexGrow: spans[i] }}
                      />
                    ))}
                  </div>
                  <div className="cs-phone__top">
                    <Glass as="span" radius={999} tone="dark" interactive={false} className="cs-phone__chip t-mono">
                      {KIND_LABEL[cur.kind]}
                    </Glass>
                    <span className="cs-phone__tc t-mono">{toTimecode(cur.t)}</span>
                  </div>
                  {SITE.placeholderMode && <AdCaption key={`cap-${active}`} text={cur.vo} className="cs-phone__cap" />}
                </div>
              </div>
              <p className="cs-bd__count t-mono">
                <span>
                  Beat <span className="cs-bd__count-n">{pad2(active + 1)}</span> / {pad2(beats.length)}
                </span>
                <span>
                  {toShort(cur.t)} / {toShort(runtime)}
                </span>
              </p>
            </div>
          </div>

          <ol className="cs-bd__rows" aria-label="Voiceover, visual and edit decision for each beat">
            {beats.map((b, i) => (
              <li key={`${b.t}-${i}`} className={`cs-bd__row${i === active ? ' cs-bd__row--active' : ''}`}>
                <div className="cs-bd__meta">
                  <p className="cs-bd__tc t-mono">
                    <time dateTime={`PT${b.t}S`}>{toTimecode(b.t)}</time>
                  </p>
                  <span className={`chip cs-bd__kind cs-bd__kind--${b.kind}`}>{KIND_LABEL[b.kind]}</span>
                </div>
                <figure className="cs-bd__thumb" aria-hidden="true">
                  <img className="cs-bd__thumb-img" src={shots[i]} alt="" loading="lazy" decoding="async" draggable="false" />
                  <span className="cs-bd__thumb-crop cropmarks" />
                </figure>
                <p className="cs-bd__vo t-h4">
                  <span className="sr-only">Voiceover: </span>
                  &ldquo;{b.vo}&rdquo;
                </p>
                <dl className="cs-bd__detail">
                  <div className="cs-bd__line">
                    <dt className="cs-bd__line-k t-mono">Visual</dt>
                    <dd className="cs-bd__line-v t-body">{b.visual}</dd>
                  </div>
                  <div className="cs-bd__line">
                    <dt className="cs-bd__line-k cs-bd__line-k--edit t-mono">Edit</dt>
                    <dd className="cs-bd__line-v t-body">{b.edit}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
