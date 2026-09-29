import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'

import { supportsRefraction } from '../lib/env'

/**
 * Builds a displacement map for a rounded rectangle.
 * R encodes horizontal offset, B encodes vertical offset, and a blurred
 * neutral-grey core keeps the centre undistorted — so only the bezel bends
 * light, exactly like a thick glass edge.
 */
function buildDisplacementMap(w, h, r, bezel) {
  const inset = Math.max(1, Math.min(w, h) * bezel)
  const blur = inset * 0.55
  const ir = Math.max(0, r - inset * 0.6)
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<defs>` +
    `<linearGradient id="x" x1="100%" y1="0%" x2="0%" y2="0%"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#f00"/></linearGradient>` +
    `<linearGradient id="y" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#00f"/></linearGradient>` +
    `<filter id="b" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${blur.toFixed(2)}"/></filter>` +
    `</defs>` +
    `<rect width="${w}" height="${h}" fill="#000"/>` +
    `<rect width="${w}" height="${h}" rx="${r}" fill="url(#x)"/>` +
    `<rect width="${w}" height="${h}" rx="${r}" fill="url(#y)" style="mix-blend-mode:difference"/>` +
    `<rect x="${inset}" y="${inset}" width="${Math.max(0, w - inset * 2)}" height="${Math.max(0, h - inset * 2)}" rx="${ir}" fill="#808080" filter="url(#b)"/>` +
    `</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function RefractionFilter({ id, w, h, r, depth, bezel, aberration }) {
  const map = useMemo(() => buildDisplacementMap(w, h, r, bezel), [w, h, r, bezel])
  const base = Math.min(w, h) * bezel * 3.2 * depth
  const s = (k) => (-(base * k)).toFixed(1)
  return (
    <svg className="glass__svg" width="0" height="0" aria-hidden="true" focusable="false">
      <filter id={id} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feImage href={map} x="0" y="0" width={w} height={h} preserveAspectRatio="none" result="map" />
        <feDisplacementMap in="SourceGraphic" in2="map" scale={s(1 + aberration)} xChannelSelector="R" yChannelSelector="B" result="dr" />
        <feColorMatrix in="dr" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="red" />
        <feDisplacementMap in="SourceGraphic" in2="map" scale={s(1)} xChannelSelector="R" yChannelSelector="B" result="dg" />
        <feColorMatrix in="dg" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="green" />
        <feDisplacementMap in="SourceGraphic" in2="map" scale={s(1 - aberration)} xChannelSelector="R" yChannelSelector="B" result="db" />
        <feColorMatrix in="db" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="blue" />
        <feBlend in="red" in2="green" mode="screen" result="rg" />
        <feBlend in="rg" in2="blue" mode="screen" />
      </filter>
    </svg>
  )
}

/**
 * <Glass> — the liquid-glass surface used across the site.
 *
 * Layers (bottom → top): refracting backdrop · specular sheen · children · edge.
 * On Chromium + fine pointers the bezel refracts what's behind it through an
 * SVG displacement filter; elsewhere it degrades to blur + saturate.
 *
 * Props
 *  as          element/component to render (default 'div')
 *  radius      number (px) or CSS length; use 999 for pills
 *  tone        'clear' | 'dark' | 'light' | 'accent'
 *  refract     enable bezel refraction where supported (default true).
 *              Keep it for small/medium surfaces (nav, buttons, handles, chips).
 *  depth       refraction strength multiplier (default 1)
 *  blur        backdrop blur in px (default 14; 6 when refracting)
 *  interactive specular highlight follows the pointer (default true)
 */
export default function Glass({
  as: Tag = 'div',
  className = '',
  radius = 24,
  tone = 'clear',
  refract = true,
  depth = 1,
  bezel = 0.16,
  aberration = 0.05,
  blur,
  interactive = true,
  style,
  children,
  ref: externalRef,
  ...rest
}) {
  const innerRef = useRef(null)
  const reactId = useId()
  const filterId = `lg${reactId.replace(/[^a-zA-Z0-9]/g, '')}`
  const [canRefract] = useState(() => refract && supportsRefraction())
  const [size, setSize] = useState(null)

  const setRef = (node) => {
    innerRef.current = node
    if (typeof externalRef === 'function') externalRef(node)
    else if (externalRef) externalRef.current = node
  }

  useLayoutEffect(() => {
    if (!canRefract || !innerRef.current) return
    const el = innerRef.current
    // ResizeObserver fires once on observe, so this also takes the first measurement
    const ro = new ResizeObserver(() => {
      const w = Math.round(el.offsetWidth)
      const h = Math.round(el.offsetHeight)
      if (w && h) setSize((prev) => (prev && prev.w === w && prev.h === h ? prev : { w, h }))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [canRefract])

  useEffect(() => {
    const el = innerRef.current
    if (!interactive || !el) return
    let raf = 0
    const onMove = (e) => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const b = el.getBoundingClientRect()
        el.style.setProperty('--mx', `${(((e.clientX - b.left) / b.width) * 100).toFixed(1)}%`)
        el.style.setProperty('--my', `${(((e.clientY - b.top) / b.height) * 100).toFixed(1)}%`)
      })
    }
    const onLeave = () => {
      el.style.removeProperty('--mx')
      el.style.removeProperty('--my')
    }
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerleave', onLeave)
    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerleave', onLeave)
    }
  }, [interactive])

  const r = typeof radius === 'number' ? `${radius}px` : radius
  const numericR = typeof radius === 'number' ? radius : 24
  const refracting = canRefract && size
  const blurPx = blur ?? (refracting ? 5 : 16)
  const backdrop = refracting
    ? `url(#${filterId}) blur(${blurPx}px) saturate(165%) brightness(1.06)`
    : `blur(${blurPx}px) saturate(170%)`

  return (
    <Tag
      ref={setRef}
      className={`glass glass--${tone}${refracting ? ' is-refracting' : ''} ${className}`}
      style={{ '--glass-r': r, ...style }}
      {...rest}
    >
      <span className="glass__backdrop" aria-hidden="true" style={{ backdropFilter: backdrop, WebkitBackdropFilter: backdrop }} />
      <span className="glass__sheen" aria-hidden="true" />
      {children}
      <span className="glass__edge" aria-hidden="true" />
      {refracting && (
        <RefractionFilter
          id={filterId}
          w={size.w}
          h={size.h}
          r={Math.min(numericR, size.h / 2, size.w / 2)}
          depth={depth}
          bezel={bezel}
          aberration={aberration}
        />
      )}
    </Tag>
  )
}
