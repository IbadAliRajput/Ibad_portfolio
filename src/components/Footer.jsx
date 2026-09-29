import { useRef } from 'react'
import { useLocation } from 'react-router'
import Button, { ArrowIcon } from './Button'
import { TLink } from '../app/PageTransition'
import { useScroll } from '../app/context'
import { gsap, useGSAP } from '../lib/gsap'
import { prefersReducedMotion, setMotion } from '../lib/env'
import { NAV, SITE, CTA_LINES } from '../data/site'
import './Footer.css'

export default function Footer() {
  const ref = useRef(null)
  const { scrollTo } = useScroll()
  const { pathname } = useLocation()
  const reduced = prefersReducedMotion()

  useGSAP(
    () => {
      if (prefersReducedMotion()) return
      gsap.fromTo(
        '.ft__letter',
        { yPercent: 102 },
        {
          yPercent: 0,
          ease: 'none',
          stagger: 0.06,
          scrollTrigger: { trigger: '.ft__mark', start: 'top bottom', end: 'bottom bottom', scrub: 0.8 },
        },
      )
      gsap.from('.ft__col', {
        y: 30,
        autoAlpha: 0,
        duration: 1,
        stagger: 0.08,
        scrollTrigger: { trigger: '.ft__cols', start: 'top 90%', once: true },
      })
    },
    { scope: ref, dependencies: [pathname], revertOnUpdate: true },
  )

  return (
    <footer ref={ref} className="ft" data-hud="End card">
      <div className="container">
        <div className="ft__top">
          <p className="ft__slogan t-h2">
            Don&rsquo;t just edit the video.
            <br />
            <em className="t-serif">Build the creative.</em>
          </p>
          <div className="ft__reach">
            <a className="ft__email t-h3" href={`mailto:${SITE.email}`}>
              {SITE.email}
            </a>
            <Button to="/#contact" size="md">
              {CTA_LINES.primary}
            </Button>
          </div>
        </div>

        <div className="ft__cols">
          <div className="ft__col">
            <p className="t-mono t-mute">Index</p>
            <ul>
              <li><TLink to="/">Home</TLink></li>
              {NAV.map((n) => (
                <li key={n.to}><TLink to={n.to}>{n.label}</TLink></li>
              ))}
              <li><TLink to="/work">All work</TLink></li>
            </ul>
          </div>
          <div className="ft__col">
            <p className="t-mono t-mute">Elsewhere</p>
            <ul>
              {SITE.socials.map((s) => (
                <li key={s.label}>
                  <a href={s.href} target="_blank" rel="noreferrer">
                    {s.label} <ArrowIcon dir="up-right" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div className="ft__col">
            <p className="t-mono t-mute">Studio</p>
            <ul className="t-dim">
              <li>{SITE.role}</li>
              <li>{SITE.location}</li>
              <li className="ft__status"><span className="rec-dot" /> {SITE.availability}</li>
            </ul>
          </div>
          <div className="ft__col">
            <p className="t-mono t-mute">Optimised for</p>
            <ul className="t-dim">
              {SITE.platforms.map((p) => <li key={p}>{p}</li>)}
            </ul>
          </div>
        </div>
      </div>

      <div className="ft__mark" aria-hidden="true">
        {SITE.name.toUpperCase().split('').map((c, i) => (
          <span className="ft__letter-mask" key={i}>
            <span className="ft__letter">{c}</span>
          </span>
        ))}
      </div>

      <div className="ft__bar container t-mono">
        <span>© {new Date().getFullYear()} {SITE.name}. All rights reserved.</span>
        <span className="ft__eor">End of reel — 00:01:00:00</span>
        <span className="ft__bar-end">
          <button
            className="ft__top-btn"
            onClick={() => setMotion(reduced ? 'full' : 'reduced')}
            aria-label={`Motion is ${reduced ? 'reduced' : 'full'}. Switch to ${reduced ? 'full' : 'reduced'} motion`}
          >
            Motion <span className={`ft__motion${reduced ? '' : ' is-on'}`}>{reduced ? 'Reduced' : 'Full'}</span>
          </button>
          <button className="ft__top-btn" onClick={() => scrollTo(0, { duration: 2.2 })}>
            Back to top <ArrowIcon dir="up" />
          </button>
        </span>
      </div>
    </footer>
  )
}
