import { useEffect, useRef } from 'react'
import VerticalVideo, { AdCaption } from '../components/VerticalVideo'
import Glass from '../components/LiquidGlass'
import Button, { ArrowIcon } from '../components/Button'
import { SectionHeader } from '../components/Primitives'
import { TLink } from '../app/PageTransition'
import { useScroll } from '../app/context'
import { gsap, useGSAP, EASE } from '../lib/gsap'
import { hasFinePointer, prefersReducedMotion } from '../lib/env'
import { toShort } from '../lib/timecode'
import { CTA_LINES, SITE } from '../data/site'
import { FEATURED, PROJECTS } from '../data/projects'
import './SelectedWork.css'

const pad2 = (n) => String(n).padStart(2, '0')
const LAST = FEATURED.length - 1
const years = PROJECTS.map((p) => p.year)
const YEARS = Math.min(...years) === Math.max(...years) ? String(years[0]) : `${Math.min(...years)}–${Math.max(...years)}`
const GLOW = 0.14 // peak opacity of the ambient tone behind the active card
const PARALLAX = 6 // xPercent travel of the poster inside its frame
const POSTER_SCALE = 1.14 // head-room so the parallax never shows an edge
const clampSkew = gsap.utils.clamp(-3, 3)

function WorkCard({ project, index }) {
  const { slug, title, kicker, formatLabel, client, year, runtime, styles, poster, video, caption, captionHl } = project
  return (
    <TLink
      to={`/work/${slug}`}
      label={title}
      kicker="Case study"
      className="wk-card"
      data-cursor="view"
      aria-label={`${title}, ${formatLabel} for ${client}, ${year}. View case study`}
    >
      <div className="wk-card__media">
        <VerticalVideo
          src={video}
          poster={poster}
          mode="auto"
          label={formatLabel}
          meta={toShort(runtime)}
          cropmarks
          className="wk-card__vv"
        >
          <div className="wk-card__bottom">
            {SITE.placeholderMode && <AdCaption text={caption} hl={captionHl} className="wk-card__caption" />}
            <Glass as="span" radius={999} tone="dark" className="wk-card__cta" aria-hidden="true">
              <span className="wk-card__cta-label">View case study</span>
              <span className="wk-card__cta-icon">
                <ArrowIcon />
              </span>
            </Glass>
          </div>
        </VerticalVideo>
      </div>

      <div className="wk-card__info">
        <p className="wk-card__row t-mono">
          <span className="wk-card__idx">{pad2(index + 1)}</span>
          <span className="wk-card__bar" aria-hidden="true" />
          <span className="wk-card__kicker">{kicker}</span>
        </p>
        <h3 className="wk-card__title t-h3">{title}</h3>
        <p className="wk-card__meta t-mono">
          {client} <span aria-hidden="true">·</span> <span className="tabular">{year}</span>
        </p>
        <ul className="wk-card__chips">
          {styles.map((s) => (
            <li key={s} className="chip wk-card__chip">
              {s}
            </li>
          ))}
        </ul>
      </div>
    </TLink>
  )
}

/**
 * 03 — Selected Work, the centrepiece.
 *  Desktop  pinned stage; vertical scroll drives a horizontal track of 9:16
 *           cards (scrubbed), with per-card reveals + inner poster parallax on
 *           containerAnimation triggers, velocity skew, a playhead progress bar
 *           and an ambient glow in the active project's tone.
 *  Touch    native scroll-snap carousel with the same progress + counter.
 *  Reduced  pin + scrub stay (visitor-driven); skew, parallax and big
 *           entrance moves are dropped for short fades.
 */
