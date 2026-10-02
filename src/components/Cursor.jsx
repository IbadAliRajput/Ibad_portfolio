import { useEffect, useRef } from 'react'
import { gsap } from '../lib/gsap'
import { useFinePointer } from '../lib/hooks'
import './Cursor.css'

const LABELS = { play: 'Play', view: 'View', drag: 'Drag', open: 'Open', next: 'Next' }
const INTERACTIVE = 'a, button, [role="button"], input, select, textarea, label, summary'

/**
 * Two-part cursor: a precise dot + a lagging lens that grows into a labelled
 * disc over media. Opt in with data-cursor="play|view|drag|open|next|hide"
 * and an optional data-cursor-label="Custom".
 */
export default function Cursor() {
  const fine = useFinePointer()
  const rootRef = useRef(null)
  const dotRef = useRef(null)
  const lensRef = useRef(null)
  const labelRef = useRef(null)

  useEffect(() => {
    if (!fine) return
    const root = rootRef.current
    const dot = dotRef.current
    const lens = lensRef.current

    // parse the transforms now, while mounting, so the first pointer move reads nothing back
    gsap.set([dot, lens], { x: 0, y: 0 })
    const dx = gsap.quickTo(dot, 'x', { duration: 0.12, ease: 'power3.out' })
    const dy = gsap.quickTo(dot, 'y', { duration: 0.12, ease: 'power3.out' })
    const lx = gsap.quickTo(lens, 'x', { duration: 0.5, ease: 'power3.out' })
    const ly = gsap.quickTo(lens, 'y', { duration: 0.5, ease: 'power3.out' })

    let state = ''
    let shown = false
    const setState = (next, label) => {
      if (next === state && (!label || labelRef.current.textContent === label)) return
      state = next
      root.dataset.state = next
      if (label !== undefined) labelRef.current.textContent = label
    }

    const move = (e) => {
      if (e.pointerType === 'touch') return
      if (!shown) {
        shown = true
        root.classList.add('is-visible')
        // jump straight to the pointer through the quickTos (start = end) — a gsap.set here
        // re-parsed the transforms from computed style and stalled the first move
        dx(e.clientX, e.clientX); dy(e.clientY, e.clientY); lx(e.clientX, e.clientX); ly(e.clientY, e.clientY)
        return
      }
      dx(e.clientX); dy(e.clientY); lx(e.clientX); ly(e.clientY)
    }
    const over = (e) => {
      const t = e.target instanceof Element ? e.target : null
      const tagged = t?.closest('[data-cursor]')
      if (tagged) {
        const kind = tagged.getAttribute('data-cursor')
        setState(kind, tagged.getAttribute('data-cursor-label') ?? LABELS[kind] ?? '')
        return
      }
      if (t?.closest(INTERACTIVE)) setState('link', '')
      else setState('', '')
    }
    const down = () => root.classList.add('is-down')
    const up = () => root.classList.remove('is-down')
    const leave = () => root.classList.remove('is-visible')
    const enter = () => shown && root.classList.add('is-visible')

    window.addEventListener('pointermove', move, { passive: true })
    document.addEventListener('pointerover', over, { passive: true })
    window.addEventListener('pointerdown', down)
    window.addEventListener('pointerup', up)
    document.documentElement.addEventListener('pointerleave', leave)
    document.documentElement.addEventListener('pointerenter', enter)
    return () => {
      window.removeEventListener('pointermove', move)
      document.removeEventListener('pointerover', over)
      window.removeEventListener('pointerdown', down)
      window.removeEventListener('pointerup', up)
      document.documentElement.removeEventListener('pointerleave', leave)
      document.documentElement.removeEventListener('pointerenter', enter)
      gsap.killTweensOf([dot, lens])
    }
  }, [fine])

  if (!fine) return null
  return (
    <div ref={rootRef} className="cursor" aria-hidden="true">
      <div ref={lensRef} className="cursor__lens">
        <span className="cursor__disc">
          <span ref={labelRef} className="cursor__label t-mono" />
        </span>
      </div>
      <div ref={dotRef} className="cursor__dot" />
    </div>
  )
}
