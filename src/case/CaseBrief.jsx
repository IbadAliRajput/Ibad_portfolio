import { Fragment, useRef } from 'react'
import { SectionHeader } from '../components/Primitives'
import { gsap, ScrollTrigger, useGSAP, EASE } from '../lib/gsap'
import { prefersReducedMotion } from '../lib/env'
import { pad2 } from './caseData'
import './CaseBrief.css'

/** "Problem → discovery → proof" with accent arrows that still read as "to" */
function Arrowed({ text }) {
  return text.split('→').map((part, i) => (
    <Fragment key={i}>
      {i > 0 && (
        <span className="cs-arrow">
          <span aria-hidden="true">→</span>
          <span className="sr-only">to</span>
        </span>
      )}
      {part}
    </Fragment>
  ))
}

/**
 * The brief — an editorial spec sheet: mono labels left, content right,
 * hairline-separated rows (objective, approaches, deliverables, tools).
 *  Motion   each row's hairline draws left → right, its content settles in behind.
 *  Reduced  short fades, hairlines static.
 */
export default function CaseBrief({ project }) {
  const root = useRef(null)
  const { client, year, objective, creativeApproach, editingApproach, deliverables, tools, production, styles } =
    project

  useGSAP(
    () => {
      const rows = gsap.utils.toArray(root.current.querySelectorAll('.cs-brief__row'))
      if (!rows.length) return
      const reduce = prefersReducedMotion()
      const intros = new Map()

      rows.forEach((row) => {
        const parts = row.querySelectorAll('.cs-brief__k, [data-cs-in]')
        const tl = gsap.timeline({ paused: true })
        if (reduce) {
          tl.from(parts, { autoAlpha: 0, duration: 0.6, stagger: 0.04, ease: 'power1.out' })
        } else {
          tl.from(row.querySelector('.cs-brief__rule'), { scaleX: 0, duration: 1.4, ease: EASE.inOut }, 0).from(
            parts,
            { autoAlpha: 0, y: 22, duration: 1.1, stagger: 0.06, ease: EASE.out },
            0.14,
          )
        }
        intros.set(row, tl)
      })

      ScrollTrigger.batch(rows, {
        start: 'top 88%',
        once: true,
        onEnter: (batch) => batch.forEach((row, k) => intros.get(row)?.delay(k * 0.1).restart(true)),
      })
    },
    { scope: root },
  )

  const rows = [
    {
      k: 'Objective',
      body: (
        <p className="cs-brief__lead t-lead" data-cs-in>
          {objective}
        </p>
      ),
    },
    {
      k: 'Creative approach',
      body: (
        <p className="cs-brief__lead t-lead" data-cs-in>
          <Arrowed text={creativeApproach} />
        </p>
      ),
    },
    {
      k: 'Editing approach',
      body: (
        <p className="cs-brief__lead t-lead" data-cs-in>
          {editingApproach}
        </p>
      ),
    },
    {
      k: 'Deliverables',
      body: (
        <ol className="cs-deliv">
          {deliverables.map((d, i) => (
            <li className="cs-deliv__item" key={d} data-cs-in>
              <span className="cs-deliv__i t-mono" aria-hidden="true">
                {pad2(i + 1)}
              </span>
              <span className="cs-deliv__t t-h4">{d}</span>
            </li>
          ))}
        </ol>
      ),
    },
    {
      k: 'Tools & production',
      body: (
        <>
          <ul className="cs-chips" aria-label="Tools" data-cs-in>
            {tools.map((t) => (
              <li className="chip cs-chip" key={t}>
                {t}
              </li>
            ))}
          </ul>
          <dl className="cs-scope" data-cs-in>
            <div className="cs-scope__row">
              <dt className="cs-scope__k t-mono">Scope</dt>
              <dd className="cs-scope__v t-small">{production.join(' · ')}</dd>
            </div>
            <div className="cs-scope__row">
              <dt className="cs-scope__k t-mono">Style</dt>
              <dd className="cs-scope__v t-small">{styles.join(' · ')}</dd>
            </div>
          </dl>
        </>
      ),
    },
  ]

  return (
    <section ref={root} className="section cs-brief" data-hud="Brief">
      <div className="container">
        <SectionHeader
          eyebrow="The brief"
          aside={`${client} — ${year}`}
          titleClass="t-h2"
          title={
            <>
              What the ad <em className="t-serif">had to do.</em>
            </>
          }
        />

        <div className="cs-brief__list">
          {rows.map((r, i) => (
            <div className="cs-brief__row" key={r.k}>
              <span className="cs-brief__rule" aria-hidden="true" />
              <h3 className="cs-brief__k t-mono">
                <span className="cs-brief__i" aria-hidden="true">
                  {pad2(i + 1)}
                </span>
                {r.k}
              </h3>
              <div className="cs-brief__v">{r.body}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