export default function SelectedWork() {
  const root = useRef(null)
  const { scrollTo } = useScroll()
  // Lenis is created after first paint — keep the latest scrollTo for event handlers
  const scrollToRef = useRef(scrollTo)
  useEffect(() => {
    scrollToRef.current = scrollTo
  }, [scrollTo])

  useGSAP(
    () => {
      const q = gsap.utils.selector(root)
      const stage = q('.wk-stage')[0]
      const track = q('.wk-track')[0]
      const items = q('.wk-item') // project cards only — the end card is .wk-item--end
      const progressEl = q('.wk-progress')[0]
      const num = q('.wk-progress__num')[0]
      const glows = q('.wk-ambient__glow')
      if (!stage || !track || !items.length) return
      const reduce = prefersReducedMotion()

      /* Progress writer — shared by the pinned track and the touch carousel.
         Per-frame work is a single custom property; the counter + ambient tone
         only change on discrete index changes. */
      let current = 0
      gsap.set(glows, { opacity: 0 })
      gsap.set(glows[0], { opacity: GLOW })
      const setProgress = (p) => {
        progressEl?.style.setProperty('--wk-p', p.toFixed(4))
        const i = Math.round(p * LAST)
        if (i === current) return
        const dir = i > current ? 1 : -1
        gsap.to(glows[current], { opacity: 0, duration: 1.4, ease: EASE.soft, overwrite: true })
        gsap.to(glows[i], { opacity: GLOW, duration: 1.4, ease: EASE.soft, overwrite: true })
        current = i
        if (!num) return
        num.textContent = pad2(i + 1)
        if (!reduce) gsap.fromTo(num, { yPercent: 105 * dir }, { yPercent: 0, duration: 0.7, ease: EASE.out, overwrite: true })
      }

      const mediaOf = (it) => it.querySelector('.wk-card__media')
      const infoOf = (it) => it.querySelectorAll('.wk-card__info > *')

      const mm = gsap.matchMedia()

      /* ---------------------------------------------------------------------
         Desktop — pinned horizontal gallery
         --------------------------------------------------------------------- */
      mm.add('(min-width: 1024px)', () => {
        const distance = () => Math.max(0, track.scrollWidth - stage.clientWidth)
        const cleanups = []

        // Velocity skew: lean into the motion, settle back to 0
        const proxy = { skew: 0 }
        const skewSet = gsap.quickSetter(track, 'skewX', 'deg')
        const onVelocity = (self) => {
          const s = clampSkew(self.getVelocity() / 900)
          if (Math.abs(s) > Math.abs(proxy.skew)) {
            proxy.skew = s
            gsap.to(proxy, {
              skew: 0,
              duration: 0.9,
              ease: 'power3.out',
              overwrite: true,
              onUpdate: () => skewSet(proxy.skew),
            })
          }
        }

        // Cards on screen before the track moves reveal with the stage; the rest as they enter from the right
        const initial = items.filter((it) => it.offsetLeft < stage.clientWidth * 0.9)
        const later = items.filter((it) => !initial.includes(it))

        const tween = gsap.to(track, {
          x: () => -distance(),
          ease: 'none',
          scrollTrigger: {
            trigger: stage,
            start: 'top top',
            end: () => `+=${distance()}`,
            pin: true,
            scrub: 1,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            onUpdate: reduce ? undefined : onVelocity,
          },
        })
        // Registered before any containerAnimation trigger (they chain onto it)
        tween.eventCallback('onUpdate', () => setProgress(tween.progress()))
        cleanups.push(() => gsap.killTweensOf(proxy))

        // Entrance of the first visible cards
        const intro = gsap.timeline({
          scrollTrigger: { trigger: track, pinnedContainer: stage, start: 'top 84%', once: true },
        })
        initial.forEach((it, i) => {
          if (reduce) {
            intro.from([mediaOf(it), ...infoOf(it)], { opacity: 0, duration: 0.6, ease: 'power1.out' }, i * 0.08)
            return
          }
          intro.from(mediaOf(it), { y: 96, opacity: 0, duration: 1.5, ease: EASE.out }, i * 0.1)
          intro.from(infoOf(it), { y: 26, opacity: 0, duration: 1.1, stagger: 0.06, ease: EASE.out }, i * 0.1 + 0.35)
        })

        // Info reveals as each later card slides in
        later.forEach((it) => {
          gsap.from(infoOf(it), {
            y: reduce ? 0 : 26,
            opacity: 0,
            duration: reduce ? 0.6 : 1.1,
            stagger: 0.06,
            ease: reduce ? 'power1.out' : EASE.out,
            scrollTrigger: { trigger: it, containerAnimation: tween, start: 'left 86%', toggleActions: 'play none none none' },
          })
        })

        // Poster: inner parallax (scrubbed on the track) + a slow push-in on hover
        const fine = hasFinePointer()
        const base = reduce ? 1 : POSTER_SCALE
        items.forEach((it) => {
          const img = it.querySelector('.vv__poster')
          const card = it.querySelector('.wk-card')
          if (!img) return
          // GSAP owns this transform now — drop the component's CSS transition so they don't fight
          gsap.set(img, { transition: 'none', scale: base, transformOrigin: '50% 50%' })
          if (!reduce) {
            gsap.fromTo(
              img,
              { xPercent: -PARALLAX },
              {
                xPercent: PARALLAX,
                ease: 'none',
                scrollTrigger: { trigger: it, containerAnimation: tween, start: 'left right', end: 'right left', scrub: true },
              },
            )
          }
          if (!fine || !card) return
          const on = () => gsap.to(img, { scale: base * 1.06, duration: 1.4, ease: EASE.out, overwrite: 'auto' })
          const off = () => gsap.to(img, { scale: base, duration: 1.1, ease: EASE.out, overwrite: 'auto' })
          card.addEventListener('pointerenter', on)
          card.addEventListener('pointerleave', off)
          cleanups.push(() => {
            card.removeEventListener('pointerenter', on)
            card.removeEventListener('pointerleave', off)
            gsap.killTweensOf(img, 'scale')
          })
        })

        // Keyboard: a tabbed-to card is off-canvas horizontally, so scroll the pin to it
        const onFocusIn = (e) => {
          const el = e.target
          if (!(el instanceof Element) || !el.matches(':focus-visible')) return
          const item = el.closest('.wk-item, .wk-item--end')
          const st = tween.scrollTrigger
          const d = distance()
          if (!item || !st || !d) return
          const x = gsap.utils.clamp(0, d, item.offsetLeft + item.offsetWidth / 2 - stage.clientWidth / 2)
          scrollToRef.current(st.start + (x / d) * (st.end - st.start), { duration: 1.1, immediate: reduce })
        }
        track.addEventListener('focusin', onFocusIn)
        cleanups.push(() => track.removeEventListener('focusin', onFocusIn))

        return () => cleanups.forEach((fn) => fn())
      })

      /* ---------------------------------------------------------------------
         Tablet / phone — native scroll-snap carousel
         --------------------------------------------------------------------- */
      mm.add('(max-width: 1023px)', () => {
        let raf = 0
        const update = () => {
          raf = 0
          const max = track.scrollWidth - track.clientWidth
          setProgress(max > 0 ? gsap.utils.clamp(0, 1, track.scrollLeft / max) : 0)
        }
        const onScroll = () => {
          if (!raf) raf = requestAnimationFrame(update)
        }
        track.addEventListener('scroll', onScroll, { passive: true })
        update()

        gsap.from(items, {
          y: reduce ? 0 : 56,
          opacity: 0,
          duration: reduce ? 0.6 : 1.3,
          stagger: 0.08,
          ease: reduce ? 'power1.out' : EASE.out,
          scrollTrigger: { trigger: track, start: 'top 88%', once: true },
        })

        return () => {
          track.removeEventListener('scroll', onScroll)
          cancelAnimationFrame(raf)
        }
      })

      return () => {
        mm.revert()
        gsap.killTweensOf([num, ...glows].filter(Boolean))
      }
    },
    { scope: root },
  )

  return (
    <section ref={root} id="work" className="wk" data-hud="Selected Work">
      <div className="container wk-head">
        <SectionHeader
          index="03"
          eyebrow="Selected work"
          title={
            <>
              Ads engineered to <em className="t-serif">stop the scroll.</em>
            </>
          }
          lead="Six real ads — AI story VSLs, claymation and glass-anatomy explainers, hook tests and UGC — each built around a hook, a structure and a test plan."
          aside={`(${pad2(FEATURED.length)}) — ${YEARS}`}
        />
      </div>

      <div className="wk-stage">
        <div className="wk-ambient" aria-hidden="true">
          {FEATURED.map((p) => (
            <span key={p.slug} className="wk-ambient__glow" style={{ '--wk-tone': p.tone }} />
          ))}
        </div>

        <ul className="wk-track" aria-label="Selected work">
          {FEATURED.map((p, i) => (
            <li key={p.slug} className={`wk-item${i % 2 ? ' wk-item--low' : ''}`}>
              <WorkCard project={p} index={i} />
            </li>
          ))}
          <li className="wk-item--end">
            <div className="wk-end">
              <p className="wk-end__title t-h2">
                Every edit,
                <br />
                <em className="t-serif">every angle.</em>
              </p>
              <div className="wk-end__foot">
                <Button to="/work" label="All work" kicker="Index">
                  {CTA_LINES.cases}
                </Button>
                <p className="wk-end__count t-mono t-mute">
                  <span className="tabular">{PROJECTS.length}</span> projects
                </p>
              </div>
            </div>
          </li>
        </ul>

        <div className="wk-progress" aria-hidden="true">
          <span className="wk-progress__count t-mono">
            <span className="wk-progress__mask">
              <span className="wk-progress__num">01</span>
            </span>
            <span className="wk-progress__sep">/</span>
            <span>{pad2(FEATURED.length)}</span>
          </span>
          <span className="wk-progress__track">
            <span className="wk-progress__fill" />
            <span className="wk-progress__head" />
          </span>
          <span className="wk-progress__hint t-mono">
            <span className="wk-progress__hint-desk">Scroll</span>
            <span className="wk-progress__hint-touch">
              Swipe <ArrowIcon />
            </span>
          </span>
        </div>
      </div>

      <div className="container wk-more">
        <Button to="/work" label="All work" kicker="Index">
          View all work
        </Button>
        <p className="wk-more__meta t-mono t-mute">
          <span className="tabular">{PROJECTS.length}</span> projects · {YEARS}
        </p>
      </div>
    </section>
  )
}
