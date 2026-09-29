import { useId, useMemo, useRef, useState } from 'react'
import { gsap, useGSAP, EASE } from '../lib/gsap'
import { prefersReducedMotion, MQ } from '../lib/env'
import { useIsDesktop } from '../lib/hooks'
import { useScroll } from '../app/context'
import { toTimecode } from '../lib/timecode'
import { SITE, POSTERS } from '../data/site'
import ScrubVideo from '../components/ScrubVideo'
import ShotStack from '../components/ShotStack'
import Glass from '../components/LiquidGlass'
import SplitReveal from '../components/SplitReveal'
import { Eyebrow } from '../components/Primitives'
import './HookScrub.css'

/* --------------------------------------------------------------------------
   Choreography — the whole pin is the hook window of the ad. project.scrub is
   an all-intra file of exactly that window (project.hook.seconds long).
   -------------------------------------------------------------------------- */
const STEP_FIRST = 0.1 // the points light in sequence, spread evenly from 10%…
const STEP_LAST = 0.82 // …to 82% of the pin
const WORDS_BY = 0.85 // the placeholder caption is fully on screen by 85% of the pin
const CUTS = [
  { at: 0, origin: '50% 42%' },
  { at: 0.38, origin: '38% 32%' },
  { at: 0.72, origin: '62% 54%' },
]

const pad2 = (n) => String(n).padStart(2, '0')
const clamp01 = (n) => Math.min(1, Math.max(0, n))
/** 6 → "6", 6.3 → "6.3" */
const fmtS = (s) => (Number.isInteger(s) ? String(s) : s.toFixed(1))

/** Progress at which point i lights, for n points */
function stepsFor(n) {
  return Array.from({ length: n }, (_, i) => (n > 1 ? STEP_FIRST + ((STEP_LAST - STEP_FIRST) * i) / (n - 1) : STEP_FIRST))
}

function stepAt(p, steps) {
  let i = -1
  for (let k = 0; k < steps.length; k++) if (p >= steps[k]) i = k
  return i
}

/** Character range of the highlight phrase inside the line (case-insensitive), or null */
function findPhrase(line, phrase) {
  const needle = phrase?.trim()
  if (!needle) return null
  const at = line.toLowerCase().indexOf(needle.toLowerCase())
  return at < 0 ? null : [at, at + needle.length]
}

/**
 * Caption words for the phone. Words overlapping the project's highlight
 * phrase get the caption box; if the phrase isn't in the hook line, the last
 * two words carry it instead.
 */
function captionWords(line, phrase) {
  const words = Array.from(line.matchAll(/\S+/g), (m) => ({ text: m[0], s: m.index, e: m.index + m[0].length }))
  const range = findPhrase(line, phrase)
  return words.map((w, i) => ({
    text: w.text,
    hl: range ? w.s < range[1] && w.e > range[0] : i >= words.length - 2,
  }))
}

/** The hook line split around its payoff phrase (set in the serif) */
function splitLine(line, phrase) {
  const range = findPhrase(line, phrase)
  if (range) return [line.slice(0, range[0]), line.slice(range[0], range[1]), line.slice(range[1])]
  const words = line.split(' ')
  const cut = Math.max(0, words.length - 2)
  const head = words.slice(0, cut).join(' ')
  return [head ? `${head} ` : '', words.slice(cut).join(' '), '']
}

/** "0.0 – 2.8s" → 2.8 (clamped to the ruler) */
function windowEnd(label, max) {
  const m = /([\d.]+)\s*s?\s*$/.exec(label ?? '')
  const v = m ? parseFloat(m[1]) : max
  return Number.isFinite(v) ? Math.min(max, Math.max(0.1, v)) : max
}

/** Ruler for a hook of `s` seconds: story segments per second, finer ticks on short hooks */
function rulerFor(s) {
  const long = s > 6
  const step = long ? 0.5 : 0.25
  const n = Math.floor(s / step)
  const every = long ? 2 : 1
  return {
    segments: Array.from({ length: Math.max(1, Math.ceil(s - 0.05)) }, (_, i) => i),
    ticks: Array.from({ length: n + 1 }, (_, i) => (i * step) / s),
    major: Math.round(1 / step),
    seconds: Array.from({ length: Math.floor(s / every) + 1 }, (_, i) => i * every),
  }
}

