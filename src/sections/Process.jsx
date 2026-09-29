import { useEffect, useRef } from 'react'
import { gsap, ScrollTrigger, useGSAP, EASE } from '../lib/gsap'
import { prefersReducedMotion } from '../lib/env'
import { toTimecode } from '../lib/timecode'
import { useScroll } from '../app/context'
import { SectionHeader } from '../components/Primitives'
import Glass from '../components/LiquidGlass'
import ShotStack from '../components/ShotStack'
import { AdCaption } from '../components/VerticalVideo'
import { PROCESS, VO_WORKFLOW } from '../data/process'
import { MEDIA } from '../data/site'
import './Process.css'

/* ==========================================================================
   The sequence model — the eight-step process laid out as a 60-second edit.
   Everything below is derived deterministically from PROCESS at module load.
   ========================================================================== */
const DURATION = 60
const pad2 = (n) => String(n).padStart(2, '0')
const mmss = (sec) => `${pad2(Math.floor(sec / 60))}:${pad2(Math.round(sec) % 60)}`
const clamp01 = (n) => (n < 0 ? 0 : n > 1 ? 1 : n)
const TOTAL = pad2(PROCESS.length)
const NAV_KEYS = ['ArrowLeft', 'ArrowRight', 'Home', 'End']

/* Clip lengths in seconds — the edit itself gets the most room on the timeline */
const WEIGHTS = [6, 8, 8, 9, 11, 7, 5, 6]

/* The Program monitor builds one ad as the steps advance — the FOCUS spot made
   with my AI character (caption-free frames, so the step captions read clean) */
const MONITOR = [
  MEDIA.ai.environment,
  MEDIA.ai.character,
  MEDIA.ai.product,
  MEDIA.ai.takes[0],
  MEDIA.ai.startFrame,
  MEDIA.ai.takes[1],
  MEDIA.ai.scenes[1],
  MEDIA.ai.scenes[2],
]

/* The burned-in caption the Program monitor carries for each step */
const CAPTIONS = [
  { text: 'Start with the brief', hl: 'brief' },
  { text: 'Find the hook first', hl: 'hook' },
  { text: 'Map every single line', hl: 'line' },
  { text: 'Build what’s missing', hl: 'missing' },
  { text: 'Cut for retention', hl: 'retention' },
  { text: 'One concept, many ads', hl: 'many ads' },
  { text: 'Check every frame', hl: 'frame' },
  { text: 'Ready to test', hl: 'test' },
]

const STEPS = (() => {
  const w = PROCESS.map((_, i) => WEIGHTS[i] ?? 7)
  const sum = w.reduce((a, b) => a + b, 0)
  let acc = 0
  return PROCESS.map((step, i) => {
    const s = (acc / sum) * DURATION
    acc += w[i]
    return {
      ...step,
      i,
      s,
      e: (acc / sum) * DURATION,
      poster: MONITOR[i % MONITOR.length],
      caption: CAPTIONS[i] ?? { text: step.title, hl: '' },
    }
  })
})()

/** Seeded PRNG (mulberry32) — the "random" edit is identical on every load */
function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Waveform as a single SVG path of bars (viewBox: n × 100) */
const BARS_PER_SEC = { vo: 7, music: 9, sfx: 12 }
function wave(seed, dur, kind) {
  const r = rng(seed)
  const n = Math.max(6, Math.round(dur * BARS_PER_SEC[kind]))
  let d = ''
  let left = 0
  let len = 1
  let pos = 0
  let amp = 0
  let word = false
  for (let k = 0; k < n; k++) {
    let a
    if (kind === 'vo') {
      // speech: words (bursts) separated by short breaths
      if (left <= 0) {
        word = !word || r() < 0.25
        len = word ? 3 + Math.floor(r() * 6) : 1 + Math.floor(r() * 2)
        left = len
        pos = 0
        amp = word ? 0.42 + r() * 0.55 : 0.04 + r() * 0.06
      }
      const env = word ? Math.sin((Math.PI * (pos + 0.5)) / len) ** 0.6 : 1
      a = amp * env * (0.62 + r() * 0.38)
      left -= 1
      pos += 1
    } else if (kind === 'music') {
      // a steady bed with a kick every few bars, faded at the edges
      const fade = Math.min(1, (k + 1) / 8, (n - k) / 8)
      a = (0.24 + r() * 0.2 + (k % 6 === 0 ? 0.26 : 0)) * fade
    } else {
      // one-shot: fast attack, exponential tail
      const t = k / (n - 1)
      a = (t < 0.2 ? t / 0.2 : Math.exp(-(t - 0.2) * 3.4)) * (0.72 + r() * 0.28)
    }
    const h = Math.max(4, Math.min(94, a * 94))
    d += `M${(k + 0.2).toFixed(1)} ${((100 - h) / 2).toFixed(1)}h0.6v${h.toFixed(1)}h-0.6z`
  }
  return { d, n }
}

