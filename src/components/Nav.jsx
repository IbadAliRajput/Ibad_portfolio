import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import Glass from './LiquidGlass'
import Button from './Button'
import { TLink } from '../app/PageTransition'
import { usePageTransition, useReady, useScroll } from '../app/context'
import { gsap, useGSAP, EASE } from '../lib/gsap'
import { NAV, SITE, CTA_LINES } from '../data/site'
import './Nav.css'

function Wordmark() {
  return (
    <TLink to="/" className="nav__mark" aria-label={`${SITE.name} — home`}>
      <span className="nav__mark-word">{SITE.name}</span>
      <span className="rec-dot" aria-hidden="true" />
    </TLink>
  )
}

/** Desktop link pill with a liquid-glass thumb that glides to the hovered link */
function LinkPill() {
  const pillRef = useRef(null)
  const thumbRef = useRef(null)
  const [hovered, setHovered] = useState(null)

  useEffect(() => {
    const thumb = thumbRef.current
    const pill = pillRef.current
    if (!thumb || !pill) return
    if (hovered === null) {
      gsap.to(thumb, { opacity: 0, scale: 0.9, duration: 0.4, ease: EASE.out })
      return
    }
    const link = pill.querySelectorAll('.nav__link')[hovered]
    if (!link) return
    const pb = pill.getBoundingClientRect()
    const lb = link.getBoundingClientRect()
    gsap.to(thumb, {
      x: lb.left - pb.left,
      width: lb.width,
      opacity: 1,
      scale: 1,
      duration: 0.7,
      ease: 'elastic.out(1, 0.75)',
    })
  }, [hovered])

  return (
    <Glass as="nav" ref={pillRef} radius={999} tone="dark" className="nav__pill" aria-label="Primary" onPointerLeave={() => setHovered(null)}>
      <span ref={thumbRef} className="nav__thumb" aria-hidden="true" />
      {NAV.map((item, i) => (
        <TLink key={item.to} to={item.to} className="nav__link" onPointerEnter={() => setHovered(i)} onFocus={() => setHovered(i)} onBlur={() => setHovered(null)}>
          {item.label}
        </TLink>
      ))}
    </Glass>
  )
}

function MobileMenu({ open, onClose }) {
  const ref = useRef(null)
  const { go } = usePageTransition()

  useGSAP(
    () => {
      const el = ref.current
      if (open) {
        gsap.set(el, { visibility: 'visible' })
        gsap
          .timeline()
          .fromTo(el, { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.8, ease: EASE.inOut })
          .fromTo('.mm__link-inner', { yPercent: 110 }, { yPercent: 0, duration: 0.9, stagger: 0.06, ease: EASE.out }, 0.3)
          .fromTo('.mm__foot > *', { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.05 }, 0.55)
      } else if (el.style.visibility === 'visible') {
        gsap
          .timeline()
          .to(el, { clipPath: 'inset(0% 0% 100% 0%)', duration: 0.7, ease: EASE.inOut })
          .set(el, { visibility: 'hidden' })
      }
    },
    { scope: ref, dependencies: [open] },
  )

  const nav = (to) => (e) => {
    e.preventDefault()
    onClose()
    setTimeout(() => go(to), 350)
  }

  return (
    <div ref={ref} id="mobile-menu" className="mm" aria-hidden={!open} inert={!open}>
      <div className="mm__inner container">
        <p className="t-mono t-mute">Index</p>
        <ul className="mm__list">
          {[{ label: 'Home', to: '/' }, ...NAV, { label: 'Contact', to: '/#contact' }].map((item, i) => (
            <li key={item.to}>
              <a href={item.to} className="mm__link t-h1" onClick={nav(item.to)}>
                <span className="mm__link-inner">
                  <span className="mm__idx t-mono">{String(i + 1).padStart(2, '0')}</span>
                  {item.label}
                </span>
              </a>
            </li>
          ))}
        </ul>
        <div className="mm__foot">
          <a className="t-h4" href={`mailto:${SITE.email}`}>{SITE.email}</a>
          <p className="t-mono t-mute"><span className="rec-dot" /> {SITE.availability}</p>
        </div>
      </div>
    </div>
  )
}

