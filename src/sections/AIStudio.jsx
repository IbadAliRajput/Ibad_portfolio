import { useRef, useState } from 'react'
import { gsap, ScrollTrigger, useGSAP, EASE } from '../lib/gsap'
import { prefersReducedMotion } from '../lib/env'
import { useIsDesktop } from '../lib/hooks'
import { useScroll } from '../app/context'
import { toTimecode } from '../lib/timecode'
import { SectionHeader, Eyebrow } from '../components/Primitives'
import SplitReveal from '../components/SplitReveal'
import Glass from '../components/LiquidGlass'
import ScrubVideo from '../components/ScrubVideo'
import { AdCaption } from '../components/VerticalVideo'
import { MEDIA, POSTERS } from '../data/site'
import { AI_WORKFLOW, AI_USES, CONTINUITY, STACK } from '../data/process'
import './AIStudio.css'

/* ==========================================================================
   Constants — everything deterministic, computed once at module load
   ========================================================================== */
const pad2 = (n) => String(n).padStart(2, '0')
/* One character, built from Ibad's photos and held consistent through every step */
const AI = MEDIA.ai
const START = AI.startFrame
const STEP_TOTAL = pad2(AI_WORKFLOW.length)
const LAYER_KEYS = ['still', 'refs', 'ref', 'motion', 'select', 'edit']

/* 01 · Controlled still — rule-of-thirds grid + power points */
const THIRDS = [
  { dir: 'h', p: '33.333%', d: '0.12s' },
  { dir: 'h', p: '66.667%', d: '0.2s' },
  { dir: 'v', p: '33.333%', d: '0.28s' },
  { dir: 'v', p: '66.667%', d: '0.36s' },
]
const POWER_POINTS = [
  { x: '33.333%', y: '33.333%', focus: true },
  { x: '66.667%', y: '33.333%' },
  { x: '33.333%', y: '66.667%' },
  { x: '66.667%', y: '66.667%' },
]
const LOCKS = ['Comp', 'Light', 'Character', 'Product']

/* 02 · Consistency — reference thumbs + wire endpoints (viewBox 900 × 1600 = 9:16) */
const REFS = [
  { label: 'Character', src: AI.character, y: '21.19%', wy: 474 },
  { label: 'Product', src: AI.product, y: '41.56%', wy: 800 },
  { label: 'Environment', src: AI.environment, y: '61.94%', wy: 1126 },
]

/* 03 · Reference — tracked anchor points */
const MARKERS = [
  { label: 'Face', x: '48%', y: '43%', s: '22%' },
  { label: 'Key light', x: '19%', y: '55%', s: '10%' },
  { label: 'Product', x: '82%', y: '49%', s: '11%' },
  { label: 'Hands', x: '84%', y: '61%', s: '12%' },
]

/* 04 · Motion — one continuous 10s image-to-video clip from the start frame, scrubbed on scroll */
const MOTION_SECONDS = 10

/* 05 · Selection — four takes of the start frame, one survives */
const PICK = 2
const TAKES = [
  { src: AI.takes[0], scale: 1.08, origin: '64% 46%', reject: 'Hands' },
  { src: AI.takes[1], scale: 1.12, origin: '66% 52%', reject: 'Label' },
  { src: AI.takes[2], scale: 1.04, origin: '50% 50%', reject: null },
  { src: AI.takes[3], scale: 1.1, origin: '46% 34%', reject: 'Face' },
]
const TAKE_TOTAL = TAKES.length

/* 06 · Integration */
const EDIT_CHECKS = ['Grade', 'Captions', 'Sound']

/* Continuity board */
const SCENES = ['SC 01', 'SC 04', 'SC 09']
/* Three different generated scenes — framed on the face, then on the bottle */
const SCENE_SHOTS = {
  Character: { src: AI.scenes, scale: [1.7, 1.9, 1.8], origin: ['36% 36%', '48% 18%', '66% 22%'] },
  Product: { src: AI.scenes, scale: [2.4, 2.2, 2.3], origin: ['74% 52%', '62% 66%', '72% 70%'] },
}
const WAVE = Array.from({ length: 10 }, (_, i) => 0.22 + 0.78 * Math.abs(Math.sin(i * 1.9 + 0.6) * Math.cos(i * 0.7)))
const CONTINUITY_NOTES = {
  Character: 'Wardrobe and setting can change between scenes. The identity can’t.',
  Product: 'Treated as a continuity asset — never accidentally redesigned.',
  Voice: 'A recurring character keeps one recognisable voice.',
}
const CHECK_TOTAL = CONTINUITY.reduce((n, g) => n + g.items.length, 0)

