import { useCallback, useEffect, useRef, useState } from 'react'
import Glass from './LiquidGlass'
import { AdCaption } from './VerticalVideo'
import { gsap, EASE } from '../lib/gsap'
import { useScroll } from '../app/context'
import { toShort } from '../lib/timecode'
import { SITE } from '../data/site'
import './VideoModal.css'

function Icon({ name }) {
  const paths = {
    play: <path d="M5 3.5v9l7.5-4.5z" fill="currentColor" />,
    pause: <path d="M4.5 3h2.5v10H4.5zM9 3h2.5v10H9z" fill="currentColor" />,
    close: <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />,
    sound: <path d="M2.5 6h2.5L8.5 3v10L5 10H2.5zM11 5.5a3.5 3.5 0 0 1 0 5M12.8 3.8a6 6 0 0 1 0 8.4" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />,
    mute: <path d="M2.5 6h2.5L8.5 3v10L5 10H2.5zM11 6l3.5 4M14.5 6L11 10" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />,
    full: <path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />,
  }
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      {paths[name]}
    </svg>
  )
}

/**
 * Fullscreen 9:16 player (click-to-expand). Rendered once at the app root;
 * open it from anywhere with useVideo().openVideo({ src, poster, title, kicker, meta }).
 */
export default function VideoModal({ item, onClose }) {
  const rootRef = useRef(null)
  const videoRef = useRef(null)
  const closeRef = useRef(null)
  const trackRef = useRef(null)
  const fillRef = useRef(null)
  const timeRef = useRef(null)
  const lastFocus = useRef(null)
  const { stop, start } = useScroll()
  const [shown, setShown] = useState(null)
  const [paused, setPaused] = useState(false)
  const [muted, setMuted] = useState(false)

  // Mount on open
  useEffect(() => {
    if (!item) return
    lastFocus.current = document.activeElement
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShown(item)
  }, [item])

  // Animate in once mounted
  useEffect(() => {
    if (!shown) return
    const root = rootRef.current
    stop()
    // Opacity only (not autoAlpha) on the dialog and its controls: a visibility:hidden
    // element can't take focus, and focus has to move into the dialog right away
    gsap
      .timeline()
      .fromTo(root, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: 'power2.out' })
      .fromTo('.vm__frame', { y: 60, scale: 0.92, clipPath: 'inset(8% 8% 8% 8% round 40px)' }, { y: 0, scale: 1, clipPath: 'inset(0% 0% 0% 0% round 0px)', duration: 1, ease: EASE.out }, 0)
      .fromTo('.vm__side > *', { y: 20, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.8, stagger: 0.06 }, 0.25)
      .fromTo('.vm__controls, .vm__close', { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7 }, 0.35)
    closeRef.current?.focus({ preventScroll: true })
    const v = videoRef.current
    if (v) {
      v.muted = false
      v.play().catch(() => {
        v.muted = true
        setMuted(true)
        v.play().catch(() => {})
      })
    }
  }, [shown, stop])

  const close = useCallback(() => {
    const root = rootRef.current
    if (!root) return
    gsap
      .timeline({
        onComplete: () => {
          setShown(null)
          setPaused(false)
          setMuted(false)
          start()
          onClose()
          lastFocus.current?.focus?.({ preventScroll: true })
        },
      })
      .to('.vm__frame', { y: 40, scale: 0.94, duration: 0.5, ease: EASE.inOut })
      .to(root, { opacity: 0, duration: 0.45, ease: 'power2.in' }, 0.05)
  }, [onClose, start])

  const toggle = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) { v.play().catch(() => {}); setPaused(false) }
    else { v.pause(); setPaused(true) }
  }, [])

  // Keyboard: Esc, Space, focus trap
  useEffect(() => {
    if (!shown) return
    const onKey = (e) => {
      if (e.key === 'Escape') close()
      if (e.key === ' ' && e.target === document.body) {
        e.preventDefault()
        toggle()
      }
      if (e.key === 'Tab') {
        const f = rootRef.current.querySelectorAll('button:not([tabindex="-1"]), [tabindex="0"]')
        if (!f.length) return
        const first = f[0]
        const last = f[f.length - 1]
        // focus somehow outside the dialog (e.g. a click on the page behind) → bring it back
        if (!rootRef.current.contains(document.activeElement)) { e.preventDefault(); (e.shiftKey ? last : first).focus() }
        else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // Progress readout
  useEffect(() => {
    if (!shown) return
    let raf = 0
    const loop = () => {
      const v = videoRef.current
      if (v && v.duration) {
        const pct = Math.round((v.currentTime / v.duration) * 100)
        fillRef.current.style.transform = `scaleX(${v.currentTime / v.duration})`
        timeRef.current.textContent = `${toShort(v.currentTime)} / ${toShort(v.duration)}`
        if (trackRef.current.getAttribute('aria-valuenow') !== String(pct)) {
          trackRef.current.setAttribute('aria-valuenow', String(pct))
          trackRef.current.setAttribute('aria-valuetext', `${toShort(v.currentTime)} of ${toShort(v.duration)}`)
        }
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [shown])

  const toggleMute = () => {
    const v = videoRef.current
    if (!v) return
    v.muted = !v.muted
    setMuted(v.muted)
  }
  const fullscreen = () => {
    const v = videoRef.current
    if (!v) return
    if (v.requestFullscreen) v.requestFullscreen().catch(() => {})
    else if (v.webkitEnterFullscreen) v.webkitEnterFullscreen()
  }
  const seek = (clientX) => {
    const v = videoRef.current
    const b = trackRef.current.getBoundingClientRect()
    if (!v?.duration) return
    v.currentTime = Math.min(1, Math.max(0, (clientX - b.left) / b.width)) * v.duration
  }
  const onTrackDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    seek(e.clientX)
  }
  const onTrackKey = (e) => {
    const v = videoRef.current
    if (!v?.duration) return
    const to = {
      ArrowRight: v.currentTime + 2,
      ArrowUp: v.currentTime + 2,
      ArrowLeft: v.currentTime - 2,
      ArrowDown: v.currentTime - 2,
      PageUp: v.currentTime + 10,
      PageDown: v.currentTime - 10,
      Home: 0,
      End: v.duration - 0.05,
    }[e.key]
    if (to === undefined) return
    e.preventDefault()
    v.currentTime = Math.min(v.duration, Math.max(0, to))
  }

  if (!shown) return null
  return (
    <div ref={rootRef} className="vm" role="dialog" aria-modal="true" aria-label={shown.title ?? 'Video player'}>
      <button className="vm__backdrop" aria-label="Close player" tabIndex={-1} onClick={close} />

      <aside className="vm__side">
        {shown.kicker && <p className="t-mono t-mute">{shown.kicker}</p>}
        {shown.title && <h2 className="t-h2">{shown.title}</h2>}
        {shown.meta && <p className="t-small">{shown.meta}</p>}
      </aside>

      <div className="vm__stage">
        <div className="vm__frame">
          {shown.poster && <img className="vm__poster" src={shown.poster} alt="" />}
          <video
            ref={videoRef}
            className="vm__video"
            src={shown.src}
            playsInline
            loop
            onClick={toggle}
            onPlay={() => setPaused(false)}
            onPause={() => setPaused(true)}
          />
          {SITE.placeholderMode && shown.caption && (
            <AdCaption text={shown.caption} hl={shown.captionHl} className="vm__caption" />
          )}
          <Glass className="vm__controls" radius={999} tone="dark">
            <button className="vm__btn" onClick={toggle} aria-label={paused ? 'Play' : 'Pause'}>
              <Icon name={paused ? 'play' : 'pause'} />
            </button>
            <div
              ref={trackRef}
              className="vm__track"
              role="slider"
              tabIndex={0}
              aria-label="Seek"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={0}
              onPointerDown={onTrackDown}
              onPointerMove={(e) => e.buttons === 1 && seek(e.clientX)}
              onKeyDown={onTrackKey}
            >
              <span ref={fillRef} className="vm__fill" />
            </div>
            <span ref={timeRef} className="vm__time t-mono">0:00 / 0:00</span>
            <button className="vm__btn" onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>
              <Icon name={muted ? 'mute' : 'sound'} />
            </button>
            <button className="vm__btn" onClick={fullscreen} aria-label="Fullscreen">
              <Icon name="full" />
            </button>
          </Glass>
        </div>
      </div>

      <Glass as="button" ref={closeRef} radius={999} tone="dark" className="vm__close" onClick={close} aria-label="Close player">
        <Icon name="close" />
      </Glass>
    </div>
  )
}
