import Glass from './LiquidGlass'
import { TLink } from '../app/PageTransition'
import { useMagnetic } from '../lib/hooks'
import './Button.css'

export function ArrowIcon({ dir = 'right' }) {
  const rot = { right: 0, up: -90, down: 90, 'up-right': -45, left: 180 }[dir] ?? 0
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true" style={{ transform: `rotate(${rot}deg)` }}>
      <path d="M2.5 8h10.2M8.9 3.6 13.3 8l-4.4 4.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * Button / link with a rolling label, a sliding arrow and magnetic pull.
 *
 *  variant  'primary' (warm-white, accent flood on hover) | 'glass' (liquid glass) | 'ghost' (text + underline)
 *  size     'sm' | 'md' | 'lg'
 *  to       internal route (uses page transition; '/#contact' style anchors supported)
 *  href     external link
 *  icon     'arrow' | 'up-right' | 'down' | false
 */
export default function Button({
  to,
  href,
  variant = 'primary',
  size = 'md',
  icon = 'arrow',
  magnetic = true,
  className = '',
  children,
  label,
  kicker,
  ...rest
}) {
  const magRef = useMagnetic(magnetic ? 0.22 : 0, { inner: '.btn__inner' })

  let Tag = 'button'
  const tagProps = { ...rest }
  if (to) {
    Tag = TLink
    tagProps.to = to
    tagProps.label = label
    tagProps.kicker = kicker
  } else if (href) {
    Tag = 'a'
    tagProps.href = href
    if (/^https?:/.test(href)) {
      tagProps.target = '_blank'
      tagProps.rel = 'noreferrer'
    }
  } else if (!tagProps.type) tagProps.type = 'button'

  const iconDir = icon === 'arrow' ? 'right' : icon
  const text = typeof children === 'string' ? children : null

  const inner = (
    <span className="btn__inner">
      <span className="btn__label">
        <span className={`btn__roll${text ? '' : ' btn__roll--static'}`}>
          <span>{children}</span>
          {text && <span aria-hidden="true">{text}</span>}
        </span>
      </span>
      {icon && (
        <span className="btn__icon" aria-hidden="true">
          <span className="btn__icon-a"><ArrowIcon dir={iconDir} /></span>
          <span className="btn__icon-b"><ArrowIcon dir={iconDir} /></span>
        </span>
      )}
    </span>
  )

  const cls = `btn btn--${variant} btn--${size}${icon ? '' : ' btn--no-icon'} ${className}`

  if (variant === 'glass') {
    return (
      <Glass as={Tag} ref={magRef} radius={999} tone="clear" className={cls} {...tagProps}>
        {inner}
      </Glass>
    )
  }
  return (
    <Tag ref={magRef} className={cls} {...tagProps}>
      {inner}
    </Tag>
  )
}
