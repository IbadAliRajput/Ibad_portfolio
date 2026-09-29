const pad = (n, l = 2) => String(Math.max(0, Math.floor(n))).padStart(l, '0')

/** 12.5 → "00:00:12:12" (HH:MM:SS:FF) */
export function toTimecode(seconds, fps = 24) {
  const s = Math.max(0, seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  const f = Math.floor((s - Math.floor(s)) * fps)
  return `${pad(h)}:${pad(m)}:${pad(sec)}:${pad(f)}`
}

/** 38 → "0:38", 72 → "1:12" */
export function toShort(seconds) {
  const s = Math.max(0, Math.round(seconds))
  return `${Math.floor(s / 60)}:${pad(s % 60)}`
}

/** 3.4 → "03.4s" — used on timeline rulers */
export function toSeconds(seconds, digits = 1) {
  return `${seconds.toFixed(digits).padStart(digits ? 3 + digits : 2, '0')}s`
}
