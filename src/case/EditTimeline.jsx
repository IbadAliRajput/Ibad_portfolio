import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { gsap, useGSAP, EASE } from '../lib/gsap'
import { prefersReducedMotion } from '../lib/env'
import { toTimecode, toShort } from '../lib/timecode'
import Glass from '../components/LiquidGlass'
import { SectionHeader } from '../components/Primitives'
import './EditTimeline.css'

/* --------------------------------------------------------------------------
   Track kinds — label, header glyph, fallback clip name
   -------------------------------------------------------------------------- */
const KINDS = {
  caption: { label: 'Captions', glyph: 'T', fallback: 'Caption' },
  ai: { label: 'AI visuals', glyph: 'AI', fallback: 'AI shot' },
  broll: { label: 'B-roll', glyph: 'B', fallback: 'B-roll insert' },
  aroll: { label: 'A-roll', glyph: 'A', fallback: 'A-roll' },
  vo: { label: 'Voiceover', glyph: 'V', fallback: 'VO line' },
  sfx: { label: 'SFX', glyph: 'S', fallback: 'Hit / whoosh' },
  music: { label: 'Music', glyph: 'M', fallback: 'Score' },
}
const VIDEO_KINDS = ['caption', 'ai', 'broll', 'aroll']
const WAVE_DENSITY = { vo: 6, music: 4.5 } // waveform bars per second
const LEAD = 'Every layer of the timeline has a job: A-roll carries the story, B-roll and AI visuals keep it moving, captions and sound make it land.'

const sec = (n) => `${n.toFixed(1)}s`
const kindOf = (k) => KINDS[k] ?? { label: k, glyph: '·', fallback: 'Clip' }

/** Deterministic pseudo-random in [0, 1) */
const hash = (i, seed) => {
  const x = Math.sin((i + 1) * 12.9898 + seed * 78.233) * 43758.5453
  return x - Math.floor(x)
}

/** Waveform as one path of vertical bars in a 0..n × 0..20 box (stretched to the clip) */
function wavePath(len, kind, seed) {
  const n = Math.max(8, Math.round(len * (WAVE_DENSITY[kind] ?? 5)))
  let d = ''
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n
    let amp
    if (kind === 'vo') {
      // speech: phrase envelope × syllables × grit
      const env = Math.pow(Math.sin(Math.PI * u), 0.45)
      const syl = 0.4 + 0.6 * Math.abs(Math.sin(i * 0.78 + seed))
      amp = env * syl * (0.35 + 0.65 * hash(i, seed))
    } else {
      // score: steady bed with a pulse on the beat
      const beat = i % 8 === 0 ? 1 : 0.74
      amp = beat * (0.4 + 0.32 * hash(i, seed) + 0.2 * Math.abs(Math.sin(i * 0.13 + seed)))
    }
    const h = Math.max(0.08, Math.min(1, amp)) * 8.6
    d += `M${(i + 0.5).toFixed(1)} ${(10 - h).toFixed(2)}V${(10 + h).toFixed(2)}`
  }
  return { d, n }
}

/** Timeline data → render model (NLE targets, % geometry, waveforms, state boundaries) */
function buildModel(timeline) {
  const duration = Math.max(1, timeline?.duration ?? 1)
  const tracks = timeline?.tracks ?? []
  const video = tracks.filter((t) => VIDEO_KINDS.includes(t.kind))
  const audio = tracks.filter((t) => !VIDEO_KINDS.includes(t.kind))
  const rows = tracks.map((t, ti) => {
    const isVideo = VIDEO_KINDS.includes(t.kind)
    const target = isVideo ? `V${video.length - video.indexOf(t)}` : `A${audio.indexOf(t) + 1}`
    const clips = t.clips.map((c, ci) => {
      const start = Math.max(0, Math.min(duration, c.start))
      const end = Math.max(start, Math.min(duration, c.end))
      return {
        key: `${t.id}-${ci}`,
        ti,
        ci,
        start,
        end,
        label: c.label,
        name: c.label || kindOf(t.kind).fallback,
        left: (start / duration) * 100,
        width: ((end - start) / duration) * 100,
        wave: WAVE_DENSITY[t.kind] ? wavePath(end - start, t.kind, ti * 31 + ci * 7 + 3) : null,
      }
    })
    return { id: t.id, name: t.name, kind: t.kind, target, clips }
  })
  const bounds = Array.from(new Set(rows.flatMap((r) => r.clips.flatMap((c) => [c.start, c.end])))).sort((a, b) => a - b)
  const ticks = Array.from({ length: Math.floor(duration) + 1 }, (_, s) => s)
  const kinds = Array.from(new Set(rows.map((r) => r.kind)))
  const keys = new Set(rows.flatMap((r) => r.clips.map((c) => c.key)))
  const clipCount = keys.size
  return { duration, rows, bounds, ticks, kinds, keys, clipCount, firstKey: rows[0]?.clips[0]?.key ?? null }
}

