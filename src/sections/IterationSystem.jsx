import { useRef } from 'react'
import { gsap, ScrollTrigger, useGSAP, EASE } from '../lib/gsap'
import { prefersReducedMotion } from '../lib/env'
import { useIsMobile } from '../lib/hooks'
import { ITERATION, TEST_LOOP, TEST_VARIABLES } from '../data/strategy'
import { media } from '../data/site'
import { Eyebrow } from '../components/Primitives'
import SplitReveal from '../components/SplitReveal'
import './IterationSystem.css'

const LETTERS = 'ABCDE'
/** First frames from the homepage hook test — hook letter × opening visual */
const framePoster = (h, o) => media(`/frames/iter-${LETTERS[h].toLowerCase()}${o + 1}.jpg`)
/** Short units for the equation — reads "1 script × 5 hooks × …" */
const UNITS = ['script', 'hooks', 'openings', 'B-roll', 'CTAs']
/** Running totals: 1 → 5 → 15 → 30 → 60 */
const CUM = ITERATION.reduce((acc, t) => [...acc, (acc.length ? acc[acc.length - 1] : 1) * t.n], [])
const TOTAL = CUM[CUM.length - 1]
const EQUATION = `${ITERATION.map((t, i) => `${t.n} ${UNITS[i]}`).join(' × ')} = ${TOTAL} ads`

/** Scroll choreography (timeline seconds): one beat per term, then the result */
const BEAT = 1.35
const AT_RESULT = ITERATION.length * BEAT + 0.2
const AT_WAVE = AT_RESULT + 1.2
const AT_CAPTION = AT_WAVE + 0.35
const AT_END = AT_CAPTION + 1.6

const pad2 = (n) => String(n).padStart(2, '0')

/** Slot order from the middle outwards: 5 → [2, 1, 3, 0, 4] */
const centreOut = (n) =>
  Array.from({ length: n }, (_, i) => i).sort((a, b) => Math.abs(a - (n - 1) / 2) - Math.abs(b - (n - 1) / 2) || a - b)

/**
 * Maps every combination (hook × opening × B-roll × CTA) onto the board so the
 * structure is legible: each hook owns a contiguous colour band, and every new
 * term fills outward from the centre.
 *  desktop 15 × 4 — columns: hook × opening, rows: B-roll × CTA
 *  mobile  10 × 6 — columns: hook × B-roll,  rows: opening × CTA
 */
function buildBoard(mobile) {
  const [, H, O, B, C] = ITERATION.map((t) => t.n)
  const cols = mobile ? H * B : H * O
  const rows = mobile ? O * C : B * C
  const hPos = centreOut(H)
  const oPos = centreOut(O)
  const bPos = centreOut(B)
  const rPos = centreOut(rows)
  const tiles = []
  for (let h = 0; h < H; h++)
    for (let o = 0; o < O; o++)
      for (let b = 0; b < B; b++)
        for (let c = 0; c < C; c++) {
          const col = mobile ? hPos[h] * B + bPos[b] : hPos[h] * O + oPos[o]
          const row = mobile ? rPos[o + O * c] : rPos[b + B * c]
          tiles.push({
            key: `${h}${o}${b}${c}`,
            h,
            col,
            row,
            // the term that first brings this combination into existence
            step: c ? 4 : b ? 3 : o ? 2 : h ? 1 : 0,
            dist: Math.hypot(col - (cols - 1) / 2, (row - (rows - 1) / 2) * 1.78),
            id: LETTERS[h],
            rest: `·O${o + 1}·B${b + 1}·C${c + 1}`,
            // same hook + same opening = same first frame
            poster: framePoster(h, o),
          })
        }
  tiles.sort((a, b) => a.row - b.row || a.col - b.col)
  return { cols, rows, tiles }
}

const BOARDS = { desktop: buildBoard(false), mobile: buildBoard(true) }

