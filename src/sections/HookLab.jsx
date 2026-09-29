import { Fragment, useId, useRef, useState } from 'react'
import { gsap, ScrollTrigger, useGSAP, EASE } from '../lib/gsap'
import { prefersReducedMotion } from '../lib/env'
import { useIsMobile, useReducedMotion } from '../lib/hooks'
import { toTimecode } from '../lib/timecode'
import { HOOK_TYPES, HOOK_VARIANTS, HOOK_LAB } from '../data/strategy'
import { SITE } from '../data/site'
import { TLink } from '../app/PageTransition'
import Glass from '../components/LiquidGlass'
import VerticalVideo from '../components/VerticalVideo'
import { SectionHeader } from '../components/Primitives'
import './HookLab.css'

const N = HOOK_VARIANTS.length
/** Each opening plays through once, holds a beat, then the lab cuts to the next */
const HOLD_AFTER = 0.6
/** Mount: let the viewfinder open before the first caption pops */
const FIRST_PLAY_DELAY = 0.75
/** Placeholder footage has no captions of its own, so the lab types them on */
const TYPED_CAPTIONS = SITE.placeholderMode

/** Caption line → word units; the highlighted phrase pops as a single unit */
function toUnits(line, hl) {
  const words = line.split(' ')
  const hw = hl ? hl.split(' ') : []
  let at = -1
  for (let k = 0; hw.length && k + hw.length <= words.length; k++) {
    if (words.slice(k, k + hw.length).join(' ') === hl) {
      at = k
      break
    }
  }
  const units = []
  for (let k = 0; k < words.length; k++) {
    if (k === at) {
      units.push({ t: hl, hl: true })
      k += hw.length - 1
    } else {
      units.push({ t: words[k], hl: false })
    }
  }
  return units
}

const VARIANTS = HOOK_VARIANTS.map((v, i) => ({ ...v, i, units: toUnits(v.line, v.hl) }))
const secs = (s) => `${pad2(Math.round(s))}s`

/* Ruler ticks: the hook window is drawn zoomed (like an NLE work area),
   so each tick is placed inside its own segment. f = fraction of that segment. */
function ticksFor(hookEnd) {
  const { duration, ctaAt } = HOOK_LAB
  const body = ctaAt - hookEnd
  const third = Math.round((hookEnd + body / 3) / 5) * 5
  const twoThirds = Math.round((hookEnd + (2 * body) / 3) / 5) * 5
  return [
    { s: 0, seg: 'hook', f: 0 },
    { s: hookEnd, seg: 'body', f: 0 },
    { s: third, seg: 'body', f: (third - hookEnd) / body },
    { s: twoThirds, seg: 'body', f: (twoThirds - hookEnd) / body },
    { s: ctaAt, seg: 'cta', f: 0 },
    { s: duration, seg: 'cta', f: 1 },
  ]
}

const KEY_STEP = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }

const pad2 = (n) => String(n).padStart(2, '0')
const isHeld = (h) => h.hover || h.focus || h.touch || !h.inView
/** A swipe on the phone chip row holds the cycle for this long (ms) */
const TOUCH_HOLD = 5000

/**
 * 06 — Hook Lab.
 * One real hook test: five openings cut onto one body. The 9:16 preview
 * plays each opening (running timecode), a tab list switches or auto-cycles
 * the variants, and an NLE strip shows that only the hook segment changes
 * while the body stays locked.
 */
