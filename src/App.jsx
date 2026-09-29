import { Route, Routes, useLocation } from 'react-router'
import { useEffect } from 'react'
import { ReadyProvider, ScrollProvider, VideoProvider } from './app/Providers'
import { TransitionProvider } from './app/PageTransition'
import { ScrollTrigger } from './lib/gsap'
import Preloader from './components/Preloader'
import Cursor from './components/Cursor'
import Nav from './components/Nav'
import HUD from './components/HUD'
import Footer from './components/Footer'
import VideoModal from './components/VideoModal'
import MotionToast from './components/MotionToast'
import Home from './pages/Home'
import Work from './pages/Work'
import CaseStudy from './pages/CaseStudy'
import NotFound from './pages/NotFound'

/** Re-measure every ScrollTrigger once fonts and late images settle */
function RefreshOnLoad() {
  const { pathname } = useLocation()
  useEffect(() => {
    let t
    // sort() puts triggers back in document order (children mount before their
    // parents, so a pin can otherwise be created after triggers that sit below it)
    const refresh = () => {
      clearTimeout(t)
      t = setTimeout(() => {
        ScrollTrigger.sort()
        ScrollTrigger.refresh()
      }, 120)
    }
    refresh()
    document.fonts?.ready.then(refresh)
    window.addEventListener('load', refresh)
    // Sections that rebuild from React state at a breakpoint create their pins
    // after matchMedia's own refresh — re-sort once they've settled
    const queries = ['(min-width: 768px)', '(min-width: 1024px)'].map((q) => window.matchMedia(q))
    const onBreakpoint = () => {
      clearTimeout(t)
      t = setTimeout(() => {
        ScrollTrigger.sort()
        ScrollTrigger.refresh()
      }, 250)
    }
    queries.forEach((m) => m.addEventListener('change', onBreakpoint))
    return () => {
      clearTimeout(t)
      window.removeEventListener('load', refresh)
      queries.forEach((m) => m.removeEventListener('change', onBreakpoint))
    }
  }, [pathname])
  return null
}

export default function App() {
  return (
    <ReadyProvider>
      <ScrollProvider>
        <VideoProvider render={(item, close) => <VideoModal item={item} onClose={close} />}>
          <TransitionProvider>
            <a className="skip-link" href="#main">Skip to content</a>
            <Preloader />
            <Nav />
            <main id="main" tabIndex={-1}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/work" element={<Work />} />
                <Route path="/work/:slug" element={<CaseStudy />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </main>
            <Footer />
            <HUD />
            <Cursor />
            <MotionToast />
            <div className="grain" aria-hidden="true" />
            <RefreshOnLoad />
          </TransitionProvider>
        </VideoProvider>
      </ScrollProvider>
    </ReadyProvider>
  )
}