/* Production stack — each capability is a track on the editing spine */
const STACK_CODES = ['EDIT', 'IMG', 'VID', 'VO', 'SYNC', 'GFX', 'SFX']
const SPINE = [
  { k: 'IMG', clips: [[4, 15], [52, 61]] },
  { k: 'VID', hot: true, clips: [[10, 34], [58, 80]] },
  { k: 'VO', clips: [[0, 46], [49, 96]] },
  { k: 'SYNC', clips: [[18, 31]] },
  { k: 'GFX', clips: [[28, 39], [69, 77], [85, 94]] },
  { k: 'SFX', clips: [[6, 8], [22, 25], [44, 47], [66, 69], [88, 91]] },
]
const SPINE_AT = 58 // playhead, % of a 30s cut
const SPINE_TC = toTimecode((30 * SPINE_AT) / 100)
const GLOW = [
  { key: 'a', src: POSTERS[1] },
  { key: 'b', src: POSTERS[2] },
  { key: 'c', src: POSTERS[0] },
]
const DRIFT = [
  { x: 12, y: -9, s: 1.08, t: 17 },
  { x: -14, y: 10, s: 0.94, t: 21 },
  { x: 9, y: -12, s: 1.1, t: 15 },
]

/* ==========================================================================
   Helpers (run inside useGSAP contexts only)
   ========================================================================== */
/** Part-head entrance: hairline draws, labels rise */
function revealPart(el) {
  if (!el) return
  const bits = el.querySelectorAll('.ai-part__l, .ai-part__meta')
  const rule = el.querySelector('.ai-part__rule')
  const tl = gsap.timeline({ scrollTrigger: { trigger: el, start: 'top 90%', once: true } })
  if (prefersReducedMotion()) {
    tl.from([...bits, rule], { opacity: 0, duration: 0.6, ease: 'power1.out' })
    return
  }
  tl.from(rule, { scaleX: 0, transformOrigin: '0% 50%', duration: 1.6, ease: EASE.inOut }, 0).from(
    bits,
    { y: 14, opacity: 0, duration: 1.1, stagger: 0.08, ease: EASE.out },
    0.15,
  )
}

/* ==========================================================================
   Small building blocks
   ========================================================================== */
