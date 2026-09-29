import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { gsap, ScrollTrigger, useGSAP, EASE } from '../lib/gsap'
import { hasFinePointer, prefersReducedMotion } from '../lib/env'
import { useMediaQuery } from '../lib/hooks'
import { toTimecode } from '../lib/timecode'
import { useScroll } from '../app/context'
import { SITE } from '../data/site'
import { AD_STRUCTURE } from '../data/strategy'
import Glass from '../components/LiquidGlass'
import Button, { ArrowIcon } from '../components/Button'
import SplitReveal from '../components/SplitReveal'
import { Eyebrow } from '../components/Primitives'
import './Contact.css'

/* --------------------------------------------------------------------------
   Content + rules
   -------------------------------------------------------------------------- */
const NEEDS = [
  'UGC Ads',
  'VSL',
  'Product Ads',
  'Founder Ads',
  'AI Creative',
  'Ad Variations',
  'Full Creative Production',
  'Other',
]

const VOLUMES = [
  { value: '1-3', label: '1–3' },
  { value: '4-10', label: '4–10' },
  { value: '11-25', label: '11–25' },
  { value: '25+', label: '25+' },
]

const STEPS = ['You send the brief', 'We map the hook & angle on a short call', 'First cut + hook variations']

const ACCEPT_EXT = ['pdf', 'doc', 'docx', 'txt', 'rtf', 'pages', 'mp4', 'mov']
const ACCEPT = ACCEPT_EXT.map((e) => `.${e}`).join(',')
const MAX_MB = 25
const MAX_BYTES = MAX_MB * 1024 * 1024
const AREA_MAX = 320 // px — the message grows with its content up to here, then scrolls
const MOCK_LATENCY = 1200

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const REQUIRED = ['name', 'email', 'message']
const FIELD_LABEL = { name: 'Name', email: 'Email', message: 'Message' }
const RULES = {
  name: (v) => (v.trim() ? '' : 'Please add your name.'),
  email: (v) => {
    const s = v.trim()
    if (!s) return 'Please add your email address.'
    return EMAIL_RE.test(s) ? '' : 'That email doesn’t look right — check for typos.'
  },
  message: (v) => (v.trim() ? '' : 'Tell me a little about the project — one line is enough.'),
}

/* The homepage is cut like a 60-second ad; this section is its final beat */
const CTA_BEAT = AD_STRUCTURE.find((b) => b.id === 'cta') ?? { label: 'CTA', range: [50, 60] }
const BEAT_IN = toTimecode(CTA_BEAT.range[0])
const BEAT_OUT = toTimecode(CTA_BEAT.range[1])

const pad2 = (n) => String(n).padStart(2, '0')
const isExternal = (href) => /^https?:/.test(href)

function extOf(name) {
  const i = name.lastIndexOf('.')
  return i > 0 ? name.slice(i + 1).toLowerCase() : ''
}

