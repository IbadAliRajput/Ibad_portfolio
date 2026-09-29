import { useEffect, useRef, useState } from 'react'
import { SITE } from '../data/site'
import { useVideo } from '../app/context'
import { useFinePointer, useInViewOnce } from '../lib/hooks'
import './VerticalVideo.css'

const safePlay = (v) => v?.play()?.catch(() => {})

/** Renders an ad-style burned-in caption, highlighting `hl` like a keyword pop */
export function AdCaption({ text, hl, className = '' }) {
  if (!text) return null
  let body = text
  const at = hl ? text.indexOf(hl) : -1
  if (at >= 0) {
    body = (
      <>
        {text.slice(0, at)}
        <span className="caption-hl">{hl}</span>
        {text.slice(at + hl.length)}
      </>
    )
  }
  return <p className={`ad-caption ${className}`}>{body}</p>
}

/**
 * 9:16 video card — the native shape of the work.
 *
 *  mode        'auto'   → inview autoplay if SITE.autoplayPreviews, else hover-to-play on fine pointers
 *              'hover' | 'inview' | 'manual' (use `playing`) | 'none'
 *  caption     ad-style caption over the placeholder footage (`captionHl` is highlighted);
 *              real ads carry their own burned-in captions, so it only draws in placeholder mode
 *  label/meta  top-left chip / top-right mono text
 *  expand      object → click opens the fullscreen player: { title, kicker, meta }
 *  cropmarks   viewfinder corners
 *  children    extra overlay content (absolutely positioned inside)
 */
export default function VerticalVideo({
  src,
  poster,
  alt = '',
  mode = 'auto',
  playing = false,
  caption,
  captionHl,
  label,
  meta,
  expand,
  cropmarks = false,
  showProgress = true,
  priority = false,
  className = '',
  children,
  onClick,
  ...rest
}) {
  const rootRef = useRef(null)
  const videoRef = useRef(null)
  const barRef = useRef(null)
  const [near, setNear] = useState(priority)
  const [hovering, setHovering] = useState(false)
  const [inView, setInView] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const fine = useFinePointer()
  const { openVideo } = useVideo()

  const effMode = mode === 'auto' ? (SITE.autoplayPreviews ? 'inview' : fine ? 'hover' : 'none') : mode

  useInViewOnce(rootRef, () => setNear(true), '400px')

  // Track visibility for inview autoplay (and to pause anything off-screen)
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.35 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const shouldPlay =
    near &&
    ((effMode === 'inview' && inView) || (effMode === 'hover' && hovering) || (effMode === 'manual' && playing && inView))

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (shouldPlay) safePlay(v)
    else if (!v.paused) v.pause()
  }, [shouldPlay])

  // Progress bar — written straight to the DOM, no re-renders
  useEffect(() => {
    if (!isPlaying || !showProgress) return
    let raf = 0
    const v = videoRef.current
    const loop = () => {
      if (v && v.duration && barRef.current) barRef.current.style.transform = `scaleX(${v.currentTime / v.duration})`
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [isPlaying, showProgress])

  const handleClick = (e) => {
    onClick?.(e)
    if (!e.defaultPrevented && expand) openVideo({ src, poster, caption, captionHl, ...expand })
  }
  const handleKey = (e) => {
    if (expand && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault()
      openVideo({ src, poster, caption, captionHl, ...expand })
    }
  }

  const interactive = Boolean(expand)

  return (
    <div
      ref={rootRef}
      className={`vv${isPlaying ? ' is-playing' : ''}${interactive ? ' is-interactive' : ''} ${className}`}
      onPointerEnter={() => { setHovering(true); setNear(true) }}
      onPointerLeave={() => setHovering(false)}
      onClick={interactive || onClick ? handleClick : undefined}
      onKeyDown={interactive ? handleKey : undefined}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? `Play ${expand.title ?? 'video'}` : undefined}
      data-cursor={interactive ? 'play' : undefined}
      {...rest}
    >
      {poster && (
        <img className="vv__poster" src={poster} alt={alt} loading={priority ? 'eager' : 'lazy'} decoding="async" draggable="false" />
      )}
      {near && src && (
        <video
          ref={videoRef}
          className="vv__video"
          src={src}
          muted
          playsInline
          loop
          preload="metadata"
          aria-hidden="true"
          onPlaying={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onCanPlay={() => shouldPlay && safePlay(videoRef.current)}
        />
      )}
      <span className="vv__shade" aria-hidden="true" />
      {cropmarks && <span className="vv__crop cropmarks" aria-hidden="true" />}
      <div className="vv__overlay">
        {(label || meta) && (
          <div className="vv__top">
            {label ? <span className="chip vv__chip">{label}</span> : <span />}
            {meta && <span className="vv__meta t-mono">{meta}</span>}
          </div>
        )}
        {SITE.placeholderMode && caption && <AdCaption text={caption} hl={captionHl} className="vv__caption" />}
        {children}
      </div>
      {showProgress && (
        <span className="vv__progress" aria-hidden="true">
          <span ref={barRef} />
        </span>
      )}
    </div>
  )
}