/** Index of the clip nearest to time t */
function nearestClip(clips, t) {
  let best = 0
  let bestD = Infinity
  clips.forEach((c, i) => {
    const d = t < c.start ? c.start - t : t > c.end ? t - c.end : 0
    if (d < bestD) {
      bestD = d
      best = i
    }
  })
  return best
}

/**
 * 04 — Behind the edit.
 * The ad's real layer structure as an NLE timeline. Scrolling sweeps the
 * playhead across it; clips light as they play. Hover / focus a clip for its
 * details; arrow keys move between clips.
 */
export default function EditTimeline({ project }) {
  const root = useRef(null)
  const panelRef = useRef(null)
  const canvasRef = useRef(null)
  const scrollRef = useRef(null)
  const tipRef = useRef(null)
  const tcRef = useRef(null)
  const followRef = useRef({ on: true, lastX: 0 })
  const [focusKey, setFocusKey] = useState(null)
  const [tip, setTip] = useState(null)
  const [canScroll, setCanScroll] = useState(false)
  const [swiped, setSwiped] = useState(false)
  const helpId = useId()

  const model = useMemo(() => buildModel(project.timeline), [project.timeline])
  const { duration, rows } = model
  const rovingKey = focusKey && model.keys.has(focusKey) ? focusKey : model.firstKey
  const runtime = toShort(project.runtime ?? duration)

  /* Horizontal overflow (phones / tablets) — toggles the swipe hint */
  useEffect(() => {
    const sc = scrollRef.current
    if (!sc) return
    const ro = new ResizeObserver(() => setCanScroll(sc.scrollWidth - sc.clientWidth > 1))
    ro.observe(sc)
    if (canvasRef.current) ro.observe(canvasRef.current)
    return () => ro.disconnect()
  }, [])

  useGSAP(
    () => {
      const el = root.current
      const q = gsap.utils.selector(el)
      const reduced = prefersReducedMotion()
      const panel = q('.et-panel')[0]
      const scroller = scrollRef.current
      const wrap = q('.et-ph-wrap')[0]
      const head = q('.et-ph')[0]
      const flag = q('.et-ph__flag')[0]
      const tcEl = tcRef.current
      if (!panel || !scroller || !wrap || !head || !flag || !tcEl) return

      const clips = q('.et-clip').map((c) => ({ el: c, s: +c.dataset.start, e: +c.dataset.end, st: null }))
      const { bounds } = model
      const follow = followRef.current
      follow.on = true
      follow.lastX = scroller.scrollLeft

      /* ---------- Geometry for the mobile auto-follow (cached per refresh) ---------- */
      const geo = { headW: 0, laneW: 0, clientW: 0, max: 0 }
      const measure = () => {
        geo.headW = wrap.offsetLeft
        geo.laneW = wrap.clientWidth
        geo.clientW = scroller.clientWidth
        geo.max = Math.max(0, scroller.scrollWidth - scroller.clientWidth)
      }
      measure()

      /* ---------- Scrubbed playhead ---------- */
      let lastTc = ''
      let lastBucket = -1
      const render = (p) => {
        const t = p * duration
        const code = toTimecode(t)
        if (code !== lastTc) {
          lastTc = code
          tcEl.textContent = code
        }
        // clip states only change when the playhead crosses a clip edge
        let b = 0
        while (b < bounds.length && bounds[b] <= t) b++
        if (b !== lastBucket) {
          lastBucket = b
          for (const c of clips) {
            const st = t >= c.e ? 'lit' : t >= c.s ? 'live' : ''
            if (st === c.st) continue
            c.st = st
            if (st) c.el.dataset.state = st
            else delete c.el.dataset.state
          }
        }
        // phones: the panel pans with the playhead (like an NLE's page-scroll) until the visitor swipes
        if (follow.on && geo.max > 0) {
          const x = Math.round(Math.min(geo.max, Math.max(0, p * geo.laneW - (geo.clientW - geo.headW) / 2)))
          if (x !== follow.lastX) {
            follow.lastX = x
            scroller.scrollLeft = x
          }
        }
      }

      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: panel,
          start: 'top 60%',
          end: 'bottom 40%',
          scrub: reduced ? true : 0.6,
          invalidateOnRefresh: true,
          onRefresh: measure,
        },
        onUpdate: () => render(tl.progress()),
      })
      tl.fromTo(head, { x: 0 }, { x: () => Math.max(0, wrap.clientWidth - 1), duration: 1 }, 0)
        // the flag slides across its pole so it never leaves the lanes
        .fromTo(flag, { xPercent: 0 }, { xPercent: -100, duration: 1 }, 0)
      render(0)

      /* ---------- Entrance (once) ---------- */
      // The panel fades with opacity only (never visibility) so its clips stay tabbable before it reveals
      const once = { trigger: panel, start: 'top 84%', once: true }
      if (reduced) {
        gsap.fromTo(
          q('.et-hintrow, .et-panel, .et-legend'),
          { opacity: 0 },
          { opacity: 1, duration: 0.7, ease: 'power1.out', stagger: 0.06, scrollTrigger: once },
        )
      } else {
        const intro = gsap.timeline({ scrollTrigger: once })
        intro
          .from(panel, { opacity: 0, y: 48, duration: 1.3, ease: EASE.out, clearProps: 'transform' }, 0)
          .from(q('.et-bar > *'), { autoAlpha: 0, y: 8, duration: 0.9, stagger: 0.06, ease: EASE.out }, 0.2)
          .from(
            q('.et-row--track .et-head'),
            { autoAlpha: 0, x: -12, duration: 1, stagger: 0.05, ease: EASE.out, clearProps: 'transform' },
            0.3,
          )
          .from(q('.et-ruler'), { autoAlpha: 0, duration: 0.9, ease: EASE.out }, 0.3)
        q('.et-row--track').forEach((row, ti) => {
          const at = 0.38 + ti * 0.08
          const bodies = row.querySelectorAll('.et-clip')
          const marks = row.querySelectorAll('.et-clip__label, .et-clip__wave')
          intro.fromTo(
            bodies,
            { scaleX: 0 },
            {
              scaleX: 1,
              duration: 1.1,
              ease: EASE.out,
              stagger: (i, target) => (+target.dataset.start / duration) * 0.7,
              clearProps: 'transform',
            },
            at,
          )
          if (marks.length) intro.from(marks, { autoAlpha: 0, duration: 0.7, stagger: 0.02, ease: 'power1.out' }, at + 0.55)
        })
        intro
          .from(q('.et-ph-wrap'), { autoAlpha: 0, duration: 0.8, ease: 'power1.out' }, 0.9)
          .from(q('.et-legend__item'), { autoAlpha: 0, y: 10, duration: 0.9, stagger: 0.05, ease: EASE.out }, 0.8)
      }
    },
    { scope: root, dependencies: [model], revertOnUpdate: true },
  )

  /* ------------------------------------------------------------------------
     Tooltip + keyboard (event delegation on the grid)
     ------------------------------------------------------------------------ */
  const clipAt = (target) => (target instanceof Element ? target.closest('.et-clip') : null)

  const showTip = (clipEl) => {
    const canvas = canvasRef.current
    const sc = scrollRef.current
    const lane = clipEl?.parentElement
    if (!canvas || !sc || !lane) return
    const ti = +clipEl.dataset.t
    const ci = +clipEl.dataset.i
    const w = tipRef.current?.offsetWidth || 232
    const cx = lane.offsetLeft + clipEl.offsetLeft + clipEl.offsetWidth / 2
    const top = lane.offsetTop + clipEl.offsetTop
    // keep it inside the visible part of the lanes (not under the sticky headers)
    const lo = sc.scrollLeft + lane.offsetLeft + w / 2 + 6
    const hi = Math.min(canvas.offsetWidth, sc.scrollLeft + sc.clientWidth) - w / 2 - 6
    const x = hi > lo ? Math.min(hi, Math.max(lo, cx)) : cx
    const below = ti < 2
    setTip({ ti, ci, x, y: below ? top + clipEl.offsetHeight + 8 : top - 8, below, open: true })
  }
  const hideTip = () => setTip((t) => (t && t.open ? { ...t, open: false } : t))

  const onPointerOver = (e) => {
    if (e.pointerType !== 'mouse') return
    const c = clipAt(e.target)
    if (c) showTip(c)
  }
  const onPointerOut = (e) => {
    if (e.pointerType !== 'mouse') return
    const c = clipAt(e.target)
    if (!c || (e.relatedTarget instanceof Node && c.contains(e.relatedTarget))) return
    hideTip()
  }
  const onFocus = (e) => {
    const c = clipAt(e.target)
    if (!c) return
    setFocusKey(c.dataset.key)
    showTip(c)
  }
  const onBlur = (e) => {
    if (clipAt(e.relatedTarget)) return
    hideTip()
  }
  const onClick = (e) => {
    const c = clipAt(e.target)
    if (!c) return
    if (document.activeElement !== c) c.focus({ preventScroll: true })
    showTip(c)
  }
  /** Grid navigation: ←/→ within a track, ↑/↓ to the clip at the same moment, Home/End (+Ctrl) */
  const moveFrom = (key, ti, ci, mod) => {
    const clips = rows[ti].clips
    switch (key) {
      case 'ArrowRight':
        return [ti, Math.min(ci + 1, clips.length - 1)]
      case 'ArrowLeft':
        return [ti, Math.max(ci - 1, 0)]
      case 'ArrowDown':
      case 'ArrowUp': {
        const nt = Math.max(0, Math.min(rows.length - 1, ti + (key === 'ArrowDown' ? 1 : -1)))
        if (nt === ti) return [ti, ci]
        const cur = clips[ci]
        return [nt, nearestClip(rows[nt].clips, (cur.start + cur.end) / 2)]
      }
      case 'Home':
        return [mod ? 0 : ti, 0]
      case 'End': {
        const nt = mod ? rows.length - 1 : ti
        return [nt, rows[nt].clips.length - 1]
      }
      default:
        return null
    }
  }
  const onKeyDown = (e) => {
    const c = clipAt(e.target)
    if (!c) return
    if (e.key === 'Escape') {
      hideTip()
      return
    }
    const ti = +c.dataset.t
    const ci = +c.dataset.i
    const to = moveFrom(e.key, ti, ci, e.ctrlKey || e.metaKey)
    if (!to) return
    e.preventDefault()
    const [nt, nc] = to
    if (nt === ti && nc === ci) return
    const next = canvasRef.current?.querySelector(`[data-key="${rows[nt].clips[nc].key}"]`)
    next?.focus()
  }

  /* A visitor's own swipe hands the panel back to them */
  const onScrollerScroll = (e) => {
    const sc = e.currentTarget
    const panel = panelRef.current
    const atEnd = String(sc.scrollLeft >= sc.scrollWidth - sc.clientWidth - 2)
    if (panel && panel.dataset.end !== atEnd) panel.dataset.end = atEnd
    const f = followRef.current
    if (Math.abs(sc.scrollLeft - f.lastX) <= 4) return
    f.on = false
    if (!swiped) setSwiped(true)
  }

  const tipRow = tip ? rows[tip.ti] : null
  const tipClip = tipRow ? tipRow.clips[tip.ci] : null

  return (
    <section ref={root} className="section et" data-hud="Behind the edit">
      <div className="container">
        <SectionHeader
          index="04"
          eyebrow="Behind the edit"
          title={
            <>
              What&rsquo;s behind <em className="t-serif">{runtime}</em>.
            </>
          }
          lead={LEAD}
          aside={`${rows.length} tracks · ${model.clipCount} clips`}
        />

        <div className="et-hintrow" aria-hidden="true">
          <p className={`et-hint t-mono${canScroll && !swiped ? ' is-on' : ''}`}>
            Swipe the timeline <span className="et-hint__arrow">&rarr;</span>
          </p>
        </div>

        <div ref={panelRef} className={`et-panel${canScroll ? ' is-scrollable' : ''}`}>
          <div className="et-bar">
            <p className="et-bar__name t-mono">
              <span className="et-bar__dot" aria-hidden="true" />
              <span className="et-bar__title">{project.title}</span>
            </p>
            <p className="et-bar__seq t-mono">Sequence 01 &middot; 9:16 &middot; 24fps</p>
            <p className="et-bar__rt t-mono tabular">
              <span className="et-bar__k">Runtime</span> {toTimecode(duration)}
            </p>
          </div>

          <div ref={scrollRef} className="et-scroll" onScroll={onScrollerScroll}>
            <div ref={canvasRef} className="et-canvas" style={{ '--et-dur': duration }}>
              <div
                className="et-grid"
                role="grid"
                aria-readonly="true"
                aria-label={`${project.title} edit timeline, ${runtime}`}
                aria-describedby={helpId}
                onPointerOver={onPointerOver}
                onPointerOut={onPointerOut}
                onFocus={onFocus}
                onBlur={onBlur}
                onClick={onClick}
                onKeyDown={onKeyDown}
              >
                <div className="et-row et-row--ruler" aria-hidden="true">
                  <div className="et-head et-head--ruler">
                    <span className="t-mono">Track</span>
                  </div>
                  <div className="et-ruler">
                    {model.ticks.map((s) => {
                      const major = s % 5 === 0
                      return (
                        <span
                          key={s}
                          className={`et-ruler__tick${major ? ' is-major' : ''}`}
                          style={{ left: `calc(${s / duration} * (100% - 1px))` }}
                        >
                          {major && duration - s >= 2.5 && <span className="et-ruler__lbl t-mono">{toShort(s)}</span>}
                        </span>
                      )
                    })}
                  </div>
                </div>

                {rows.map((r) => (
                  <div key={r.id} className={`et-row et-row--track et-k--${r.kind}`} role="row">
                    <div className="et-head" role="rowheader">
                      <span className="et-head__sw" aria-hidden="true" />
                      <span className="et-head__glyph t-mono" aria-hidden="true">
                        {kindOf(r.kind).glyph}
                      </span>
                      <span className="et-head__name">{r.name}</span>
                      <span className="et-head__tgt t-mono" aria-hidden="true">
                        {r.target}
                      </span>
                    </div>
                    <div className="et-lane" role="none">
                      {r.clips.map((c) => (
                        <div
                          key={c.key}
                          role="gridcell"
                          className={`et-clip${c.wave ? ' et-clip--audio' : ''}`}
                          tabIndex={c.key === rovingKey ? 0 : -1}
                          data-key={c.key}
                          data-t={c.ti}
                          data-i={c.ci}
                          data-start={c.start}
                          data-end={c.end}
                          style={{ left: `${c.left}%`, width: `max(3px, calc(${c.width}% - 2px))` }}
                        >
                          {c.wave && (
                            <svg
                              className="et-clip__wave"
                              viewBox={`0 0 ${c.wave.n} 20`}
                              preserveAspectRatio="none"
                              aria-hidden="true"
                              focusable="false"
                            >
                              <path className="et-clip__wave-path" d={c.wave.d} vectorEffect="non-scaling-stroke" />
                            </svg>
                          )}
                          {c.label && (
                            <span className="et-clip__label t-mono" aria-hidden="true">
                              {c.label}
                            </span>
                          )}
                          <span className="sr-only">{`${c.name}, ${sec(c.start)} to ${sec(c.end)}`}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="et-ph-wrap" aria-hidden="true">
                <span className="et-ph">
                  <span className="et-ph__flag">
                    <span ref={tcRef} className="et-ph__tc tabular">
                      {toTimecode(0)}
                    </span>
                  </span>
                </span>
              </div>

              <Glass
                ref={tipRef}
                className={`et-tip${tipRow ? ` et-k--${tipRow.kind}` : ''}${tip?.open ? ' is-open' : ''}${tip?.below ? ' is-below' : ''}`}
                tone="dark"
                refract={false}
                interactive={false}
                radius={14}
                aria-hidden="true"
                style={{ left: `${tip?.x ?? 0}px`, top: `${tip?.y ?? 0}px` }}
              >
                {tipClip && (
                  <span className="et-tip__body">
                    <span className="et-tip__track t-mono">
                      <span className="et-tip__sw" />
                      {tipRow.name}
                      <span className="et-tip__tgt">{tipRow.target}</span>
                    </span>
                    <span className="et-tip__label">{tipClip.name}</span>
                    <span className="et-tip__time t-mono tabular">
                      {sec(tipClip.start)} &ndash; {sec(tipClip.end)}
                      <span className="et-tip__dur">{sec(tipClip.end - tipClip.start)}</span>
                    </span>
                  </span>
                )}
              </Glass>
            </div>
          </div>
          <p id={helpId} className="sr-only">
            Each row is a track. Use the arrow keys to move between clips; the playhead follows your scroll.
          </p>
        </div>

        <ul className="et-legend" aria-label="Clip types">
          {model.kinds.map((k) => (
            <li key={k} className={`et-legend__item et-k--${k}`}>
              <span className="et-legend__sw" aria-hidden="true" />
              {kindOf(k).label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
