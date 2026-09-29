import { useRef, useState } from 'react'
import { gsap, useGSAP, EASE } from '../lib/gsap'
import { prefersReducedMotion } from '../lib/env'
import { useReady, useScroll } from '../app/context'
import { toTimecode } from '../lib/timecode'
import { SITE } from '../data/site'
import './Preloader.css'

const SEEN_KEY = 'ibad:seen'

// Read once per page load, so StrictMode's second mount doesn't mistake the
// first visit for a return visit
let seenCache = null
function wasSeen() {
  if (seenCache !== null) return seenCache
  try {
    seenCache = sessionStorage.getItem(SEEN_KEY) === '1'
    sessionStorage.setItem(SEEN_KEY, '1')
  } catch {
    seenCache = false
  }
  return seenCache
}

/**
 * The preloader is the hook window: timecode runs 00:00:00:00 → 00:00:03:00
 * while fonts + first media settle, then the frame wipes up into the site.
 * Returning visitors in the same session get a shorter cut.
 */
export default function Preloader() {
  const rootRef = useRef(null)
  const { setReady } = useReady()
  const { stop, start } = useScroll()
  const [done, setDone] = useState(false)

  useGSAP(
    () => {
      const root = rootRef.current
      const tcEl = root.querySelector('.pl__tc')
      const reduce = prefersReducedMotion()
      const seen = wasSeen()
      stop()
      window.scrollTo(0, 0)

      const finish = () => {
        start()
        setDone(true)
      }

      const run = seen || reduce ? 0.8 : 2.1
      const t = { v: 0 }
      const intro = gsap
        .timeline()
        .from('.pl__corner', { autoAlpha: 0, duration: 0.8, stagger: 0.06 }, 0)
        .from('.pl__crop', { scale: 1.04, autoAlpha: 0, duration: 1.2 }, 0)
        .from('.pl__kicker > *', { yPercent: 120, duration: 0.9, stagger: 0.05 }, 0.1)
        .from('.pl__tc', { yPercent: 40, autoAlpha: 0, duration: 1 }, 0.15)
        .to(t, {
          v: 3,
          duration: run,
          ease: 'power2.inOut',
          onUpdate: () => {
            tcEl.textContent = toTimecode(t.v)
          },
        }, 0.2)
        .to('.pl__bar', { scaleX: 1, duration: run, ease: 'power2.inOut' }, 0.2)

      const fontsReady = document.fonts?.ready ?? Promise.resolve()
      const introDone = new Promise((res) => intro.eventCallback('onComplete', res))
      Promise.all([fontsReady, introDone]).then(() => {
        if (!root.isConnected) return
        if (reduce) {
          setReady(true)
          gsap.to(root, { autoAlpha: 0, duration: 0.5, ease: 'power1.out', onComplete: finish })
          return
        }
        gsap
          .timeline({ onComplete: finish })
          .to('.pl__line', { yPercent: -120, duration: 0.7, stagger: 0.04, ease: EASE.inOut })
          .to('.pl__tc', { yPercent: -30, autoAlpha: 0, duration: 0.6, ease: EASE.inOut }, 0)
          .to('.pl__corner, .pl__track, .pl__crop', { autoAlpha: 0, duration: 0.5 }, 0)
          .add(() => setReady(true), 0.35)
          .to(root, { clipPath: 'inset(0% 0% 100% 0%)', duration: 1.1, ease: EASE.inOut }, 0.3)
      })
    },
    { scope: rootRef },
  )

  if (done) return null
  return (
    <div ref={rootRef} className="pl" role="status" aria-live="polite" aria-label="Loading">
      <span className="pl__crop cropmarks" aria-hidden="true" />
      <span className="pl__corner pl__corner--tl t-mono">{SITE.name}</span>
      <span className="pl__corner pl__corner--tr t-mono">Performance creative</span>
      <span className="pl__corner pl__corner--bl t-mono">9:16 · 24 fps</span>
      <span className="pl__corner pl__corner--br t-mono">© {new Date().getFullYear()}</span>

      <div className="pl__center">
        <p className="pl__kicker t-mono">
          <span className="pl__line"><span className="rec-dot" /> Loading the hook</span>
        </p>
        <p className="pl__tc tabular" aria-hidden="true">00:00:00:00</p>
        <p className="pl__kicker t-mono t-mute">
          <span className="pl__line">The first three seconds decide everything</span>
        </p>
      </div>
      <div className="pl__track" aria-hidden="true">
        <span className="pl__bar" />
      </div>
    </div>
  )
}