/**
 * 02 — The hook.
 * A pinned 9:16 phone scrubs the ad's opening while the timecode runs and
 * the five reasons the hook works light up in sequence.
 */
export default function HookScrub({ project }) {
  const root = useRef(null)
  const videoApi = useRef(null)
  const shotsApi = useRef(null)
  const tcRef = useRef(null)
  const stRef = useRef(null)
  const [active, setActive] = useState(-1)
  const desktop = useIsDesktop()
  const { scrollTo } = useScroll()
  const titleId = useId()

  const { hook, captionHl, poster, title, scrub } = project
  const hookS = hook.seconds
  const ruler = useMemo(() => rulerFor(hookS), [hookS])
  const points = hook.points
  const steps = useMemo(() => stepsFor(points.length), [points.length])
  // Placeholder footage gets typed-on captions; real ads carry their own
  const words = useMemo(
    () => (SITE.placeholderMode ? captionWords(hook.line, captionHl) : []),
    [hook.line, captionHl],
  )
  const [linePre, linePay, linePost] = useMemo(() => splitLine(hook.line, captionHl), [hook.line, captionHl])
  const winEnd = useMemo(() => windowEnd(hook.window, hookS), [hook.window, hookS])
  const shots = useMemo(() => {
    const k = Math.max(0, POSTERS.indexOf(poster))
    const srcs = [poster, POSTERS[(k + 3) % POSTERS.length], POSTERS[(k + 6) % POSTERS.length]]
    return CUTS.map((c, i) => ({ src: srcs[i], at: c.at, from: 1.04, to: 1.16, origin: c.origin }))
  }, [poster])

  useGSAP(
    () => {
      const el = root.current
      const q = gsap.utils.selector(el)
      const reduced = prefersReducedMotion()
      const wordEls = q('.hs-w')
      const n = wordEls.length

      /* ---------- Pinned scrub (desktop pins the whole stage, mobile the phone stack) ---------- */
      const mm = gsap.matchMedia()
      mm.add({ isDesktop: MQ.desktop, isMobile: MQ.tablet }, (ctx) => {
        const { isDesktop } = ctx.conditions
        const pin = q(isDesktop ? '.hs-pin' : '.hs-stage')[0]
        const tcEl = tcRef.current
        const segs = q('.hs-seg__fill')
        const scale = q('.hs-ruler__scale')[0]
        const head = q('.hs-ruler__ph')[0]
        if (!pin || !tcEl || !scale || !head) return

        let lastTc = ''
        let lastCount = -1
        let lastStep = -2

        const paint = (p, withState) => {
          videoApi.current?.setProgress(p)
          shotsApi.current?.setProgress(p)
          const code = toTimecode(p * hookS)
          if (code !== lastTc) {
            lastTc = code
            tcEl.textContent = code
          }
          const count = Math.min(n, Math.ceil((p * n) / WORDS_BY))
          if (count !== lastCount) {
            lastCount = count
            wordEls.forEach((w, i) => w.classList.toggle('is-on', i < count))
          }
          if (!withState) return
          const s = stepAt(p, steps)
          if (s !== lastStep) {
            lastStep = s
            setActive(s)
          }
        }

        const tl = gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: {
            trigger: pin,
            start: 'top top',
            end: isDesktop ? '+=240%' : '+=180%',
            pin: true,
            scrub: reduced ? true : 1,
            anticipatePin: 1,
            invalidateOnRefresh: true,
          },
          onUpdate: () => paint(tl.progress(), true),
        })
        const segN = ruler.segments.length
        ruler.segments.forEach((i) => {
          if (segs[i]) tl.fromTo(segs[i], { scaleX: 0 }, { scaleX: 1, duration: 1 / segN }, i / segN)
        })
        tl.fromTo(head, { x: 0 }, { x: () => Math.max(0, scale.clientWidth - 1), duration: 1 }, 0)

        stRef.current = tl.scrollTrigger
        paint(clamp01(tl.progress()), false)

        return () => {
          stRef.current = null
          wordEls.forEach((w) => w.classList.remove('is-on'))
          setActive(-1)
        }
      })

      /* ---------- Entrance (once) ---------- */
      const media = q('.hs-media')[0]
      const headEl = q('.hs-head')[0]
      const list = q('.hs-points-wrap')[0]
      if (!media || !headEl || !list) return () => mm.revert()
      const once = (trigger, start = 'top 82%') => ({ trigger, start, once: true })

      if (reduced) {
        gsap.fromTo(
          q('.hs-phone, .hs-ruler'),
          { autoAlpha: 0 },
          { autoAlpha: 1, duration: 0.7, ease: 'power1.out', stagger: 0.08, scrollTrigger: once(media, 'top 88%') },
        )
        gsap.fromTo(
          q('.hs-eyebrow, .hs-line__mark, .hs-window'),
          { autoAlpha: 0 },
          { autoAlpha: 1, duration: 0.7, ease: 'power1.out', stagger: 0.05, scrollTrigger: once(headEl, 'top 88%') },
        )
        // opacity only (not visibility) — the rows are buttons and must stay tabbable before they reveal
        gsap.fromTo(
          list,
          { opacity: 0 },
          { opacity: 1, duration: 0.7, ease: 'power1.out', scrollTrigger: once(list, 'top 94%') },
        )
        return () => mm.revert()
      }

      // The screen opens like a viewfinder, the crop marks lock on, the ruler draws.
      gsap
        .timeline({ scrollTrigger: once(media) })
        .fromTo(
          q('.hs-phone__screen'),
          { clipPath: 'inset(8% 10% 8% 10% round 9%)' },
          { clipPath: 'inset(0% 0% 0% 0% round 0%)', duration: 1.5, ease: EASE.inOut, clearProps: 'clipPath' },
          0,
        )
        .from(q('.hs-phone__ui'), { autoAlpha: 0, duration: 0.9, ease: EASE.out }, 0.7)
        .from(q('.hs-phone__crop'), { autoAlpha: 0, scale: 1.06, duration: 1.1, ease: EASE.out }, 0.8)
        .from(q('.hs-ruler__scale'), { scaleX: 0, transformOrigin: '0% 50%', duration: 1.3, ease: EASE.inOut }, 0.35)
        .from(q('.hs-ruler__lbl'), { autoAlpha: 0, y: 6, duration: 0.9, stagger: 0.06, ease: EASE.out }, 0.8)

      gsap
        .timeline({ scrollTrigger: once(headEl, 'top 86%') })
        .from(q('.hs-eyebrow'), { autoAlpha: 0, y: 12, duration: 1, ease: EASE.out }, 0)
        .from(q('.hs-line__mark'), { autoAlpha: 0, x: 10, duration: 1.2, ease: EASE.out }, 0.2)
        .from(q('.hs-window'), { autoAlpha: 0, y: 10, duration: 1, ease: EASE.out }, 0.45)

      // Inner rows only — the <li> opacity belongs to the mobile crossfade. Opacity, not
      // autoAlpha: these are buttons and must stay reachable by Tab before they reveal.
      gsap.from(q('.hs-pt__in, .hs-dots'), {
        opacity: 0,
        y: 18,
        duration: 1.1,
        ease: EASE.out,
        stagger: 0.07,
        clearProps: 'opacity,transform',
        scrollTrigger: once(list, 'top 92%'),
      })

      return () => mm.revert()
    },
    { scope: root, dependencies: [words, shots, steps, ruler, hookS], revertOnUpdate: true },
  )

  /** Jump the scrub to the moment a point becomes active */
  const seek = (i) => {
    const st = stRef.current
    if (!st) return
    const at = Math.min(0.995, steps[i] + 0.06)
    scrollTo(st.start + (st.end - st.start) * at, { duration: 1.2, immediate: prefersReducedMotion() })
  }

  const shown = Math.max(0, active)
  const Row = desktop ? 'button' : 'div'

  return (
    <section
      ref={root}
      className="hs"
      data-hud="The Hook"
      aria-labelledby={titleId}
      style={{ '--hs-tone': project.tone }}
    >
      <div className="hs-pin">
        <div className="hs-grid container">
          <header className="hs-head">
            <Eyebrow index="02" className="hs-eyebrow">
              The hook
            </Eyebrow>
            <div className="hs-line">
              <span className="hs-line__mark t-h2" aria-hidden="true">
                &ldquo;
              </span>
              <SplitReveal as="h2" id={titleId} className="hs-line__text t-h2">
                {linePre}
                <em className="t-serif">{linePay}</em>
                {linePost}
                <span aria-hidden="true">&rdquo;</span>
              </SplitReveal>
            </div>
            <p className="hs-window t-mono">
              <span className="hs-window__k">Window:</span> <span className="tabular">{hook.window}</span>
            </p>
          </header>

          <div className="hs-stage">
            <div className="hs-media">
              <div
                className="hs-phone"
                role="img"
                aria-label={`Opening frames of the ${title} ad. Scroll to scrub through the first ${fmtS(hookS)} seconds.`}
              >
                <div className="hs-phone__screen">
                  <ScrubVideo ref={videoApi} src={scrub} poster={poster} className="hs-phone__video" />
                  {SITE.placeholderMode && <ShotStack ref={shotsApi} shots={shots} />}
                  <span className="hs-phone__shade" />
                  <div className="hs-phone__ui">
                    <div className="hs-phone__prog">
                      {ruler.segments.map((i) => (
                        <span className="hs-seg" key={i}>
                          <span className="hs-seg__fill" />
                        </span>
                      ))}
                    </div>
                    <div className="hs-phone__top">
                      <span className="hs-phone__chip t-mono">
                        Hook &middot; 0&ndash;{fmtS(hookS)}s
                      </span>
                      <Glass className="hs-phone__rec" radius={999} tone="dark" interactive={false}>
                        <span className="rec-dot hs-phone__dot" />
                        <span ref={tcRef} className="hs-tc t-mono tabular">
                          {toTimecode(0)}
                        </span>
                      </Glass>
                    </div>
                    {words.length > 0 && (
                      <p className="hs-cap">
                        {words.map((w, i) => (
                          <span key={i} className={`hs-w${w.hl ? ' is-hl caption-hl' : ''}`}>
                            {w.text}
                          </span>
                        ))}
                      </p>
                    )}
                  </div>
                </div>
                <span className="hs-phone__crop cropmarks" />
              </div>

              <div className="hs-ruler" aria-hidden="true">
                <div className="hs-ruler__scale">
                  <span className="hs-ruler__win" style={{ '--hs-win': winEnd / hookS }} />
                  {ruler.ticks.map((f, i) => (
                    <span
                      key={i}
                      className={`hs-ruler__tick${i % ruler.major === 0 ? ' is-major' : ''}`}
                      style={{ left: `calc(${f} * (100% - 1px))` }}
                    />
                  ))}
                  <span className="hs-ruler__ph" />
                </div>
                <div className="hs-ruler__labels">
                  {ruler.seconds.map((s, i) => (
                    <span
                      key={s}
                      className={`hs-ruler__lbl t-mono${i === 0 ? ' is-first' : ''}${i === ruler.seconds.length - 1 ? ' is-last' : ''}`}
                      style={{ left: `${(s / hookS) * 100}%` }}
                    >
                      {s.toFixed(1)}s
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="hs-points-wrap">
              <ol className="hs-points" aria-label="Why this hook works">
                {points.map((pt, i) => (
                  <li
                    key={pt.k}
                    className={`hs-pt${i === active ? ' is-active' : ''}${i === shown ? ' is-shown' : ''}`}
                    aria-current={i === active ? 'step' : undefined}
                  >
                    <Row
                      className={`hs-pt__in${desktop ? ' hs-pt__in--btn' : ''}`}
                      {...(desktop ? { type: 'button', onClick: () => seek(i) } : {})}
                    >
                      <span className="hs-pt__bar" aria-hidden="true" />
                      <span className="hs-pt__k t-mono">
                        <span className="hs-pt__n">{pad2(i + 1)}</span>
                        {pt.k}
                      </span>
                      <span className="hs-pt__v">{pt.v}</span>
                    </Row>
                  </li>
                ))}
              </ol>
              {!desktop && (
                <div className="hs-dots" role="group" aria-label="Jump to a point">
                  {points.map((pt, i) => (
                    <button
                      key={pt.k}
                      type="button"
                      className={`hs-dot${i === active ? ' is-active' : ''}${i < active ? ' is-done' : ''}`}
                      aria-label={`Point ${i + 1} of ${points.length}: ${pt.k}`}
                      aria-current={i === active ? 'step' : undefined}
                      onClick={() => seek(i)}
                    >
                      <span className="hs-dot__bar" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