export default function Nav() {
  const rootRef = useRef(null)
  const { ready } = useReady()
  const { lenis, stop, start } = useScroll()
  const location = useLocation()
  const [open, setOpen] = useState(false)

  // Intro once the preloader lifts
  useGSAP(
    () => {
      if (!ready) return
      gsap.fromTo(
        rootRef.current.querySelectorAll('.nav__intro'),
        { y: -24, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 1.2, stagger: 0.08, ease: EASE.out, delay: 0.5 },
      )
    },
    { scope: rootRef, dependencies: [ready] },
  )

  // Hide on scroll down, reveal on scroll up
  useEffect(() => {
    const el = rootRef.current
    let last = window.scrollY
    let hidden = false
    // Keyboard focus inside the bar keeps it on screen, so focused links are never off-canvas
    let focused = false
    const show = () => {
      if (!hidden) return
      hidden = false
      gsap.to(el, { yPercent: 0, duration: 0.8, ease: EASE.out, overwrite: true })
    }
    const onScroll = () => {
      const y = window.scrollY
      const down = y > last + 2
      const up = y < last - 2
      if (down && y > 240 && !hidden && !focused) {
        hidden = true
        gsap.to(el, { yPercent: -140, duration: 0.7, ease: EASE.inOut, overwrite: true })
      } else if (up || y < 120) {
        show()
      }
      el.classList.toggle('is-scrolled', y > 40)
      last = y
    }
    const onFocusIn = () => {
      focused = true
      show()
    }
    const onFocusOut = (e) => {
      if (!el.contains(e.relatedTarget)) focused = false
    }
    const src = lenis ?? window
    src.on ? src.on('scroll', onScroll) : window.addEventListener('scroll', onScroll, { passive: true })
    el.addEventListener('focusin', onFocusIn)
    el.addEventListener('focusout', onFocusOut)
    return () => {
      if (src.off) src.off('scroll', onScroll)
      else window.removeEventListener('scroll', onScroll)
      el.removeEventListener('focusin', onFocusIn)
      el.removeEventListener('focusout', onFocusOut)
      gsap.killTweensOf(el)
    }
  }, [lenis])

  // Close menu on route change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(false)
  }, [location.pathname])

  // Scroll lock + keyboard while the menu is open: Escape closes back to the
  // burger, Tab cycles between the burger and the menu
  const wasOpen = useRef(false)
  const burgerRef = useRef(null)
  useEffect(() => {
    if (open) stop()
    else if (wasOpen.current) start()
    wasOpen.current = open
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false)
        burgerRef.current?.focus()
        return
      }
      if (e.key !== 'Tab') return
      const menu = document.getElementById('mobile-menu')
      const items = [burgerRef.current, ...(menu ? menu.querySelectorAll('a[href], button') : [])].filter(Boolean)
      const i = items.indexOf(document.activeElement)
      if (e.shiftKey && i <= 0) {
        e.preventDefault()
        items[items.length - 1].focus()
      } else if (!e.shiftKey && (i === -1 || i === items.length - 1)) {
        e.preventDefault()
        items[0].focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, stop, start])

  return (
    <>
      <header ref={rootRef} className={`nav${open ? ' is-open' : ''}`}>
        <div className="nav__bar container">
          <div className="nav__intro nav__left">
            <Wordmark />
          </div>
          <div className="nav__intro nav__center">
            <LinkPill />
          </div>
          <div className="nav__intro nav__right">
            <p className="nav__status t-mono">
              <span className="rec-dot" aria-hidden="true" /> {SITE.availability}
            </p>
            <Button to="/#contact" variant="glass" size="sm" className="nav__cta">
              {CTA_LINES.primary}
            </Button>
            <Glass
              as="button"
              ref={burgerRef}
              radius={999}
              tone="dark"
              className="nav__burger"
              aria-expanded={open}
              aria-controls="mobile-menu"
              aria-label={open ? 'Close menu' : 'Open menu'}
              onClick={() => setOpen((o) => !o)}
            >
              <span className="nav__burger-lines" aria-hidden="true">
                <span />
                <span />
              </span>
            </Glass>
          </div>
        </div>
      </header>
      <MobileMenu open={open} onClose={() => setOpen(false)} />
    </>
  )
}
