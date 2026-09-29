import { useRef } from 'react'
import { gsap, SplitText, useGSAP } from '../lib/gsap'
import { prefersReducedMotion } from '../lib/env'

/**
 * Paragraph whose words brighten one by one as it scrolls through the viewport.
 * Wrap words in <em className="t-serif"> or <mark> for emphasis — they split too.
 */
export default function ScrollWords({
  as: Tag = 'p',
  from = 0.13,
  start = 'top 82%',
  end = 'bottom 48%',
  className = '',
  children,
  ...rest
}) {
  const ref = useRef(null)

  useGSAP(
    () => {
      const el = ref.current
      if (!el || prefersReducedMotion()) return
      const split = SplitText.create(el, {
        type: 'words',
        wordsClass: 'sw-word',
        autoSplit: true,
        onSplit(self) {
          return gsap.fromTo(
            self.words,
            { opacity: from },
            { opacity: 1, ease: 'none', stagger: 0.12, scrollTrigger: { trigger: el, start, end, scrub: 0.6 } },
          )
        },
      })
      return () => split.revert()
    },
    { scope: ref },
  )

  return (
    <Tag ref={ref} className={`scroll-words ${className}`} {...rest}>
      {children}
    </Tag>
  )
}