export default function HookLab() {
  const rootRef = useRef(null)
  /** Why the auto-advance is holding — written by listeners, read by GSAP */
  const holdRef = useRef({ hover: false, focus: false, touch: false, inView: false, seen: false })
  const playRef = useRef(null)
  const advanceRef = useRef(null)
  const prevRef = useRef(null)
  const [sel, setSel] = useState({ i: 0, n: 0 })
  // Reduced motion: nothing plays on its own — only an opening the viewer picks
  const [picked, setPicked] = useState(false)
  const mobile = useIsMobile()
  const reduced = useReducedMotion()
  const uid = useId()

  const v = VARIANTS[sel.i]
  const ticks = ticksFor(v.dur)
  const tabId = (id) => `${uid}-tab-${id}`
  const panelId = `${uid}-panel`

  // `n` changes on every pick, so re-clicking the active hook restarts it
  const select = (k) => {
    setPicked(true)
    setSel((s) => ({ i: k, n: s.n + 1 }))
  }

  const onKeyDown = (e) => {
    let next = null
    if (e.key in KEY_STEP) next = (sel.i + KEY_STEP[e.key] + N) % N
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = N - 1
    if (next === null) return
    e.preventDefault()
    select(next)
    e.currentTarget.querySelectorAll('[role="tab"]')[next]?.focus()
  }

  /* ---------------------------------------------------------------------
     Setup — entrances, in-view + hover/focus holds (runs once)
     --------------------------------------------------------------------- */
  useGSAP(
    () => {
      const root = rootRef.current
      const q = gsap.utils.selector(root)
      const lab = q('.hk-lab')[0]
      const hold = holdRef.current
      const reducedNow = prefersReducedMotion()
      if (!lab) return

      // Warm the cache so every cut is a true hard cut
      VARIANTS.forEach((h) => {
        const pre = new Image()
        pre.src = h.poster
      })

      const apply = () => {
        const held = isHeld(hold)
        advanceRef.current?.paused(held)
        lab.classList.toggle('is-held', held)
      }

      const onEnter = (e) => {
        if (e.pointerType === 'touch') return
        hold.hover = true
        apply()
      }
      const onLeave = (e) => {
        if (e.pointerType === 'touch') return
        hold.hover = false
        apply()
      }
      // Keyboard focus holds the cycle; a mouse click doesn't (it's already hovering)
      const onFocusIn = (e) => {
        const t = e.target
        hold.focus = t instanceof Element && t.matches(':focus-visible')
        apply()
      }
      const onFocusOut = (e) => {
        if (lab.contains(e.relatedTarget)) return
        hold.focus = false
        apply()
      }
      // Touch: a swipe through the chip row holds the cycle so it doesn't
      // scroll the row out from under the finger
      let touchTimer = 0
      const onTouch = () => {
        hold.touch = true
        apply()
        clearTimeout(touchTimer)
        touchTimer = setTimeout(() => {
          hold.touch = false
          apply()
        }, TOUCH_HOLD)
      }
      const row = q('.hk-tabs')[0]
      lab.addEventListener('pointerenter', onEnter)
      lab.addEventListener('pointerleave', onLeave)
      lab.addEventListener('focusin', onFocusIn)
      lab.addEventListener('focusout', onFocusOut)
      row?.addEventListener('touchstart', onTouch, { passive: true })

      ScrollTrigger.create({
        trigger: lab,
        start: 'top 75%',
        end: 'bottom 25%',
        onToggle: (self) => {
          hold.inView = self.isActive
          if (self.isActive && !hold.seen) {
            hold.seen = true
            playRef.current?.play()
          }
          apply()
        },
      })
      apply()

      const once = (trigger, start = 'top 80%') => ({ trigger, start, once: true })
      const phone = q('.hk-phone__frame')[0]
      const listParts = q('.hk-list__head, .hk-tab, .hk-detail, .hk-list__foot')
      const strip = q('.hk-strip')[0]
      const cells = q('.hk-cat')

      if (reducedNow) {
        // from() settles on each element's own CSS opacity (the ambient rests at 0.42)
        const fade = (targets, trigger) =>
          gsap.from(targets, {
            opacity: 0,
            duration: 0.7,
            ease: 'power1.out',
            stagger: 0.04,
            clearProps: 'opacity',
            scrollTrigger: once(trigger, 'top 88%'),
          })
        fade([phone, q('.hk-ambient')[0], q('.hk-note')[0], ...listParts], lab)
        fade(q('.hk-strip__head, .hk-strip__tl'), strip)
        fade([q('.hk-cats__head')[0], ...cells], q('.hk-cats')[0])
      } else {
        /* The viewfinder opens, then the list settles in beside it */
        gsap
          .timeline({ scrollTrigger: once(lab, 'top 75%') })
          .fromTo(
            phone,
            { clipPath: 'inset(9% 11% 9% 11% round 36px)' },
            { clipPath: 'inset(-2% -2% -2% -2% round 0px)', duration: 1.4, ease: EASE.inOut, clearProps: 'clipPath' },
            0,
          )
          .from(q('.hk-ambient'), { autoAlpha: 0, duration: 1.8, ease: 'power1.out' }, 0.5)
          .from(q('.hk-note'), { opacity: 0, y: 10, duration: 1 }, 0.8)
          .from(listParts, { opacity: 0, y: 22, duration: 1.1, stagger: 0.07, clearProps: 'transform' }, 0.2)

        /* The strip draws on like a sequence being laid down */
        gsap
          .timeline({ scrollTrigger: once(strip, 'top 85%') })
          .from(q('.hk-strip__head > *'), { autoAlpha: 0, y: 10, duration: 1, stagger: 0.06 }, 0)
          .fromTo(
            q('.hk-track')[0],
            { clipPath: 'inset(0% 100% 0% 0%)' },
            { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.5, ease: EASE.inOut, clearProps: 'clipPath' },
            0.05,
          )
          .from(q('.hk-tick'), { autoAlpha: 0, duration: 0.8, stagger: 0.07, ease: 'power1.out' }, 0.3)

        /* Categories — a quiet staggered grid */
        gsap
          .timeline({ scrollTrigger: once(q('.hk-cats')[0], 'top 82%') })
          .from(q('.hk-cats__head > *'), { opacity: 0, y: 12, duration: 1, stagger: 0.06 }, 0)
          .from(cells, { opacity: 0, y: 28, duration: 1.2, stagger: 0.06, clearProps: 'transform,opacity' }, 0.1)
      }

      return () => {
        lab.removeEventListener('pointerenter', onEnter)
        lab.removeEventListener('pointerleave', onLeave)
        lab.removeEventListener('focusin', onFocusIn)
        lab.removeEventListener('focusout', onFocusOut)
        row?.removeEventListener('touchstart', onTouch)
        clearTimeout(touchTimer)
        hold.touch = false
        lab.classList.remove('is-held')
      }
    },
    { scope: rootRef },
  )

  /* ---------------------------------------------------------------------
     Per variant — the cut, the hook playback and the auto-advance.
     The previous run is reverted first, so every tween starts clean.
     --------------------------------------------------------------------- */
  useGSAP(
    () => {
      const root = rootRef.current
      const q = gsap.utils.selector(root)
      const hold = holdRef.current
      const reducedNow = prefersReducedMotion()
      const { i, n } = sel
      const prev = prevRef.current
      prevRef.current = { i, n }
      // Mount (and StrictMode's re-run) isn't a change — only a pick is
      const changed = prev !== null && prev.n !== n
      const prevI = prev ? prev.i : i
      const hookSeconds = VARIANTS[i].dur

      const tc = q('.hk-tc__cur')[0]
      const cap = q('.hk-cap')[0]
      const words = q('.hk-cap__w')
      const hooks = q('.hk-hook')
      const tab = q('.hk-tab')[i]
      const fill = tab?.querySelector('.hk-tab__fill')
      const head = q('.hk-ph__head')[0]
      // the preview remounts per pick — GSAP owns the new poster's transform (punch-in)
      const img = q('.hk-phone .vv__poster')[0]
      if (img) gsap.set(img, { transition: 'none', transformOrigin: '50% 42%' })
      if (tc) tc.textContent = toTimecode(0)

      // Phones: bring the active chip into the scroller's view
      const row = q('.hk-tabs')[0]
      if (changed && row && tab && row.scrollWidth > row.clientWidth + 1) {
        const left = tab.offsetLeft - (row.clientWidth - tab.offsetWidth) / 2
        row.scrollTo({ left: Math.max(0, left), behavior: reducedNow ? 'auto' : 'smooth' })
      }

      /* Reduced motion — a plain fade, nothing advances on its own */
      if (reducedNow) {
        if (!changed) return
        if (cap) gsap.fromTo(cap, { opacity: 0 }, { opacity: 1, duration: 0.4, ease: 'power1.out' })
        if (prevI !== i && hooks[prevI]) {
          gsap.fromTo(hooks[prevI], { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.35, ease: 'power1.out' })
        }
        if (hooks[i]) gsap.fromTo(hooks[i], { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.35, ease: 'power1.out' })
        return
      }

      /* The cut: hard cut on the poster with a slight punch-in; the strip
         swaps its hook segment while the body acknowledges with a pulse */
      if (changed) {
        if (img) gsap.fromTo(img, { scale: 1.06 }, { scale: 1, duration: 1.1, ease: EASE.out })
        if (prevI !== i && hooks[prevI]) {
          gsap.fromTo(
            hooks[prevI],
            { autoAlpha: 1, xPercent: 0 },
            { autoAlpha: 0, xPercent: -16, duration: 0.5, ease: EASE.inOut },
          )
        }
        if (hooks[i]) {
          gsap.fromTo(
            hooks[i],
            { clipPath: 'inset(0% 100% 0% 0%)' },
            { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.75, ease: EASE.inOut, delay: 0.04 },
          )
        }
        const pulse = q('.hk-seg__pulse')[0]
        if (pulse) {
          gsap
            .timeline()
            .fromTo(pulse, { opacity: 0 }, { opacity: 1, duration: 0.16, ease: 'power1.out' }, 0.18)
            .to(pulse, { opacity: 0, duration: 0.9, ease: EASE.out })
        }
      }

      /* Playback of the hook window: the timecode and the strip's playhead run
         in real time with the clip (and placeholder captions pop word by word) */
      const at = changed ? 0.06 : FIRST_PLAY_DELAY
      const play = gsap.timeline({ paused: !changed && !hold.seen })
      if (words.length) {
        play.fromTo(
          words,
          { autoAlpha: 0, scale: 0.8 },
          { autoAlpha: 1, scale: 1, duration: 0.42, ease: EASE.out, stagger: 0.12 },
          at,
        )
      }
      if (tc) {
        const clock = { t: 0 }
        let last = ''
        play.to(
          clock,
          {
            t: hookSeconds,
            duration: hookSeconds,
            ease: 'none',
            onUpdate: () => {
              const s = toTimecode(clock.t)
              if (s === last) return
              last = s
              tc.textContent = s
            },
          },
          at,
        )
      }
      if (head) play.fromTo(head, { xPercent: 0 }, { xPercent: 100, duration: hookSeconds, ease: 'none' }, at)
      playRef.current = play

      /* Auto-advance: the active row's bar fills while the opening plays, then
         the next hook cuts in. Holds while hovered, keyboard-focused or off screen. */
      if (fill) {
        advanceRef.current = gsap.fromTo(
          fill,
          { scaleX: 0 },
          {
            scaleX: 1,
            duration: hookSeconds + HOLD_AFTER,
            ease: 'none',
            paused: isHeld(hold),
            onComplete: () => setSel((s) => ({ i: (s.i + 1) % N, n: s.n + 1 })),
          },
        )
      }

      return () => {
        playRef.current = null
        advanceRef.current = null
      }
    },
    { scope: rootRef, dependencies: [sel], revertOnUpdate: true },
  )

  return (
    <section ref={rootRef} id="hooks" className="section hk" data-hud="Hook Lab">
      <div className="container">
        <SectionHeader
          index="06"
          eyebrow="Hook lab"
          aside={HOOK_LAB.title}
          title={
            <>
              One body. <em className="t-serif">Five</em> openings.
            </>
          }
          lead="A real hook test: the body of the ad stays locked while the first few seconds change — so every angle gets tested without rebuilding the creative."
        />

        <div className="hk-lab">
          {/* The preview — tab panel for the list */}
          <figure className="hk-stage">
            <div
              className="hk-phone"
              role="tabpanel"
              id={panelId}
              aria-labelledby={tabId(v.id)}
              tabIndex={0}
            >
              {/* Ambient light — a blurred copy of the frame spills onto the page */}
              <span className="hk-ambient" aria-hidden="true" style={{ backgroundImage: `url(${v.poster})` }} />
              <div className="hk-phone__frame">
                {/* Keyed per pick: every cut restarts the opening from its first frame */}
                <VerticalVideo
                  key={`${v.id}-${sel.n}`}
                  src={v.video}
                  mode={reduced && !picked ? 'none' : 'manual'}
                  playing
                  poster={v.poster}
                  alt={`Opening frame — ${v.visual}`}
                  showProgress={false}
                  cropmarks
                  label={`Hook ${v.id} · ${v.type}`}
                  meta={
                    <span className="hk-tc" aria-hidden="true">
                      <span className="hk-tc__cur">{toTimecode(0)}</span>
                      <span className="hk-tc__to">→</span>
                      <span className="hk-tc__end">{toTimecode(v.dur)}</span>
                    </span>
                  }
                  className="hk-vv"
                >
                  {TYPED_CAPTIONS && (
                    <p className="ad-caption hk-cap">
                      {v.units.map((u, k) => (
                        <Fragment key={k}>
                          {k > 0 && ' '}
                          <span className={u.hl ? 'caption-hl hk-cap__w' : 'hk-cap__w'}>{u.t}</span>
                        </Fragment>
                      ))}
                    </p>
                  )}
                </VerticalVideo>
              </div>
            </div>
            <figcaption className="hk-note t-mono">
              <span className="hk-note__k">Shot</span>
              <span className="hk-note__v">{v.visual}</span>
            </figcaption>
          </figure>

          {/* The five openings */}
          <div className="hk-list">
            <p className="hk-list__head t-mono" aria-hidden="true">
              <span>Openings</span>
              <span>
                <span className="hk-list__cur">{pad2(sel.i + 1)}</span> / {pad2(N)}
              </span>
            </p>

            <div
              className="hk-tabs"
              role="tablist"
              aria-label="Hook variations"
              aria-orientation={mobile ? 'horizontal' : 'vertical'}
              onKeyDown={onKeyDown}
            >
              {VARIANTS.map((h) => {
                const on = h.i === sel.i
                return (
                  <button
                    key={h.id}
                    type="button"
                    role="tab"
                    id={tabId(h.id)}
                    aria-selected={on}
                    aria-controls={panelId}
                    tabIndex={on ? 0 : -1}
                    className={`hk-tab${on ? ' is-active' : ''}`}
                    onClick={() => select(h.i)}
                  >
                    <Glass
                      as="span"
                      radius={999}
                      tone={on ? 'accent' : 'clear'}
                      refract={false}
                      interactive={false}
                      className="hk-tab__badge"
                      aria-hidden="true"
                    >
                      <span className="hk-tab__glow" />
                      <span className="hk-tab__letter">{h.id}</span>
                    </Glass>
                    <span className="hk-tab__body">
                      <span className="sr-only">Hook {h.id}: </span>
                      <span className="hk-tab__type t-h4">{h.type}</span>
                      <span className="hk-tab__line t-small">{h.line}</span>
                    </span>
                    <span className="hk-tab__bar" aria-hidden="true">
                      <span className="hk-tab__fill" />
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Phones: the chip row carries only the type, so the line sits below it */}
            <div className="hk-detail" aria-hidden="true">
              <p className="hk-detail__k t-mono">
                Hook {v.id} — {v.type}
              </p>
              <p className="hk-detail__line">{v.line}</p>
            </div>

            <div className="hk-list__foot t-mono" aria-hidden="true">
              {reduced ? (
                <span className="hk-status">Select an opening</span>
              ) : (
                <span className="hk-status">
                  <span className="hk-status__dot" />
                  <span className="hk-status__run">Auto-advancing</span>
                  <span className="hk-status__hold">Paused</span>
                </span>
              )}
              <span className="hk-keys">
                <kbd className="hk-key">↑</kbd>
                <kbd className="hk-key">↓</kbd>
                to switch
              </span>
            </div>
          </div>

          {/* ONE BODY — the sequence, with only the hook window swapping */}
          <div className="hk-strip">
            <p className="hk-strip__head t-mono" aria-hidden="true">
              <span>Sequence · {toTimecode(HOOK_LAB.duration)}</span>
              <span className="hk-strip__swap">
                Only <span className="hk-strip__hl">00–{secs(v.dur)}</span> changes
              </span>
            </p>
            <div className="hk-strip__tl" aria-hidden="true">
              <div className="hk-ruler">
                {ticks.map((t) => (
                  <span key={t.seg + t.f} className={`hk-tick hk-tick--${t.seg}`} style={{ '--f': String(t.f) }}>
                    <span className="hk-tick__l">{Math.round(t.s)}s</span>
                  </span>
                ))}
              </div>
              <div className="hk-track">
                <div className="hk-seg hk-seg--hook">
                  <div className="hk-seg__box">
                    {VARIANTS.map((h) => (
                      <div
                        key={h.id}
                        className={`hk-hook${h.i === sel.i ? ' is-active' : ''}`}
                        style={{ '--hk-hue': `var(--hk-h${h.i})` }}
                      >
                        <span className="hk-hook__film" style={{ backgroundImage: `url(${h.poster})` }} />
                        <span className="hk-seg__label">
                          Hook {h.id}
                          <span className="hk-seg__sub"> — {h.type}</span>
                        </span>
                        <span className="hk-seg__range">00–{secs(h.dur)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="hk-seg hk-seg--body">
                  <div className="hk-seg__box">
                    <span className="hk-seg__pulse" />
                    <span className="hk-seg__label">
                      One body<span className="hk-seg__sub"> — unchanged</span>
                    </span>
                    <span className="hk-seg__range">
                      {secs(v.dur)}–{secs(HOOK_LAB.ctaAt)}
                    </span>
                  </div>
                </div>
                <div className="hk-seg hk-seg--cta">
                  <div className="hk-seg__box">
                    <span className="hk-seg__label">CTA</span>
                    <span className="hk-seg__range">
                      {secs(HOOK_LAB.ctaAt)}–{secs(HOOK_LAB.duration)}
                    </span>
                  </div>
                </div>
                <span className="hk-ph">
                  <span className="hk-ph__head" />
                </span>
              </div>
            </div>
            <p className="sr-only">
              Sequence: hook {v.id}, {v.type}, from 0 to {Math.round(v.dur)} seconds; one body, unchanged, from{' '}
              {Math.round(v.dur)} to {HOOK_LAB.ctaAt} seconds; call to action from {HOOK_LAB.ctaAt} to{' '}
              {HOOK_LAB.duration} seconds.
            </p>
            <p className="hk-strip__foot t-mono">
              <TLink to={`/work/${HOOK_LAB.slug}`} label={HOOK_LAB.title} kicker="Case study" className="hk-strip__link">
                See all five hooks in the case study <span aria-hidden="true">→</span>
              </TLink>
            </p>
          </div>
        </div>

        {/* 10 hook categories */}
        <div className="hk-cats">
          <div className="hk-cats__head">
            <h3 className="hk-cats__title t-mono">
              <span className="hk-cats__n">{pad2(HOOK_TYPES.length)}</span>
              Hook categories
            </h3>
            <p className="hk-cats__aside t-small">Ten ways to earn the next three seconds.</p>
          </div>
          <ol className="hk-cats__grid">
            {HOOK_TYPES.map((h, k) => (
              <li className="hk-cat" key={h.name}>
                <span className="hk-cat__i t-mono" aria-hidden="true">
                  {pad2(k + 1)}
                </span>
                <h4 className="hk-cat__name t-h4">{h.name}</h4>
                <p className="hk-cat__desc t-small">{h.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
