import { useEffect, useRef, useState } from 'react'
import Glass from './LiquidGlass'
import Button from './Button'
import { gsap, useGSAP } from '../lib/gsap'
import { getMotion, rememberMotion, setMotion } from '../lib/env'
import { useReady } from '../app/context'
import './MotionToast.css'

/**
 * Shown once when the OS asks for reduced motion and the visitor hasn't chosen.
 * Respects the setting by default while making the full cut one click away.
 */
export default function MotionToast() {
  const { ready } = useReady()
  const [show, setShow] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const m = getMotion()
    if (!ready || !m.os || m.stored) return
    const t = setTimeout(() => setShow(true), 1600)
    return () => clearTimeout(t)
  }, [ready])

  useGSAP(
    () => {
      if (show) gsap.fromTo(ref.current, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6, ease: 'power1.out' })
    },
    { dependencies: [show] },
  )

  const keep = () => {
    rememberMotion('reduced')
    gsap.to(ref.current, { autoAlpha: 0, duration: 0.4, onComplete: () => setShow(false) })
  }

  if (!show) return null
  return (
    <Glass ref={ref} className="mt" tone="dark" radius={22} role="dialog" aria-label="Motion preference">
      <p className="mt__copy t-small">
        <span className="t-fg">Reduced motion is on.</span> Your system asked for less animation, so this
        motion-led portfolio is toned down.
      </p>
      <div className="mt__actions">
        <Button size="sm" onClick={() => setMotion('full')}>
          Play full motion
        </Button>
        <button className="mt__keep t-mono" onClick={keep}>
          Keep reduced
        </button>
      </div>
    </Glass>
  )
}
