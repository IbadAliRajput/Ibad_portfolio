import { useRef } from 'react'
import ScrubVideo from '../components/ScrubVideo'
import ShotStack from '../components/ShotStack'
import VerticalVideo from '../components/VerticalVideo'
import SplitReveal from '../components/SplitReveal'
import Button from '../components/Button'
import Glass from '../components/LiquidGlass'
import { TLink } from '../app/PageTransition'
import { gsap, useGSAP, EASE } from '../lib/gsap'
import { prefersReducedMotion, hasFinePointer, MQ } from '../lib/env'
import { useReady, useVideo } from '../app/context'
import { toTimecode, toShort } from '../lib/timecode'
import { SITE, MEDIA, POSTERS, CTA_LINES } from '../data/site'
import { FEATURED, getProject } from '../data/projects'
import { AD_STRUCTURE, FUNNEL } from '../data/strategy'
import './HeroReel.css'

/* --------------------------------------------------------------------------
   Choreography constants (fractions of the pinned scroll)
   -------------------------------------------------------------------------- */
const REEL = MEDIA.reelSeconds // the scrubbed ad's length (s)
const REEL_PROJECT = getProject(MEDIA.reelSlug)
const HANDOFF = 0.13 // hero → reel: centre card takes the stage
const REEL_START = 0.15
const REEL_END = 0.965

// Placeholder edit: cut points (s) — fast in the hook, breathing in the explanation
const CUTS = [0, 0.8, 1.6, 2.3, 3, 4.6, 6.2, 8, 10.5, 13, 15.2, 17.8, 20, 22.5, 25, 27.6, 30.4, 33, 35, 37, 39.5, 42, 44.6, 47.2, 50, 53.5, 57]
const SHOTS = CUTS.map((t, i) => ({
  src: POSTERS[(i * 3) % POSTERS.length],
  at: t / REEL,
  from: i % 3 === 2 ? 1.16 : 1.02, // every third shot punches out, the rest punch in
  to: i % 3 === 2 ? 1.03 : 1.13,
  origin: ['50% 40%', '38% 30%', '62% 52%'][i % 3],
}))

// Fan of cards around the phone slot (0 = the phone) — never the ad the phone already plays
const FAN_PROJECTS = FEATURED.filter((p) => p.slug !== MEDIA.reelSlug).slice(1, 5)
const FAN = [-2, -1, 1, 2].map((pos, i) => ({ pos, project: FAN_PROJECTS[i] }))

// The skeleton, in the order and at the times its beats actually land in the scrubbed ad
const BEATS = (MEDIA.reelBeats ?? AD_STRUCTURE)
  .map((r) => ({ ...AD_STRUCTURE.find((b) => b.id === r.id), range: r.range }))
  .map((b) => ({ ...b, short: b.label.split(' /')[0] }))
/** "0–6s" on a short ad; "2:30–3:29" once beats run past a minute */
const LONG_REEL = REEL > 90
const span = ([a, b]) => (LONG_REEL ? `${toShort(a)}–${toShort(b)}` : `${a}–${b}s`)
/** A longer ad gets a longer pin, so the scrub never races (capped at 1.35×) */
const PIN_SCALE = Math.min(1.35, Math.max(1, REEL / 60))
const beatAt = (t) => {
  for (let i = BEATS.length - 1; i >= 0; i--) if (t >= BEATS[i].range[0]) return i
  return 0
}
const clamp01 = (n) => Math.min(1, Math.max(0, n))
// Ruler: fine ticks with a label every 15s on a short ad, every minute on a long one
const TICK_STEP = REEL > 120 ? 15 : 5
const TICK_MAJOR = REEL > 120 ? 60 : 15
const TICKS = Array.from({ length: Math.floor(REEL / TICK_STEP) + 1 }, (_, i) => i * TICK_STEP)