function Tick({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        d="M3.6 8.4l2.9 2.9 5.9-6.4"
        pathLength="1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function PartHead({ index, label, meta }) {
  return (
    <div className="ai-part">
      <Eyebrow index={index} className="ai-part__l">
        {label}
      </Eyebrow>
      {meta && <p className="ai-part__meta t-mono t-mute">{meta}</p>}
      <span className="ai-part__rule" aria-hidden="true" />
    </div>
  )
}

/** The 9:16 "monitor" every workflow visual lives in (decorative — the steps carry the content) */
function Frame({ variant, children }) {
  return (
    <div className={`ai-frame ai-frame--${variant}`} aria-hidden="true">
      {children}
      <span className="ai-frame__crop cropmarks" />
    </div>
  )
}

/* --------------------------------------------------------------------------
   Workflow layers — one per step. `.is-on` plays the layer's entrance,
   `.is-live` runs its loop (only ever one live layer at a time).
   -------------------------------------------------------------------------- */
function LayerStill() {
  return (
    <>
      <img className="ai-layer__media" src={START} alt="" loading="lazy" decoding="async" draggable="false" />
      <span className="ai-shade" />
      <span className="ai-l1__band ai-l1__band--top ai-in ai-in--fade" style={{ '--d': '0.5s' }} />
      <span className="ai-l1__band ai-l1__band--bottom ai-in ai-in--fade" style={{ '--d': '0.5s' }} />
      <span className="ai-l1__guide ai-in ai-in--fade" style={{ '--d': '0.55s' }}>
        <span className="ai-l1__ratio ai-mono">4:5 safe</span>
      </span>
      {THIRDS.map((l) => (
        <span key={l.dir + l.p} className={`ai-l1__line ai-l1__line--${l.dir}`} style={{ '--p': l.p, '--d': l.d }} />
      ))}
      {POWER_POINTS.map((pt, k) => (
        <span
          key={pt.x + pt.y}
          className={`ai-l1__pt${pt.focus ? ' is-focus' : ''}`}
          style={{ '--x': pt.x, '--y': pt.y, '--d': `${0.7 + k * 0.06}s` }}
        />
      ))}
      <div className="ai-frame__top">
        <span className="chip ai-chip ai-in" style={{ '--d': '0.08s' }}>
          <span className="ai-dot" />
          Start frame
        </span>
        <span className="ai-meta ai-mono ai-in" style={{ '--d': '0.16s' }}>
          seed 4471 · 9:16
        </span>
      </div>
      <div className="ai-frame__bottom">
        <ul className="ai-l1__locks ai-mono">
          {LOCKS.map((k, i) => (
            <li key={k} className="ai-in" style={{ '--d': `${0.62 + i * 0.07}s` }}>
              <Tick className="ai-tick" />
              {k}
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}

function LayerConsistency() {
  return (
    <>
      <span className="ai-board" />
      <figure className="ai-l2__still ai-in" style={{ '--d': '0.05s' }}>
        <img src={START} alt="" loading="lazy" decoding="async" draggable="false" />
        <span className="ai-l2__tag ai-mono">Start frame</span>
      </figure>
      <svg className="ai-l2__wires" viewBox="459 0 108 1600" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        {REFS.map((r) => (
          <path key={r.label} d={`M459 800 C513 800 513 ${r.wy} 567 ${r.wy}`} vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <span className="ai-l2__node ai-in ai-in--fade" style={{ '--d': '0.4s' }} />
      <ul className="ai-l2__refs">
        {REFS.map((r, k) => (
          <li key={r.label} className="ai-l2__ref ai-in" style={{ '--y': r.y, '--d': `${0.2 + k * 0.1}s` }}>
            <span className="ai-l2__thumb">
              <img src={r.src} alt="" loading="lazy" decoding="async" draggable="false" />
              <span className="ai-l2__label ai-mono">{r.label}</span>
            </span>
            <span className="ai-l2__check" style={{ '--d': `${0.72 + k * 0.16}s` }}>
              <Tick />
            </span>
          </li>
        ))}
      </ul>
      <div className="ai-frame__top">
        <span className="chip ai-chip ai-in" style={{ '--d': '0.08s' }}>
          References
        </span>
        <span className="ai-meta ai-mono ai-in" style={{ '--d': '1.2s' }}>
          3 / 3 locked
        </span>
      </div>
      <div className="ai-frame__bottom">
        <span className="ai-meta ai-mono ai-in" style={{ '--d': '1.1s' }}>
          Carried into every scene
        </span>
      </div>
    </>
  )
}

function LayerReference() {
  return (
    <>
      <img className="ai-layer__media" src={START} alt="" loading="lazy" decoding="async" draggable="false" />
      <span className="ai-shade ai-shade--deep" />
      <span className="ai-l3__sweep">
        <span className="ai-l3__scan" />
      </span>
      {MARKERS.map((m, k) => (
        <span key={m.label} className="ai-l3__mk" style={{ left: m.x, top: m.y, '--s': m.s, '--d': `${0.25 + k * 0.1}s` }}>
          <span className="ai-l3__box cropmarks" />
          <span className="ai-l3__lbl ai-mono">{m.label}</span>
        </span>
      ))}
      <div className="ai-frame__top">
        <span className="chip ai-chip ai-in" style={{ '--d': '0.08s' }}>
          Reference
        </span>
        <span className="ai-meta ai-mono ai-in" style={{ '--d': '0.16s' }}>
          Anchor · frame 0001
        </span>
      </div>
      <div className="ai-frame__bottom ai-frame__bottom--center">
        <span className="chip ai-chip ai-chip--lock ai-in" style={{ '--d': '0.75s' }}>
          <span className="ai-dot ai-dot--sq" />
          Reference locked
        </span>
      </div>
    </>
  )
}

function LayerMotion({ videoRef }) {
  return (
    <>
      <ScrubVideo ref={videoRef} src={AI.motionScrub} poster={START} className="ai-l4__video" />
      <span className="ai-shade" />
      <div className="ai-frame__top">
        <span className="chip ai-chip ai-in" style={{ '--d': '0.08s' }}>
          <span className="ai-dot" />
          Motion
        </span>
        <span className="ai-meta ai-mono ai-in" style={{ '--d': '0.16s' }} data-ai-tc>
          {toTimecode(0)}
        </span>
      </div>
      <div className="ai-frame__bottom ai-frame__bottom--stack">
        <div className="ai-l4__row ai-mono ai-in" style={{ '--d': '0.24s' }}>
          <span>Image → video · {MOTION_SECONDS}s</span>
          <span>From start frame</span>
        </div>
        <span className="ai-l4__bar ai-in ai-in--fade" style={{ '--d': '0.3s' }}>
          <i data-ai-bar />
        </span>
      </div>
    </>
  )
}

function LayerSelection() {
  return (
    <>
      <span className="ai-board" />
      <div className="ai-frame__top">
        <span className="chip ai-chip ai-in" style={{ '--d': '0.05s' }}>
          Contact sheet
        </span>
        <span className="ai-meta ai-mono ai-in" style={{ '--d': '1.05s' }}>
          {TAKE_TOTAL} takes · 1 kept
        </span>
      </div>
      <ul className="ai-l5__grid">
        {TAKES.map((t, k) => {
          const pick = k === PICK
          const late = `${0.55 + k * 0.1}s`
          return (
            <li key={t.src} className={`ai-l5__take ai-in${pick ? ' is-pick' : ' is-reject'}`} style={{ '--d': `${0.08 + k * 0.07}s` }}>
              <img
                src={t.src}
                alt=""
                loading="lazy"
                decoding="async"
                draggable="false"
                style={{ transform: `scale(${t.scale})`, transformOrigin: t.origin }}
              />
              <span className="ai-l5__n ai-mono">T{pad2(k + 1)}</span>
              {pick ? (
                <span className="chip chip--accent ai-l5__sel">Selected</span>
              ) : (
                <>
                  <span className="ai-l5__dim" style={{ '--d': late }} />
                  <span className="ai-l5__strike" style={{ '--d': late }} />
                  <span className="ai-l5__why ai-mono" style={{ '--d': late }}>
                    &times; {t.reject}
                  </span>
                </>
              )}
            </li>
          )
        })}
      </ul>
      <div className="ai-frame__bottom ai-frame__bottom--center">
        <span className="ai-meta ai-mono ai-in" style={{ '--d': '1.15s' }}>
          Hands · faces · labels · physics
        </span>
      </div>
    </>
  )
}

function LayerIntegration() {
  return (
    <>
      <img className="ai-layer__media" src={TAKES[PICK].src} alt="" loading="lazy" decoding="async" draggable="false" />
      <span className="ai-l6__grade" />
      <span className="ai-shade" />
      <div className="ai-frame__top">
        <span className="chip ai-chip ai-in" style={{ '--d': '0.08s' }}>
          <span className="ai-dot" />
          In the edit
        </span>
        <span className="ai-meta ai-mono ai-in" style={{ '--d': '0.16s' }}>
          T{pad2(PICK + 1)} · 9:16
        </span>
      </div>
      <AdCaption className="ai-l6__cap ai-in" text="Here’s what nobody tells you." hl="nobody" />
      <div className="ai-frame__bottom ai-frame__bottom--stack">
        <ul className="ai-l6__checks ai-mono">
          {EDIT_CHECKS.map((c, k) => (
            <li key={c} className="ai-in" style={{ '--d': `${0.5 + k * 0.08}s` }}>
              <Tick className="ai-tick" />
              {c}
            </li>
          ))}
        </ul>
        <span className="ai-l6__bar ai-in ai-in--fade" style={{ '--d': '0.3s' }}>
          <i />
        </span>
      </div>
    </>
  )
}

function renderLayer(i, videoRef) {
  switch (i) {
    case 0:
      return <LayerStill />
    case 1:
      return <LayerConsistency />
    case 2:
      return <LayerReference />
    case 3:
      return <LayerMotion videoRef={videoRef} />
    case 4:
      return <LayerSelection />
    default:
      return <LayerIntegration />
  }
}

function Layer({ i, shown, on, live, videoRef }) {
  const cls = `ai-layer ai-layer--${LAYER_KEYS[i]}${shown ? ' is-shown' : ''}${on ? ' is-on' : ''}${live ? ' is-live' : ''}`
  return <div className={cls}>{renderLayer(i, videoRef)}</div>
}

/** Desktop index beside the sticky frame: rolling counter + jump-to-step list */
function Rail({ active, onGo }) {
  const cur = Math.max(active, 0)
  return (
    <nav className="ai-rail" aria-label="Image to video workflow steps">
      <div className="ai-rail__head">
        <p className="t-mono t-mute">Image → video</p>
        <p className="ai-rail__count" aria-hidden="true">
          <span className="ai-rail__roll">
            <span className="ai-rail__reel" style={{ '--i': cur }}>
              {AI_WORKFLOW.map((s) => (
                <span key={s.n}>{s.n}</span>
              ))}
            </span>
          </span>
          <span className="ai-rail__total t-mono">/ {STEP_TOTAL}</span>
        </p>
      </div>
      <div className="ai-rail__steps">
        <span className="ai-rail__track" aria-hidden="true">
          <span className="ai-rail__fill" />
        </span>
        <ol className="ai-rail__list">
          {AI_WORKFLOW.map((s, i) => (
            <li key={s.n}>
              <button
                type="button"
                className={`ai-rail__btn${i === active ? ' is-active' : ''}${i < active ? ' is-done' : ''}`}
                aria-current={i === active ? 'step' : undefined}
                onClick={() => onGo(i)}
              >
                <span className="ai-rail__n t-mono">{s.n}</span>
                <span className="ai-rail__t">{s.title}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
    </nav>
  )
}

/* ==========================================================================
   Part 1 — Image → video workflow
   Desktop: sticky 9:16 frame (CSS sticky, no pin) + six scroll blocks.
   Below desktop: every block carries its own compact visual.
   ========================================================================== */
function Workflow() {
  const rootRef = useRef(null)
  const videoApi = useRef(null)
  const desktop = useIsDesktop()
  const { scrollTo } = useScroll()
  const [active, setActive] = useState(-1)
  const [reached, setReached] = useState(-1)

  useGSAP(
    () => {
      const root = rootRef.current
      const q = gsap.utils.selector(root)
      const steps = q('.ai-step')
      const reduced = prefersReducedMotion()
      revealPart(q('.ai-part')[0])

      // Active step = the block crossing the viewport centre (discrete state only)
      steps.forEach((el, i) => {
        ScrollTrigger.create({
          trigger: el,
          start: 'top center',
          end: 'bottom center',
          onToggle: (self) => {
            if (self.isActive) {
              setActive(i)
              setReached((r) => Math.max(r, i))
            } else if (i === 0 && self.direction < 0) {
              setActive(-1)
            }
          },
        })
      })
      // Big jumps (anchor links, fast flicks) can skip whole blocks without toggling
      // them — settle on the last step whenever the sequence is left downward,
      // and back before step 1 whenever it's left upward.
      if (steps.length) {
        const last = steps.length - 1
        ScrollTrigger.create({
          trigger: steps[0],
          start: 'top center',
          endTrigger: steps[last],
          end: 'bottom center',
          onLeave: () => {
            setActive(last)
            setReached(last)
          },
          onLeaveBack: () => setActive(-1),
        })
      }

      // 04 · Motion — scrubbed by its own block; per-frame writes go straight to the DOM
      const tcEl = q('[data-ai-tc]')[0]
      const barEl = q('[data-ai-bar]')[0]
      let lastTc = ''
      const render = (p) => {
        videoApi.current?.setProgress(p)
        const tc = toTimecode(p * MOTION_SECONDS)
        if (tcEl && tc !== lastTc) {
          tcEl.textContent = tc
          lastTc = tc
        }
        if (barEl) barEl.style.transform = `scaleX(${p.toFixed(4)})`
      }
      render(0)

      const motionTrigger = desktop ? steps[3] : q('.ai-step__visual')[3]
      if (motionTrigger) {
        const scrub = { p: 0 }
        gsap.to(scrub, {
          p: 1,
          ease: 'none',
          onUpdate: () => render(scrub.p),
          scrollTrigger: {
            trigger: motionTrigger,
            start: desktop ? 'top center' : 'top 85%',
            end: desktop ? 'bottom center' : 'bottom 20%',
            scrub: reduced ? true : 0.6,
          },
        })
      }

      if (desktop) {
        // Rail progress runs the length of the six blocks
        const fill = q('.ai-rail__fill')[0]
        if (fill && steps.length) {
          gsap.fromTo(
            fill,
            { scaleY: 0 },
            {
              scaleY: 1,
              ease: 'none',
              scrollTrigger: {
                trigger: steps[0],
                start: 'top center',
                endTrigger: steps[steps.length - 1],
                end: 'bottom center',
                scrub: reduced ? true : 0.5,
              },
            },
          )
        }
        gsap.from(q('.ai-stage__in'), {
          opacity: 0,
          y: reduced ? 0 : 90,
          duration: reduced ? 0.6 : 1.4,
          ease: reduced ? 'power1.out' : EASE.out,
          scrollTrigger: { trigger: q('.ai-flow__grid')[0], start: 'top 85%', once: true },
        })
        return
      }

      steps.forEach((el) => {
        gsap.from(el.children, {
          opacity: 0,
          y: reduced ? 0 : 40,
          duration: reduced ? 0.6 : 1.2,
          stagger: 0.08,
          ease: reduced ? 'power1.out' : EASE.out,
          scrollTrigger: { trigger: el, start: 'top 88%', once: true },
        })
      })
    },
    { scope: rootRef, dependencies: [desktop], revertOnUpdate: true },
  )

  // Rail → centre the chosen block in the viewport
  const go = (i) => {
    const el = rootRef.current?.querySelectorAll('.ai-step')[i]
    if (!el) return
    const offset = -Math.max(0, (window.innerHeight - el.offsetHeight) / 2)
    scrollTo(el, { offset, immediate: prefersReducedMotion() })
  }

  const cur = Math.max(active, 0)

  return (
    <div className="ai-flow" ref={rootRef}>
      <PartHead index="09.1" label="Image → video workflow" meta={`${STEP_TOTAL} steps · worked example — me, as a 3D character`} />

      <div className={`ai-flow__grid${desktop ? ' is-desktop' : ''}`}>
        {desktop && (
          <div className="ai-flow__stage">
            <div className="ai-stage">
              <div className="ai-stage__in">
                <Frame variant="stage">
                  {AI_WORKFLOW.map((s, i) => (
                    <Layer
                      key={s.n}
                      i={i}
                      shown={cur === i}
                      // scrolled back above step 1: keep its overlays rather than snapping them off in view
                      on={active === i || (i === 0 && active < 0 && reached >= 0)}
                      live={active === i}
                      videoRef={videoApi}
                    />
                  ))}
                </Frame>
                <Rail active={active} onGo={go} />
              </div>
            </div>
          </div>
        )}

        <ol className="ai-steps">
          {AI_WORKFLOW.map((s, i) => (
            <li key={s.n} className={`ai-step${active === i ? ' is-active' : ''}`}>
              {!desktop && (
                <div className="ai-step__visual">
                  <Frame variant="inline">
                    <Layer i={i} shown on={reached >= i} live={active === i} videoRef={videoApi} />
                  </Frame>
                </div>
              )}
              <div className="ai-step__text">
                <p className="ai-step__n t-mono">
                  <span className="ai-step__bar" aria-hidden="true" />
                  Step {s.n}
                </p>
                <h3 className="ai-step__title t-h2">{s.title}</h3>
                <p className="ai-step__body t-lead">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

/* ==========================================================================
   Part 2 — Continuity board
   ========================================================================== */
function Scenes({ group }) {
  const voice = group === 'Voice'
  const shot = SCENE_SHOTS[group]
  return (
    <div className="ai-cc__vis" aria-hidden="true">
      {SCENES.map((sc, k) => (
        <span className="ai-cc__scene" key={sc}>
          <span className={`ai-cc__thumb${voice ? ' ai-cc__thumb--wave' : ''}`}>
            {voice || !shot ? (
              <svg viewBox="0 0 36 64" preserveAspectRatio="none" focusable="false">
                {WAVE.map((h, i) => (
                  <rect key={i} x={i * 3.6 + 0.8} y={32 - h * 12} width="2" height={h * 24} rx="1" />
                ))}
              </svg>
            ) : (
              <img
                src={shot.src[k]}
                alt=""
                loading="lazy"
                decoding="async"
                draggable="false"
                style={{ transform: `scale(${shot.scale[k]})`, transformOrigin: shot.origin[k] }}
              />
            )}
          </span>
          <span className="ai-cc__sc t-mono">{sc}</span>
        </span>
      ))}
    </div>
  )
}

function Continuity() {
  const ref = useRef(null)

  useGSAP(
    () => {
      const root = ref.current
      const reduced = prefersReducedMotion()
      revealPart(root.querySelector('.ai-part'))

      const grid = root.querySelector('.ai-cont__grid')
      const cards = gsap.utils.toArray(grid.querySelectorAll('.ai-cc'))
      const tl = gsap.timeline({ scrollTrigger: { trigger: grid, start: 'top 78%', once: true } })
      cards.forEach((card, k) => {
        if (reduced) {
          tl.from(card, { opacity: 0, duration: 0.6, ease: 'power1.out' }, k * 0.06)
          return
        }
        const at = k * 0.14
        tl.from(card, { y: 64, opacity: 0, duration: 1.3, ease: EASE.out }, at)
          .from(card.querySelectorAll('.ai-cc__scene'), { y: 18, opacity: 0, duration: 1, stagger: 0.07, ease: EASE.out }, at + 0.2)
          .from(card.querySelectorAll('.ai-cc__row'), { opacity: 0, duration: 0.7, stagger: 0.055, ease: 'power2.out' }, at + 0.3)
          .fromTo(
            card.querySelectorAll('.ai-cc__tick path'),
            { strokeDashoffset: 1 },
            { strokeDashoffset: 0, duration: 0.65, stagger: 0.055, ease: 'power2.inOut' },
            at + 0.42,
          )
      })

      const note = root.querySelector('.ai-cont__note')
      gsap.from(note, {
        opacity: 0,
        y: reduced ? 0 : 24,
        duration: reduced ? 0.6 : 1.2,
        ease: reduced ? 'power1.out' : EASE.out,
        scrollTrigger: { trigger: note, start: 'top 92%', once: true },
      })
    },
    { scope: ref },
  )

  return (
    <div className="ai-cont" ref={ref}>
      <PartHead index="09.2" label="Continuity" meta={`${pad2(CONTINUITY.length)} groups · ${CHECK_TOTAL} checks`} />
      <SplitReveal as="h3" className="ai-cont__title t-h2">
        Continuity is a production requirement.
      </SplitReveal>

      <div className="ai-cont__grid">
        {CONTINUITY.map((g) => (
          <article className="ai-cc" key={g.group}>
            <header className="ai-cc__head">
              <h4 className="ai-cc__name t-h4">{g.group}</h4>
              <span className="ai-cc__count t-mono">{pad2(g.items.length)} checks</span>
            </header>
            <Scenes group={g.group} />
            <ul className="ai-cc__list" role="list">
              {g.items.map((it, k) => (
                <li className="ai-cc__row" key={it}>
                  <span className="ai-cc__box" aria-hidden="true">
                    <Tick className="ai-cc__tick" />
                  </span>
                  <span className="ai-cc__item">{it}</span>
                  <span className="ai-cc__k t-mono" aria-hidden="true">
                    {pad2(k + 1)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="ai-cc__note t-small">{CONTINUITY_NOTES[g.group]}</p>
          </article>
        ))}
      </div>

      <p className="ai-cont__note t-lead">
        The same character, the same product, the same voice — across every scene, so it feels like a{' '}
        <em className="t-serif t-fg">real campaign.</em>
      </p>
    </div>
  )
}

/* ==========================================================================
   Part 3 — What AI makes possible
   ========================================================================== */
function Uses() {
  const ref = useRef(null)

  useGSAP(
    () => {
      const root = ref.current
      const reduced = prefersReducedMotion()
      revealPart(root.querySelector('.ai-part'))
      gsap.from(root.querySelectorAll('.ai-use'), {
        opacity: 0,
        y: reduced ? 0 : 30,
        duration: reduced ? 0.5 : 1.1,
        ease: reduced ? 'power1.out' : EASE.out,
        stagger: { each: reduced ? 0.015 : 0.045, from: 'center' },
        scrollTrigger: { trigger: root.querySelector('.ai-uses__cloud'), start: 'top 86%', once: true },
      })
    },
    { scope: ref },
  )

  return (
    <div className="ai-uses" ref={ref}>
      <PartHead index="09.3" label="Applications" meta={`${pad2(AI_USES.length)} use cases`} />
      <SplitReveal as="h3" className="ai-uses__title t-h2">
        What AI makes <em className="t-serif">possible.</em>
      </SplitReveal>
      <ul className="ai-uses__cloud" role="list">
        {AI_USES.map((u, i) => (
          <li className="ai-use" key={u}>
            <span className="ai-use__n t-mono" aria-hidden="true">
              {pad2(i + 1)}
            </span>
            {u}
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ==========================================================================
   Part 4 — Production stack (glass bento over a drifting colour field)
   ========================================================================== */
function Spine() {
  return (
    <div className="ai-spine" aria-hidden="true">
      <div className="ai-spine__row ai-spine__ruler t-mono">
        <span />
        <span className="ai-spine__ticks">
          <span>00:00</span>
          <span>00:15</span>
          <span>00:30</span>
        </span>
      </div>
      <div className="ai-spine__body">
        {SPINE.map((t) => (
          <div className="ai-spine__row" key={t.k}>
            <span className={`ai-spine__k t-mono${t.hot ? ' is-hot' : ''}`}>{t.k}</span>
            <span className="ai-spine__lane">
              {t.clips.map(([a, b]) => (
                <i key={a} className={`ai-spine__clip${t.hot ? ' is-hot' : ''}`} style={{ left: `${a}%`, width: `${b - a}%` }} />
              ))}
            </span>
          </div>
        ))}
        <span className="ai-spine__zone">
          <span className="ai-spine__head" style={{ left: `${SPINE_AT}%` }}>
            <span className="ai-spine__tc t-mono">{SPINE_TC}</span>
          </span>
        </span>
      </div>
    </div>
  )
}

function Stack() {
  const ref = useRef(null)

  useGSAP(
    () => {
      const root = ref.current
      const q = gsap.utils.selector(root)
      const reduced = prefersReducedMotion()
      revealPart(q('.ai-part')[0])

      // Cards travel on transform only; their layers fade individually so the
      // backdrop blur never loses sight of the glow behind (opacity on the
      // glass element itself would cut it off until the fade finished).
      const tl = gsap.timeline({ scrollTrigger: { trigger: q('.ai-bento')[0], start: 'top 82%', once: true } })
      q('.ai-card').forEach((card, k) => {
        const at = k * (reduced ? 0.04 : 0.085)
        if (!reduced) tl.from(card, { y: 72, duration: 1.35, ease: EASE.out, clearProps: 'transform' }, at)
        // clearProps hands opacity back to the stylesheet (the glass sheen brightens on hover)
        tl.from(card.children, { opacity: 0, duration: reduced ? 0.6 : 1.1, ease: 'power2.out', clearProps: 'opacity' }, at)
      })
      if (reduced) return

      tl.from(q('.ai-spine__clip'), { scaleX: 0, transformOrigin: '0% 50%', duration: 1.1, stagger: 0.03, ease: EASE.inOut }, 0.35)

      // Slow colour drift — only while the stage is on screen
      const drift = gsap.timeline({ paused: true })
      q('.ai-glow__blob').forEach((b, k) => {
        const d = DRIFT[k % DRIFT.length]
        drift.to(b, { xPercent: d.x, yPercent: d.y, scale: d.s, duration: d.t, ease: 'sine.inOut', yoyo: true, repeat: -1 }, 0)
      })
      ScrollTrigger.create({
        trigger: q('.ai-stack__stage')[0],
        start: 'top bottom',
        end: 'bottom top',
        onToggle: (self) => (self.isActive ? drift.play() : drift.pause()),
      })
    },
    { scope: ref },
  )

  return (
    <div className="ai-stack" ref={ref}>
      <PartHead index="09.4" label="Production stack" meta={`${pad2(STACK.length)} capabilities · 1 spine`} />
      <div className="ai-stack__head">
        <SplitReveal as="h3" className="ai-stack__title t-h2">
          One spine. Six <em className="t-serif">plug-ins.</em>
        </SplitReveal>
        <p className="ai-stack__cap t-lead">The technology matters for what it enables — not as a list of logos.</p>
      </div>

      <div className="ai-stack__stage">
        <div className="ai-glow" aria-hidden="true">
          {GLOW.map((g) => (
            <img key={g.key} className={`ai-glow__blob ai-glow__blob--${g.key}`} src={g.src} alt="" loading="lazy" decoding="async" draggable="false" />
          ))}
        </div>
        <ul className="ai-bento" role="list">
          {STACK.map((s, i) => {
            const spine = i === 0
            return (
              <Glass
                as="li"
                key={s.title}
                className={`ai-card${spine ? ' ai-card--spine' : ''}`}
                radius="var(--r-lg)"
                tone="dark"
                // the spine card is too large for the displacement filter to stay cheap
                refract={!spine}
                bezel={0.12}
              >
                <div className="ai-card__in">
                  <div className="ai-card__top">
                    <span className="ai-card__idx t-mono">{pad2(i + 1)}</span>
                    {spine ? (
                      <span className="chip chip--accent">The spine</span>
                    ) : (
                      <span className="ai-card__code t-mono">{STACK_CODES[i]}</span>
                    )}
                  </div>
                  {spine && <Spine />}
                  <div className="ai-card__txt">
                    <h4 className="ai-card__title t-h3">{s.title}</h4>
                    <p className="ai-card__body t-small">{s.body}</p>
                  </div>
                </div>
              </Glass>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

/* ==========================================================================
   Section
   ========================================================================== */
export default function AIStudio() {
  return (
    <section id="ai" className="section ai" data-hud="AI + Human">
      <div className="container">
        <SectionHeader
          index="09"
          eyebrow="AI + human editing"
          aside="Generated · selected · edited"
          title={
            <>
              AI where it makes a <em className="t-serif">better ad.</em>
            </>
          }
          lead="Not AI for the sake of AI. Generated visuals step in when traditional footage can’t communicate the idea — then get edited like everything else."
        />
        <Workflow />
        <Continuity />
        <Uses />
        <Stack />
      </div>
    </section>
  )
}
