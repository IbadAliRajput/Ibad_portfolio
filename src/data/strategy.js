// Creative strategy content — the "why" behind the edits.

// R2 base — inlined from site.js (MEDIA_URL); see that file for env override
const R2 = 'https://ibadportfolio.com'

export const FUNNEL = ['Attention', 'Retention', 'Understanding', 'Desire', 'Action']

/** The 60-second ad skeleton. range in seconds. */
export const AD_STRUCTURE = [
  { id: 'hook', label: 'Hook', range: [0, 3], goal: 'Stop the scroll.', stage: 'Attention', caption: ['This', 'is', 'why', 'your', 'ads', 'stop', 'working.'], hl: 5 },
  { id: 'problem', label: 'Problem / Context', range: [3, 8], goal: "Identify the viewer's problem or create curiosity.", stage: 'Retention', caption: ['You', 'spent', 'the', 'budget', 'on', 'footage…'], hl: 3 },
  { id: 'explain', label: 'Explanation', range: [8, 20], goal: 'Explain what is happening and why it matters.', stage: 'Understanding', caption: ['But', 'nobody', 'watched', 'past', 'second', 'two.'], hl: 4 },
  { id: 'mechanism', label: 'Mechanism / Solution', range: [20, 35], goal: 'Introduce the solution or explain how it works.', stage: 'Desire', caption: ['Every', 'cut', 'needs', 'a', 'reason', 'to', 'stay.'], hl: 4 },
  { id: 'proof', label: 'Proof / Transformation', range: [35, 50], goal: 'Show evidence, demonstration, testimonial or result.', stage: 'Desire', caption: ['Same', 'script.', 'Five', 'new', 'openings.'], hl: 2 },
  { id: 'cta', label: 'CTA', range: [50, 60], goal: 'Tell the viewer what to do next.', stage: 'Action', caption: ['Send', 'the', 'script.', "Let's", 'build', 'it.'], hl: 4 },
]

export const HOOK_TYPES = [
  { name: 'Problem', desc: 'Immediately identifies a pain point.' },
  { name: 'Curiosity', desc: 'Opens an information gap the viewer has to close.' },
  { name: 'Pattern-Interrupt', desc: 'An unexpected visual or statement that breaks the scroll.' },
  { name: 'Contrarian', desc: 'Challenges something the viewer already believes.' },
  { name: 'Demonstration', desc: 'Starts directly with the product, process or result.' },
  { name: 'Question', desc: 'A question the target audience instantly relates to.' },
  { name: 'Story', desc: 'Begins in the middle of a personal experience.' },
  { name: 'Transformation', desc: 'Starts with the result, then explains how it happened.' },
  { name: 'Warning', desc: 'Creates urgency around a mistake or problem.' },
  { name: 'Discovery', desc: 'Framed as something the speaker just found out.' },
]

/**
 * The Hook Lab — one real hook test (Corvael, "The Wrong Fire"): five openings
 * cut onto one body. dur = seconds until the shared body starts; hl = the
 * phrase placeholder captions would punch.
 */
const LAB = `${R2}/work/hooks-05`
export const HOOK_LAB = { slug: 'corvael-wrong-fire', title: 'Corvael — The Wrong Fire', duration: 92, ctaAt: 72 }
export const HOOK_VARIANTS = [
  { id: 'A', type: 'Pattern-Interrupt', line: 'Do not buy Corvael nattokinase if you like your calcium score going up.', hl: 'Do not buy', visual: 'The bottle pushed toward the lens, a hand raised', dur: 6.6 },
  { id: 'B', type: 'Problem', line: 'If you’ve cut the salt for six years and the number still went up — you don’t lack discipline.', hl: 'six years', visual: 'At the kitchen table, the salt shaker pushed away', dur: 6.9 },
  { id: 'C', type: 'Story', line: 'For years, they told him to walk more to fix his arteries. But you can’t walk off what’s in the wall.', hl: 'walk more', visual: 'Walking the dog down a sunny suburban street', dur: 7.5 },
  { id: 'D', type: 'Curiosity', line: 'Problem one: cholesterol pills don’t work on plaque that isn’t in your blood. Here’s why.', hl: 'Here’s why.', visual: 'A 3D artery, the pill sliding past the plaque', dur: 7.6 },
  { id: 'E', type: 'Contrarian', line: 'Stop cutting the salt for a problem that’s built into the artery wall. You’re fighting the wrong fire.', hl: 'wrong fire.', visual: 'A red cross over the salt shaker', dur: 9.0 },
].map((v) => ({ ...v, video: `${LAB}/hook-${v.id.toLowerCase()}.mp4`, poster: `${LAB}/hook-${v.id.toLowerCase()}.jpg` }))

export const VARIATION_AXES = [
  { name: 'Hook', desc: 'Different opening statement.' },
  { name: 'Opening Visual', desc: 'Different first frame, same voiceover.' },
  { name: 'Speaker', desc: 'Different creator or founder footage.' },
  { name: 'B-Roll', desc: 'Different supporting footage.' },
  { name: 'AI Visual', desc: 'Different AI-generated interpretation.' },
  { name: 'Product Shot', desc: 'Different product presentation.' },
  { name: 'Caption Style', desc: 'Different emphasis or presentation.' },
  { name: 'CTA', desc: 'Different closing message.' },
  { name: 'Pacing', desc: 'Fast vs moderate rhythm.' },
  { name: 'Music', desc: 'Different background audio.' },
  { name: 'Voiceover', desc: 'Different voice or tone when required.' },
  { name: 'Sequence', desc: 'Different ordering of visual moments.' },
]

