import { useRef } from 'react'
import { gsap, SplitText, useGSAP, EASE } from '../lib/gsap'
import { prefersReducedMotion } from '../lib/env'
import { useReady } from '../app/context'

/**
 * Masked text reveal (lines rise out of clipped masks).
 *
 *  type     'lines' | 'words' | 'chars'
 *  trigger  'view'   → plays when scrolled into view (default)
 *           'ready'  → plays once the preloader has finished (hero copy)
 *           'none'   → split + hide, you drive it (listen for the returned split via onSplit)
 *  delay / stagger / duration / start (ScrollTrigger start)
 *
 * Children may include inline elements (<em className="t-serif">, <br/> …).
 */
export default function SplitReveal({
  as: Tag = 'div',
  type = 'lines',
  trigger = 'view',
  delay = 0,
  stagger,
  duration = 1.25,
  start = 'top 88%',
  className = '',
  children,
  ...rest
}) {
  const ref = useRef(null)
  const { ready } = useReady()
  const armed = trigger !== 'ready' || ready

  useGSAP(
    () => {
      const el = ref.current
      if (!el || !armed) return
      if (trigger === 'none') {
        gsap.set(el, { autoAlpha: 1 })
        return
      }
      if (prefersReducedMotion()) {
        gsap.fromTo(el, { autoAlpha: 0 }, {
          autoAlpha: 1,
          duration: 0.7,
          delay,
          ease: 'power1.out',
          scrollTrigger: trigger === 'view' ? { trigger: el, start, once: true } : undefined,
        })
        return
      }
      const splitType = type === 'chars' ? 'lines,words,chars' : type === 'words' ? 'lines,words' : 'lines'
      const split = SplitText.create(el, {
        type: splitType,
        mask: 'lines',
        linesClass: 'line-mask-inner',
        autoSplit: true,
        onSplit(self) {
          const targets = type === 'chars' ? self.chars : type === 'words' ? self.words : self.lines
          const st = stagger ?? (type === 'chars' ? 0.016 : type === 'words' ? 0.035 : 0.085)
          return gsap.from(targets, {
            yPercent: 115,
            duration,
            stagger: st,
            delay,
            ease: EASE.out,
            scrollTrigger: trigger === 'view' ? { trigger: el, start, once: true } : undefined,
          })
        },
      })
      gsap.set(el, { autoAlpha: 1 })
      return () => split.revert()
    },
    { scope: ref, dependencies: [armed] },
  )

  return (
    <Tag ref={ref} className={`split-reveal ${className}`} {...rest}>
      {children}
    </Tag>
  )
}
