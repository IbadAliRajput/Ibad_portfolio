import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router'
import { useReady, useScroll } from '../app/context'
import HeroReel from '../sections/HeroReel'
import Manifesto from '../sections/Manifesto'
import SelectedWork from '../sections/SelectedWork'
import Services from '../sections/Services'
import Difference from '../sections/Difference'
import HookLab from '../sections/HookLab'
import IterationSystem from '../sections/IterationSystem'
import Process from '../sections/Process'
import AIStudio from '../sections/AIStudio'
import Proof from '../sections/Proof'
import About from '../sections/About'
import Contact from '../sections/Contact'

/**
 * Home is structured like the ad it sells:
 * hook (hero + reel) → problem (manifesto) → proof of work → mechanism
 * (services, difference, hooks, iteration, process, AI) → proof → CTA.
 */
export default function Home() {
  const { hash } = useLocation()
  const { ready } = useReady()
  const { scrollTo } = useScroll()
  const readyOnMount = useRef(ready)

  // Deep links like /#work on first load (route changes — incl. back/forward —
  // are handled by the transition, so skip when Home mounts after the preloader)
  useEffect(() => {
    if (!ready || !hash || readyOnMount.current) return
    const t = setTimeout(() => scrollTo(hash, { immediate: true, force: true }), 80)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  useEffect(() => {
    document.title = 'Ibad — Performance Video Editor & AI Creative Producer'
  }, [])

  return (
    <>
      <HeroReel />
      <Manifesto />
      <SelectedWork />
      <Services />
      <Difference />
      <HookLab />
      <IterationSystem />
      <Process />
      <AIStudio />
      <Proof />
      <About />
      <Contact />
    </>
  )
}
