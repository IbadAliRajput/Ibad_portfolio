import { useEffect } from 'react'
import { installMediaGuard } from '../lib/mediaGuard'

/**
 * Blocks the casual download paths site-wide: right-click menu (except in
 * form fields), drag-out media, long-press save sheets (CSS side in
 * base.css) and Ctrl/Cmd+S. See lib/mediaGuard.js for the honest limits.
 */
export default function MediaGuard() {
  useEffect(() => installMediaGuard(), [])
  return null
}
