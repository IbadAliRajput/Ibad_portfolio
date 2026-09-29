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

export { gsap, ScrollTrigger, SplitText, Flip, CustomEase, Observer, useGSAP }
