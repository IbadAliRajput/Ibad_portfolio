/**
 * Media protection — best-effort deterrents, installed once at boot.
 *
 * Nothing on the open web is un-downloadable (DevTools, screen recording and
 * the network tab can always capture media), but this closes every casual
 * path: the right-click menu, drag-out images/videos, the iOS/Android
 * long-press save sheet and Ctrl/Cmd+S. Form fields keep their context menu
 * so paste/correct word stay available in the contact form.
 */

const isFormField = (el) => {
  const tag = el?.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable
}

/** Right-click menu everywhere except form fields (paste/spellcheck stay usable) */
function onContextMenu(e) {
  if (isFormField(e.target)) return
  e.preventDefault()
}

/** Stop dragging images/videos out of the page (and text selections with them) */
function onDragStart(e) {
  const t = e.target
  if (t.tagName === 'IMG' || t.tagName === 'VIDEO' || t.tagName === 'SOURCE' || t.closest?.('video')) {
    e.preventDefault()
  }
}

/** Block the save-page shortcut (a no-op where the browser ignores preventDefault) */
function onKeyDown(e) {
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && (e.key === 's' || e.key === 'S')) {
    e.preventDefault()
  }
}

export function installMediaGuard() {
  const opts = { capture: true, passive: false }
  document.addEventListener('contextmenu', onContextMenu, opts)
  document.addEventListener('dragstart', onDragStart, opts)
  document.addEventListener('keydown', onKeyDown)
  return () => {
    document.removeEventListener('contextmenu', onContextMenu, opts)
    document.removeEventListener('dragstart', onDragStart, opts)
    document.removeEventListener('keydown', onKeyDown)
  }
}