function formatBytes(bytes) {
  const kb = bytes / 1024
  if (kb < 1024) return `${Math.max(1, Math.round(kb))} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}

function validate(data) {
  const out = {}
  REQUIRED.forEach((k) => {
    out[k] = RULES[k](String(data.get(k) ?? ''))
  })
  return out
}

const firstName = (v) => String(v ?? '').trim().split(/\s+/)[0]

/** Multipart payload — a real endpoint can take it as-is */
function buildPayload(form, file) {
  const data = new FormData(form)
  data.delete('brief') // the dropzone keeps the file in state (drag & drop never touches the input)
  if (file) data.append('brief', file, file.name)
  data.append('source', 'portfolio/contact')
  return data
}

function buildSummary(data, file) {
  const out = []
  const need = data.get('need')
  if (need) out.push(String(need))
  const vol = VOLUMES.find((o) => o.value === data.get('volume'))
  if (vol) out.push(`${vol.label} ads / month`)
  if (file) out.push(file.name)
  return out
}

/**
 * Transport. Mocked for now: resolves after ~1.2s and honours `signal` so an
 * unmount mid-send never touches state.
 */
function sendBrief(payload, signal) {
  // TODO(Ibad): wire a real endpoint (Formspree / Resend / a serverless route).
  // `payload` is already multipart FormData — name, email, company, need, volume,
  // message, brief (file), source and the `_gotcha` honeypot — so wiring is e.g.:
  //
  //   return fetch('https://formspree.io/f/<form-id>', {
  //     method: 'POST',
  //     body: payload,
  //     headers: { Accept: 'application/json' },
  //     signal,
  //   }).then((res) => {
  //     if (!res.ok) throw new Error(`Send failed (${res.status})`)
  //   })
  //
  // Keep MAX_MB in sync with the provider's upload limit. A rejected promise
  // shows the inline "didn't go through" message and keeps the form filled.
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, MOCK_LATENCY)
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(t)
        reject(new DOMException('Aborted', 'AbortError'))
      },
      { once: true },
    )
  })
}

/* --------------------------------------------------------------------------
   Glyphs
   -------------------------------------------------------------------------- */
function UploadGlyph() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true" focusable="false">
      <path
        d="M10 13.6V4.4M6 8.2l4-4 4 4M4.2 15.6h11.6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function CloseGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true" focusable="false">
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

/* --------------------------------------------------------------------------
   Floating-label field
   The resting label (sans, in the field) and the floated label (mono, above)
   are two layers that cross over, so the type change reads as one motion.
   -------------------------------------------------------------------------- */
function Field({ id, label, error, required = false, multiline = false, className = '', ...rest }) {
  const Control = multiline ? 'textarea' : 'input'
  const errId = `${id}-err`
  return (
    <div className={`ct-field${error ? ' is-invalid' : ''}${className ? ` ${className}` : ''}`}>
      <div className={`ct-control${multiline ? ' ct-control--area' : ''}`}>
        <Control
          id={id}
          className={`ct-input${multiline ? ' ct-input--area' : ''}`}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errId : undefined}
          placeholder=" "
          {...rest}
        />
        <label htmlFor={id} className="ct-label">
          <span className="ct-label__rest">
            {label}
            {required && (
              <span className="ct-label__req" aria-hidden="true">
                *
              </span>
            )}
          </span>
          <span className="ct-label__float" aria-hidden="true">
            {label}
            {required && ' *'}
          </span>
        </label>
        <span className="ct-rule" aria-hidden="true">
          <span className="ct-rule__base" />
          <span className="ct-rule__focus" />
        </span>
      </div>
      {error && (
        <p id={errId} className="ct-err t-small t-accent">
          {error}
        </p>
      )}
    </div>
  )
}

/* --------------------------------------------------------------------------
   Brief upload — drag & drop or browse
   -------------------------------------------------------------------------- */
function Dropzone({ file, error, inputRef, onPick, onRemove, className = '' }) {
  const [over, setOver] = useState(false)

  // A file released just outside the zone would otherwise be opened by the browser,
  // replacing the page and the half-filled brief
  useEffect(() => {
    const guard = (e) => {
      if (e.defaultPrevented || !Array.from(e.dataTransfer?.types ?? []).includes('Files')) return
      e.preventDefault()
      if (e.type === 'dragover') e.dataTransfer.dropEffect = 'none'
    }
    window.addEventListener('dragover', guard)
    window.addEventListener('drop', guard)
    return () => {
      window.removeEventListener('dragover', guard)
      window.removeEventListener('drop', guard)
    }
  }, [])

  const hasFiles = (e) => Array.from(e.dataTransfer?.types ?? []).includes('Files')
  const onDragEnter = (e) => {
    if (!hasFiles(e)) return
    e.preventDefault()
    setOver(true)
  }
  const onDragOver = (e) => {
    if (!hasFiles(e)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }
  const onDragLeave = (e) => {
    if (e.currentTarget.contains(e.relatedTarget)) return
    setOver(false)
  }
  const onDrop = (e) => {
    if (!hasFiles(e)) return
    e.preventDefault()
    setOver(false)
    onPick(e.dataTransfer.files?.[0])
  }
  const onChange = (e) => {
    const picked = e.target.files?.[0]
    e.target.value = '' // the file lives in state, so picking the same file again still fires
    onPick(picked)
  }

  const title = over ? 'Release to attach' : file ? 'Drop another file to replace it' : 'Drag & drop your brief or script'
  const cls = `ct-drop${over ? ' is-over' : ''}${file ? ' has-file' : ''}${error ? ' is-invalid' : ''}`

  return (
    <div className={`${cls}${className ? ` ${className}` : ''}`}>
      <p id="ct-file-label" className="ct-legend t-mono">
        Upload brief / script
        <span className="ct-legend__opt">Optional</span>
      </p>
      <input
        ref={inputRef}
        id="ct-file"
        className="ct-drop__input sr-only"
        type="file"
        name="brief"
        accept={ACCEPT}
        aria-labelledby="ct-file-label"
        aria-describedby={error ? 'ct-file-hint ct-file-err' : 'ct-file-hint'}
        aria-invalid={error ? true : undefined}
        onChange={onChange}
      />
      <label
        htmlFor="ct-file"
        className="ct-drop__zone"
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <svg className="ct-drop__frame" aria-hidden="true" focusable="false">
          <rect className="ct-drop__rect" width="100%" height="100%" rx="24" ry="24" />
        </svg>
        <span className="ct-drop__icon" aria-hidden="true">
          <UploadGlyph />
        </span>
        <span className="ct-drop__title">{title}</span>
        <span className="ct-drop__sub">
          or <span className="ct-drop__browse">browse your files</span>
        </span>
        <span id="ct-file-hint" className="ct-drop__hint t-mono">
          PDF, DOC, TXT, RTF, Pages, MP4, MOV · Max {MAX_MB} MB
        </span>
      </label>

      {file && (
        <div className="ct-filechip">
          <span className="ct-filechip__ext t-mono" aria-hidden="true">
            {extOf(file.name).slice(0, 4) || 'file'}
          </span>
          <span className="ct-filechip__meta">
            <span className="ct-filechip__name">{file.name}</span>
            <span className="ct-filechip__size t-mono">{formatBytes(file.size)} · Attached</span>
          </span>
          <button type="button" className="ct-filechip__rm" onClick={onRemove} aria-label={`Remove ${file.name}`}>
            <CloseGlyph />
          </button>
        </div>
      )}

      {error && (
        <p id="ct-file-err" className="ct-err t-small t-accent">
          {error}
        </p>
      )}
    </div>
  )
}

/* --------------------------------------------------------------------------
   12 — Contact
   The homepage's final beat: one big question, a direct line, and a brief
   intake that's quick to fill and hands a real endpoint a ready payload.
   -------------------------------------------------------------------------- */
export default function Contact() {
  const root = useRef(null)
  const formRef = useRef(null)
  const panelRef = useRef(null)
  const doneRef = useRef(null)
  const fileInputRef = useRef(null)
  const thumbRef = useRef(null)
  const thumbTo = useRef(null)
  const morph = useRef(null)
  const prevH = useRef(0)
  const lastStatus = useRef('idle')
  const request = useRef(null)
  const copyTimer = useRef(0)
  const refreshTimer = useRef(0)

  const { scrollTo } = useScroll()
  const narrow = useMediaQuery('(max-width: 359px)')
  const compact = useMediaQuery('(max-width: 479px)')

  const [status, setStatus] = useState('idle') // idle | sending | sent
  const [attempted, setAttempted] = useState(false)
  const [errors, setErrors] = useState({})
  const [file, setFile] = useState(null)
  const [fileError, setFileError] = useState('')
  const [volume, setVolume] = useState('')
  const [sendError, setSendError] = useState('')
  const [live, setLive] = useState({ msg: '', n: 0 })
  const [copied, setCopied] = useState(false)
  const [sender, setSender] = useState({ first: '', summary: [] })

  const sending = status === 'sending'
  const sent = status === 'sent'
  const errorCount = REQUIRED.filter((k) => errors[k]).length
  const formMsg =
    sendError ||
    (attempted && errorCount ? `${errorCount} ${errorCount === 1 ? 'field needs' : 'fields need'} attention` : '')
  const btnSize = narrow ? 'sm' : compact ? 'md' : 'lg'

  /** Polite announcement. The counter lets an identical message be read again (e.g. a repeat submit). */
  const announce = (msg) => setLive((p) => ({ msg, n: p.n + 1 }))

  /** Content below moved (errors, file chip, textarea, success morph) — re-measure triggers once it settles */
  const scheduleRefresh = () => {
    clearTimeout(refreshTimer.current)
    refreshTimer.current = setTimeout(() => ScrollTrigger.refresh(), 320)
  }

  /** Focus without the native jump, then glide there if it's off-screen */
  const focusField = (el) => {
    if (!el || typeof el.focus !== 'function') return
    el.focus({ preventScroll: true })
    const r = el.getBoundingClientRect()
    const vh = window.innerHeight
    if (r.top < vh * 0.14 || r.bottom > vh * 0.86) {
      scrollTo(el, { offset: -Math.round(vh * 0.3), duration: 1.1, immediate: prefersReducedMotion() })
    }
  }

  // Nothing outlives the section: in-flight send, copy + refresh timers
  useEffect(
    () => () => {
      request.current?.abort()
      clearTimeout(copyTimer.current)
      clearTimeout(refreshTimer.current)
    },
    [],
  )

  /* Entrance choreography · pointer light · segmented thumb */
  useGSAP(
    () => {
      const el = root.current
      const q = (s) => el.querySelector(s)
      const qa = (s) => Array.from(el.querySelectorAll(s))
      const once = (trigger, start = 'top 84%') => ({ trigger, start, once: true })
      const reduced = prefersReducedMotion()

      // One reusable tween for the volume thumb — xPercent steps one column per option
      thumbTo.current = gsap.quickTo(
        thumbRef.current,
        'xPercent',
        reduced ? { duration: 0.2, ease: 'power1.out' } : { duration: 0.75, ease: EASE.out },
      )

      const top = q('.ct-top')
      const stage = q('.ct-stage')
      const body = q('.ct-body')
      const after = q('.ct-after')
      const topBits = qa('.ct-eyebrow, .ct-top__tc')
      const reachBits = qa('.ct-reach > *')
      const formBits = qa('.ct-form > :not(.ct-hp)')
      const afterBits = qa('.ct-after .ct-kicker, .ct-step, .ct-social__item')

      // Anything holding links, fields or buttons fades opacity, not autoAlpha —
      // visibility:hidden would drop it from the tab order until it's scrolled to
      if (reduced) {
        const fade = (targets, trigger) =>
          gsap.fromTo(
            targets,
            { opacity: 0 },
            {
              opacity: 1,
              duration: 0.7,
              ease: 'power1.out',
              stagger: 0.04,
              clearProps: 'opacity',
              scrollTrigger: once(trigger, 'top 90%'),
            },
          )
        fade(topBits, top)
        fade(reachBits, body)
        fade(formBits, body)
        fade(afterBits, after)
        return
      }

      // Head — the timeline rule draws, metadata settles in
      gsap
        .timeline({ scrollTrigger: once(top, 'top 90%') })
        .from('.ct-top__line', { scaleX: 0, transformOrigin: '0% 50%', duration: 1.5, ease: EASE.inOut }, 0)
        .from(topBits, { autoAlpha: 0, y: 12, duration: 1.1, stagger: 0.08 }, 0.25)

      // The light blooms behind the question
      gsap.from('.ct-glow__core', {
        autoAlpha: 0,
        scale: 0.55,
        duration: 2.6,
        ease: EASE.out,
        scrollTrigger: once(stage, 'top 80%'),
      })

      // Body — the panel rises (transform only, so its glass keeps sampling the scene),
      // fields settle in and their hairlines are laid down like tracks
      gsap
        .timeline({ scrollTrigger: once(body, 'top 82%') })
        .from(reachBits, { opacity: 0, y: 28, duration: 1.2, stagger: 0.08, clearProps: 'transform' }, 0)
        .from(panelRef.current, { y: 120, duration: 1.6, clearProps: 'transform' }, 0.05)
        .from(formBits, { opacity: 0, y: 22, duration: 1.1, stagger: 0.055, clearProps: 'transform' }, 0.3)
        .from(
          qa('.ct-form .ct-rule__base'),
          { scaleX: 0, transformOrigin: '0% 50%', duration: 1.3, ease: EASE.inOut, stagger: 0.07, clearProps: 'transform' },
          0.4,
        )

      gsap.from(afterBits, {
        opacity: 0,
        y: 18,
        duration: 1.1,
        stagger: 0.06,
        clearProps: 'transform',
        scrollTrigger: once(after, 'top 92%'),
      })

      // Pointer light — lazily follows the cursor anywhere in the section (fine pointers only)
      if (!hasFinePointer()) return
      const glow = q('.ct-glow')
      glow.classList.add('is-live')
      const pos = { x: 0, y: 0 }
      const write = () => {
        glow.style.setProperty('--ct-gx', `${pos.x.toFixed(1)}px`)
        glow.style.setProperty('--ct-gy', `${pos.y.toFixed(1)}px`)
      }
      const follow = { duration: 1.8, ease: 'power3.out', onUpdate: write }
      const xTo = gsap.quickTo(pos, 'x', follow)
      const yTo = gsap.quickTo(pos, 'y', follow)
      const onMove = (e) => {
        const b = stage.getBoundingClientRect()
        xTo(e.clientX - (b.left + b.width / 2))
        yTo(e.clientY - (b.top + b.height / 2))
      }
      const onLeave = () => {
        xTo(0)
        yTo(0)
      }
      el.addEventListener('pointermove', onMove)
      el.addEventListener('pointerleave', onLeave)
      return () => {
        el.removeEventListener('pointermove', onMove)
        el.removeEventListener('pointerleave', onLeave)
        glow.classList.remove('is-live')
        glow.style.removeProperty('--ct-gx')
        glow.style.removeProperty('--ct-gy')
      }
    },
    { scope: root },
  )

  /* Form ⇄ success — crossfade inside the same panel while it morphs to the new height */
  useGSAP(
    () => {
      const prev = lastStatus.current
      lastStatus.current = status
      const entering = status === 'sent' && prev !== 'sent'
      const leaving = status === 'idle' && prev === 'sent'
      if (!entering && !leaving) return

      const panel = panelRef.current
      const form = formRef.current
      const done = doneRef.current
      const ring = done.querySelector('.ct-check__ring')
      const tick = done.querySelector('.ct-check__tick')
      const bits = done.querySelectorAll('.ct-done__bit')
      const reduced = prefersReducedMotion()

      morph.current?.kill()
      gsap.set(panel, { clearProps: 'height' })
      const fromH = prevH.current || panel.offsetHeight
      const toH = panel.offsetHeight // React already swapped which layer is in flow

      const land = () => {
        if (entering) done.focus({ preventScroll: true })
        else form.elements.namedItem('name')?.focus({ preventScroll: true })
      }

      // If the top of the panel is above the fold, bring the result into view
      if (entering) {
        const navH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 76
        if (panel.getBoundingClientRect().top < navH) {
          scrollTo(panel, { offset: -(navH + 24), duration: 1.4, immediate: reduced })
        }
      }

      if (reduced) {
        gsap.set(entering ? form : done, { autoAlpha: 0, y: 0 })
        // focus once the fade has made the layer visible (a visibility:hidden target can't take focus)
        morph.current = gsap.fromTo(
          entering ? done : form,
          { autoAlpha: 0, y: 0 },
          { autoAlpha: 1, duration: 0.45, ease: 'power1.out', onComplete: land },
        )
        if (entering) {
          gsap.set([ring, tick], { strokeDashoffset: 0, opacity: 1 })
          gsap.set(bits, { autoAlpha: 1, y: 0 })
        }
        scheduleRefresh()
        return
      }

      const tl = gsap.timeline({ onComplete: scheduleRefresh })
      morph.current = tl
      tl.fromTo(
        panel,
        { height: fromH },
        { height: toH, duration: 1.1, ease: EASE.inOut, clearProps: 'height' },
        entering ? 0.3 : 0.1,
      )

      if (entering) {
        tl.to(form, { autoAlpha: 0, y: -14, duration: 0.42, ease: 'power2.in' }, 0)
          .set([ring, tick], { opacity: 0 }, 0)
          .set(done, { autoAlpha: 1, y: 0 }, 0.5)
          .fromTo(bits, { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, duration: 1.2, stagger: 0.07, ease: EASE.out }, 0.72)
          .set(ring, { opacity: 1 }, 0.55)
          .fromTo(ring, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.2, ease: EASE.inOut }, 0.55)
          .set(tick, { opacity: 1 }, 1.2)
          .fromTo(tick, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.7, ease: EASE.out }, 1.2)
          .call(land, null, 0.6)
      } else {
        tl.to(done, { autoAlpha: 0, y: -10, duration: 0.4, ease: 'power2.in' }, 0)
          .fromTo(form, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 1, ease: EASE.out }, 0.45)
          .call(land, null, 0.5)
      }
    },
    { dependencies: [status], scope: root },
  )

  /* ------------------------------------------------------------------------
     Handlers
     ------------------------------------------------------------------------ */
  const onFieldBlur = (e) => {
    if (!attempted) return
    const { name, value } = e.target
    const msg = RULES[name]?.(value) ?? ''
    if (msg === (errors[name] ?? '')) return
    setErrors((prev) => ({ ...prev, [name]: msg }))
    if (msg) announce(msg)
  }

  const onFieldInput = (e) => {
    const { name, value } = e.target
    if (errors[name] && !RULES[name](value)) setErrors((prev) => ({ ...prev, [name]: '' }))
  }

  const grow = (area) => {
    area.style.height = 'auto'
    area.style.height = `${Math.min(area.scrollHeight, AREA_MAX)}px`
    area.style.overflowY = area.scrollHeight > AREA_MAX ? 'auto' : 'hidden'
  }

  const onMessageInput = (e) => {
    onFieldInput(e)
    grow(e.currentTarget)
  }

  const onMessageBlur = (e) => {
    onFieldBlur(e)
    scheduleRefresh()
  }

  const onVolume = (e) => {
    const idx = VOLUMES.findIndex((o) => o.value === e.target.value)
    const to = thumbTo.current
    // First pick: the thumb appears in place; after that it slides
    if (to && idx > -1) {
      if (volume) to(idx * 100)
      else to(idx * 100, idx * 100)
    }
    setVolume(e.target.value)
  }

  const pickFile = (f) => {
    if (!f) return
    let msg = ''
    if (!ACCEPT_EXT.includes(extOf(f.name))) {
      msg = `“${f.name}” isn’t a supported format. Use PDF, DOC, DOCX, TXT, RTF, Pages, MP4 or MOV.`
    } else if (f.size > MAX_BYTES) {
      msg = `That file is ${formatBytes(f.size)} — the limit is ${MAX_MB} MB. Share a link in the message instead.`
    }
    if (msg) {
      setFileError(msg)
      announce(msg)
      scheduleRefresh()
      return
    }
    setFile(f)
    setFileError('')
    announce(`Attached ${f.name}, ${formatBytes(f.size)}.`)
    scheduleRefresh()
  }

  const removeFile = () => {
    const name = file?.name
    setFile(null)
    setFileError('')
    fileInputRef.current?.focus()
    if (name) announce(`Removed ${name}.`)
    scheduleRefresh()
  }

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(SITE.email)
      setCopied(true)
      announce('Email address copied.')
      clearTimeout(copyTimer.current)
      copyTimer.current = setTimeout(() => setCopied(false), 2200)
    } catch {
      announce(`Couldn’t copy automatically. The address is ${SITE.email}.`)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (status !== 'idle') return
    const form = e.currentTarget
    const data = new FormData(form)
    const next = validate(data)
    const invalid = REQUIRED.filter((k) => next[k])
    // commit aria-invalid + the error text before focus lands, so the field is announced with its message
    flushSync(() => {
      setAttempted(true)
      setErrors(next)
      setSendError('')
    })

    if (invalid.length) {
      const names = invalid.map((k) => FIELD_LABEL[k]).join(', ')
      announce(`Please check ${invalid.length === 1 ? 'one field' : `${invalid.length} fields`}: ${names}.`)
      focusField(form.elements.namedItem(invalid[0]))
      scheduleRefresh()
      return
    }

    const payload = buildPayload(form, file)
    const ctrl = new AbortController()
    request.current = ctrl
    setStatus('sending')
    announce('Sending your project details…')

    try {
      await sendBrief(payload, ctrl.signal)
    } catch {
      if (ctrl.signal.aborted) return
      const msg = `That didn’t go through. Please try again, or email ${SITE.email}.`
      setStatus('idle')
      setSendError(msg)
      announce(msg)
      return
    }
    if (ctrl.signal.aborted) return

    prevH.current = panelRef.current?.offsetHeight ?? 0
    setSender({ first: firstName(data.get('name')), summary: buildSummary(data, file) })
    announce('')
    setStatus('sent')
  }

  const sendAnother = () => {
    prevH.current = panelRef.current?.offsetHeight ?? 0
    const form = formRef.current
    if (form) {
      form.reset()
      const area = form.elements.namedItem('message')
      if (area) {
        area.style.height = ''
        area.style.overflowY = ''
      }
    }
    setFile(null)
    setFileError('')
    setVolume('')
    setErrors({})
    setAttempted(false)
    setSendError('')
    setStatus('idle')
  }

  /* ------------------------------------------------------------------------
     Render
     ------------------------------------------------------------------------ */
  return (
    <section ref={root} id="contact" className="section ct" data-hud="Contact" aria-labelledby="ct-title">
      <div className="container">
        <header className="ct-head">
          <div className="ct-top">
            <Eyebrow index="12" className="ct-eyebrow">
              Contact
            </Eyebrow>
            <p className="ct-top__tc t-mono" aria-hidden="true">
              <span className="ct-top__beat">{CTA_BEAT.label}</span>
              <span className="ct-top__range">
                {BEAT_IN} — {BEAT_OUT}
              </span>
            </p>
            <span className="ct-top__line" aria-hidden="true" />
          </div>

          <div className="ct-stage">
            <div className="ct-glow" aria-hidden="true">
              <span className="ct-glow__core" />
            </div>
            <SplitReveal as="h2" id="ct-title" className="ct-title t-display">
              Have a script?
            </SplitReveal>
            <SplitReveal as="p" className="ct-sub t-h1" delay={0.14}>
              Let&rsquo;s turn it into a <em className="t-serif t-accent">performance ad.</em>
            </SplitReveal>
          </div>
        </header>

        <div className="ct-body">
          {/* Direct line */}
          <div className="ct-reach">
            <p className="ct-kicker t-mono">Direct line</p>
            <div className="ct-mail">
              <a className="ct-email ct-uline t-h3" href={`mailto:${SITE.email}`}>
                {SITE.email}
              </a>
              <button
                type="button"
                className={`ct-copy t-mono${copied ? ' is-copied' : ''}`}
                onClick={copyEmail}
                aria-label={copied ? 'Email address copied' : 'Copy email address'}
              >
                <span className="ct-copy__dot" aria-hidden="true" />
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <dl className="ct-meta">
              <div className="ct-meta__row">
                <dt className="ct-meta__k t-mono">Status</dt>
                <dd className="ct-meta__v">
                  <span className="rec-dot" aria-hidden="true" />
                  {SITE.availability}
                </dd>
              </div>
              <div className="ct-meta__row">
                <dt className="ct-meta__k t-mono">Response</dt>
                <dd className="ct-meta__v">Replies within 24 hours</dd>
              </div>
              <div className="ct-meta__row">
                <dt className="ct-meta__k t-mono">Based</dt>
                <dd className="ct-meta__v">{SITE.location}</dd>
              </div>
            </dl>
          </div>

          {/* Brief intake */}
          <div className="ct-formcol">
            <Glass ref={panelRef} className="ct-panel" tone="dark" refract={false} radius="var(--r-xl)">
              <div className="ct-stack">
                <form
                  ref={formRef}
                  className={`ct-form${sent ? ' is-away' : ''}`}
                  noValidate
                  onSubmit={handleSubmit}
                  aria-labelledby="ct-form-title"
                  aria-busy={sending || undefined}
                  inert={sent}
                >
                  <div className="ct-panel__head ct-span">
                    <h3 id="ct-form-title" className="ct-panel__title t-mono">
                      Project brief
                    </h3>
                    <p className="ct-panel__req t-mono" aria-hidden="true">
                      * Required
                    </p>
                  </div>

                  <Field
                    id="ct-name"
                    name="name"
                    label="Name"
                    required
                    autoComplete="name"
                    error={errors.name}
                    onBlur={onFieldBlur}
                    onInput={onFieldInput}
                  />
                  <Field
                    id="ct-email"
                    name="email"
                    type="email"
                    inputMode="email"
                    label="Email"
                    required
                    autoComplete="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    error={errors.email}
                    onBlur={onFieldBlur}
                    onInput={onFieldInput}
                  />
                  <Field id="ct-company" name="company" label="Company / Brand" autoComplete="organization" className="ct-span" />

                  <fieldset className="ct-group ct-span" role="radiogroup" aria-labelledby="ct-need-legend">
                    <legend id="ct-need-legend" className="ct-legend t-mono">
                      What do you need?
                    </legend>
                    <div className="ct-pills">
                      {NEEDS.map((n) => (
                        <label className="ct-pill" key={n}>
                          <input className="ct-pill__input sr-only" type="radio" name="need" value={n} />
                          <span className="ct-pill__txt">{n}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <fieldset className="ct-group ct-span" role="radiogroup" aria-labelledby="ct-vol-legend">
                    <legend id="ct-vol-legend" className="ct-legend t-mono">
                      Approximate monthly volume
                      <span className="ct-legend__opt">Optional</span>
                    </legend>
                    <div className={`ct-seg${volume ? ' has-value' : ''}`}>
                      <span ref={thumbRef} className="ct-seg__thumb" aria-hidden="true" />
                      {VOLUMES.map((o) => (
                        <label className="ct-seg__opt" key={o.value}>
                          <input
                            className="ct-seg__input sr-only"
                            type="radio"
                            name="volume"
                            value={o.value}
                            onChange={onVolume}
                          />
                          <span className="ct-seg__txt">
                            {o.label}
                            <span className="sr-only"> ads a month</span>
                          </span>
                        </label>
                      ))}
                    </div>
                    <p className="ct-seg__unit t-mono" aria-hidden="true">
                      Ads per month
                    </p>
                  </fieldset>

                  <Field
                    id="ct-message"
                    name="message"
                    label="Message"
                    required
                    multiline
                    rows={3}
                    placeholder="Product, audience, the goal — plus links to footage or reference ads."
                    className="ct-span"
                    data-lenis-prevent=""
                    error={errors.message}
                    onBlur={onMessageBlur}
                    onInput={onMessageInput}
                  />

                  <Dropzone
                    className="ct-span"
                    file={file}
                    error={fileError}
                    inputRef={fileInputRef}
                    onPick={pickFile}
                    onRemove={removeFile}
                  />

                  {/* Honeypot — people never see it; providers like Formspree drop anything that fills it */}
                  <div className="ct-hp" aria-hidden="true">
                    <label htmlFor="ct-gotcha">Leave this field empty</label>
                    <input id="ct-gotcha" type="text" name="_gotcha" tabIndex={-1} autoComplete="off" />
                  </div>

                  <div className="ct-actions ct-span">
                    <Button
                      type="submit"
                      variant="primary"
                      size={btnSize}
                      className={`ct-submit${sending ? ' is-busy' : ''}`}
                      aria-disabled={sending || undefined}
                    >
                      <span className={`ct-sublabel${sending ? ' is-busy' : ''}`}>
                        <span className="ct-sublabel__idle" aria-hidden={sending || undefined}>
                          <span className="ct-sublabel__line">Send Project Details</span>
                          <span className="ct-sublabel__line" aria-hidden="true">
                            Send Project Details
                          </span>
                        </span>
                        <span className="ct-sublabel__busy" aria-hidden={!sending || undefined}>
                          Sending…
                        </span>
                      </span>
                    </Button>
                    <p className="ct-formmsg t-small" aria-hidden="true">
                      {formMsg}
                    </p>
                  </div>
                </form>

                <div
                  ref={doneRef}
                  className={`ct-done${sent ? '' : ' is-away'}`}
                  inert={!sent}
                  tabIndex={-1}
                  role="group"
                  aria-labelledby="ct-done-title"
                  aria-describedby="ct-done-text"
                >
                  <svg className="ct-check" viewBox="0 0 72 72" aria-hidden="true" focusable="false">
                    <path className="ct-check__ring" pathLength="1" d="M36 3a33 33 0 1 1 0 66a33 33 0 1 1 0-66" />
                    <path className="ct-check__tick" pathLength="1" d="M24.5 37.4l7.7 7.6L48 28.8" />
                  </svg>
                  <p className="ct-done__kicker t-mono ct-done__bit">That&rsquo;s a wrap · {BEAT_OUT}</p>
                  <h3 id="ct-done-title" className="ct-done__title t-h2 ct-done__bit">
                    Brief received.
                  </h3>
                  <p id="ct-done-text" className="ct-done__text t-lead ct-done__bit">
                    Thanks, {sender.first}. I&rsquo;ll reply within 24 hours with first thoughts on the hook.
                  </p>
                  {sender.summary.length > 0 && (
                    <ul className="ct-done__summary ct-done__bit" aria-label="Sent with your brief">
                      {sender.summary.map((s, i) => (
                        <li className="chip ct-done__chip" key={`${i}-${s}`}>
                          <span className="ct-done__chiptxt">{s}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="ct-done__again ct-done__bit">
                    <Button variant="ghost" onClick={sendAnother}>
                      Send another
                    </Button>
                  </div>
                </div>
              </div>
            </Glass>
          </div>

          {/* redundant once the brief is in — fades out (inert) instead of floating under a shorter panel */}
          <p className={`ct-note t-small${sent ? ' is-muted' : ''}`} inert={sent}>
            Prefer email?{' '}
            <a className="ct-note__link ct-uline" href={`mailto:${SITE.email}`}>
              {SITE.email}
            </a>
          </p>

          {/* After you hit send */}
          <div className="ct-after">
            <div className="ct-next">
              <h3 className="ct-kicker t-mono">What happens next</h3>
              <ol className="ct-steps">
                {STEPS.map((s, i) => (
                  <li className="ct-step" key={s}>
                    <span className="ct-step__n t-mono" aria-hidden="true">
                      {pad2(i + 1)}
                    </span>
                    <span className="ct-step__t">{s}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="ct-elsewhere">
              <h3 className="ct-kicker t-mono">Elsewhere</h3>
              <ul className="ct-social">
                {SITE.socials.map((s) => (
                  <li className="ct-social__item" key={s.label}>
                    <a
                      className="ct-social__link"
                      href={s.href}
                      {...(isExternal(s.href) ? { target: '_blank', rel: 'noreferrer' } : {})}
                    >
                      {s.label}
                      <ArrowIcon dir="up-right" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {live.msg}
          {live.msg && live.n % 2 ? ' ' : ''}
        </p>
      </div>
    </section>
  )
}
