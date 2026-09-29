// Shared case-study styles first, so each section's own sheet can refine them
import './CaseStudy.css'
import { useEffect } from 'react'
import { useParams } from 'react-router'
import { getProject } from '../data/projects'
import NotFound from './NotFound'
import CaseHero from '../case/CaseHero'
import CaseBrief from '../case/CaseBrief'
import HookScrub from '../case/HookScrub'
import CaseBreakdown from '../case/CaseBreakdown'
import CaseVariations from '../case/CaseVariations'
import EditTimeline from '../case/EditTimeline'
import CaseRecap from '../case/CaseRecap'
import CaseNext from '../case/CaseNext'

/**
 * One case study, structured like the brief (§8): the final ad first, then
 * the brief, the hook, the script-to-visual breakdown, the hook variations
 * (when the project was delivered as a hook test), the timeline behind it,
 * and the way out. The project's tone colours the page through --cs-tone.
 */
function CaseStudyPage({ project }) {
  const { title, kicker, tone } = project

  useEffect(() => {
    document.title = `${title} — ${kicker} — Ibad`
  }, [title, kicker])

  return (
    <article className="cs" style={{ '--cs-tone': tone }} aria-labelledby="cs-title">
      <CaseHero project={project} />
      <CaseBrief project={project} />
      <HookScrub project={project} />
      <CaseBreakdown project={project} />
      {project.hooks?.length > 0 && <CaseVariations project={project} />}
      <EditTimeline project={project} />
      <CaseRecap project={project} />
      <CaseNext project={project} />
    </article>
  )
}

export default function CaseStudy() {
  const { slug } = useParams()
  const project = getProject(slug)
  if (!project) return <NotFound />
  // Keyed on the slug: project → project navigation remounts every section,
  // so each intro, split and ScrollTrigger is rebuilt from scratch.
  return <CaseStudyPage key={slug} project={project} />
}
