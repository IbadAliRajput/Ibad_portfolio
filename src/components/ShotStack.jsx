import { useImperativeHandle, useRef } from 'react'
import './ShotStack.css'

/**
 * Simulated edit for placeholder mode: a stack of poster "shots" that hard-cut
 * and punch in as a progress value moves through cut points — so scrubbed
 * sections read as real editing while the stand-in videos are black.
 *
 *  shots   [{ src, at: 0..1 (cut point), from?: scale, to?: scale, origin?: '50% 40%' }]
 *  ref     → { setProgress(p) }
 *
 * Render it above the <ScrubVideo> and only when SITE.placeholderMode is true.
 */
export default function ShotStack({ shots, className = '', ref }) {
  const rootRef = useRef(null)
  const last = useRef(-1)

  useImperativeHandle(
    ref,
    () => ({
      setProgress(p) {
        const root = rootRef.current
        if (!root) return
        let i = 0
        for (let k = 0; k < shots.length; k++) if (p >= shots[k].at) i = k
        const s = shots[i]
        const end = i < shots.length - 1 ? shots[i + 1].at : 1
        const local = end > s.at ? Math.min(1, Math.max(0, (p - s.at) / (end - s.at))) : 0
        const imgs = root.children
        if (i !== last.current) {
          if (last.current >= 0 && imgs[last.current]) imgs[last.current].classList.remove('is-on')
          imgs[i]?.classList.add('is-on')
          // restart the cut flash by alternating between two identical
          // animations, which avoids forcing a reflow on every cut
          const flip = root.classList.contains('is-cut-a')
          root.classList.toggle('is-cut-a', !flip)
          root.classList.toggle('is-cut-b', flip)
          last.current = i
        }
        const from = s.from ?? 1.02
        const to = s.to ?? 1.12
        if (imgs[i]) imgs[i].style.transform = `scale(${(from + (to - from) * local).toFixed(4)})`
      },
    }),
    [shots],
  )

  return (
    <div ref={rootRef} className={`shots ${className}`} aria-hidden="true">
      {shots.map((s, i) => (
        <img
          key={i}
          src={s.src}
          alt=""
          loading="lazy"
          decoding="async"
          style={{ transformOrigin: s.origin ?? '50% 45%' }}
          draggable="false"
        />
      ))}
    </div>
  )
}
