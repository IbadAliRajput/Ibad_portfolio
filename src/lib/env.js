// Environment + capability helpers (all SSR-safe)

export const isBrowser = typeof window !== 'undefined'

export const MQ = {
  mobile: '(max-width: 767px)',
  tablet: '(max-width: 1023px)',
  desktop: '(min-width: 1024px)',
  fine: '(hover: hover) and (pointer: fine)',
  osReduce: '(prefers-reduced-motion: reduce)',
}

export const matches = (q) => isBrowser && window.matchMedia(q).matches
export const hasFinePointer = () => matches(MQ.fine)

/* --------------------------------------------------------------------------
   Motion preference
   The OS setting is the default, but visitors can override it from the UI
   (Motion toggle in the footer / the reduced-motion toast). The choice is
   stored and applied on reload so every animation initialises consistently.

   "Reduced" is gentle, not off: scroll-linked storytelling (pins, scrubbed
   video, progress) stays because the visitor drives it; autonomous loops,
   parallax, tilt, smooth-scroll inertia and large entrance moves are dropped.
   -------------------------------------------------------------------------- */
const MOTION_KEY = 'ibad:motion'

function readStored() {
  try {
    const v = localStorage.getItem(MOTION_KEY)
    return v === 'full' || v === 'reduced' ? v : null
  } catch {
    return null
  }
}

let motionCache = null
export function getMotion() {
  if (!isBrowser) return { reduced: false, stored: null, os: false }
  if (motionCache) return motionCache
  const stored = readStored()
  const os = matches(MQ.osReduce)
  motionCache = { reduced: stored ? stored === 'reduced' : os, stored, os }
  return motionCache
}

/** Effective reduced-motion flag — use this, never the raw media query */
export const prefersReducedMotion = () => getMotion().reduced

/** Remember a choice without reloading (e.g. "keep reduced") */
export function rememberMotion(value) {
  try {
    localStorage.setItem(MOTION_KEY, value)
  } catch {
    /* storage blocked — preference lasts for this page only */
  }
}

/** Switch motion mode — reloads so every timeline re-initialises cleanly */
export function setMotion(value) {
  rememberMotion(value)
  window.location.reload()
}

if (isBrowser) document.documentElement.classList.toggle('is-reduced', getMotion().reduced)

let refractCache = null
/**
 * SVG-filter refraction inside `backdrop-filter` only renders in Chromium.
 * Everyone else gets the (still lovely) blur + saturate glass.
 */
export function supportsRefraction() {
  if (!isBrowser) return false
  if (refractCache !== null) return refractCache
  const brands = navigator.userAgentData?.brands ?? []
  const chromium = brands.some((b) => /Chromium|Google Chrome|Microsoft Edge|Opera|Brave/i.test(b.brand))
  const reduceTransparency = matches('(prefers-reduced-transparency: reduce)')
  refractCache = chromium && hasFinePointer() && !reduceTransparency && CSS.supports('backdrop-filter', 'blur(1px)')
  return refractCache
}