/** Creative Iteration System — product of counts = total ads */
export const ITERATION = [
  { n: 1, label: 'Script', unit: 'concept' },
  { n: 5, label: 'Hook variations', unit: 'hooks' },
  { n: 3, label: 'Opening visuals', unit: 'openings' },
  { n: 2, label: 'B-roll variations', unit: 'b-roll' },
  { n: 2, label: 'CTA variations', unit: 'CTAs' },
]

export const TEST_LOOP = ['Create', 'Test', 'Learn', 'Iterate', 'Produce new variation']
export const TEST_VARIABLES = ['Hook', 'Angle', 'Opening shot', 'Creator', 'Voice', 'Visual style', 'B-roll', 'CTA', 'Pacing', 'Product intro', 'Offer']

export const ANGLES = [
  { name: 'Problem', desc: 'Focus on the pain point.' },
  { name: 'Solution', desc: 'Focus on the solution.' },
  { name: 'Education', desc: 'Teach something.' },
  { name: 'Story', desc: 'Tell a personal story.' },
  { name: 'Discovery', desc: '"I found this…"' },
  { name: 'Testimonial', desc: '"I tried this…"' },
  { name: 'Transformation', desc: 'Show the result.' },
  { name: 'Demonstration', desc: 'Show how it works.' },
  { name: 'Mistake', desc: 'What people are doing wrong.' },
  { name: 'Comparison', desc: 'Old approach vs new approach.' },
  { name: 'Curiosity', desc: 'Create an information gap.' },
]

export const TRADITIONAL = ['Receives footage', 'Cuts footage', 'Adds music', 'Adds captions', 'Exports']
export const PERFORMANCE = [
  'Receives script & brief',
  'Understands the audience',
  'Identifies the hook',
  'Plans the visual story',
  'Sources & generates visuals',
  'Builds retention structure',
  'Creates variations',
  'Edits',
  'Sound designs',
  'Optimises for paid social',
]

export const RETENTION_TECHNIQUES = [
  'Frequent visual changes', 'Pattern interrupts', 'Punch-ins', 'Punch-outs', 'Camera-angle changes', 'B-roll insertion',
  'Product close-ups', 'AI visual transitions', 'Motion graphics', 'On-screen emphasis', 'Sound effects', 'Strategic pauses',
  'Speed changes', 'Visual reveals', 'Visual progression', 'Match cuts', 'Object-focused shots', 'Reaction shots', 'Demonstration shots',
]

/** Every visual change should do one of these */
export const PHILOSOPHY = ['Explain', 'Demonstrate', 'Emphasise', 'Entertain', 'Create curiosity', 'Build emotion', 'Move the story forward']

/** Script says → possible visual */
export const SCRIPT_TO_VISUAL = [
  { says: 'Something is building up.', visual: 'AI-generated conceptual build-up animation.' },
  { says: "Here's what happens next.", visual: 'A reveal, or a transition into a new environment.' },
  { says: 'This is where things change.', visual: 'Strong visual transition into the product introduction.' },
  { says: 'Two weeks later…', visual: 'New environment, wardrobe, physical progression or timeline cue.' },
]

/** Voiceover → visual mapping example */
export const VO_MAP = [
  { vo: 'You keep doing X…', visual: 'Relevant UGC shot' },
  { vo: "But here's what you're missing…", visual: 'Visual change / pattern interrupt' },
  { vo: 'This is why…', visual: 'AI explanatory animation' },
  { vo: "Here's what changed…", visual: 'Product demo / transformation visual' },
]

export const BROLL_QUESTIONS = [
  'Does it explain what is being said?',
  'Does it demonstrate what is being said?',
  'Does it create emotion?',
  'Does it reinforce credibility?',
  'Does it create curiosity?',
  'Does it prevent visual fatigue?',
  'Does it move the story forward?',
]

/** Positioning pillars */
export const PILLARS = [
  { name: 'Strategy', desc: 'Understanding the script, audience and creative angle.' },
  { name: 'Editing', desc: 'Fast, clean and retention-focused short-form editing.' },
  { name: 'Creative', desc: 'Strong hooks, storytelling and visual concepts.' },
  { name: 'AI', desc: "Custom visual production when traditional footage isn't enough." },
  { name: 'Variations', desc: 'Multiple hooks and creative executions for testing.' },
  { name: 'Performance', desc: 'Every decision made for attention, retention and conversion.' },
]

export const ROLES = ['Video Editor', 'Creative Strategist', 'AI Visual Producer', 'Performance Ad Specialist']

/** Process-true figures (not performance claims) for the animated stats */
export const STATS = [
  { value: 3, prefix: '0–', suffix: 's', label: 'Hook window', note: 'The first three seconds decide everything.' },
  { value: 5, suffix: '+', label: 'Hooks per concept', note: 'One body, many openings to test.' },
  { value: 60, label: 'Ads from one script', note: '5 hooks × 3 openings × 2 B-roll × 2 CTAs.' },
  { value: 3, prefix: '1–', suffix: 's', label: 'Visual change cadence', note: 'Pacing follows the script, not a preset.' },
]