/** Caption chunks: one strong word per card, short words ride along */
function chunk(text) {
  const out = []
  let cur = []
  for (const w of text.split(' ')) {
    cur.push(w)
    if (w.replace(/[^a-z]/gi, '').length > 3 || cur.length === 2) {
      out.push(cur.join(' '))
      cur = []
    }
  }
  if (cur.length) {
    if (out.length) out[out.length - 1] += ` ${cur.join(' ')}`
    else out.push(cur.join(' '))
  }
  return out
}

const V2_LABELS = ['B-roll', 'AI insert', 'Product', 'Cutaway', 'AI scene', 'Macro', 'Demo', 'Overlay', 'UGC', 'Graphic']
const SFX_LABELS = ['Whoosh', 'Hit', 'Riser', 'Swipe', 'Impact', 'Pop', 'Click']

const LANES = (() => {
  const v3 = []
  const v2 = []
  const a1 = []
  const a2 = []
  STEPS.forEach((st, i) => {
    const r = rng(9973 * (i + 1) + 17)
    const len = st.e - st.s

    // V3 — captions ride the voiceover in short cards
    const words = chunk(st.caption.text)
    const slot = (len - 0.6) / words.length
    words.forEach((label, k) => {
      const mid = st.s + 0.3 + slot * (k + 0.5)
      const half = Math.min(slot - 0.24, 1.1 + r() * 0.9) / 2
      v3.push({ s: mid - half, e: mid + half, label })
    })

    // V2 — B-roll and AI inserts over the story
    const n2 = Math.max(1, Math.min(3, Math.round(len / 3.5)))
    const s2 = (len - 0.4) / n2
    for (let k = 0; k < n2; k++) {
      const lo = st.s + 0.2 + k * s2
      const a = lo + r() * s2 * 0.28
      const b = Math.min(lo + s2 - 0.14, a + s2 * (0.42 + r() * 0.4))
      v2.push({ s: a, e: b, label: V2_LABELS[(i * 3 + k) % V2_LABELS.length] })
    }

    // A1 — the voiceover: one or two sentences per step
    const two = len >= 8
    const mid = st.s + len * (0.46 + r() * 0.08)
    const lines = two
      ? [
          [st.s + 0.25, mid - 0.18],
          [mid + 0.18, st.e - 0.3],
        ]
      : [[st.s + 0.25, st.e - 0.3]]
    lines.forEach(([s, e], k) => {
      a1.push({ s, e, label: `VO ${st.n}${two ? 'ab'[k] : ''}`, wave: wave(311 * (i + 1) + k, e - s, 'vo') })
    })
  })

  // A2 — music bed (the drop lands on the edit) with a hit on every cut
  const drop = STEPS[4]?.s ?? DURATION / 2
  a2.push({ s: 0, e: drop - 0.2, label: 'Music · Bed', row: 'lo', wave: wave(4242, drop - 0.2, 'music') })
  a2.push({ s: drop + 0.2, e: DURATION, label: 'Music · Drop', row: 'lo', wave: wave(4243, DURATION - drop - 0.2, 'music') })
  STEPS.slice(1).forEach((st, k) => {
    a2.push({ s: st.s - 0.5, e: st.s + 0.55, label: SFX_LABELS[k % SFX_LABELS.length], row: 'hi', wave: wave(777 + k, 1.05, 'sfx') })
  })

  return [
    { id: 'v3', code: 'V3', name: 'Captions', clips: v3 },
    { id: 'v2', code: 'V2', name: 'B-roll & AI', clips: v2 },
    { id: 'v1', code: 'V1', name: 'Story', main: true, target: true },
    { id: 'a1', code: 'A1', name: 'Voiceover', clips: a1, target: true, audio: true },
    { id: 'a2', code: 'A2', name: 'Music & SFX', clips: a2, audio: true },
  ]
})()

