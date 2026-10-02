// Rendering budget — one place that decides how hard the page may lean on the GPU.
//
//  .scroll-shield     shown while the page moves fast under a still pointer:
//                     content stops being hit-tested (and re-styling hovers)
//                     every frame. It drops as the page slows, and at once on
//                     any pointer movement, so clicks always land.
//
//  html.is-lite       a device that can't hold the frame rate. A handful of
//                     effects swap to cheaper, near-identical versions (see the
//                     "Lite" rules in base.css / glass.css). Decided up front from
//                     hardware hints, or at runtime by watching real scroll frames;
//                     remembered on the device so the next visit starts light.
import { isBrowser, matches } from './env'
import { readScroll } from './gsap'

const KEY = 'ibad:perf'
const listeners = new Set()

function readStored() {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

/** Hardware hints: few cores, little memory, data saver — or a phone */
function hintsLite() {
  if (!isBrowser) return false
  const n = navigator
  const mem = n.deviceMemory ?? 8
  const cores = n.hardwareConcurrency ?? 8
  return mem <= 4 || cores <= 4 || n.connection?.saveData === true || matches('(pointer: coarse)')
}

let lite = isBrowser && (readStored() === 'lite' || hintsLite())
if (isBrowser) document.documentElement.classList.toggle('is-lite', lite)

export const isLite = () => lite

/** Subscribe to the tier switching to lite at runtime; returns an unsubscribe */
export function onLite(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

function goLite() {
  if (lite) return
  lite = true
  document.documentElement.classList.add('is-lite')
  try {
    localStorage.setItem(KEY, 'lite')
  } catch {
    /* storage blocked — lite for this page only */
  }
  listeners.forEach((cb) => cb())
}

/**
 * Mark sections within ~⅔ of a viewport of the screen with [data-near].
 * Permanent compositor layers (will-change / translateZ) are scoped to it in
 * CSS — `[data-near] .x { will-change: transform }` — so a layer is built a
 * little before its section arrives and released once it's well past, instead
 * of every section's layers (and the "overlap" layers they force on whatever
 * paints above them) living in GPU memory for the whole visit.
 * Watches <main> for route swaps; returns a teardown.
 */
export function watchNear(onRefresh) {
  const main = document.querySelector('main')
  if (!main || typeof IntersectionObserver === 'undefined') return () => {}
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => e.target.toggleAttribute('data-near', e.isIntersecting)),
    { rootMargin: '66% 0px' },
  )
  // observe() is idempotent, so rescanning is cheap — on route swaps (main's children
  // change) and on every ScrollTrigger refresh (sections that mount later)
  const scan = () => main.querySelectorAll('section').forEach((el) => io.observe(el))
  scan()
  const mo = new MutationObserver(scan)
  mo.observe(main, { childList: true })
  const off = onRefresh?.(scan)
  return () => {
    off?.()
    mo.disconnect()
    io.disconnect()
  }
}

/**
 * Wire the scroll flag and the frame-rate watch to the page's scroller.
 * `subscribe(fn)` must call fn on every scroll frame (Lenis 'scroll' or the
 * native scroll event); `now()` is the frame clock. Returns a teardown.
 */
export function watchScroll(subscribe) {
  // a class on <html> would restyle the whole document on every toggle; the
  // shield is one element (styles in base.css)
  const shield = document.createElement('div')
  shield.className = 'scroll-shield'
  shield.setAttribute('aria-hidden', 'true')
  document.body.appendChild(shield)
  // touch scrolling never hit-tests a still pointer — no shield on coarse pointers
  const useShield = !matches('(pointer: coarse)')
  let shielded = false
  let held = false // the pointer moved this gesture: stay out of its way until the page rests
  let idle = 0
  let lastY = null
  let lastT = 0
  // frame pacing, sampled only while the page is actually moving
  let last = 0
  const samples = []
  const drop = () => {
    if (!shielded) return
    shielded = false
    shield.classList.remove('is-on')
  }
  const rest = () => {
    drop()
    held = false
    last = 0
    lastY = null
  }
  const onScroll = () => {
    const now = performance.now()
    // speed in px per 60fps frame. The shield only covers fast movement: at that
    // speed nothing under a still pointer is a click target. It drops as the glide
    // settles, so a click on a slowing page always lands.
    const y = readScroll()
    const v = lastY === null ? 0 : (Math.abs(y - lastY) / Math.max(1, now - lastT)) * 16.67
    lastY = y
    lastT = now
    if (useShield && !held && !shielded && v > 8) {
      shielded = true
      shield.classList.add('is-on')
    } else if (shielded && v < 4) drop()
    clearTimeout(idle)
    idle = setTimeout(rest, 140)
    if (lite) return
    if (last) {
      const dt = now - last
      if (dt < 250) samples.push(dt) // a longer gap is a pause, not a slow frame
    }
    last = now
    if (samples.length >= 150) {
      const sorted = [...samples].sort((a, b) => a - b)
      const median = sorted[sorted.length >> 1]
      const slow = samples.filter((d) => d > 34).length / samples.length
      samples.length = 0
      // under ~45fps typical, or one frame in four dropped: the effects cost more than they give
      if (median > 22 || slow > 0.25) goLite()
    }
  }
  const onPointer = (e) => {
    if (e.pointerType === 'touch') return
    held = true
    drop()
  }
  const unsub = subscribe(onScroll)
  window.addEventListener('pointermove', onPointer, { passive: true })
  return () => {
    unsub?.()
    clearTimeout(idle)
    window.removeEventListener('pointermove', onPointer)
    shield.remove()
  }
}
