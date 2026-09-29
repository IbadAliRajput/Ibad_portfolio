import { createContext, useContext } from 'react'

/** true once the preloader has finished — gate intro animations on this */
export const ReadyContext = createContext({ ready: false, setReady: () => {} })
/** Lenis instance (null when reduced-motion → native scroll) + scroll helpers */
export const ScrollContext = createContext({ lenis: null, scrollTo: () => {}, stop: () => {}, start: () => {} })
/** Global click-to-expand 9:16 player */
export const VideoContext = createContext({ openVideo: () => {}, closeVideo: () => {} })
/** Page transitions — go('/work/slug', { label }) */
export const TransitionContext = createContext({ go: () => {} })

export const useReady = () => useContext(ReadyContext)
export const useScroll = () => useContext(ScrollContext)
export const useVideo = () => useContext(VideoContext)
export const usePageTransition = () => useContext(TransitionContext)
