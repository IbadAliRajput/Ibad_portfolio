// Case-study helpers — deterministic derivations from a project record.
import { HOOK_TYPES } from '../data/strategy'

export const pad2 = (n) => String(n).padStart(2, '0')

/** Breakdown shot kinds → chip labels (upper-cased by .chip) */
export const KIND_LABEL = { aroll: 'A-roll', broll: 'B-roll', ai: 'AI', product: 'Product' }

const HOOK_DESC = Object.fromEntries(HOOK_TYPES.map((h) => [h.name, h.desc]))
export const hookDesc = (type) => HOOK_DESC[type] ?? ''

/** One still per breakdown beat — a frame pulled from the ad at that beat */
export const beatShots = (project) => project.breakdown.map((row) => row.shot ?? project.poster)

/** Short, wide-set titles earn the mega size; everything else runs at display */
export function titleScale(title) {
  const longest = Math.max(...title.split(/\s+/).map((w) => w.length))
  return title.length <= 13 && longest <= 7 ? 't-mega' : 't-display'
}
