import { useEffect } from 'react'
import Button from '../components/Button'
import SplitReveal from '../components/SplitReveal'
import './NotFound.css'

export default function NotFound() {
  useEffect(() => {
    document.title = 'Signal lost — Ibad'
  }, [])
  return (
    <section className="nf" data-hud="Signal lost">
      <div className="container nf__inner">
        <p className="t-mono t-mute">
          <span className="rec-dot" /> Error 404 — frame not found
        </p>
        <p className="nf__tc tabular" aria-hidden="true">00:00:04:04</p>
        <SplitReveal as="h1" className="t-h1">
          This cut <em className="t-serif">didn&rsquo;t</em> make the edit.
        </SplitReveal>
        <Button to="/">Back to the reel</Button>
      </div>
    </section>
  )
}