/** Testing-loop geometry — a stadium loop, horizontal on desktop, vertical on phones */
const LOOPS = {
  h: {
    w: 1200,
    h: 250,
    d: 'M110 70 H1090 C1172 70 1172 200 1090 200 H110 C28 200 28 70 110 70',
    nodes: TEST_LOOP.map((_, i) => [110 + i * 245, 70]),
    along: TEST_LOOP.map((_, i) => i * 245),
  },
  v: {
    w: 340,
    h: 560,
    d: 'M40 50 V510 C40 550 300 550 300 510 V50 C300 10 40 10 40 50',
    nodes: TEST_LOOP.map((_, i) => [40, 50 + i * 115]),
    along: TEST_LOOP.map((_, i) => i * 115),
  },
}
const LOOP_SECONDS = 9
const TRAIL = 150

/**
 * 07 — Creative iteration system.
 * A pinned build: the equation 1 × 5 × 3 × 2 × 2 = 60 assembles term by term
 * while a board of 60 ad tiles fills outward from the centre. After the pin,
 * the testing loop runs as a live diagram, then the variables worth testing.
 */
export default function IterationSystem() {
  const rootRef = useRef(null)
  /** The layout the current build was made for (null until the first build) */
  const builtRef = useRef(null)
  const mobile = useIsMobile()
  const board = mobile ? BOARDS.mobile : BOARDS.desktop
  const loop = mobile ? LOOPS.v : LOOPS.h

  useGSAP(
    () => {
      const root = rootRef.current
      const q = gsap.utils.selector(root)
      const reducedNow = prefersReducedMotion()
      const pin = q('.it-pin')[0]
      if (!pin) return

      /* -----------------------------------------------------------------
         The pinned build
         ----------------------------------------------------------------- */
      const grps = q('.it-eq__grp')
      const nums = q('.it-term__n')
      const res = q('.it-res')[0]
      const tiles = q('.it-tile')
      const lits = q('.it-tile__lit')
      const meterN = q('.it-meter__n')[0]
      const meterFill = q('.it-meter__fill')[0]
      const caption = q('.it-caption')[0]
      const legend = q('.it-legend')[0]

      const byStep = ITERATION.map(() => [])
      board.tiles.forEach((t, k) => byStep[t.step].push({ el: tiles[k], dist: t.dist }))
      byStep.forEach((list) => list.sort((a, b) => a.dist - b.dist))

      /* The running count and the result are derived from the timeline's
         time, so they're right after any jump, refresh or reverse scrub */
      const countEase = gsap.parseEase('power1.out')
      const totalEase = gsap.parseEase('power2.out')
      const clamp01 = gsap.utils.clamp(0, 1)
      let lastCount = -1
      let lastTotal = -1
      let tl = null
      const sync = () => {
        const t = tl ? tl.time() : 0
        let v = 0
        for (let s = 0; s < CUM.length; s++) {
          const f = clamp01((t - (s * BEAT + 0.12)) / 0.9)
          if (f <= 0) break
          const from = s ? CUM[s - 1] : 0
          v = from + (CUM[s] - from) * countEase(f)
        }
        const count = Math.round(v)
        const sum = Math.round(TOTAL * totalEase(clamp01((t - AT_RESULT - 0.05) / 1.1)))
        if (count !== lastCount) {
          lastCount = count
          if (meterN) meterN.textContent = pad2(count)
          if (meterFill) meterFill.style.transform = `scaleX(${count / TOTAL})`
        }
        if (sum !== lastTotal) {
          lastTotal = sum
          if (res) res.textContent = String(sum)
        }
      }

      tl = gsap.timeline({
        defaults: { ease: 'none' },
        onUpdate: sync,
        scrollTrigger: {
          trigger: pin,
          start: 'top top',
          end: mobile ? '+=220%' : '+=300%',
          pin: true,
          scrub: reducedNow ? true : 1,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onRefresh: sync,
        },
      })

      const rise = reducedNow ? 0 : 26
      ITERATION.forEach((_, s) => {
        const at = s * BEAT
        // the new term arrives; the previous ones step back
        tl.fromTo(grps[s], { autoAlpha: 0, y: rise }, { autoAlpha: 1, y: 0, duration: 0.7, ease: EASE.out }, at)
        if (s > 0) tl.to(nums.slice(0, s), { opacity: 0.4, duration: 0.5, ease: 'power1.out' }, at)

        const step = byStep[s].map((t) => t.el)
        if (step.length) {
          tl.fromTo(
            step,
            reducedNow ? { autoAlpha: 0 } : { autoAlpha: 0, scale: 0.35 },
            {
              autoAlpha: 1,
              scale: 1,
              duration: 0.75,
              ease: EASE.out,
              stagger: { amount: Math.min(0.85, step.length * 0.05) },
            },
            at + 0.12,
          )
        }
      })
      if (legend) tl.fromTo(legend, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6 }, BEAT)

      // = 60 — the result lands in accent and counts up
      const resGrp = grps[grps.length - 1]
      tl.fromTo(resGrp, { autoAlpha: 0, y: rise }, { autoAlpha: 1, y: 0, duration: 0.7, ease: EASE.out }, AT_RESULT)
        .to(nums.slice(0, ITERATION.length), { opacity: 0.4, duration: 0.5 }, AT_RESULT)

      // a wave of light passes across every ad
      tl.fromTo(
        lits,
        { opacity: 0 },
        {
          opacity: reducedNow ? 0.28 : 0.5,
          duration: 0.3,
          ease: 'power1.inOut',
          stagger: { amount: 0.9, grid: [board.rows, board.cols], from: 'start', axis: 'x', yoyo: true, repeat: 1 },
        },
        AT_WAVE,
      )

      if (caption) tl.fromTo(caption, { opacity: 0, y: rise * 0.6 }, { opacity: 1, y: 0, duration: 0.8, ease: EASE.out }, AT_CAPTION)
      tl.to({}, { duration: 0.01 }, AT_END)
      sync()

      /* -----------------------------------------------------------------
         Entrances (normal flow)
         ----------------------------------------------------------------- */
      const once = (trigger, start = 'top 82%') => ({ trigger, start, once: true })
      const cells = q('.it-cell')
      gsap.fromTo(
        q('.it-head .eyebrow'),
        { opacity: 0, y: reducedNow ? 0 : 12 },
        { opacity: 1, y: 0, duration: 1, ease: EASE.out, scrollTrigger: once(pin, 'top 80%') },
      )
      gsap.fromTo(
        cells,
        { opacity: 0 },
        {
          opacity: 1,
          duration: reducedNow ? 0.6 : 1.2,
          ease: 'power1.out',
          stagger: reducedNow ? 0 : { amount: 0.6, grid: [board.rows, board.cols], from: 'center' },
          scrollTrigger: once(pin, 'top 70%'),
        },
      )

      /* -----------------------------------------------------------------
         The testing loop — a dot travels the loop while it's on screen
         ----------------------------------------------------------------- */
      const loopEl = q('.it-loop')[0]
      const path = q('.it-loop__path')[0]
      const trail = q('.it-loop__trail')[0]
      const dot = q('.it-loop__dot')[0]
      const nodes = q('.it-loop__node')
      const labels = q('.it-loop__label')
      if (loopEl && path && dot) {
        const L = path.getTotalLength()
        const place = (len) => {
          const pt = path.getPointAtLength(len)
          dot.setAttribute('cx', pt.x.toFixed(2))
          dot.setAttribute('cy', pt.y.toFixed(2))
        }
        const lit = loop.along.map(() => false)
        nodes.concat(labels).forEach((el) => el.classList.remove('is-lit'))
        const light = (k, on) => {
          if (lit[k] === on) return
          lit[k] = on
          nodes[k]?.classList.toggle('is-lit', on)
          labels[k]?.classList.toggle('is-lit', on)
        }

        gsap.set(path, { strokeDasharray: L, strokeDashoffset: reducedNow ? 0 : L })
        const intro = gsap.timeline({ scrollTrigger: once(loopEl, 'top 80%') })
        if (reducedNow) {
          intro.fromTo([loopEl], { opacity: 0 }, { opacity: 1, duration: 0.7, ease: 'power1.out' })
        } else {
          intro
            .to(path, { strokeDashoffset: 0, duration: 2, ease: EASE.inOut }, 0)
            .from(nodes, { scale: 0, transformOrigin: '50% 50%', duration: 0.8, ease: EASE.out, stagger: 0.12 }, 0.35)
            .from(labels, { autoAlpha: 0, y: 10, duration: 0.9, ease: EASE.out, stagger: 0.1 }, 0.45)
            .from(q('.it-loop__note, .it-loop__dot, .it-loop__trail'), { opacity: 0, duration: 0.8 }, 1.4)
        }

        if (reducedNow) {
          place(0)
          loop.along.forEach((_, k) => light(k, true))
          if (trail) gsap.set(trail, { display: 'none' })
        } else {
          if (trail) gsap.set(trail, { strokeDasharray: `${TRAIL} ${L - TRAIL}` })
          const p = { t: 0 }
          const run = gsap.to(p, {
            t: 1,
            duration: LOOP_SECONDS,
            ease: 'none',
            repeat: -1,
            paused: true,
            onUpdate: () => {
              const len = p.t * L
              place(len)
              if (trail) trail.style.strokeDashoffset = String(TRAIL - len)
              loop.along.forEach((a, k) => light(k, len >= a - 36 && len <= a + 70))
            },
          })
          place(0)
          ScrollTrigger.create({
            trigger: loopEl,
            start: 'top bottom',
            end: 'bottom top',
            onToggle: (self) => run.paused(!self.isActive),
          })
        }
      }

      gsap.fromTo(
        q('.it-var'),
        { opacity: 0, y: reducedNow ? 0 : 14 },
        {
          opacity: 1,
          y: 0,
          duration: reducedNow ? 0.6 : 0.9,
          ease: EASE.out,
          stagger: 0.04,
          scrollTrigger: once(q('.it-vars')[0], 'top 88%'),
        },
      )

      /* A breakpoint rebuild leaves this pin last in ScrollTrigger's list, so every
         trigger below it would be measured without its spacing: re-sort, re-measure once */
      const rebuilt = builtRef.current !== null && builtRef.current !== mobile
      builtRef.current = mobile
      if (rebuilt) {
        gsap.delayedCall(0.1, () => {
          ScrollTrigger.sort()
          ScrollTrigger.refresh()
        })
      }
    },
    { scope: rootRef, dependencies: [mobile], revertOnUpdate: true },
  )

  return (
    <section ref={rootRef} id="iteration" className="it" data-hud="Iteration System">
      {/* ---------------- Pinned build ---------------- */}
      <div className="it-pin">
        <div className="container it-stage">
          <div className="it-top">
            <div className="it-head">
              <Eyebrow index="07">Creative iteration system</Eyebrow>
              <SplitReveal as="h2" className="it-title t-h2">
                One concept. <em className="t-serif">Sixty</em> ads.
              </SplitReveal>
            </div>

            <p className="sr-only">{EQUATION}</p>
            <div className="it-eq" aria-hidden="true">
              {ITERATION.map((t, i) => (
                <span className="it-eq__grp" key={t.label}>
                  {i > 0 && <span className="it-op">×</span>}
                  <span className="it-term">
                    <span className="it-term__n">{t.n}</span>
                    <span className="it-term__u t-mono">{UNITS[i]}</span>
                  </span>
                </span>
              ))}
              <span className="it-eq__grp it-eq__grp--res">
                <span className="it-op it-op--eq">=</span>
                <span className="it-term it-term--res">
                  <span className="it-res">{TOTAL}</span>
                  <span className="it-term__u t-mono">ads</span>
                </span>
              </span>
            </div>
          </div>

          <div className="it-board" aria-hidden="true">
            <div className="it-grid" style={{ '--it-cols': board.cols, '--it-rows': board.rows }}>
              {board.tiles.map((t) => (
                <div className="it-cell" key={t.key}>
                  <div className="it-tile" style={{ '--it-hue': `var(--it-h${t.h})` }}>
                    <span className="it-tile__img" style={{ backgroundImage: `url(${t.poster})` }} />
                    <span className="it-tile__cap" />
                    <span className="it-tile__lit" />
                    <span className="it-tile__id">
                      {t.id}
                      <span className="it-tile__rest">{t.rest}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="it-foot">
            <p className="it-caption t-lead">
              This can create a large number of testing combinations without rebuilding the creative from scratch.
            </p>
            <div className="it-foot__side">
              <ul className="it-legend t-mono" aria-hidden="true">
                {LETTERS.split('').map((l, h) => (
                  <li key={l} className="it-legend__i" style={{ '--it-hue': `var(--it-h${h})` }}>
                    {l}
                  </li>
                ))}
                <li className="it-legend__k">Hooks</li>
              </ul>
              <p className="it-meter t-mono" aria-hidden="true">
                <span className="it-meter__k">Ads</span>
                <span className="it-meter__v">
                  <span className="it-meter__n">00</span> / {TOTAL}
                </span>
                <span className="it-meter__bar">
                  <span className="it-meter__fill" />
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ---------------- The testing loop ---------------- */}
      <div className="container it-after">
        <div className="it-after__head">
          <Eyebrow>The testing loop</Eyebrow>
          <SplitReveal as="h3" className="it-after__title t-h2">
            Not one perfect video. <em className="t-serif">A system</em> that learns.
          </SplitReveal>
          <p className="it-after__lead t-lead">
            The editing process is designed around testing: every result shapes the next variation.
          </p>
        </div>

        <figure className="it-loop" style={{ '--it-ar': `${loop.w} / ${loop.h}` }}>
          <svg
            className="it-loop__svg"
            viewBox={`0 0 ${loop.w} ${loop.h}`}
            aria-hidden="true"
            focusable="false"
          >
            <path className="it-loop__path" d={loop.d} />
            <path className="it-loop__trail" d={loop.d} />
            {loop.nodes.map(([x, y], k) => (
              <circle key={TEST_LOOP[k]} className="it-loop__node" cx={x} cy={y} r={7} />
            ))}
            <circle className="it-loop__dot" cx={loop.nodes[0][0]} cy={loop.nodes[0][1]} r={5} />
          </svg>
          {loop.nodes.map(([x, y], k) => (
            <span
              key={TEST_LOOP[k]}
              className="it-loop__label"
              style={{ left: `${(x / loop.w) * 100}%`, top: `${(y / loop.h) * 100}%` }}
              aria-hidden="true"
            >
              <span className="it-loop__idx t-mono">{pad2(k + 1)}</span>
              <span className="it-loop__name">{TEST_LOOP[k]}</span>
            </span>
          ))}
          {!mobile && <span className="it-loop__note t-mono">Every result feeds the next test</span>}
          <figcaption className="sr-only">{TEST_LOOP.join(', then ')} — and repeat.</figcaption>
        </figure>

        <div className="it-vars">
          <h4 className="it-vars__title t-mono">
            <span className="it-vars__n">{pad2(TEST_VARIABLES.length)}</span>
            Testing variables
          </h4>
          <ul className="it-vars__list">
            {TEST_VARIABLES.map((v) => (
              <li key={v} className="it-var">
                {v}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