const TICKS = Array.from({ length: DURATION + 1 }, (_, s) => s)
const LABEL_TICKS = TICKS.filter((s) => s % 5 === 0)
const SHOTS = STEPS.map((st) => ({ src: st.poster, at: st.s / DURATION, from: 1.03, to: 1.12, origin: '50% 42%' }))

const span = (s, e) => ({ '--s': s / DURATION, '--w': (e - s) / DURATION })

/* ==========================================================================
   Pieces
   ========================================================================== */

/** One step in the glass inspector (desktop). All eight are stacked; one shows. */
function StepDetail({ step }) {
  return (
    <div className="pr-step">
      <p className="pr-step__num">
        <span className="pr-mask">
          <span className="pr-rise">{step.n}</span>
        </span>
      </p>
      <p className="pr-step__tc pr-fade">
        <span>
          <span className="pr-step__k">In</span>
          {toTimecode(step.s)}
        </span>
        <span>
          <span className="pr-step__k">Out</span>
          {toTimecode(step.e)}
        </span>
      </p>
      <p className="pr-step__verb">
        <span className="pr-mask">
          <span className="pr-rise">{step.verb}</span>
        </span>
      </p>
      <p className="pr-step__title t-h1">
        <span className="pr-mask">
          <span className="pr-rise">{step.title}</span>
        </span>
      </p>
      <ul className="pr-step__items">
        {step.items.map((item) => (
          <li className="chip pr-chip pr-fade" key={item}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** V1 — a step as a clip on the story track. Selecting it seeks the playhead there. */
function StoryClip({ step }) {
  return (
    <button
      type="button"
      className="pr-clip pr-clip--v1"
      data-i={step.i}
      data-s={step.s}
      data-e={step.e}
      style={span(step.s, step.e)}
      aria-label={`Jump to step ${step.n} of ${TOTAL}: ${step.title}`}
    >
      <span className="pr-clip__lit" aria-hidden="true" />
      <span className="pr-clip__bar" aria-hidden="true" />
      <img className="pr-clip__thumb" src={step.poster} alt="" loading="lazy" decoding="async" draggable="false" />
      <span className="pr-clip__txt" aria-hidden="true">
        <span className="pr-clip__name">
          <span className="pr-clip__n">{step.n}</span>
          {step.title}
        </span>
        <span className="pr-clip__sub">{step.verb}</span>
      </span>
    </button>
  )
}

/** Decorative clip on the supporting tracks */
function Clip({ clip, lane }) {
  return (
    <span
      className={`pr-clip pr-clip--${lane}${clip.row ? ` pr-clip--${clip.row}` : ''}`}
      data-s={clip.s}
      data-e={clip.e}
      style={span(clip.s, clip.e)}
    >
      {clip.wave && (
        <svg className="pr-wave" viewBox={`0 0 ${clip.wave.n} 100`} preserveAspectRatio="none" focusable="false">
          <path d={clip.wave.d} />
        </svg>
      )}
      <span className="pr-clip__lit" />
      <span className="pr-clip__label">{clip.label}</span>
    </span>
  )
}

/* ==========================================================================
   Section
   ========================================================================== */
export default function Process() {
  const rootRef = useRef(null)
  const shotsApi = useRef(null)
  const { scrollTo } = useScroll()
  const scrollToRef = useRef(scrollTo)

  useEffect(() => {
    scrollToRef.current = scrollTo
  }, [scrollTo])

  useGSAP(
    () => {
      const root = rootRef.current
      const q = gsap.utils.selector(root)
      const reduced = prefersReducedMotion()
      const mm = gsap.matchMedia()
      /* Breakpoint rebuilds append their triggers last; matchMedia refreshes right
         after the handlers, so put everything back in page order first */
      let built = false

      /* -------------------------------------------------------------------
         Desktop — a pinned NLE: the timeline scrolls under a fixed playhead
         ------------------------------------------------------------------- */
      mm.add('(min-width: 1024px)', () => {
        const pin = q('.pr-pin')[0]
        const tlEl = q('.pr-tl')[0]
        const strip = q('.pr-strip')[0]
        const ph = q('.pr-ph')[0]
        const flag = q('.pr-ph__tc')[0]
        const lane = q('.pr-lane--v1')[0]
        const panel = q('.pr-panel')[0]
        const mon = q('.pr-mon')[0]
        const countN = q('.pr-count__n')[0]
        const countName = q('.pr-count__name')[0]
        if (!pin || !strip || !ph || !lane) return

        const story = q('.pr-clip--v1')
        const caps = q('.pr-mon__cap')
        const amb = q('.pr-amb__img')
        const parts = q('.pr-step').map((el) => ({
          el,
          rises: gsap.utils.toArray(el.querySelectorAll('.pr-rise')),
          fades: gsap.utils.toArray(el.querySelectorAll('.pr-fade')),
        }))
        const clips = q('.pr-clip').map((el) => ({
          el,
          lit: el.querySelector('.pr-clip__lit'),
          s: Number(el.dataset.s),
          e: Number(el.dataset.e),
          f: -1,
          on: false,
        }))
        const partEls = parts.flatMap((p) => [p.el, ...p.rises, ...p.fades])

        let active = -1
        let lastTc = ''

        gsap.set(
          parts.map((p) => p.el),
          { autoAlpha: 0 },
        )
        gsap.set(amb, { autoAlpha: 0 })

        /* Inspector crossfade — a masked rise, direction-aware, killable mid-flight */
        const showStep = (i, dir, instant) => {
          const p = parts[i]
          if (!p) return
          gsap.killTweensOf([p.el, ...p.rises, ...p.fades])
          if (instant) {
            gsap.set(p.el, { autoAlpha: 1 })
            gsap.set(p.rises, { yPercent: 0 })
            gsap.set(p.fades, { opacity: 1, y: 0 })
            return
          }
          if (reduced) {
            gsap.set(p.rises, { yPercent: 0 })
            gsap.set(p.fades, { opacity: 1, y: 0 })
            gsap.to(p.el, { autoAlpha: 1, duration: 0.35, ease: 'power1.out' })
            return
          }
          gsap.set(p.el, { autoAlpha: 1 })
          gsap.fromTo(
            p.rises,
            { yPercent: 108 * dir },
            { yPercent: 0, duration: 0.62, ease: EASE.out, stagger: 0.045, delay: 0.08 },
          )
          gsap.fromTo(
            p.fades,
            { opacity: 0, y: 10 },
            { opacity: 1, y: 0, duration: 0.5, ease: EASE.out, stagger: 0.022, delay: 0.16 },
          )
        }

        const hideStep = (i, dir) => {
          const p = parts[i]
          if (!p) return
          gsap.killTweensOf([p.el, ...p.rises, ...p.fades])
          if (reduced) {
            gsap.to(p.el, { autoAlpha: 0, duration: 0.3, ease: 'power1.out' })
            return
          }
          gsap.to(p.rises, { yPercent: -108 * dir, duration: 0.42, ease: EASE.inOut, stagger: 0.03 })
          gsap.to(p.fades, { opacity: 0, duration: 0.24, ease: 'power1.out' })
          gsap.set(p.el, { autoAlpha: 0, delay: 0.52 })
        }

        const setActive = (next) => {
          if (next === active) return
          const prev = active
          const first = prev < 0
          const dir = first || next > prev ? 1 : -1
          active = next

          if (!first) hideStep(prev, dir)
          showStep(next, dir, first)

          story.forEach((el, k) => {
            el.classList.toggle('is-active', k === next)
            if (k === next) el.setAttribute('aria-current', 'step')
            else el.removeAttribute('aria-current')
          })
          caps.forEach((el, k) => el.classList.toggle('is-on', k === next))

          if (amb[prev]) gsap.to(amb[prev], { autoAlpha: 0, duration: 0.9, ease: EASE.soft, overwrite: true })
          if (amb[next]) gsap.to(amb[next], { autoAlpha: 1, duration: first ? 0 : 0.9, ease: EASE.soft, overwrite: true })

          if (countN) {
            countN.textContent = pad2(next + 1)
            if (!first && !reduced) {
              gsap.fromTo(countN, { yPercent: 100 * dir }, { yPercent: 0, duration: 0.5, ease: EASE.out, overwrite: true })
            }
          }
          if (countName) countName.textContent = STEPS[next]?.title ?? ''
        }

        /* The scrub: strip x maps 00:00 → 01:00 under the playhead */
        const tl = gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: {
            trigger: pin,
            start: 'top top',
            end: '+=320%',
            pin: true,
            scrub: 1,
            anticipatePin: 1,
            invalidateOnRefresh: true,
          },
        })
        tl.fromTo(
          strip,
          { x: () => ph.offsetLeft },
          { x: () => ph.offsetLeft - strip.offsetWidth, duration: 1 },
        )

        // Reads the (smoothed) timeline progress; writes only what changed
        const sync = () => {
          const p = tl.progress()
          const t = p * DURATION

          const tc = toTimecode(t)
          if (tc !== lastTc) {
            lastTc = tc
            if (flag) flag.textContent = tc
          }

          for (const c of clips) {
            const f = clamp01((t - c.s) / (c.e - c.s))
            if (f === c.f || (Math.abs(f - c.f) < 0.0008 && f > 0 && f < 1)) continue
            c.f = f
            if (c.lit) c.lit.style.transform = `scaleX(${f.toFixed(4)})`
            const on = f > 0
            if (on !== c.on) {
              c.on = on
              c.el.classList.toggle('is-lit', on)
            }
          }

          let a = STEPS.length - 1
          for (let k = 0; k < STEPS.length; k++) {
            if (t < STEPS[k].e) {
              a = k
              break
            }
          }
          setActive(a)
          shotsApi.current?.setProgress(p)
        }
        tl.eventCallback('onUpdate', sync)
        sync()

        /* Approach: inspector and monitor settle into place (scroll-linked) */
        if (!reduced) {
          const approach = { trigger: pin, start: 'top bottom', end: 'top top', scrub: true }
          if (panel) gsap.fromTo(panel, { y: 72 }, { y: 0, ease: 'none', scrollTrigger: approach })
          if (mon) gsap.fromTo(mon, { y: 132 }, { y: 0, ease: 'none', scrollTrigger: { ...approach } })

          /* Build: the first seconds of media are laid onto the tracks */
          const visible = clips
            .filter((c) => c.s < 20)
            .sort((a, b) => a.s - b.s)
            .map((c) => c.el)
          gsap
            .timeline({ scrollTrigger: { trigger: tlEl, pinnedContainer: pin, start: 'top 90%', once: true } })
            .from(q('.pr-tl__corner, .pr-track'), { opacity: 0, x: -14, duration: 1, stagger: 0.06, ease: EASE.out }, 0)
            .from(q('.pr-ruler'), { opacity: 0, duration: 1.2, ease: EASE.soft }, 0.1)
            .fromTo(
              visible,
              { clipPath: 'inset(0% 100% 0% 0%)' },
              {
                clipPath: 'inset(0% 0% 0% 0%)',
                duration: 1.1,
                ease: EASE.out,
                stagger: 0.022,
                clearProps: 'clipPath',
              },
              0.2,
            )
            .from(q('.pr-ph__line'), { scaleY: 0, duration: 1.3, ease: EASE.inOut }, 0.15)
            .from(q('.pr-ph__flag, .pr-ph__glow'), { opacity: 0, duration: 0.8, ease: EASE.soft }, 0.55)
        }

        /* Selecting a clip seeks the playhead to it (click, or keyboard focus) */
        const seek = (i) => {
          const st = tl.scrollTrigger
          const step = STEPS[i]
          if (!st || !step) return
          const p = (step.s + step.e) / 2 / DURATION
          scrollToRef.current(st.start + p * (st.end - st.start), { duration: 1.2, immediate: reduced })
        }
        const clipOf = (e) => (e.target instanceof Element ? e.target.closest('.pr-clip--v1') : null)
        const onClick = (e) => {
          const b = clipOf(e)
          if (b) seek(Number(b.dataset.i))
        }
        const onFocusIn = (e) => {
          const b = clipOf(e)
          if (b && b.matches(':focus-visible')) seek(Number(b.dataset.i))
        }
        lane.addEventListener('click', onClick)
        lane.addEventListener('focusin', onFocusIn)
        if (built) ScrollTrigger.sort()

        return () => {
          lane.removeEventListener('click', onClick)
          lane.removeEventListener('focusin', onFocusIn)
          gsap.killTweensOf([...partEls, ...amb, countN].filter(Boolean))
          gsap.set([...partEls, ...amb, countN].filter(Boolean), { clearProps: 'opacity,visibility,transform' })
          clips.forEach((c) => {
            c.lit?.style.removeProperty('transform')
            c.el.classList.remove('is-lit', 'is-active')
            c.el.removeAttribute('aria-current')
          })
          caps.forEach((el) => el.classList.remove('is-on'))
          if (flag) flag.textContent = toTimecode(0)
          if (countN) countN.textContent = pad2(1)
          if (countName) countName.textContent = STEPS[0]?.title ?? ''
        }
      })

      /* -------------------------------------------------------------------
         Phones & tablets — a vertical track, scrubbed by scroll
         ------------------------------------------------------------------- */
      mm.add('(max-width: 1023px)', () => {
        const list = q('.pr-list')[0]
        const rail = q('.pr-rail')[0]
        const fill = q('.pr-rail__fill')[0]
        const head = q('.pr-rail__head')[0]
        const cards = q('.pr-card')
        if (!list || !rail) return

        let marks = []
        let listH = 0
        let reached = -1
        const measure = () => {
          listH = list.offsetHeight
          marks = cards.map((c) => {
            const node = c.querySelector('.pr-card__node')
            return c.offsetTop + (node ? node.offsetTop + node.offsetHeight / 2 : 0)
          })
        }
        const mark = (y) => {
          let r = 0
          for (const m of marks) if (m <= y + 1) r += 1
          if (r === reached) return
          reached = r
          cards.forEach((c, k) => c.classList.toggle('is-reached', k < r))
        }
        measure()

        gsap
          .timeline({
            defaults: { ease: 'none' },
            scrollTrigger: {
              trigger: list,
              start: 'top 72%',
              end: 'bottom 72%',
              scrub: true,
              invalidateOnRefresh: true,
              onRefresh: (self) => {
                measure()
                mark(self.progress * listH)
              },
              onUpdate: (self) => mark(self.progress * listH),
            },
          })
          .fromTo(fill, { scaleY: 0 }, { scaleY: 1 }, 0)
          .fromTo(head, { y: 0 }, { y: () => rail.offsetHeight }, 0)
        mark(0)

        if (!reduced) {
          cards.forEach((card) => {
            gsap.from(card, {
              opacity: 0,
              y: 44,
              duration: 1.2,
              ease: EASE.out,
              scrollTrigger: { trigger: card, start: 'top 92%', once: true },
            })
          })
        }
        if (built) ScrollTrigger.sort()

        return () => {
          gsap.killTweensOf(cards)
          cards.forEach((c) => c.classList.remove('is-reached'))
        }
      })
      built = true

      /* -------------------------------------------------------------------
         Voiceover workflow — both layouts
         ------------------------------------------------------------------- */
      const vo = q('.pr-vo')[0]
      if (vo) {
        const head = gsap.utils.toArray(vo.querySelectorAll('.pr-vo__label, .pr-vo__line'))
        const items = gsap.utils.toArray(vo.querySelectorAll('.pr-vo__txt'))
        const arrows = gsap.utils.toArray(vo.querySelectorAll('.pr-vo__arrow'))
        const intro = gsap.timeline({ scrollTrigger: { trigger: vo, start: 'top 86%', once: true } })
        if (reduced) {
          intro.from([...head, ...items, ...arrows], { opacity: 0, duration: 0.6, stagger: 0.03, ease: 'power1.out' })
        } else {
          intro
            .from(head, { opacity: 0, y: 24, duration: 1.2, stagger: 0.08, ease: EASE.out }, 0)
            .from(items, { opacity: 0, y: 14, duration: 1, stagger: 0.09, ease: EASE.out }, 0.25)
            .fromTo(arrows, { '--draw': 0 }, { '--draw': 1, duration: 0.9, stagger: 0.09, ease: EASE.inOut }, 0.4)
        }
      }

      return () => mm.revert()
    },
    { scope: rootRef },
  )

  // Story track keys: ← → Home End move between clips (focus seeks the playhead)
  const onStoryKey = (e) => {
    if (!NAV_KEYS.includes(e.key)) return
    const btns = Array.from(e.currentTarget.querySelectorAll('.pr-clip--v1'))
    const i = btns.indexOf(document.activeElement)
    if (i < 0) return
    e.preventDefault()
    const n = btns.length
    const next =
      e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : Math.max(0, Math.min(n - 1, i + (e.key === 'ArrowRight' ? 1 : -1)))
    btns[next]?.focus({ preventScroll: true })
  }

  return (
    <section ref={rootRef} id="process" className="pr" data-hud="Process">
      <div className="container pr-head">
        <SectionHeader
          index="08"
          eyebrow="Process"
          aside="Brief → Delivery"
          title={
            <>
              From brief to <em className="t-serif">delivery.</em>
            </>
          }
          lead="Eight steps, one repeatable system — laid out like the edit it produces."
        />
      </div>

      {/* Vertical timeline for phones & tablets. On desktop it stays in the
          accessibility tree as the readable version of the pinned edit. */}
      <div className="container pr-mobile">
        <div className="pr-vt">
          <span className="pr-rail" aria-hidden="true">
            <span className="pr-rail__fill" />
            <span className="pr-rail__head" />
          </span>
          <ol className="pr-list" aria-label="The process, step by step">
            {STEPS.map((st) => (
              <li className="pr-card" key={st.n}>
                <span className="pr-card__node" aria-hidden="true" />
                <h3 className="pr-card__title">
                  <span className="sr-only">Step {st.n}: </span>
                  {st.title}
                </h3>
                <p className="pr-card__verb">{st.verb}</p>
                <span className="pr-card__big" aria-hidden="true">
                  {st.n}
                </span>
                <ul className="pr-card__items">
                  {st.items.map((item) => (
                    <li className="chip pr-chip" key={item}>
                      {item}
                    </li>
                  ))}
                </ul>
                <p className="pr-card__tc" aria-hidden="true">
                  <span>
                    <span className="pr-card__k">In</span>
                    {toTimecode(st.s)}
                  </span>
                  <span>
                    <span className="pr-card__k">Out</span>
                    {toTimecode(st.e)}
                  </span>
                </p>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* Desktop — the pinned edit suite */}
      <div className="pr-pin">
        <div className="container pr-stage">
          <div className="pr-upper">
            <div className="pr-amb" aria-hidden="true">
              {STEPS.map((st) => (
                <img key={st.n} className="pr-amb__img" src={st.poster} alt="" loading="lazy" decoding="async" draggable="false" />
              ))}
            </div>

            <Glass className="pr-panel" tone="dark" refract={false} radius="var(--r-xl)" aria-hidden="true">
              <div className="pr-panel__stack">
                {STEPS.map((st) => (
                  <StepDetail key={st.n} step={st} />
                ))}
              </div>
            </Glass>

            <div className="pr-mon" aria-hidden="true">
              <p className="pr-mon__bar">
                <span className="pr-mon__tag">
                  <span className="pr-mon__dot" />
                  Program
                </span>
                <span>9:16 · 24p</span>
              </p>
              <div className="pr-mon__frame">
                <ShotStack ref={shotsApi} shots={SHOTS} />
                <span className="pr-mon__shade" />
                <span className="pr-mon__crop cropmarks" />
                {STEPS.map((st) => (
                  <AdCaption key={st.n} className="pr-mon__cap" text={st.caption.text} hl={st.caption.hl} />
                ))}
              </div>
            </div>
          </div>

          <div className="pr-tl">
            <p className="pr-tl__corner" aria-hidden="true">
              <span>Seq 01</span>
              <span>24 fps</span>
            </p>
            <div className="pr-tl__heads" aria-hidden="true">
              {LANES.map((l) => (
                <div key={l.id} className={`pr-track pr-track--${l.id}${l.target ? ' is-target' : ''}`}>
                  <span className="pr-track__code">{l.code}</span>
                  <span className="pr-track__name">{l.name}</span>
                  {l.audio && (
                    <span className="pr-track__tools">
                      <span>M</span>
                      <span>S</span>
                    </span>
                  )}
                </div>
              ))}
            </div>

            <div className="pr-tl__view">
              <div className="pr-tl__rows" aria-hidden="true">
                <span className="pr-row pr-row--ruler" />
                {LANES.map((l) => (
                  <span key={l.id} className={`pr-row pr-row--${l.id}`} />
                ))}
              </div>

              <div className="pr-strip">
                <div className="pr-ruler" aria-hidden="true">
                  {TICKS.map((s) => (
                    <span key={s} className={`pr-tick${s % 5 === 0 ? ' is-major' : ''}`} style={{ '--x': s / DURATION }} />
                  ))}
                  {LABEL_TICKS.map((s) => (
                    <span key={`l${s}`} className="pr-tick__l" style={{ '--x': s / DURATION }}>
                      {mmss(s)}
                    </span>
                  ))}
                </div>
                <div className="pr-lanes">
                  {LANES.map((l) =>
                    l.main ? (
                      <div
                        key={l.id}
                        className="pr-lane pr-lane--v1"
                        role="group"
                        aria-label="Process timeline — select a step to jump to it"
                        onKeyDown={onStoryKey}
                      >
                        {STEPS.map((st) => (
                          <StoryClip key={st.n} step={st} />
                        ))}
                      </div>
                    ) : (
                      <div key={l.id} className={`pr-lane pr-lane--${l.id}`} aria-hidden="true">
                        {l.clips.map((c, k) => (
                          <Clip key={k} clip={c} lane={l.id} />
                        ))}
                      </div>
                    ),
                  )}
                </div>
              </div>

              <div className="pr-ph" aria-hidden="true">
                <span className="pr-ph__glow" />
                <span className="pr-ph__line" />
                <span className="pr-ph__flag">
                  <span className="pr-ph__tc">{toTimecode(0)}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="pr-foot">
            <p className="pr-count" aria-hidden="true">
              <span className="pr-count__k">Step</span>
              <span className="pr-count__win">
                <span className="pr-count__n">{pad2(1)}</span>
              </span>
              <span className="pr-count__of">/ {TOTAL}</span>
              <span className="pr-count__bar" />
              <span className="pr-count__name">{STEPS[0]?.title}</span>
            </p>
            <p className="pr-hint">Scroll to scrub — select a clip to jump</p>
          </div>
        </div>
      </div>

      {/* Voiceover-driven workflow */}
      <div className="container pr-vo">
        <div className="pr-vo__head">
          <p className="pr-vo__label">
            <span className="pr-vo__icon" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
              <span />
            </span>
            Voiceover-driven workflow
          </p>
          <p className="pr-vo__line">
            Each sentence of the script is mapped to a specific <span className="caption-hl">visual</span>.
          </p>
        </div>
        <ol className="pr-vo__flow" aria-label="Voiceover-driven workflow">
          {VO_WORKFLOW.map((name, i) => (
            <li key={name} className="pr-vo__step">
              <span className="pr-vo__txt">
                <span className="pr-vo__i" aria-hidden="true">
                  {pad2(i + 1)}
                </span>
                <span className="pr-vo__name">{name}</span>
              </span>
              {i < VO_WORKFLOW.length - 1 && (
                <span className="pr-vo__arrow" aria-hidden="true">
                  <span className="pr-vo__shaft" />
                  <span className="pr-vo__tip" />
                </span>
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
