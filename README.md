# Ibad — Performance Video Editor & AI Creative Producer

Portfolio site built with Vite + React 19, GSAP (ScrollTrigger, SplitText, Flip), Lenis smooth scroll and a custom liquid-glass UI.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in /dist
npm run preview  # serve the build
```

## Where things live

| Path | What |
| --- | --- |
| `src/data/site.js` | Name, email, availability, socials, platforms, hero reel, AI Studio media |
| `src/data/projects.js` | The 13 case studies (copy, hooks, script breakdown, media timings) |
| `src/data/strategy.js` | Hook strategy + the homepage Hook Lab (which hook test it shows) |
| `src/data/services.js`, `process.js` | Services (each previews one real ad), process, AI workflow copy |
| `src/sections/*` | Homepage sections, in page order (see `src/pages/Home.jsx`) |
| `src/pages/*` | Home, All work (`/work`), Case study (`/work/:slug`), 404 |
| `src/components/*` | Shared UI: `LiquidGlass`, `Button`, `VerticalVideo`, `ScrubVideo`… |
| `src/styles/tokens.css` | Colours, type scale, spacing, motion tokens |
| `scripts/media.mjs` | Builds every web asset for a project from its master (`npm run media`) |
| `media-inbox/` | Your original ad exports (not deployed, not in git) |
| `public/media/` | Local encoding output — **gitignored**; upload its contents to R2 after encoding |
| Cloudflare R2 | All images + videos stream from the bucket behind `https://ibadportfolio.com`, mirroring the old `/public/media` tree without its `/media` prefix (`/work/<id>/…`, `/frames/…`, `/ai/…`, `/about.jpg`, `/noise.png`) |

## Adding a new ad

1. Drop the master export into `media-inbox/` (9:16 MP4, any length). For a hook test, drop every variation too.
2. Add a `project({...})` entry in `src/data/projects.js` — copy an existing one:
   - `media: { id, src, poster }` — a folder name, the master's file name, and the second to use as the cover frame (`live: true` for real, non-AI footage).
   - `hook.seconds` — where the hook ends (the case-study scrub covers exactly that window).
   - `breakdown[].at` — the second each beat still is pulled from.
   - `hooks[]` (hook tests only) — each opening's file and `dur`, the second where the shared body starts.
   - Add its slug to `ORDER` at the bottom; the first six are featured on the homepage.
3. Run `npm run media -- <id>` — posters, previews, the full ad, the hook scrub, beat stills and hook clips are cut for you (ffmpeg ships with the project, nothing to install).
4. Upload the new `public/media/work/<id>/` folder to the R2 bucket (same path, no `/media` prefix) — `wrangler r2 object put` or drag-and-drop in the Cloudflare dashboard.

`placeholderMode` in `src/data/site.js` stays `false`: real ads carry their own burned-in captions, so the site doesn't draw any over them.

## Contact form

The form validates and shows a success state but does not send anything yet. Wire it to your form backend (Formspree, Resend, a serverless function…) where the `TODO` is in `src/sections/Contact.jsx` — the payload is already built as `FormData`, including the optional brief upload.

## Motion & accessibility

- The site follows the operating system's *reduce motion* setting by default. In that mode scroll-driven storytelling (pinned sections, scrubbed video) stays, while smooth-scroll inertia, parallax, loops and large entrance moves are removed.
- Visitors can switch between **Full** and **Reduced** motion from the footer (the choice is remembered). When the OS asks for reduced motion, a one-time notice offers the full experience.
- On Windows, *Settings → Accessibility → Visual effects → Animation effects* (or "Adjust for best performance") turns reduced motion on for every browser.
- Liquid-glass refraction uses SVG filters inside `backdrop-filter`, which only Chromium renders; Safari and Firefox get a frosted-glass fallback.

## Media on Cloudflare R2

The repo ships no media — every image and video streams from a public R2 bucket on the custom domain `https://ibadportfolio.com` (folder structure mirrors the old `/public/media`, minus the `/media` prefix). Keeps the repo and Vercel deploys tiny.

- **Base URL**: `MEDIA_URL` in `src/data/site.js`. Override per-environment with `VITE_MEDIA_URL` in `.env.local` (e.g. a staging bucket or the raw `pub-….r2.dev` endpoint).
- **CORS (required)**: the scroll-scrubbed videos fetch their file with `fetch()` into a blob, so the bucket must send CORS headers. In the R2 bucket settings add a CORS policy allowing `GET` from `https://ibadportfolio.com` and your deploy/preview origins (`AllowedOrigins: ["*"]` is fine for a public bucket).
- **Caching**: R2 + Cloudflare edge-cache by default; served with long cache headers, so nothing to configure on Vercel.
- `vercel.json` 301-redirects any stale `/media/…` link to the bucket so old bookmarks keep working.

## Deploying

Any static host works. SPA fallbacks are included for Netlify (`public/_redirects`) and Vercel (`vercel.json`) so deep links like `/work/corbel-the-trainer` resolve.

The deploy contains only code — the ~350 MB of media lives in R2, so builds stay light and fast.
