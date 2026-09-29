import { Fragment, startTransition, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'react-router'
import Glass from '../components/LiquidGlass'
import Button, { ArrowIcon } from '../components/Button'
import VerticalVideo, { AdCaption } from '../components/VerticalVideo'
import SplitReveal from '../components/SplitReveal'
import { Eyebrow } from '../components/Primitives'
import { TLink } from '../app/PageTransition'
import { useReady, useScroll } from '../app/context'
import { gsap, ScrollTrigger, Flip, useGSAP, EASE } from '../lib/gsap'
import { MQ, prefersReducedMotion } from '../lib/env'
import { useFinePointer, useIsDesktop, useIsMobile } from '../lib/hooks'
import { toShort } from '../lib/timecode'
import { CTA_LINES, SITE } from '../data/site'
import { FORMATS, PRODUCTION, PROJECTS, STYLES } from '../data/projects'
import './Work.css'

/* ==========================================================================
   Filter model — AND across groups, single-select per group, 'All' = off
   ========================================================================== */
const ALL = 'All'
const GROUPS = [
  { key: 'format', label: 'Format', all: 'All formats', options: FORMATS, test: (p, v) => p.format === v },
  { key: 'style', label: 'Style', all: 'All styles', options: STYLES, test: (p, v) => p.styles.includes(v) },
  { key: 'production', label: 'Production', all: 'All production', options: PRODUCTION, test: (p, v) => p.production.includes(v) },
]
const NO_FILTERS = { format: ALL, style: ALL, production: ALL }
const TOTAL = PROJECTS.length

const pad2 = (n) => String(n).padStart(2, '0')
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`
const matches = (p, f) => GROUPS.every((g) => f[g.key] === ALL || g.test(p, f[g.key]))
const countWith = (f) => PROJECTS.reduce((n, p) => n + (matches(p, f) ? 1 : 0), 0)
const activeCount = (f) => GROUPS.reduce((n, g) => n + (f[g.key] === ALL ? 0 : 1), 0)
const sameFilters = (a, b) => GROUPS.every((g) => a[g.key] === b[g.key])

/** Query → filters. Case-insensitive, unknown values fall back to 'All'. */
function readFilters(params) {
  const out = {}
  GROUPS.forEach((g) => {
    const raw = (params.get(g.key) ?? '').trim().toLowerCase()
    out[g.key] = g.options.find((o) => o.toLowerCase() === raw) ?? ALL
  })
  return out
}

const YEARS = (() => {
  const ys = PROJECTS.map((p) => p.year)
  const a = Math.min(...ys)
  const b = Math.max(...ys)
  return a === b ? String(a) : `${a}–${b}`
})()
const FORMAT_COUNTS = FORMATS.map((f) => ({ f, n: PROJECTS.filter((p) => p.format === f).length }))
const FORMAT_MAX = Math.max(1, ...FORMAT_COUNTS.map((c) => c.n))

const SHOT_BELOW = 'inset(100% 0% 0% 0%)'
const SHOT_ABOVE = 'inset(0% 0% 100% 0%)'
const SHOT_SHOWN = 'inset(0% 0% 0% 0%)'
const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'

const cssPx = (el, prop, fallback) => {
  const v = parseFloat(getComputedStyle(el).getPropertyValue(prop))
  return Number.isFinite(v) ? v : fallback
}

function trapFocus(e, container) {
  if (!container) return
  const nodes = Array.from(container.querySelectorAll(FOCUSABLE)).filter((n) => n.getClientRects().length > 0)
  if (!nodes.length) return
  const first = nodes[0]
  const last = nodes[nodes.length - 1]
  const cur = document.activeElement
  if (!container.contains(cur) || cur === container) {
    e.preventDefault()
    ;(e.shiftKey ? last : first).focus()
  } else if (e.shiftKey && cur === first) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && cur === last) {
    e.preventDefault()
    first.focus()
  }
}

/* ==========================================================================
   Icons
   ========================================================================== */
function Chevron() {
  return (
    <svg className="wx-dd__chev" viewBox="0 0 12 12" width="12" height="12" fill="none" aria-hidden="true" focusable="false">
      <path d="M2.75 4.5 6 7.75 9.25 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function GridIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true" focusable="false">
      <rect x="2" y="2" width="4.5" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.3" />
      <rect x="9.5" y="2" width="4.5" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.3" />
      <rect x="2" y="9.5" width="4.5" height="4.5" rx="1.2" stroke="currentColor" strokeWidth="1.3" />
      <rect x="9.5" y="9.5" width="4.5" height="4.5" rx="1.2" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  )
}
function ListIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true" focusable="false">
      <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}
function FilterIcon() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" fill="none" aria-hidden="true" focusable="false">
      <path d="M2 4.5h7M12.5 4.5H14M2 11.5h2M7.5 11.5H14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="10.75" cy="4.5" r="1.75" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="5.75" cy="11.5" r="1.75" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  )
}
function CloseIcon({ size = 12 }) {
  return (
    <svg viewBox="0 0 12 12" width={size} height={size} fill="none" aria-hidden="true" focusable="false">
      <path d="M3 3l6 6M9 3 3 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

/* ==========================================================================
   Desktop filter — select-only combobox (WAI-ARIA APG): focus stays on the
   button, arrows move aria-activedescendant through a Glass listbox.
   ========================================================================== */
function Dropdown({ group, value, filters, onSelect }) {
  const rootRef = useRef(null)
  const popRef = useRef(null)
  const prevValue = useRef(value)
  const typed = useRef({ s: '', t: -1e9 })
  const uid = useId()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)

  const options = [ALL, ...group.options]
  const current = Math.max(0, options.indexOf(value))
  const labelId = `${uid}-l`
  const listId = `${uid}-lb`
  const optId = (i) => `${uid}-o${i}`

  const show = (i = current) => {
    setActive(i)
    setOpen(true)
  }
  const hide = () => setOpen(false)
  const choose = (i) => {
    setOpen(false)
    if (options[i] !== value) onSelect(group.key, options[i])
  }

  // Pointer outside closes
  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  // Type-ahead: jump to the next option starting with the typed letters
  const typeAhead = (char, stamp) => {
    const t = typed.current
    t.s = stamp - t.t > 700 ? char.toLowerCase() : t.s + char.toLowerCase()
    t.t = stamp
    const from = open ? active : current
    const n = options.length
    for (let k = t.s.length === 1 ? 1 : 0; k <= n; k++) {
      const i = (from + k) % n
      const label = (options[i] === ALL ? group.all : options[i]).toLowerCase()
      if (label.startsWith(t.s)) return i
    }
    return -1
  }

  const onKeyDown = (e) => {
    const n = options.length
    const { key } = e
    if (key.length === 1 && key !== ' ' && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const i = typeAhead(key, e.timeStamp)
      if (i >= 0) {
        e.preventDefault()
        if (open) setActive(i)
        else show(i)
      }
      return
    }
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' ', 'Home', 'End'].includes(key)) {
        e.preventDefault()
        show(key === 'Home' ? 0 : key === 'End' ? n - 1 : current)
      }
      return
    }
    switch (key) {
      case 'ArrowDown':
        e.preventDefault()
        setActive((a) => Math.min(n - 1, a + 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setActive((a) => Math.max(0, a - 1))
        break
      case 'Home':
      case 'PageUp':
        e.preventDefault()
        setActive(0)
        break
      case 'End':
      case 'PageDown':
        e.preventDefault()
        setActive(n - 1)
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        choose(active)
        break
      case 'Escape':
        e.preventDefault()
        e.stopPropagation()
        hide()
        break
      case 'Tab':
        hide()
        break
      default:
    }
  }

  // Value rolls in from below when it changes (same language as the buttons)
  useGSAP(
    () => {
      if (prevValue.current === value) return
      prevValue.current = value
      if (prefersReducedMotion()) return
      gsap.fromTo('.wx-dd__cur', { yPercent: 105 }, { yPercent: 0, duration: 0.7, ease: EASE.out })
    },
    { scope: rootRef, dependencies: [value] },
  )

  // Popover in / out. Opacity < 1 on the Glass root would make it its own
  // backdrop root (the blur would snap on at the end), so the root only moves
  // and toggles visibility while its layers fade.
  useGSAP(
    () => {
      const pop = popRef.current
      if (!pop) return
      const layers = Array.from(pop.children).filter((el) => el.tagName.toLowerCase() !== 'svg')
      const opts = pop.querySelectorAll('.wx-opt')
      const reduce = prefersReducedMotion()
      gsap.killTweensOf([pop, ...layers, ...opts])
      if (open) {
        gsap.set(pop, { visibility: 'visible' })
        gsap.fromTo(layers, { opacity: 0 }, { opacity: 1, duration: reduce ? 0.2 : 0.4, ease: 'power2.out' })
        if (reduce) return
        gsap.fromTo(pop, { y: -8, scale: 0.97 }, { y: 0, scale: 1, duration: 0.55, ease: EASE.out })
        gsap.fromTo(opts, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.025, delay: 0.04, ease: EASE.out })
      } else {
        gsap
          .timeline()
          .to(layers, { opacity: 0, duration: reduce ? 0.15 : 0.22, ease: 'power2.out' }, 0)
          .to(pop, { y: reduce ? 0 : -4, duration: 0.25, ease: 'power2.out' }, 0)
          .set(pop, { visibility: 'hidden' })
      }
    },
    { scope: rootRef, dependencies: [open] },
  )

  return (
    <div ref={rootRef} className={`wx-dd${open ? ' is-open' : ''}${value !== ALL ? ' is-set' : ''}`}>
      <button
        type="button"
        role="combobox"
        className="wx-dd__btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-labelledby={labelId}
        aria-activedescendant={open ? optId(active) : undefined}
        onClick={() => (open ? hide() : show())}
        onKeyDown={onKeyDown}
        onKeyUp={(e) => {
          if (e.key === ' ') e.preventDefault()
        }}
        onBlur={hide}
      >
        <span id={labelId} className="wx-dd__label t-mono" aria-hidden="true">
          {group.label}
        </span>
        <span className="wx-dd__value">
          <span className="wx-dd__sizer" aria-hidden="true">
            {options.map((o) => (
              <span key={o}>{o}</span>
            ))}
          </span>
          <span key={value} className="wx-dd__cur">
            {value}
          </span>
        </span>
        <Chevron />
      </button>

      <Glass ref={popRef} className="wx-dd__pop" radius={20} tone="dark" bezel={0.1} blur={14}>
        <ul
          id={listId}
          role="listbox"
          aria-labelledby={labelId}
          className="wx-dd__list"
          onMouseDown={(e) => e.preventDefault()}
        >
          {options.map((o, i) => {
            const n = countWith({ ...filters, [group.key]: o })
            const selected = o === value
            return (
              <li
                key={o}
                id={optId(i)}
                role="option"
                aria-selected={selected}
                className={`wx-opt${i === active ? ' is-active' : ''}${selected ? ' is-selected' : ''}${n === 0 ? ' is-empty' : ''}`}
                onPointerEnter={() => setActive(i)}
                onClick={() => choose(i)}
              >
                <span className="wx-opt__mark" aria-hidden="true" />
                <span className="wx-opt__name">{o === ALL ? group.all : o}</span>
                <span className="wx-opt__n t-mono" aria-hidden="true">
                  {pad2(n)}
                </span>
                <span className="sr-only">, {plural(n, 'project')}</span>
              </li>
            )
          })}
        </ul>
      </Glass>
    </div>
  )
}

/* ==========================================================================
   Touch filter — bottom sheet with staged (draft) filters
   ========================================================================== */
function FilterSheet({ filters, onApply, onClose }) {
  const rootRef = useRef(null)
  const panelRef = useRef(null)
  const closing = useRef(false)
  const uid = useId()
  const [draft, setDraft] = useState(filters)
  const { stop, start } = useScroll()
  const count = countWith(draft)
  const nDraft = activeCount(draft)

  // Layout effect so the lock is released before the page runs its Flip
  useLayoutEffect(() => {
    stop()
    return () => start()
  }, [stop, start])

  useGSAP(
    () => {
      const panel = panelRef.current
      const scrim = rootRef.current.querySelector('.wx-sheet__scrim')
      const parts = panel.querySelectorAll('.wx-sheet__group, .wx-sheet__foot')
      const layers = Array.from(panel.children)
      // handlers below animate these outside the context — kill them on unmount
      const cleanup = () => gsap.killTweensOf([panel, scrim, ...layers])
      panel.focus({ preventScroll: true })
      if (prefersReducedMotion()) {
        // fade the panel's layers, not the Glass root (keeps its backdrop blur live)
        gsap.fromTo([scrim, ...layers], { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'power1.out' })
        return cleanup
      }
      gsap
        .timeline()
        .fromTo(scrim, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: 'power2.out' }, 0)
        .fromTo(panel, { yPercent: 100 }, { yPercent: 0, duration: 0.85, ease: EASE.out }, 0)
        .fromTo(parts, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.8, stagger: 0.06, ease: EASE.out }, 0.12)
      return cleanup
    },
    { scope: rootRef },
  )

  const close = (after) => {
    if (closing.current) return
    closing.current = true
    const panel = panelRef.current
    const scrim = rootRef.current?.querySelector('.wx-sheet__scrim')
    const reduce = prefersReducedMotion()
    const done = () => {
      onClose()
      if (typeof after === 'function') after()
    }
    if (!panel || !scrim) {
      done()
      return
    }
    const tl = gsap.timeline({ onComplete: done })
    if (reduce) tl.to(Array.from(panel.children), { opacity: 0, duration: 0.25, ease: 'power1.out' }, 0)
    else tl.to(panel, { yPercent: 100, duration: 0.6, ease: EASE.inOut }, 0)
    tl.to(scrim, { opacity: 0, duration: reduce ? 0.25 : 0.5, ease: 'power2.out' }, reduce ? 0 : 0.08)
  }

  // Drag the header down to dismiss
  const onGrab = (e) => {
    if (closing.current || (e.pointerType === 'mouse' && e.button !== 0)) return
    if (e.target instanceof Element && e.target.closest('button')) return
    const head = e.currentTarget
    const panel = panelRef.current
    if (!panel) return
    const y0 = e.clientY
    let dy = 0
    let vy = 0
    let lastY = y0
    let lastT = e.timeStamp
    head.setPointerCapture?.(e.pointerId)
    gsap.killTweensOf(panel, 'y')
    const move = (ev) => {
      dy = Math.max(0, ev.clientY - y0)
      vy = (ev.clientY - lastY) / Math.max(1, ev.timeStamp - lastT)
      lastY = ev.clientY
      lastT = ev.timeStamp
      gsap.set(panel, { y: dy })
    }
    const end = () => {
      head.removeEventListener('pointermove', move)
      head.removeEventListener('pointerup', end)
      head.removeEventListener('pointercancel', end)
      if (dy > 110 || vy > 0.7) close()
      else gsap.to(panel, { y: 0, duration: 0.6, ease: EASE.out })
    }
    head.addEventListener('pointermove', move)
    head.addEventListener('pointerup', end)
    head.addEventListener('pointercancel', end)
  }

  // Escape + focus trap (re-bound each render so `close` is always current)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
      } else if (e.key === 'Tab') trapFocus(e, panelRef.current)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  // Crossing into desktop swaps the sheet for the inline dropdowns
  useEffect(() => {
    const m = window.matchMedia(MQ.desktop)
    const onChange = () => {
      if (m.matches) onClose()
    }
    m.addEventListener('change', onChange)
    return () => m.removeEventListener('change', onChange)
  }, [onClose])

  const pick = (key, o) => setDraft((d) => ({ ...d, [key]: d[key] === o && o !== ALL ? ALL : o }))

  return (
    <div ref={rootRef} className="wx-sheet">
      <div className="wx-sheet__scrim" aria-hidden="true" onClick={() => close()} />
      <Glass
        ref={panelRef}
        className="wx-sheet__panel"
        radius="28px 28px 0 0"
        tone="dark"
        refract={false}
        blur={26}
        interactive={false}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${uid}-t`}
        tabIndex={-1}
      >
        <div className="wx-sheet__head" onPointerDown={onGrab}>
          <span className="wx-sheet__grab" aria-hidden="true" />
          <div className="wx-sheet__bar">
            <h2 id={`${uid}-t`} className="wx-sheet__title t-h4">
              Filters
            </h2>
            <div className="wx-sheet__tools">
              <button
                type="button"
                className="wx-sheet__reset t-mono"
                aria-disabled={nDraft === 0}
                onClick={() => {
                  if (nDraft) setDraft(NO_FILTERS)
                }}
              >
                Reset
              </button>
              <button type="button" className="wx-sheet__close" onClick={() => close()} aria-label="Close filters">
                <CloseIcon size={14} />
              </button>
            </div>
          </div>
        </div>

        <div className="wx-sheet__body" data-lenis-prevent>
          {GROUPS.map((g) => (
            <div key={g.key} className="wx-sheet__group" role="group" aria-labelledby={`${uid}-${g.key}`}>
              <p id={`${uid}-${g.key}`} className="wx-sheet__label t-mono">
                {g.label}
              </p>
              <div className="wx-sheet__chips">
                {[ALL, ...g.options].map((o) => {
                  const on = draft[g.key] === o
                  const n = countWith({ ...draft, [g.key]: o })
                  return (
                    <button
                      key={o}
                      type="button"
                      className={`wx-schip${on ? ' is-on' : ''}`}
                      aria-pressed={on}
                      disabled={!on && n === 0}
                      onClick={() => pick(g.key, o)}
                    >
                      <span>{o}</span>
                      <span className="wx-schip__n t-mono" aria-hidden="true">
                        {n}
                      </span>
                      <span className="sr-only">, {plural(n, 'project')}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="wx-sheet__foot">
          <Button className="wx-sheet__show" onClick={() => close(() => onApply(draft))} disabled={count === 0}>
            {count === 0 ? 'No matches' : `Show ${plural(count, 'result')}`}
          </Button>
        </div>
      </Glass>
    </div>
  )
}

/* ==========================================================================
   Grid card / list row / list preview frame
   ========================================================================== */
function Card({ project, index, compact, activeStyle }) {
  const { slug, title, kicker, format, formatLabel, runtime, year, styles, poster, video, caption, captionHl } = project
  return (
    <TLink
      to={`/work/${slug}`}
      label={title}
      kicker="Case study"
      className="wx-card"
      data-cursor="view"
      aria-label={`${title} — ${formatLabel}, ${toShort(runtime)}, ${year}. View case study`}
    >
      <div className="wx-card__media">
        <VerticalVideo
          src={video}
          poster={poster}
          mode="auto"
          label={compact ? format : formatLabel}
          meta={toShort(runtime)}
          caption={caption}
          captionHl={captionHl}
          className="wx-card__vv"
        />
      </div>
      <div className="wx-card__info">
        <div className="wx-card__head">
          <h3 className="wx-card__title t-h4">{title}</h3>
          <span className="wx-card__idx t-mono" aria-hidden="true">
            <span className="wx-card__roll">
              <span>{pad2(index + 1)}</span>
              <span>
                <ArrowIcon dir="up-right" />
              </span>
            </span>
          </span>
        </div>
        <p className="wx-card__kicker t-small t-dim">{kicker}</p>
        <ul className="wx-card__chips">
          {styles.map((s) => (
            <li key={s} className={`chip wx-card__chip${s === activeStyle ? ' is-hl' : ''}`}>
              {s}
            </li>
          ))}
        </ul>
      </div>
    </TLink>
  )
}

function Row({ project, index, activeStyle }) {
  const { slug, title, formatLabel, runtime, year, styles, poster } = project
  return (
    <TLink
      to={`/work/${slug}`}
      label={title}
      kicker="Case study"
      className="wx-row__link"
      data-cursor="view"
      aria-label={`${title} — ${formatLabel}, ${styles.join(' and ')}, ${toShort(runtime)}, ${year}. View case study`}
    >
      <span className="wx-row__in">
        <span className="wx-row__idx t-mono">{pad2(index + 1)}</span>
        <span className="wx-row__thumb">
          <img className="wx-row__img" src={poster} alt="" loading="lazy" decoding="async" draggable="false" />
        </span>
        <span className="wx-row__main">
          <span className="wx-row__title t-h3">{title}</span>
          <span className="wx-row__sub t-mono">
            {formatLabel} <span aria-hidden="true">·</span> {toShort(runtime)} <span aria-hidden="true">·</span> {year}
          </span>
        </span>
        <span className="wx-row__fmt t-mono">{formatLabel}</span>
        <span className="wx-row__styles t-small">
          {styles.map((s) => (
            <span key={s} className={`wx-row__style${s === activeStyle ? ' is-hl' : ''}`}>
              {s}
            </span>
          ))}
        </span>
        <span className="wx-row__rt t-mono">{toShort(runtime)}</span>
        <span className="wx-row__yr t-mono">{year}</span>
        <span className="wx-row__arrow" aria-hidden="true">
          <span className="wx-row__arrow-a">
            <ArrowIcon />
          </span>
          <span className="wx-row__arrow-b">
            <ArrowIcon />
          </span>
        </span>
      </span>
      <span className="wx-row__rule" aria-hidden="true" />
      <span className="wx-row__line" aria-hidden="true" />
    </TLink>
  )
}

function Shot({ project, index }) {
  return (
    <div className="wx-shot" data-slug={project.slug}>
      <img className="wx-shot__img" src={project.poster} alt="" loading="lazy" decoding="async" draggable="false" />
      <span className="wx-shot__shade" />
      <span className="wx-shot__crop cropmarks" />
      <div className="wx-shot__top t-mono">
        <span className="wx-shot__idx">
          <span className="wx-shot__dot" />
          {pad2(index + 1)} / {pad2(TOTAL)}
        </span>
        <span>{toShort(project.runtime)}</span>
      </div>
      {SITE.placeholderMode && <AdCaption className="wx-shot__cap" text={project.caption} hl={project.captionHl} />}
    </div>
  )
}

function Empty({ onReset }) {
  return (
    <div className="wx-empty">
      <div className="wx-empty__frame cropmarks" aria-hidden="true">
        <span className="wx-empty__rec t-mono">
          <span className="wx-empty__dot" />
          No signal
        </span>
        <span className="wx-empty__tc t-mono">00:00:00:00</span>
      </div>
      <div className="wx-empty__body">
        <p className="t-mono t-mute">00 results</p>
        <p className="wx-empty__title t-h3">No projects match that combination.</p>
        <p className="wx-empty__hint t-body">Loosen one filter, or reset and browse all {TOTAL} projects.</p>
        <Button size="md" icon={false} onClick={onReset}>
          Reset filters
        </Button>
      </div>
    </div>
  )
}

/* ==========================================================================
   /work — the full index
   ========================================================================== */
export default function Work() {
  const rootRef = useRef(null)
  const indexRef = useRef(null)
  const barRef = useRef(null)
  const statusRef = useRef(null)
  const resultsRef = useRef(null)
  const listRef = useRef(null)
  const previewRef = useRef(null)
  const fbtnRef = useRef(null)
  const flipRef = useRef(null)
  const focusAfter = useRef(null)
  const refreshCall = useRef(null)
  const deferCall = useRef(null)
  const switching = useRef(false)
  const restoreAfterSwitch = useRef(false)
  const viewSwitched = useRef(false)
  const prevView = useRef(null)
  const prevCount = useRef(null)

  const [params, setParams] = useSearchParams()
  const [pendingView, setPendingView] = useState(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const { ready } = useReady()
  const { scrollTo } = useScroll()
  const desktop = useIsDesktop()
  const mobile = useIsMobile()
  const fine = useFinePointer()

  const filters = readFilters(params)
  const view = params.get('view') === 'list' ? 'list' : 'grid'
  const shownView = pendingView ?? view
  const previewOn = desktop && fine && view === 'list'
  const count = countWith(filters)
  const nActive = activeCount(filters)
  const sig = GROUPS.map((g) => filters[g.key]).join('|')
  const activeGroups = GROUPS.filter((g) => filters[g.key] !== ALL)
  const liveText = `${count ? `Showing ${count} of ${TOTAL} projects` : 'No projects match these filters'}${
    activeGroups.length ? `, filtered by ${activeGroups.map((g) => filters[g.key]).join(', ')}` : ''
  }`

  useEffect(() => {
    document.title = `All work — ${SITE.name}`
  }, [])

  /* ------------------------------------------------------------------------
     Sticky filter bar ↔ auto-hiding nav. The bar sticks at 16px; while the
     nav is showing it glides down to sit beneath it (mirrors the nav's own
     show/hide rules and eases, so the two move as one).
     ------------------------------------------------------------------------ */
  useGSAP(
    () => {
      const bar = barRef.current
      const section = indexRef.current
      const results = resultsRef.current
      if (!bar || !section) return
      const gapOf = () => Math.max(0, cssPx(document.documentElement, '--nav-h', 76) + 8 - cssPx(bar, 'top', 16))
      let gap = gapOf()
      const measure = ScrollTrigger.create({
        trigger: section,
        start: () => `top ${cssPx(bar, 'top', 16)}px`,
        end: 'bottom top',
        onRefresh: () => {
          gap = gapOf()
        },
      })
      const nav = { p: 1 }
      const setY = gsap.quickSetter(bar, 'y', 'px')
      let room = 0
      let shown = true
      let last = window.scrollY
      const render = () => setY(nav.p * room)
      ScrollTrigger.create({
        start: 0,
        end: 'max',
        onUpdate: (self) => {
          const y = self.scroll()
          if (y > last + 2 && y > 240 && shown) {
            shown = false
            gsap.to(nav, { p: 0, duration: 0.7, ease: EASE.inOut, overwrite: true, onUpdate: render })
          } else if ((y < last - 2 || y < 120) && !shown) {
            shown = true
            gsap.to(nav, { p: 1, duration: 0.8, ease: EASE.out, overwrite: true, onUpdate: render })
          }
          last = y
          room = Number.isFinite(measure.start) ? gsap.utils.clamp(0, gap, y - measure.start + gap) : 0
          render()
        },
      })

      // CTA band: lead + actions settle in after the headline (opacity only,
      // so the button stays reachable by Tab before it has revealed)
      const reduce = prefersReducedMotion()
      gsap.from('.wx-cta__lead, .wx-cta__actions', {
        opacity: 0,
        y: reduce ? 0 : 22,
        duration: reduce ? 0.6 : 1.2,
        delay: 0.2,
        stagger: 0.1,
        ease: reduce ? 'power1.out' : EASE.out,
        scrollTrigger: { trigger: '.wx-cta', start: 'top 78%', once: true },
      })

      // Handlers + callbacks below create tweens outside this context: kill them on unmount
      return () => {
        gsap.killTweensOf(nav)
        if (results) gsap.killTweensOf(results)
        refreshCall.current?.kill()
        deferCall.current?.kill()
      }
    },
    { scope: rootRef },
  )

  /* ------------------------------------------------------------------------
     Actions
     ------------------------------------------------------------------------ */
  const scheduleRefresh = () => {
    refreshCall.current?.kill()
    refreshCall.current = gsap.delayedCall(0.12, () => ScrollTrigger.refresh())
  }

  // Build the next query from the live URL so queued writes never clobber each other
  const writeParams = (next) => {
    setParams(
      () => {
        const p = new URLSearchParams(window.location.search)
        Object.entries(next).forEach(([k, v]) => {
          if (!v || v === ALL || (k === 'view' && v === 'grid')) p.delete(k)
          else p.set(k, v)
        })
        return p
      },
      { replace: true, preventScrollReset: true },
    )
  }

  /** Bring the results into view (always when forced, else only if scrolled past them) */
  const revealResults = (force) => {
    const status = statusRef.current
    const bar = barRef.current
    if (!status || !bar) return
    const top = status.getBoundingClientRect().top
    if (!force && top >= 0) return
    const stick = cssPx(bar, 'top', 16)
    const navH = cssPx(document.documentElement, '--nav-h', 76)
    // Scrolling up brings the nav back (and the bar below it)
    const clearance = bar.offsetHeight + (top > 0 ? stick : navH + 8) + 20
    scrollTo(status, { offset: -clearance, duration: 1.3, force: true, immediate: prefersReducedMotion() })
  }

  const apply = (partial, opts = {}) => {
    const next = { ...filters, ...partial }
    const scroll = () => revealResults(Boolean(opts.scroll))
    if (sameFilters(next, filters)) {
      if (opts.scroll) scroll()
      return
    }
    const results = resultsRef.current
    if (results && !prefersReducedMotion()) {
      // Record height first: getState() fast-forwards any in-flight flip
      const height = results.offsetHeight
      flipRef.current = { state: Flip.getState(results.querySelectorAll('.wx-item, .wx-row')), height }
    } else {
      flipRef.current = { state: null, height: 0 }
    }
    writeParams(next)
    deferCall.current?.kill()
    // After the sheet: wait for it to unmount (Lenis restarts, which resets any scroll in flight)
    if (opts.defer) deferCall.current = gsap.delayedCall(0.12, scroll)
    else scroll()
  }

  const onSelect = (key, v) => apply({ [key]: v })
  const removeFilter = (key, i) => {
    focusAfter.current = i
    apply({ [key]: ALL })
  }
  const clearAll = () => {
    focusAfter.current = -1
    apply(NO_FILTERS)
  }
  const onLegend = (f) => apply({ format: filters.format === f ? ALL : f }, { scroll: true })

  const switchView = (v) => {
    if (v === shownView || switching.current) return
    switching.current = true
    viewSwitched.current = true
    setPendingView(v)
    revealResults(false)
    const done = () => {
      switching.current = false
      restoreAfterSwitch.current = true
      // Router updates are transitions: clear the pending view in the same one so
      // the toggle never commits a frame back on the old layout
      startTransition(() => {
        setPendingView(null)
        writeParams({ view: v })
      })
    }
    const results = resultsRef.current
    if (!results) {
      done()
      return
    }
    const reduce = prefersReducedMotion()
    gsap.to(results, {
      autoAlpha: 0,
      y: reduce ? 0 : 14,
      duration: reduce ? 0.2 : 0.4,
      ease: EASE.inOut,
      overwrite: 'auto', // never kill an in-flight Flip height tween
      onComplete: done,
    })
  }

  const openSheet = () => setSheetOpen(true)
  const closeSheet = () => {
    setSheetOpen(false)
    fbtnRef.current?.focus({ preventScroll: true })
  }

  /* ------------------------------------------------------------------------
     Intro — waits for the preloader on a cold load; plays under the lifting
     curtain on a route change (ready is already true then)
     ------------------------------------------------------------------------ */
  useGSAP(
    () => {
      const q = gsap.utils.selector(rootRef)
      const fades = q('.wx-in')
      const rows = q('.wx-legend__row')
      const fills = q('.wx-legend__fill')
      const count = q('.wx-hero__count')
      const rule = q('.wx-hero__rule')
      const bar = q('.wx-in-bar')
      const status = q('.wx-status')
      const all = [...fades, ...rows, ...count, ...bar, ...status]
      if (!ready) {
        gsap.set(all, { autoAlpha: 0 })
        gsap.set(rule, { scaleX: 0 })
        return
      }
      const tl = gsap.timeline({ delay: 0.3 })
      if (prefersReducedMotion()) {
        tl.set(rule, { scaleX: 1 }).fromTo([...all, ...rule], { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6, stagger: 0.02, ease: 'power1.out' })
        return
      }
      tl.fromTo(rule, { scaleX: 0 }, { scaleX: 1, duration: 1.6, ease: EASE.inOut }, 0)
        .fromTo(fades, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 1.1, stagger: 0.08, ease: EASE.out }, 0.2)
        .fromTo(rows, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.06, ease: EASE.out }, 0.4)
        .from(fills, { scaleX: 0, duration: 1.3, stagger: 0.06, ease: EASE.inOut }, 0.55)
        .fromTo(count, { autoAlpha: 0, yPercent: 60 }, { autoAlpha: 1, yPercent: 0, duration: 0.9, ease: EASE.out }, 0.8)
        .fromTo(bar, { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 1.1, stagger: 0.08, ease: EASE.out }, 0.5)
        .fromTo(status, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.8, ease: 'power1.out' }, 0.8)
    },
    { scope: rootRef, dependencies: [ready] },
  )

  /* ------------------------------------------------------------------------
     First-view reveal of the current layout (re-armed on grid ↔ list).
     Opacity only on the hidden state so unrevealed cards stay focusable.
     ------------------------------------------------------------------------ */
  useGSAP(
    (ctx, safe) => {
      const results = resultsRef.current
      if (!results) return
      const grid = view === 'grid'
      const items = gsap.utils.toArray(results.querySelectorAll(grid ? '.wx-item:not(.is-out)' : '.wx-row:not(.is-out)'))
      if (!items.length) return
      const reduce = prefersReducedMotion()
      const bodyOf = (el) => el.querySelector(grid ? '.wx-card' : '.wx-row__in')
      const ruleOf = (el) => el.querySelector('.wx-row__rule')
      gsap.set(items.map(bodyOf), { opacity: 0 })
      if (!grid && !reduce) gsap.set(items.map(ruleOf), { scaleX: 0 })
      if (!ready) return

      const lead = viewSwitched.current ? 0.05 : 0.6
      let opening = true
      gsap.delayedCall(0.3, () => {
        opening = false
      })
      ScrollTrigger.batch(items, {
        start: 'top 94%',
        once: true,
        onEnter: safe((batch) => {
          const delay = opening ? lead : 0
          const bodies = batch.map(bodyOf)
          if (reduce) {
            gsap.to(bodies, { opacity: 1, duration: 0.6, stagger: 0.05, delay, ease: 'power1.out' })
            return
          }
          gsap.fromTo(
            bodies,
            { y: grid ? 72 : 26 },
            { y: 0, opacity: 1, duration: grid ? 1.3 : 1.1, stagger: grid ? 0.09 : 0.06, delay, ease: EASE.out },
          )
          if (!grid) gsap.to(batch.map(ruleOf), { scaleX: 1, duration: 1.4, stagger: 0.06, delay, ease: EASE.inOut })
        }),
      })
    },
    { scope: rootRef, dependencies: [view, ready], revertOnUpdate: true },
  )

  // Switch settled — bring the (faded) results back; the reveal above re-staggers them.
  // Keyed on the switch finishing, not only on `view` changing: two quick switches can
  // commit together and land back on the same layout, which must still fade back in
  useGSAP(
    () => {
      // still in flight: its own fade's onComplete commits it (don't kill that tween)
      if (pendingView !== null || switching.current) return
      const changed = prevView.current !== null && prevView.current !== view
      prevView.current = view
      if (!changed && !restoreAfterSwitch.current) return
      restoreAfterSwitch.current = false
      const results = resultsRef.current
      if (results) {
        // a flip on the old layout may still hold the height
        gsap.killTweensOf(results)
        gsap.set(results, { clearProps: 'opacity,visibility,transform,height' })
      }
      scheduleRefresh()
    },
    { scope: rootRef, dependencies: [view, pendingView] },
  )

  /* ------------------------------------------------------------------------
     Filtering — Flip from the recorded state to the new layout. Leavers fade
     and shrink out where they stood, entrants scale up in place, the rest
     glide; the container height eases so the page below never jumps.
     ------------------------------------------------------------------------ */
  useGSAP(
    () => {
      const pending = flipRef.current
      flipRef.current = null
      const results = resultsRef.current
      if (!pending || !results) return
      const empty = results.querySelector('.wx-empty')

      if (!pending.state) {
        gsap.fromTo(results, { opacity: 0 }, { opacity: 1, duration: 0.35, ease: 'power1.out', clearProps: 'opacity' })
        scheduleRefresh()
        return
      }

      const targets = pending.state.targets
      const to = results.offsetHeight // measured before Flip makes everything absolute
      const tl = Flip.from(pending.state, {
        duration: 0.7,
        ease: EASE.out,
        absolute: true,
        onEnter: (els) =>
          gsap.fromTo(els, { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.7, delay: 0.1, stagger: 0.05, ease: EASE.out }),
        onLeave: (els) => gsap.to(els, { opacity: 0, scale: 0.9, duration: 0.45, ease: 'power2.out' }),
        onComplete: () => {
          gsap.set(results, { clearProps: 'height' })
          gsap.set(targets, { clearProps: 'opacity,transform' })
          scheduleRefresh()
        },
      })
      tl.fromTo(results, { height: pending.height }, { height: to, duration: 0.7, ease: EASE.out }, 0)
      if (empty) tl.fromTo(empty, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.9, ease: EASE.out }, 0.3)
    },
    { scope: rootRef, dependencies: [sig] },
  )

  // Result count rolls like a timecode digit
  useGSAP(
    () => {
      const prev = prevCount.current
      prevCount.current = count
      if (prev === null || prev === count || prefersReducedMotion()) return
      const num = statusRef.current?.querySelector('.wx-count__num')
      if (num) gsap.fromTo(num, { yPercent: count > prev ? 100 : -100 }, { yPercent: 0, duration: 0.7, ease: EASE.out })
    },
    { scope: rootRef, dependencies: [count] },
  )

  // Keep keyboard focus alive when the control that had it disappears
  useEffect(() => {
    const want = focusAfter.current
    focusAfter.current = null
    if (want === null) return
    const chips = statusRef.current ? Array.from(statusRef.current.querySelectorAll('.wx-chip')) : []
    const target =
      want >= 0 && chips.length ? chips[Math.min(want, chips.length - 1)] : barRef.current?.querySelector('.wx-dd__btn, .wx-fbtn')
    target?.focus({ preventScroll: true })
  }, [sig])

  /* ------------------------------------------------------------------------
     List view — floating 9:16 preview that follows the cursor (desktop,
     fine pointer). Frames hard-cut with a wipe + punch-in as rows change.
     ------------------------------------------------------------------------ */
  useGSAP(
    () => {
      const list = listRef.current
      const preview = previewRef.current
      if (!previewOn || !list || !preview) return
      const frame = preview.querySelector('.wx-preview__frame')
      const shots = gsap.utils.toArray(preview.querySelectorAll('.wx-shot'))
      const bySlug = new Map(shots.map((s, i) => [s.dataset.slug, i]))
      const imgs = shots.map((s) => s.querySelector('.wx-shot__img'))
      const metas = shots.map((s) => s.querySelectorAll('.wx-shot__top, .wx-shot__cap'))
      const reduce = prefersReducedMotion()
      const clampRot = gsap.utils.clamp(-5, 5)

      gsap.set(preview, { xPercent: -50, yPercent: -50, x: 0, y: 0, rotation: 0 })
      gsap.set(frame, { autoAlpha: 0, scale: reduce ? 1 : 0.6 })
      gsap.set(shots, { clipPath: SHOT_BELOW })

      const xTo = gsap.quickTo(preview, 'x', { duration: 0.65, ease: 'power3' })
      const yTo = gsap.quickTo(preview, 'y', { duration: 0.65, ease: 'power3' })
      const rTo = gsap.quickTo(preview, 'rotation', { duration: 0.6, ease: 'power3' })

      let active = false
      let ticking = false
      let cur = -1
      let z = 1
      let px = 0
      let py = 0
      let lastX = null

      // Lean follows the frame's own lagged velocity, so it settles by itself
      const tick = (time, dt) => {
        const x = gsap.getProperty(preview, 'x')
        if (lastX !== null && dt > 0) rTo(clampRot(((x - lastX) / (dt / 16.667)) * 0.28))
        lastX = x
      }

      const place = (instant) => {
        const r = list.getBoundingClientRect()
        const half = preview.offsetWidth / 2
        const x = gsap.utils.clamp(half, Math.max(half, r.width - half), px - r.left)
        const y = py - r.top
        if (instant) {
          xTo(x, x)
          yTo(y, y)
        } else {
          xTo(x)
          yTo(y)
        }
      }

      const swap = (i) => {
        if (i === cur || i < 0 || !shots[i]) return
        const next = shots[i]
        const hadPrev = cur >= 0
        const down = !hadPrev || i > cur
        z += 1
        next.style.zIndex = String(z)
        if (!hadPrev || reduce) {
          gsap.set(next, { clipPath: SHOT_SHOWN, overwrite: true })
          gsap.set(metas[i], { autoAlpha: 1, yPercent: 0, overwrite: true })
          if (reduce) gsap.set(imgs[i], { scale: 1, yPercent: 0, overwrite: true })
          else gsap.fromTo(imgs[i], { scale: 1.16, yPercent: 0 }, { scale: 1, duration: 1.2, ease: EASE.out, overwrite: true })
        } else {
          gsap.fromTo(next, { clipPath: down ? SHOT_BELOW : SHOT_ABOVE }, { clipPath: SHOT_SHOWN, duration: 0.8, ease: EASE.out, overwrite: true })
          gsap.fromTo(imgs[i], { yPercent: down ? 10 : -10, scale: 1.22 }, { yPercent: 0, scale: 1, duration: 1.1, ease: EASE.out, overwrite: true })
          gsap.fromTo(
            metas[i],
            { autoAlpha: 0, yPercent: 30 },
            { autoAlpha: 1, yPercent: 0, duration: 0.7, delay: 0.12, stagger: 0.05, ease: EASE.out, overwrite: true },
          )
          gsap.to(imgs[cur], { yPercent: down ? -8 : 8, duration: 0.8, ease: EASE.out, overwrite: true })
        }
        cur = i
      }

      const show = () => {
        if (active) return
        active = true
        gsap.to(frame, { autoAlpha: 1, scale: 1, duration: reduce ? 0.3 : 0.8, ease: EASE.out, overwrite: 'auto' })
        if (!reduce && !ticking) {
          lastX = null
          gsap.ticker.add(tick)
          ticking = true
        }
      }
      const hide = () => {
        if (!active) return
        active = false
        gsap.to(frame, { autoAlpha: 0, scale: reduce ? 1 : 0.6, duration: reduce ? 0.2 : 0.5, ease: 'power3.out', overwrite: 'auto' })
        if (ticking) {
          gsap.ticker.remove(tick)
          ticking = false
        }
        rTo(0)
      }

      const evaluate = (target) => {
        const el = target instanceof Element && list.contains(target) ? target : null
        const row = el?.closest('.wx-row')
        if (!row || row.classList.contains('is-out')) {
          hide()
          return
        }
        place(!active)
        swap(bySlug.get(row.dataset.slug) ?? -1)
        show()
      }

      const onMove = (e) => {
        if (e.pointerType === 'touch') return
        px = e.clientX
        py = e.clientY
        evaluate(e.target)
      }
      const onLeave = () => hide()
      // Content scrolling under a resting cursor keeps the frame on the right row
      const onScroll = () => {
        if (active) evaluate(document.elementFromPoint(px, py))
      }

      list.addEventListener('pointermove', onMove)
      list.addEventListener('pointerleave', onLeave)
      window.addEventListener('scroll', onScroll, { passive: true })
      return () => {
        list.removeEventListener('pointermove', onMove)
        list.removeEventListener('pointerleave', onLeave)
        window.removeEventListener('scroll', onScroll)
        gsap.ticker.remove(tick)
        gsap.killTweensOf([preview, frame, ...shots, ...imgs, ...metas.flatMap((m) => Array.from(m))])
      }
    },
    { scope: rootRef, dependencies: [previewOn], revertOnUpdate: true },
  )

  /* ------------------------------------------------------------------------
     Render
     ------------------------------------------------------------------------ */
  return (
    <div ref={rootRef} className="wx">
      {/* Hero ------------------------------------------------------------- */}
      <section className="wx-hero" data-hud="All work" aria-labelledby="wx-title">
        <div className="container">
          <div className="wx-hero__top">
            <Eyebrow className="wx-in">Index</Eyebrow>
            <p className="wx-hero__aside t-mono wx-in">
              <span className="tabular">{YEARS}</span>
              <span className="wx-hero__aside-x">
                <span aria-hidden="true"> · </span>Paid social
              </span>
              <span aria-hidden="true"> · </span>9:16
            </p>
            <span className="wx-hero__rule" aria-hidden="true" />
          </div>

          <div className="wx-hero__main">
            <div className="wx-hero__lede">
              <div className="wx-hero__title">
                {/* SplitText labels the element it splits, so the heading itself is split.
                    Re-keyed on `ready` so a cold load replays it once the preloader lifts. */}
                <SplitReveal key={ready ? 'go' : 'wait'} as="h1" id="wx-title" type="chars" delay={0.4} className="wx-hero__word t-mega">
                  All work
                </SplitReveal>
                <span className="wx-hero__count t-mono" aria-hidden="true">
                  ({pad2(TOTAL)})
                </span>
              </div>
              <p className="wx-hero__lead t-lead wx-in">
                AI story VSLs, explainers, hook tests, UGC and creator-led ads — filter by format, creative style or production type.
              </p>
            </div>

            <aside className="wx-legend" aria-label="Projects by format">
              <p className="wx-legend__head t-mono wx-in" aria-hidden="true">
                <span>Format</span>
                <span>Projects</span>
              </p>
              <ul className="wx-legend__list">
                {FORMAT_COUNTS.map(({ f, n }) => {
                  const on = filters.format === f
                  return (
                    <li key={f}>
                      <button
                        type="button"
                        className={`wx-legend__row${on ? ' is-on' : ''}`}
                        aria-pressed={on}
                        aria-label={`Filter by ${f}, ${plural(n, 'project')}`}
                        onClick={() => onLegend(f)}
                      >
                        <span className="wx-legend__name">{f}</span>
                        <span className="wx-legend__track" aria-hidden="true">
                          <span className="wx-legend__fill" style={{ '--wx-n': n / FORMAT_MAX }} />
                        </span>
                        <span className="wx-legend__n">{pad2(n)}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </aside>
          </div>
        </div>
      </section>

      {/* Index ------------------------------------------------------------ */}
      <section ref={indexRef} className="wx-index" data-hud="All work" aria-labelledby="wx-index-title">
        <h2 id="wx-index-title" className="sr-only">
          Project index
        </h2>
        <div ref={barRef} className="wx-bar">
          <div className="container wx-bar__row">
            {desktop ? (
              <Glass className="wx-pill wx-in-bar" radius={999} tone="dark" blur={8} role="group" aria-label="Filter projects">
                {GROUPS.map((g, i) => (
                  <Fragment key={g.key}>
                    {i > 0 && <span className="wx-pill__div" aria-hidden="true" />}
                    <Dropdown group={g} value={filters[g.key]} filters={filters} onSelect={onSelect} />
                  </Fragment>
                ))}
              </Glass>
            ) : (
              <Glass
                as="button"
                ref={fbtnRef}
                type="button"
                className={`wx-fbtn wx-in-bar${nActive ? ' is-set' : ''}`}
                radius={999}
                tone="dark"
                blur={8}
                aria-haspopup="dialog"
                aria-expanded={sheetOpen}
                onClick={openSheet}
              >
                <FilterIcon />
                <span className="wx-fbtn__txt">Filters</span>
                <span className="wx-fbtn__n t-mono" aria-hidden="true">
                  ({nActive})
                </span>
                <span className="sr-only">{nActive ? `, ${nActive} active` : ''}</span>
              </Glass>
            )}

            <Glass className="wx-view wx-in-bar" radius={999} tone="dark" blur={8} role="group" aria-label="Layout" data-view={shownView}>
              <span className="wx-view__thumb" aria-hidden="true" />
              <button type="button" className="wx-view__btn" aria-pressed={shownView === 'grid'} onClick={() => switchView('grid')}>
                <GridIcon />
                <span className="wx-view__txt">Grid</span>
              </button>
              <button type="button" className="wx-view__btn" aria-pressed={shownView === 'list'} onClick={() => switchView('list')}>
                <ListIcon />
                <span className="wx-view__txt">List</span>
              </button>
            </Glass>
          </div>
        </div>

        <div className="container">
          <div ref={statusRef} className="wx-status">
            <p className="wx-count t-mono" aria-hidden="true">
              <span>Showing</span>
              <span className="wx-count__mask">
                <span key={count} className="wx-count__num">
                  {pad2(count)}
                </span>
              </span>
              <span>of {pad2(TOTAL)}</span>
            </p>
            <p className="sr-only" aria-live="polite" aria-atomic="true">
              {liveText}
            </p>
            {activeGroups.length > 0 && (
              <ul className="wx-active" aria-label="Active filters">
                {activeGroups.map((g, i) => (
                  <li key={g.key}>
                    <button
                      type="button"
                      className="chip wx-chip"
                      onClick={() => removeFilter(g.key, i)}
                      aria-label={`Remove ${g.label.toLowerCase()} filter: ${filters[g.key]}`}
                    >
                      <span className="wx-chip__k">{g.label}</span>
                      <span className="wx-chip__v">{filters[g.key]}</span>
                      <CloseIcon size={10} />
                    </button>
                  </li>
                ))}
                <li>
                  <button type="button" className="wx-clear t-mono" onClick={clearAll}>
                    Clear all
                  </button>
                </li>
              </ul>
            )}
          </div>

          <div ref={resultsRef} className="wx-results">
            {view === 'grid' ? (
              <ul className="wx-grid" aria-label="Projects">
                {PROJECTS.map((p, i) => (
                  <li key={p.slug} className={`wx-item${matches(p, filters) ? '' : ' is-out'}`}>
                    <Card project={p} index={i} compact={mobile} activeStyle={filters.style} />
                  </li>
                ))}
              </ul>
            ) : (
              <div ref={listRef} className={`wx-list${previewOn ? ' has-preview' : ''}`}>
                <div className="wx-list__head t-mono" aria-hidden="true">
                  <span>#</span>
                  {!previewOn && <span />}
                  <span>Project</span>
                  <span>Format</span>
                  <span>Style</span>
                  <span>Runtime</span>
                  <span>Year</span>
                  <span />
                </div>
                <ul className="wx-rows" aria-label="Projects">
                  {PROJECTS.map((p, i) => (
                    <li key={p.slug} className={`wx-row${matches(p, filters) ? '' : ' is-out'}`} data-slug={p.slug}>
                      <Row project={p} index={i} activeStyle={filters.style} />
                    </li>
                  ))}
                </ul>
                {previewOn && (
                  <div ref={previewRef} className="wx-preview" aria-hidden="true">
                    <div className="wx-preview__frame">
                      {PROJECTS.map((p, i) => (
                        <Shot key={p.slug} project={p} index={i} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            {count === 0 && (
              <Empty
                onReset={() => {
                  focusAfter.current = -1
                  apply(NO_FILTERS)
                }}
              />
            )}
          </div>
        </div>
      </section>

      {/* CTA band --------------------------------------------------------- */}
      <section className="wx-cta" data-hud="All work">
        <div className="container wx-cta__grid">
          <div className="wx-cta__main">
            <Eyebrow>Next step</Eyebrow>
            <SplitReveal as="h2" className="wx-cta__title t-h1">
              Have a <em className="t-serif">script?</em>
            </SplitReveal>
          </div>
          <div className="wx-cta__side">
            <p className="wx-cta__lead t-lead">
              Send the script, the raw footage or just the product link. I&rsquo;ll map the hook, the structure and the variations worth testing.
            </p>
            <div className="wx-cta__actions">
              <Button to="/#contact" size="lg" label={CTA_LINES.primary} kicker="Contact">
                {CTA_LINES.primary}
              </Button>
              <p className="wx-cta__status t-mono">
                <span className="rec-dot" aria-hidden="true" />
                {SITE.availability}
              </p>
            </div>
          </div>
        </div>
      </section>

      {sheetOpen &&
        createPortal(
          <FilterSheet filters={filters} onApply={(draft) => apply(draft, { defer: true })} onClose={closeSheet} />,
          document.body,
        )}
    </div>
  )
}
