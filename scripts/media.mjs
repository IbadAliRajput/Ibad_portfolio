// Builds every web asset a project needs from its master file in /media-inbox,
// driven entirely by src/data/projects.js:
//
//   poster.jpg     cover frame (media.poster, seconds)
//   preview.mp4    first 10s, muted, 540p — card hover/autoplay loops
//   full.mp4       the whole ad, 720p with sound — the video player
//   scrub.mp4      the hook window (hook.seconds), all-intra — the case-study scroll scrub
//   beat-N.jpg     one still per breakdown beat (breakdown[].at)
//   hook-x.mp4/jpg every opening of a hook test (hooks[].src, hooks[].dur)
//
//   npm run media                    build anything missing
//   npm run media -- ad-10 hooks-06  only these media ids
//   npm run media -- --force         rebuild everything
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ffmpegPath from 'ffmpeg-static'

const run = promisify(execFile)
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const IN = path.join(ROOT, 'media-inbox')
const OUT = path.join(ROOT, 'public/media/work')
const args = process.argv.slice(2)
const FORCE = args.includes('--force')
const ONLY = args.filter((a) => !a.startsWith('--'))

const FIT = (w, h) => `scale=${w}:${h}:force_original_aspect_ratio=increase:flags=lanczos,crop=${w}:${h},setsar=1`
const ff = (a) => run(ffmpegPath, ['-y', '-v', 'error', ...a], { maxBuffer: 1 << 26 })
const need = (file) => FORCE || !existsSync(file)

const { PROJECTS } = await import(pathToFileURL(path.join(ROOT, 'src/data/projects.js')).href)

for (const p of PROJECTS) {
  const { id, src, poster = 1, live = false } = p.media
  if (ONLY.length && !ONLY.includes(id)) continue
  const source = path.join(IN, src)
  if (!existsSync(source)) {
    console.warn(`skip ${id}: media-inbox/${src} not found`)
    continue
  }
  const dir = path.join(OUT, id)
  mkdirSync(dir, { recursive: true })
  const at = (name) => path.join(dir, name)
  const tune = live ? 'film' : 'animation'
  const t0 = performance.now()

  if (need(at('poster.jpg'))) await ff(['-ss', String(poster), '-i', source, '-frames:v', '1', '-vf', FIT(720, 1280), '-q:v', '4', at('poster.jpg')])

  if (need(at('preview.mp4'))) {
    await ff(['-i', source, '-t', '10', '-an', '-vf', `fps=30,${FIT(540, 960)}`, '-c:v', 'libx264', '-preset', 'slow', '-tune', tune, '-crf', '27', '-maxrate', '1400k', '-bufsize', '2800k', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', at('preview.mp4')])
  }

  if (need(at('full.mp4'))) {
    await ff(['-i', source, '-vf', FIT(720, 1280), '-c:v', 'libx264', '-preset', 'medium', '-tune', tune, '-profile:v', 'high', '-crf', '28', '-maxrate', '1500k', '-bufsize', '3000k', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '96k', '-ac', '2', '-movflags', '+faststart', at('full.mp4')])
  }

  // the stamp file records which hook length the scrub was cut for
  const stamp = at(`.scrub-${p.hook.seconds}`)
  if (FORCE || !existsSync(stamp)) {
    await ff(['-i', source, '-t', String(p.hook.seconds), '-an', '-vf', `fps=24,${FIT(720, 1280)}`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '25', '-g', '1', '-bf', '0', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', at('scrub.mp4')])
    writeFileSync(stamp, '')
  }

  for (const [i, b] of p.breakdown.entries()) {
    const out = at(`beat-${i + 1}.jpg`)
    if (need(out)) await ff(['-ss', String(b.at), '-i', source, '-frames:v', '1', '-vf', FIT(720, 1280), '-q:v', '5', out])
  }

  for (const h of p.hooks) {
    const x = h.id.toLowerCase()
    const hsrc = path.join(IN, h.src)
    if (need(at(`hook-${x}.mp4`))) {
      await ff(['-i', hsrc, '-t', (h.dur + 0.35).toFixed(2), '-vf', FIT(720, 1280), '-c:v', 'libx264', '-preset', 'slow', '-tune', tune, '-crf', '26', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '96k', '-ac', '2', '-movflags', '+faststart', at(`hook-${x}.mp4`)])
    }
    if (need(at(`hook-${x}.jpg`))) await ff(['-ss', '0.4', '-i', hsrc, '-frames:v', '1', '-vf', FIT(720, 1280), '-q:v', '5', at(`hook-${x}.jpg`)])
  }

  console.log(`✓ ${id}  ${((performance.now() - t0) / 1000).toFixed(0)}s`)
}
