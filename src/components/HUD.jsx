import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router'
import { gsap, ScrollTrigger, useGSAP } from '../lib/gsap'
import { useIsDesktop } from '../lib/hooks'
import { useReady } from '../app/context'
import { toTimecode } from '../lib/timecode'
import './HUD.css'

/**
 * Edit-suite HUD. The page is treated as a 60-second ad: scroll position is
 * the playhead, shown as timecode, and the current section is the "marker".
 * Sections opt in with  data-hud="Section name".
 */
export default function HUD() {
  const desktop = useIsDesktop()
  const { ready } = useReady()
  const location = useLocation()
  const rootRef = useRef(null)
  const tcRef = useRef(null)
  const markerRef = useRef(null)
  const barRef = useRef(null)
  const current = useRef('')

  useGSAP(
    () => {
      if (!ready || !desktop) return
      gsap.fromTo(rootRef.current, { autoAlpha: 0 }, { autoAlpha: 1, duration: 1, delay: 1.2 })
    },
    { dependencies: [ready, desktop] },
  )

  // Sections with their own timecode (the showreel) can mute the HUD
  useEffect(() => {
    const onMute = (e) => rootRef.current?.classList.toggle('is-muted', Boolean(e.detail))
    window.addEventListener('hud:mute', onMute)
    return () => window.removeEventListener('hud:mute', onMute)
  }, [])

  // Timecode + progress
  useEffect(() => {
    if (!desktop) return
    let last = -1
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight
      const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0
      if (Math.abs(p - last) < 0.0002) return
      last = p
      if (tcRef.current) tcRef.current.textContent = toTimecode(p * 60)
      if (barRef.current) barRef.current.parentElement.style.setProperty('--p', p.toFixed(4))
    }
    gsap.ticker.add(update)
    return () => gsap.ticker.remove(update)
  }, [desktop])

  // Section markers
  useEffect(() => {
    if (!desktop) return
    rootRef.current?.classList.remove('is-muted')
    const triggers = []
    const setMarker = (name) => {
      if (!name || name === current.current || !markerRef.current) return
      current.current = name
      gsap.to(markerRef.current, {
        duration: 0.8,
        scrambleText: { text: name.toUpperCase(), chars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', speed: 0.8 },
        ease: 'none',
      })
    }
    const id = setTimeout(() => {
      document.querySelectorAll('[data-hud]').forEach((el) => {
        triggers.push(
          ScrollTrigger.create({
            trigger: el,
            start: 'top 55%',
            end: 'bottom 55%',
            // refreshed after every pin, so a section's end includes its own pin spacing
            refreshPriority: -1,
            onToggle: (self) => self.isActive && setMarker(el.dataset.hud),
          }),
        )
      })
      const first = document.querySelector('[data-hud]')
      if (first && window.scrollY < 50) setMarker(first.dataset.hud)
    }, 600)
    return () => {
      clearTimeout(id)
      triggers.forEach((t) => t.kill())
    }
  }, [desktop, location.pathname])

  if (!desktop) return null
  return (
    <div ref={rootRef} className="hud" aria-hidden="true">
      <div className="hud__left t-mono">
        <span className="rec-dot" />
        <span ref={tcRef} className="hud__tc">00:00:00:00</span>
        <span className="hud__sep" />
        <span ref={markerRef} className="hud__marker" />
      </div>
      <div className="hud__right t-mono">
        <span className="hud__label">Runtime</span>
        <span className="hud__track">
          <span ref={barRef} className="hud__bar" />
        </span>
        <span>00:01:00:00</span>
      </div>
    </div>
  )
}
