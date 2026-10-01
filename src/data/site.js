// Global site config — edit here, it propagates everywhere.
export const SITE = {
  name: 'Ibad',
  role: 'Performance Video Editor & AI Creative Producer',
  tagline: 'Short-form ads built for attention, retention & conversion.',
  email: 'contact@ibadportfolio.com',
  availability: 'Booking projects for Q4 2026',
  location: 'Remote — working worldwide',
  socials: [{ label: 'LinkedIn', href: 'https://pk.linkedin.com/in/ibad-ali-ab5402374' }],
  platforms: ['Meta Ads', 'Instagram Reels', 'TikTok', 'YouTube Shorts', 'Facebook'],

  /**
   * MEDIA FLAGS
   * placeholderMode  — true only while /public/media holds black stand-in videos:
   *                    scroll-scrubbed sections then draw simulated "shots" and
   *                    ad-style captions over them. Real ads carry their own
   *                    burned-in captions, so this stays false.
   * autoplayPreviews — autoplay muted previews when cards scroll into view.
   *                    While false, previews play on hover (desktop) only.
   */
  placeholderMode: false,
  autoplayPreviews: false,
}

export const NAV = [
  { label: 'Work', to: '/#work' },
  { label: 'Services', to: '/#services' },
  { label: 'Process', to: '/#process' },
  { label: 'About', to: '/#about' },
]

export const CTA_LINES = {
  primary: 'Start a Project',
  work: 'View My Work',
  together: "Let's Work Together",
  brief: 'Send Your Brief',
  cases: 'Explore Case Studies',
  edits: 'See The Edits',
  next: "Let's Build Your Next Creative",
}

/**
 * Cloudflare R2 — every image and video streams from the bucket behind
 * https://media.ibadportfolio.com. Its contents mirror the old /public/media tree,
 * minus the /media prefix (…/work/ad-05/full.mp4, /frames/f01.jpg, …).
 * Set VITE_MEDIA_URL in a .env.local to point at another bucket (staging,
 * r2.dev endpoint) without touching code.
 */
export const MEDIA_URL = (import.meta.env.VITE_MEDIA_URL || 'https://media.ibadportfolio.com').replace(/\/+$/, '')

/** Prefix a site-relative /media/... path with the R2 base */
export const media = (path) => `${MEDIA_URL}${path}`

/**
 * Frame library — stills pulled from the real ads (frames/ in the R2 bucket).
 * Used wherever a section needs imagery that isn't one specific project.
 */
export const POSTERS = Array.from({ length: 16 }, (_, i) => media(`/frames/f${String(i + 1).padStart(2, '0')}.jpg`))

const AI = media('/ai')
export const MEDIA = {
  /** The hero reel: a real 60-second ad (Cleantra), scrubbed on scroll — GOP-6 so seeks stay cheap */
  reel: media('/work/ad-05/reel.mp4'),
  reelFull: media('/work/ad-05/full.mp4'),
  reelPoster: media('/work/ad-05/poster.jpg'),
  reelSlug: 'cleantra-tight-ring',
  reelSeconds: 59,
  /** The ad's beats, in the order they play (ids from strategy AD_STRUCTURE; seconds) */
  reelBeats: [
    { id: 'hook', range: [0, 7] }, // the wedding ring
    { id: 'problem', range: [7, 19] }, // the water pill
    { id: 'explain', range: [19, 28] }, // the compression stocking
    { id: 'mechanism', range: [28, 46] }, // Cleantra and its herbs
    { id: 'proof', range: [46, 55] }, // the puffiness fades
    { id: 'cta', range: [55, 59] }, // tested, guarantee, link
  ],
  /**
   * AI Studio — one character built from Ibad's photos with Higgsfield
   * (Nano Banana Pro for the stills, Kling 3.0 for the motion), held
   * consistent across every frame of the pipeline.
   */
  ai: {
    startFrame: `${AI}/start-frame.jpg`,
    character: `${AI}/character.jpg`,
    product: `${AI}/product.jpg`,
    environment: `${AI}/environment.jpg`,
    takes: [`${AI}/take-1.jpg`, `${AI}/take-2.jpg`, `${AI}/start-frame.jpg`, `${AI}/take-4.jpg`],
    scenes: [`${AI}/start-frame.jpg`, `${AI}/scene-kitchen.jpg`, `${AI}/scene-rooftop.jpg`],
    motionScrub: `${AI}/motion-scrub.mp4`, // 10s, all-intra
    motion: `${AI}/motion.mp4`,
  },
  about: media('/about.jpg'),
}
