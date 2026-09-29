import { useRef } from 'react'
import Button from '../components/Button'
import SplitReveal from '../components/SplitReveal'
import { gsap, useGSAP, EASE } from '../lib/gsap'
import { prefersReducedMotion } from '../lib/env'
import { toTimecode } from '../lib/timecode'
import { CTA_LINES, SITE } from '../data/site'
import './CaseRecap.css'

/**
 * Recap CTA — the case study ends the way the ad does: on an end card.
 * A framed panel (crop marks, the ad's end timecode, a horizon glow in the
 * project's tone) carrying the ask and the two ways forward.
 *  Motion   the frame opens from inset, the glow rises, the contents settle.
 *  Reduced  short fades.
 */
export default function CaseRecap({ project }) {
  const root = useRef(null)

  useGSAP(
    () => {
      const q = gsap.utils.selector(root)
      const frame = q('.cs-cta__frame')[0]
      if (!frame) return
      const st = { trigger: frame, start: 'top 80%', once: true }

      if (prefersReducedMotion()) {
        gsap.from(q('[data-cs-in], .cs-cta__glow'), { autoAlpha: 0, duration: 0.7, stagger: 0.05, ease: 'power1.out', scrollTrigger: st })
        return
      }
      // End on the frame's own corner radius (it changes by breakpoint) so clearing the clip is seamless
      const r = getComputedStyle(frame).borderTopLeftRadius || '32px'
      gsap
        .timeline({ scrollTrigger: st, defaults: { ease: EASE.out } })
        .fromTo(
          frame,
          { clipPath: 'inset(7% 5% 7% 5% round 48px)' },
          { clipPath: `inset(0% 0% 0% 0% round ${r})`, duration: 1.6, ease: EASE.inOut, clearProps: 'clipPath' },
          0,
        )
        .from(q('.cs-cta__glow'), { autoAlpha: 0, scale: 0.5, yPercent: 20, duration: 2.4, ease: EASE.soft }, 0.15)
        .from(q('[data-cs-in]'), { autoAlpha: 0, y: 20, duration: 1.1, stagger: 0.08 }, 0.55)
    },
    { scope: root },
  )

  return (
    <section ref={root} className="section cs-cta" data-hud="Next step">
      <div className="container">
        <div className="cs-cta__frame">
          <span className="cs-glow cs-cta__glow" aria-hidden="true" />
          <span className="cs-cta__crop cropmarks" aria-hidden="true" />
          <div className="cs-cta__bar t-mono" aria-hidden="true" data-cs-in>
            <span className="cs-cta__bar-k">
              <span className="rec-dot" /> End card
            </span>
            <span className="tabular">{toTimecode(project.runtime)}</span>
          </div>

          <SplitReveal as="h2" className="cs-cta__title t-h1">
            Have a script like this?
            <br />
            <em className="t-serif">
              Let&rsquo;s build your <span className="nowrap">next creative.</span>
            </em>
          </SplitReveal>
          <p className="cs-cta__lead t-lead" data-cs-in>
            Send the script, the raw footage or just the product. I&rsquo;ll turn it into a hook-first ad — and the
            variations to test it.
          </p>
          <div className="cs-cta__actions" data-cs-in>
            <Button to="/#contact" size="lg" label="Contact" kicker="Start a project">
              {CTA_LINES.primary}
            </Button>
            <Button to="/work" variant="ghost" label="All work" kicker="Index">
              {CTA_LINES.cases}
            </Button>
          </div>
          <p className="cs-cta__foot t-mono" data-cs-in>
            <span className="rec-dot" aria-hidden="true" />
            {SITE.availability}
          </p>
        </div>
      </div>
    </section>
  )
}