function RailIcon({ d }) {
  return (
    <span className="hr__rail-btn">
      <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true">
        <path d={d} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}
const ICONS = [
  'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
  'M5 18.5V6.5A1.5 1.5 0 0 1 6.5 5h11A1.5 1.5 0 0 1 19 6.5v8a1.5 1.5 0 0 1-1.5 1.5H9z',
  'M14 5l6 6-6 6M20 11H10a6 6 0 0 0-6 6',
  'M7 4h10v16l-5-3.5L7 20z',
]

/* --------------------------------------------------------------------------
   Scroll: pin → hand the centre card to the stage → scrub the 60s reel.
   Runs inside a gsap.matchMedia context so it rebuilds across breakpoints.
   -------------------------------------------------------------------------- */
function buildScroll(rootEl, videoApi, shotsApi, mobile) {
  const q = gsap.utils.selector(rootEl)
  const stage = q('.hr__stage')[0]
  const phone = q('.hr__phone')[0]
  const slot = q('.hr__slot')[0]
  const cards = q('.hr__card')
  const reduce = prefersReducedMotion()

  // Fan layout (percent-based, so it stays responsive)
  cards.forEach((c) => {
    const i = +c.dataset.pos
    gsap.set(c, {
      xPercent: i * (mobile ? 46 : 57),
      yPercent: Math.abs(i) * 5 + i * i * 1.6,
      rotation: i * 6.5,
      scale: 1 - Math.abs(i) * 0.07,
      zIndex: 5 - Math.abs(i),
    })
  })

  // Where the phone must sit (relative to its final layout box) to overlap the slot
  const geom = () => {
    const s = stage.getBoundingClientRect()
    const r = slot.getBoundingClientRect()
    const pw = phone.offsetWidth
    const ph = phone.offsetHeight
    return {
      x: r.left - s.left + r.width / 2 - (phone.offsetLeft + pw / 2),
      y: r.top - s.top + r.height / 2 - (phone.offsetTop + ph / 2),
      scale: r.height / ph,
    }
  }

  // DOM handles for the per-frame writer
  const tcEls = q('[data-tc]')
  const bar = q('.hr__pbar')[0]
  const timeline = q('.hr__timeline')[0]
  const beatItems = q('.hr__beat')
  const beatBars = q('.hr__beat-bar > i')
  const segs = q('.hr__seg')
  const funnel = q('.hr__stage-item')
  const caps = q('.hr__cap')
  const words = caps.map((c) => Array.from(c.querySelectorAll('.hr__w')))
  const labels = q('.hr__beat-word')
  const rangeEl = q('.hr__beat-range')[0]
  const goalEl = q('.hr__beat-goal')[0]
  const chipM = q('.hr__chip-m-txt')[0]
  gsap.set(labels, { yPercent: 110 })
  gsap.set(labels[0], { yPercent: 0 })

  let beat = -1
  let lastTc = ''
  let inReel = false
  const shown = words.map(() => -1)

  const setBeat = (i) => {
    const prev = beat
    beat = i
    beatItems.forEach((el, k) => {
      el.classList.toggle('is-active', k === i)
      el.classList.toggle('is-done', k < i)
    })
    segs.forEach((el, k) => {
      el.classList.toggle('is-active', k === i)
      el.classList.toggle('is-done', k < i)
    })
    beatBars.forEach((el, k) => {
      if (k < i) el.style.transform = 'scaleX(1)'
      else if (k > i) el.style.transform = 'scaleX(0)'
    })
    const stageIdx = FUNNEL.indexOf(BEATS[i].stage)
    funnel.forEach((el, k) => {
      el.classList.toggle('is-active', k === stageIdx)
      el.classList.toggle('is-done', k < stageIdx)
    })
    caps.forEach((el, k) => el.classList.toggle('is-on', k === i))
    rangeEl.textContent = span(BEATS[i].range)
    goalEl.textContent = BEATS[i].goal
    if (chipM) chipM.textContent = `${BEATS[i].short} · ${span(BEATS[i].range)} · ${BEATS[i].stage}`
    if (prev >= 0 && prev !== i) {
      const dir = i > prev ? 1 : -1
      gsap.to(labels[prev], { yPercent: -110 * dir, duration: reduce ? 0.01 : 0.7, ease: EASE.inOut, overwrite: true })
      gsap.fromTo(labels[i], { yPercent: 110 * dir }, { yPercent: 0, duration: reduce ? 0.01 : 0.8, ease: EASE.out, overwrite: true })
    }
  }

  const render = (p) => {
    // the reel has its own timecode — let the global HUD step aside meanwhile
    const reelNow = p > HANDOFF * 0.8 && p < 0.995
    if (reelNow !== inReel) {
      inReel = reelNow
      window.dispatchEvent(new CustomEvent('hud:mute', { detail: reelNow }))
    }
    const rp = clamp01((p - REEL_START) / (REEL_END - REEL_START))
    videoApi.current?.setProgress(rp)
    shotsApi.current?.setProgress(rp)
    const t = rp * REEL
    const tc = toTimecode(t)
    if (tc !== lastTc) {
      lastTc = tc
      for (const el of tcEls) el.textContent = tc
    }
    bar.style.transform = `scaleX(${rp})`
    timeline.style.setProperty('--rp', rp.toFixed(4))
    const i = beatAt(t)
    if (i !== beat) setBeat(i)
    const b = BEATS[i]
    const local = clamp01((t - b.range[0]) / (b.range[1] - b.range[0]))
    if (beatBars[i]) beatBars[i].style.transform = `scaleX(${local})`
    // placeholder captions pop word-by-word through the first 70% of each beat
    const beatWords = words[i]
    if (beatWords) {
      const n = Math.min(beatWords.length, Math.ceil((local / 0.7) * beatWords.length))
      if (n !== shown[i]) {
        beatWords.forEach((w, k) => w.classList.toggle('is-on', k < n))
        shown[i] = n
      }
    }
  }

  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    onUpdate: () => render(tl.progress()),
    scrollTrigger: {
      trigger: rootEl,
      start: 'top top',
      end: () => `+=${window.innerHeight * (mobile ? 5 : 6.2) * PIN_SCALE}`,
      pin: true,
      scrub: reduce ? true : 0.9,
      anticipatePin: 1,
      invalidateOnRefresh: true,
    },
  })

  tl.fromTo(
    phone,
    { x: () => geom().x, y: () => geom().y, scale: () => geom().scale },
    { x: 0, y: 0, scale: 1, duration: HANDOFF, ease: 'power2.inOut' },
    0,
  )
    .to(q('.hr__head'), { yPercent: -14, autoAlpha: 0, duration: HANDOFF * 0.7, ease: 'power1.in' }, 0)
    .to(q('.hr__foot, .hr__cue'), { y: 50, autoAlpha: 0, duration: HANDOFF * 0.5, ease: 'power1.in' }, 0)
    .to(q('.hr__phone-hero'), { autoAlpha: 0, duration: HANDOFF * 0.35 }, HANDOFF * 0.35)
    .fromTo(q('.hr__phone-ui'), { autoAlpha: 0 }, { autoAlpha: 1, duration: HANDOFF * 0.3 }, HANDOFF * 0.7)
    .fromTo(
      q('.hr__reel-ui'),
      { autoAlpha: 0, y: 26 },
      { autoAlpha: 1, y: 0, duration: 0.05, stagger: 0.012, ease: 'power2.out' },
      HANDOFF - 0.02,
    )
    .fromTo(q('.hr__end'), { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.02 }, REEL_END)
    .set({}, {}, 1)

  cards.forEach((c) => {
    const i = +c.dataset.pos
    const d = Math.sign(i)
    tl.to(
      c,
      {
        xPercent: `+=${d * 150}`,
        yPercent: `+=${36 + Math.abs(i) * 12}`,
        rotation: `+=${d * 16}`,
        autoAlpha: 0,
        duration: HANDOFF * 0.85,
        ease: 'power2.in',
      },
      0.006 * (3 - Math.abs(i)),
    )
  })

  render(0)
}

