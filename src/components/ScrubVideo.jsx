import { useEffect, useImperativeHandle, useRef } from 'react'
import { gsap } from '../lib/gsap'

const clamp01 = (n) => Math.min(1, Math.max(0, n))

/**
 * Scroll-scrubbed <video>. Drive it with `ref.current.setProgress(0..1)`
 * from a ScrollTrigger's onUpdate. The file is fetched into memory so seeks
 * are instant, and the displayed time eases toward the target so fast
 * wheel flicks still read as smooth motion.
 *
 * Encode sources all-intra (every frame a keyframe) for frame-accurate
 * scrubbing, or with a very short GOP for longer clips — see scripts/media.mjs.
 *
 *  ref.current.setProgress(p)   0..1
 *  ref.current.getTime()        currently displayed time (s)
 *  ref.current.duration         seconds (0 until metadata loads)
 */
export default function ScrubVideo({ src, poster, className = '', smoothing = 0.16, ref, ...rest }) {
  const videoRef = useRef(null)
  const state = useRef({ target: 0, current: 0, duration: 0 })

  useImperativeHandle(
    ref,
    () => ({
      setProgress(p) {
        state.current.target = clamp01(p)
      },
      getTime() {
        return state.current.current * state.current.duration
      },
      get duration() {
        return state.current.duration
      },
      get el() {
        return videoRef.current
      },
    }),
    [],
  )

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const s = state.current
    const ctrl = new AbortController()
    let blobUrl = null

    const load = () =>
      fetch(src, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
        .then((b) => {
          if (ctrl.signal.aborted) return
          blobUrl = URL.createObjectURL(b)
          v.src = blobUrl
        })
        .catch(() => {
          if (!ctrl.signal.aborted) v.src = src
        })
    // Fetch once the video is within ~1.5 viewports, so below-the-fold scrubs
    // don't compete with the hero for bandwidth
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return
        io.disconnect()
        load()
      },
      { rootMargin: '150% 0px' },
    )
    io.observe(v)

    // last time handed to the element; seeks are skipped while one is in flight
    // and caught up after, so the resting frame always matches the target
    let applied = -1
    const onMeta = () => {
      s.duration = v.duration || 0
      applied = -1
    }
    // iOS only paints seeked frames after the element has played once
    const onData = () => {
      const p = v.play()
      if (p)
        p.then(() => {
          v.pause()
          applied = -1
        }).catch(() => {})
    }
    v.addEventListener('loadedmetadata', onMeta)
    v.addEventListener('loadeddata', onData, { once: true })

    const tick = () => {
      if (!s.duration) return
      const diff = s.target - s.current
      if (Math.abs(diff) >= 0.00005) {
        s.current += diff * smoothing
        if (Math.abs(s.target - s.current) < 0.0004) s.current = s.target
      }
      const t = Math.min(s.duration - 0.04, s.current * s.duration)
      if (v.seeking || Math.abs(t - applied) < 0.001) return
      applied = t
      v.currentTime = t
    }
    gsap.ticker.add(tick)

    return () => {
      io.disconnect()
      ctrl.abort()
      gsap.ticker.remove(tick)
      v.removeEventListener('loadedmetadata', onMeta)
      v.removeEventListener('loadeddata', onData)
      v.removeAttribute('src')
      v.load()
      if (blobUrl) URL.revokeObjectURL(blobUrl)
    }
  }, [src, smoothing])

  return (
    <video
      ref={videoRef}
      className={`scrub-video ${className}`}
      poster={poster}
      muted
      playsInline
      preload="auto"
      aria-hidden="true"
      tabIndex={-1}
      disablePictureInPicture
      {...rest}
    />
  )
}
