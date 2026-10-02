// Central GSAP setup — import everything animation-related from here.
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'
import { Flip } from 'gsap/Flip'
import { CustomEase } from 'gsap/CustomEase'
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin'
import { Observer } from 'gsap/Observer'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(ScrollTrigger, SplitText, Flip, CustomEase, ScrambleTextPlugin, Observer, useGSAP)

/**
 * House eases
 *  out    — the signature: fast start, long luxurious settle (reveals, UI)
 *  inOut  — curtains, wipes, page transitions
 *  soft   — gentle drift (hover, parallax)
 *  snap   — decisive editorial cut (hook swaps, counters)
 */
CustomEase.create('ibad.out', '0.16, 1, 0.3, 1')
CustomEase.create('ibad.inOut', '0.76, 0, 0.24, 1')
CustomEase.create('ibad.soft', '0.33, 1, 0.68, 1')
CustomEase.create('ibad.snap', '0.87, 0, 0.13, 1')

export const EASE = { out: 'ibad.out', inOut: 'ibad.inOut', soft: 'ibad.soft', snap: 'ibad.snap' }

gsap.defaults({ ease: EASE.out, duration: 1 })
ScrollTrigger.config({ ignoreMobileResize: true })
// ScrollTrigger re-applies the scrollRestoration it saw at registration after every refresh;
// pin it to 'manual' so back/forward positions are restored by the page transition instead
ScrollTrigger.clearScrollMemory('manual')

/**
 * The page's scroll position, as ScrollTrigger reads it. Every native scroll
 * event makes ScrollTrigger re-read window.scrollY — and that event lands after
 * the frame's style writes, so each read forced a full style recalc: most of
 * the forced work on every scrolled frame. While Lenis is gliding it has just
 * written the position itself, so its own value is read back instead; at any
 * other time (native, keyboard or scrollbar scrolling, refreshes, jumps) this
 * reads the DOM exactly as ScrollTrigger always did. Registered before any
 * trigger exists, since ScrollTrigger caches its scroll reader per scroller.
 */
let scrollSource = null
export const setScrollSource = (lenis) => {
  scrollSource = lenis
}
// A proxied scroller isn't cached by ScrollTrigger (every trigger asks), so the
// DOM value is cached here — and dropped on anything that can move the page:
// a native scroll event, a Lenis frame, a scroll write, a refresh.
let cached = null
export const invalidateScroll = () => {
  cached = null
}
/** window.scrollY, without the forced style pass while Lenis is gliding */
export const readScroll = () => {
  if (scrollSource?.isScrolling === 'smooth') return scrollSource.animatedScroll
  if (cached === null) cached = window.scrollY
  return cached
}
if (typeof window !== 'undefined') {
  window.addEventListener('scroll', invalidateScroll, { capture: true, passive: true })
  ScrollTrigger.addEventListener('refreshInit', invalidateScroll)
  ScrollTrigger.scrollerProxy(document.documentElement, {
    scrollTop(value) {
      if (arguments.length) {
        window.scrollTo(0, value)
        cached = null
        return
      }
      return readScroll()
    },
    getBoundingClientRect: () => ({ top: 0, left: 0, width: window.innerWidth, height: window.innerHeight }),
    pinType: 'fixed',
  })
}

export { gsap, ScrollTrigger, SplitText, Flip, CustomEase, Observer, useGSAP } // + setScrollSource, readScroll, invalidateScroll above