export default function HeroReel() {
  const root = useRef(null)
  const videoApi = useRef(null)
  const shotsApi = useRef(null)
  const { ready } = useReady()
  const { openVideo } = useVideo()

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add({ mobile: MQ.tablet, desktop: MQ.desktop }, (mctx) =>
        buildScroll(root.current, videoApi, shotsApi, mctx.conditions.mobile),
      )
    },
    { scope: root },
  )

  /* ------------------------------------------------------------------------
     Intro (after the preloader), idle float and pointer parallax
     ------------------------------------------------------------------------ */
  useGSAP(
    () => {
      if (!ready) return
      const q = gsap.utils.selector(root)
      const ins = q('.hr__card-in')
      const phoneIn = q('.hr__phone-in')[0]
      const intro = q('.hr__intro')
      if (prefersReducedMotion()) {
        gsap.fromTo([...ins, phoneIn, ...intro], { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.8, stagger: 0.04 })
        return
      }
      gsap
        .timeline({ delay: 0.1 })
        .fromTo(
          ins,
          { yPercent: 140, rotation: (k) => [-16, -9, 9, 16][k], autoAlpha: 0 },
          { yPercent: 0, rotation: 0, autoAlpha: 1, duration: 1.9, stagger: { each: 0.09, from: 'center' }, ease: EASE.out },
          0,
        )
        .fromTo(phoneIn, { yPercent: 115, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 1.9, ease: EASE.out }, 0.06)
        .fromTo(intro, { y: 28, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1.3, stagger: 0.08, ease: EASE.out }, 0.55)

      // idle float — each layer on its own rhythm; parked while the hero is off-screen
      const floats = [...ins, phoneIn].map((layer, k) =>
        gsap.to(layer, { y: k % 2 ? 9 : -9, duration: 2.8 + k * 0.35, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: 2 + k * 0.15 }),
      )
      const el = root.current
      const io = new IntersectionObserver(([e]) => floats.forEach((t) => (e.isIntersecting ? t.resume() : t.pause())))
      io.observe(el)

      if (!hasFinePointer()) return () => io.disconnect()
      const fan = q('.hr__fan')[0]
      const rx = gsap.quickTo([fan, phoneIn], 'rotationX', { duration: 1.2, ease: 'power3.out' })
      const ry = gsap.quickTo([fan, phoneIn], 'rotationY', { duration: 1.2, ease: 'power3.out' })
      gsap.set([fan, phoneIn], { transformPerspective: 1400 })
      const onMove = (e) => {
        if (window.scrollY > window.innerHeight * 0.25) return
        const nx = e.clientX / window.innerWidth - 0.5
        const ny = e.clientY / window.innerHeight - 0.5
        ry(nx * 9)
        rx(-ny * 6)
      }
      el.addEventListener('pointermove', onMove)
      return () => {
        io.disconnect()
        el.removeEventListener('pointermove', onMove)
      }
    },
    { scope: root, dependencies: [ready] },
  )

  const playReel = () =>
    openVideo({
      src: MEDIA.reelFull,
      poster: MEDIA.reelPoster,
      title: REEL_PROJECT.title,
      kicker: `${REEL_PROJECT.client} — the ${toShort(REEL)} ad`,
      meta: REEL_PROJECT.summary,
    })

  return (
    <section ref={root} id="hero" className="hr" data-hud="Intro" aria-label="Introduction and featured ad">
      <div className="hr__stage">
        {/* ---------- HERO STATE ---------- */}
        <div className="hr__head container">
          <p className="hr__eyebrow t-mono hr__intro">
            <span className="rec-dot" aria-hidden="true" /> {SITE.role}
          </p>
          <SplitReveal as="h1" className="hr__title" trigger="ready" delay={0.25}>
            Performance ads
            <br />
            that don&rsquo;t <em className="t-serif">feel</em>
            <br />
            like ads.
          </SplitReveal>
          <p className="hr__lead t-lead hr__intro">
            Short-form UGC, direct-response and AI-assisted creatives engineered around hooks, retention and conversion.
          </p>
          <div className="hr__ctas hr__intro">
            <Button to="/#work">{CTA_LINES.work}</Button>
            <Button to="/#contact" variant="glass">
              {CTA_LINES.together}
            </Button>
          </div>
        </div>

        <div className="hr__foot container">
          <p className="hr__formats t-mono hr__intro">
            {['UGC', 'VSL', 'Direct response', 'AI creative', 'Performance'].map((f) => (
              <span key={f}>{f}</span>
            ))}
          </p>
          <p className="hr__platforms t-mono t-mute hr__intro">
            Built for <span className="t-dim">{SITE.platforms.slice(0, 4).join(' · ')}</span>
          </p>
        </div>

        <div className="hr__cue" aria-hidden="true">
          <div className="hr__cue-in t-mono t-mute hr__intro">
            <span>Scroll to play the reel</span>
            <span className="hr__cue-line" />
          </div>
        </div>

        <div className="hr__fan">
          <div className="hr__slot" aria-hidden="true" />
          {FAN.map(({ pos, project }) => (
            <div className="hr__card" data-pos={pos} key={project.slug}>
              <div className="hr__card-in">
                <TLink to={`/work/${project.slug}`} label={project.title} kicker="Case study" data-cursor="view" aria-label={`${project.title} — ${project.formatLabel}`}>
                  <VerticalVideo
                    src={project.video}
                    poster={project.poster}
                    label={project.formatLabel}
                    meta={toShort(project.runtime)}
                    caption={project.caption}
                    captionHl={project.captionHl}
                    priority
                    className="hr__vv"
                  />
                </TLink>
              </div>
            </div>
          ))}
        </div>

        {/* ---------- THE PHONE (hero centre card → reel) ---------- */}
        <div className="hr__phone">
          <div className="hr__phone-in">
            <div className="hr__screen">
              <ScrubVideo ref={videoApi} src={MEDIA.reel} poster={MEDIA.reelPoster} className="hr__video" smoothing={0.28} />
              {SITE.placeholderMode && <ShotStack ref={shotsApi} shots={SHOTS} />}
              <span className="hr__shade" aria-hidden="true" />

              <div className="hr__phone-hero">
                <div className="hr__ph-top">
                  <span className="chip hr__ph-chip">{REEL_PROJECT.client}</span>
                  <span className="t-mono">{toShort(REEL)}</span>
                </div>
                {SITE.placeholderMode && (
                  <p className="hr__ph-cap">
                    Built for <span className="caption-hl">attention.</span>
                  </p>
                )}
              </div>

              <div className="hr__phone-ui" aria-hidden="true">
                <div className="hr__ui-top">
                  <Glass className="hr__rec" radius={999} tone="dark" interactive={false}>
                    <span className="rec-dot" />
                    <span className="t-mono">REC</span>
                    <span className="t-mono tabular" data-tc>
                      00:00:00:00
                    </span>
                  </Glass>
                  <span className="t-mono hr__ratio">9:16</span>
                </div>
                <span className="hr__safe">
                  <span className="t-mono">Safe zone</span>
                </span>
                <div className="hr__rail">
                  {ICONS.map((d) => (
                    <RailIcon key={d} d={d} />
                  ))}
                </div>
                {/* the real ad carries its own captions — these only type over placeholder footage */}
                <div className="hr__caps">
                  {SITE.placeholderMode &&
                    BEATS.map((b) => (
                      <p className="hr__cap" key={b.id}>
                        {b.caption.map((w, k) => (
                          <span className={`hr__w${k === b.hl ? ' caption-hl' : ''}`} key={k}>
                            {w}
                          </span>
                        ))}
                      </p>
                    ))}
                </div>
                <div className="hr__sponsor">
                  <span className="hr__avatar" />
                  <span>
                    <b>{REEL_PROJECT.client}</b>
                    <span className="t-mono">Sponsored</span>
                  </span>
                  <span className="hr__learn">Learn more</span>
                </div>
                <span className="hr__pline">
                  <span className="hr__pbar" />
                </span>
              </div>
            </div>

            <Glass as="button" className="hr__play hr__phone-hero" radius={999} tone="light" onClick={playReel} data-cursor="play" aria-label={`Watch the full ${REEL_PROJECT.client} ad`}>
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                <path d="M5 3.5v9l7.5-4.5z" fill="currentColor" />
              </svg>
              <span>Watch the ad</span>
            </Glass>
          </div>
        </div>

        {/* ---------- REEL STATE ---------- */}
        <div className="hr__left hr__reel-ui">
          <p className="t-mono t-mute">
            Anatomy of a real {toShort(REEL)} ad — {REEL_PROJECT.client}
          </p>
          <div className="hr__beat-label" aria-hidden="true">
            {BEATS.map((b) => (
              <span className="hr__beat-word" key={b.id}>
                {b.short}
                <span className="t-accent">.</span>
              </span>
            ))}
          </div>
          <p className="hr__beat-range t-mono t-accent">{span(BEATS[0].range)}</p>
          <p className="hr__beat-goal t-lead">{BEATS[0].goal}</p>
          <ol className="hr__beats">
            {BEATS.map((b, i) => (
              <li className="hr__beat t-mono" key={b.id}>
                <span className="hr__beat-idx">{String(i + 1).padStart(2, '0')}</span>
                <span className="hr__beat-name">{b.label}</span>
                <span className="hr__beat-r">
                  {span(b.range)}
                </span>
                <span className="hr__beat-bar">
                  <i />
                </span>
              </li>
            ))}
          </ol>
          <p className="hr__end t-mono">
            End of reel <span className="t-mute">— keep scrolling</span>
          </p>
        </div>

        <div className="hr__right hr__reel-ui">
          <p className="t-mono t-mute">Viewer journey</p>
          <ol className="hr__funnel">
            {FUNNEL.map((f, i) => (
              <li className="hr__stage-item" key={f}>
                <span className="hr__stage-idx t-mono">{String(i + 1).padStart(2, '0')}</span>
                {f}
              </li>
            ))}
          </ol>
          <p className="t-small t-dim hr__note">
            Every section needs a <em className="t-serif t-fg">visual reason</em> to keep watching.
          </p>
        </div>

        <p className="hr__chip-m hr__reel-ui t-mono" aria-hidden="true">
          <span className="rec-dot" />{' '}
          <span className="hr__chip-m-txt">
            {BEATS[0].short} · {span(BEATS[0].range)} · {BEATS[0].stage}
          </span>
        </p>

        <div className="hr__timeline hr__reel-ui" style={{ '--rp': 0 }} aria-hidden="true">
          <div className="hr__ruler">
            {TICKS.map((s) => (
              <span key={s} style={{ left: `${(s / REEL) * 100}%` }} className={s % TICK_MAJOR === 0 ? 'is-major' : ''}>
                {s % TICK_MAJOR === 0 && <i className="t-mono">{toShort(s)}</i>}
              </span>
            ))}
          </div>
          <div className="hr__track">
            {BEATS.map((b) => (
              <span className="hr__seg" key={b.id} style={{ flexGrow: b.range[1] - b.range[0] }}>
                <span className="hr__seg-name t-mono">{b.short}</span>
              </span>
            ))}
          </div>
          <span className="hr__playhead">
            <span className="hr__flag t-mono tabular" data-tc>
              00:00:00:00
            </span>
          </span>
        </div>
      </div>
    </section>
  )
}
