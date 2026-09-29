// Portfolio case studies — the real ads. Media for each streams from the
// Cloudflare R2 bucket behind MEDIA_URL in site.js, mirrored from the old
// /public/media tree without its /media prefix.
// Kept import-free so the media scripts can read it with plain Node.

/* --------------------------------------------------------------------------
   Timeline builder — turns the script breakdown into NLE-style tracks so each
   case study can show the layered edit (A-roll, VO, B-roll, AI, captions…).
   -------------------------------------------------------------------------- */
const CHUNKS = [2.4, 1.6, 3.1, 1.9, 2.7, 1.3, 2.2]
function chunk(start, end, label, seed = 0) {
  const out = []
  let t = start
  let i = seed
  while (t < end - 0.05) {
    const len = Math.min(CHUNKS[i % CHUNKS.length], end - t)
    out.push({ start: +t.toFixed(2), end: +(t + len).toFixed(2), label: out.length === 0 ? label : '' })
    t += len
    i++
  }
  return out
}

function buildTimeline(duration, rows) {
  const spans = rows.map((r, i) => [r.t, i < rows.length - 1 ? rows[i + 1].t : duration])
  const tracks = {
    caption: { id: 'cap', name: 'Captions', kind: 'caption', clips: [] },
    ai: { id: 'ai', name: 'AI Visuals', kind: 'ai', clips: [] },
    broll: { id: 'broll', name: 'B-Roll', kind: 'broll', clips: [] },
    aroll: { id: 'aroll', name: 'A-Roll', kind: 'aroll', clips: [] },
    vo: { id: 'vo', name: 'Voiceover', kind: 'vo', clips: [] },
    sfx: { id: 'sfx', name: 'SFX', kind: 'sfx', clips: [] },
    music: { id: 'music', name: 'Music', kind: 'music', clips: [{ start: 0, end: duration, label: 'Score' }] },
  }
  rows.forEach((r, i) => {
    const [s, e] = spans[i]
    const words = r.vo.replace(/[…".,!?—]/g, '').split(' ').slice(0, 3).join(' ')
    tracks.caption.clips.push({ start: s, end: Math.max(s + 0.6, e - 0.15), label: words })
    tracks.vo.clips.push({ start: s + 0.05, end: Math.max(s + 0.6, e - 0.35), label: i === 0 ? 'VO' : '' })
    tracks.sfx.clips.push({ start: s, end: s + 0.35, label: '' })
    if (r.kind === 'ai') tracks.ai.clips.push(...chunk(s, e, r.visual.split(',')[0], i))
    else if (r.kind === 'aroll') {
      tracks.aroll.clips.push(...chunk(s, e, 'A-roll', i))
      const mid = s + (e - s) * 0.45
      if (e - s > 3) tracks.broll.clips.push({ start: +mid.toFixed(2), end: +(mid + 1.2).toFixed(2), label: '' })
    } else tracks.broll.clips.push(...chunk(s, e, r.visual.split(',')[0], i))
    if (r.kind === 'product') tracks.sfx.clips.push({ start: Math.max(0, s - 1.1), end: s, label: 'Riser' })
  })
  return { duration, tracks: Object.values(tracks).filter((t) => t.clips.length) }
}

/** Media paths for a project folder, plus per-beat stills and per-hook clips */
// Inlined base — this file must stay import-free (scripts/media.mjs reads it
// with plain Node). Keep in sync with MEDIA_URL in site.js.
const WORK = 'https://ibadportfolio.com/work'
function project(p) {
  const dir = `${WORK}/${p.media.id}`
  return {
    poster: `${dir}/poster.jpg`,
    video: `${dir}/preview.mp4`, // 10s muted loop for cards
    full: `${dir}/full.mp4`, // the whole ad, with sound, for the player
    scrub: `${dir}/scrub.mp4`, // the hook window, all-intra, for the scroll scrub
    caption: p.hook.line,
    captionHl: p.hook.hl,
    ...p,
    breakdown: p.breakdown.map((b, i) => ({ ...b, shot: `${dir}/beat-${i + 1}.jpg` })),
    hooks: (p.hooks ?? []).map((h) => ({ ...h, video: `${dir}/hook-${h.id.toLowerCase()}.mp4`, poster: `${dir}/hook-${h.id.toLowerCase()}.jpg` })),
    timeline: buildTimeline(p.runtime, p.breakdown),
  }
}

const LONG = ['Meta', 'Facebook']
const SHORT = ['Meta', 'TikTok', 'Reels']

export const PROJECTS = [
  /* ------------------------------------------------------------------ */
  project({
    slug: 'corvael-in-the-wall',
    media: { id: 'hooks-01', src: 'ad-01-hook-a.mp4', poster: 0.4 },
    title: 'In the Wall',
    kicker: 'Claymation Hook Test',
    client: 'Corvael',
    year: 2026,
    runtime: 125,
    format: 'Explainer',
    formatLabel: 'AI Explainer VSL',
    styles: ['Claymation', 'Mechanism'],
    production: ['AI visuals', 'Editing', 'Hook variations'],
    platforms: LONG,
    tone: '#e88f86',
    summary:
      'A claymation explainer built around one idea — the plaque sits in the artery wall, not the blood — delivered with five interchangeable openings on one locked body.',
    objective:
      'Find the angle that stops statin users — a warning, a demonstration, a reframe or hard numbers — without rebuilding the ad for every test.',
    creativeApproach:
      'Five hooks → one shared mechanism: fibrin in the wall → why lowering cholesterol never touched it → the enzyme that does → offer and guarantee.',
    editingApproach:
      'Stop-motion-style clay keeps a heavy medical topic warm and approachable. Every opening lands on the same cut into the body, so the test isolates the hook and nothing else.',
    deliverables: ['5 hook variations', '1 locked body (≈2 min)', 'Claymation mechanism sequence', 'Offer + guarantee close'],
    tools: ['AI image generation', 'AI video generation', 'Voiceover', 'Captions', 'Sound design'],
    overview:
      'A hook-testing set: five openings — warning, demonstration, problem, numbers and reframe — each cut onto the same claymation body, so every result is a clean read on the hook.',
    stats: [
      { k: 'Runtime', v: '2:05' },
      { k: 'Hooks', v: '5' },
      { k: 'Body', v: '1 locked' },
      { k: 'Ratio', v: '9:16' },
    ],
    hook: {
      line: 'This is the hidden cost of taking a statin every single morning for six years.',
      hl: 'hidden cost',
      window: '0.0 – 4.4s',
      seconds: 4.4,
      points: [
        { k: 'What it communicates', v: 'A cost the viewer hasn’t counted, attached to a habit they repeat every morning.' },
        { k: 'The curiosity gap', v: '“Hidden” implies something nobody mentioned at the doctor’s. The ad promises to show it.' },
        { k: 'Why the visual matches', v: 'A tired clay man takes his pill at the sink — then the cut goes straight inside his chest.' },
        { k: 'The first shot', v: 'An ordinary kitchen in warm clay: familiar, gentle, and nothing like a pharma ad.' },
        { k: 'No slow intro', v: 'The pill is swallowed in the first second; the mechanism starts at 4.4s.' },
      ],
    },
    breakdown: [
      { t: 0, at: 0.4, kind: 'ai', vo: 'This is the hidden cost of taking a statin…', visual: 'Clay man at the sink with his morning pill', edit: 'Hook slot — one of five openings' },
      { t: 4.4, at: 7.0, kind: 'ai', vo: 'There’s a protein called fibrin. It’s the mesh your plaque is built on.', visual: 'Clay artery cross-section, the fibrin mesh', edit: 'Body starts here — shared by every hook' },
      { t: 18.9, at: 24.5, kind: 'ai', vo: 'Less reaching your legs, which is why you stop on the stairs.', visual: 'The clay man pausing on the stairs', edit: 'One symptom, one shot, on the word' },
      { t: 57.9, at: 60.5, kind: 'ai', vo: 'Nattokinase is an enzyme fermented out of a Japanese food.', visual: 'Fermented soybeans, stretching strands', edit: 'Macro push-in for the reveal' },
      { t: 75.8, at: 78.0, kind: 'ai', vo: 'When the fibrin lets go, the calcium locked inside it comes loose.', visual: 'Calcium flecks lifting off the artery wall', edit: 'Why K2 matters — one visual per claim' },
      { t: 101.3, at: 122.3, kind: 'product', vo: 'It’s called Corvael. Website only — it isn’t on Amazon.', visual: 'Clay bottle beside the website-exclusive card', edit: 'Offer, guarantee and exclusivity close' },
    ],
    hooks: [
      { id: 'A', type: 'Warning', line: 'This is the hidden cost of taking a statin every single morning for six years.', dur: 4.4, src: 'ad-01-hook-a.mp4' },
      { id: 'B', type: 'Demonstration', line: 'This is what’s still happening inside your artery every morning while you swallow that pill.', dur: 4.4, src: 'ad-01-hook-b.mp4' },
      { id: 'C', type: 'Problem', line: 'Your statin brought your cholesterol down. It did its job — and your arteries are still filling in.', dur: 6.6, src: 'ad-01-hook-c.mp4' },
      { id: 'D', type: 'Curiosity', line: 'Your LDL is 71. Your calcium score went from 347 to 411 in the same six years. Both are true.', dur: 7.8, src: 'ad-01-hook-d.mp4' },
      { id: 'E', type: 'Contrarian', line: 'Your statin lowers what’s arriving in your blood. It has never once been where the plaque actually is.', dur: 4.9, src: 'ad-01-hook-e.mp4' },
    ],
  }),

  /* ------------------------------------------------------------------ */
  project({
    slug: 'corbel-the-trainer',
    media: { id: 'ad-02', src: 'ad-02.mp4', poster: 2.0 },
    title: 'The Trainer',
    kicker: 'Pixar-Style Story VSL',
    client: 'Corbel',
    year: 2026,
    runtime: 369,
    format: 'Story',
    formatLabel: 'AI Story VSL',
    styles: ['Pixar-style 3D', 'Story'],
    production: ['AI visuals', 'Editing'],
    platforms: LONG,
    tone: '#5b8cff',
    summary:
      'A six-minute animated drama that sells a supplement the way a short film would — a marriage falls apart, an old friend explains why, and the product only arrives once the viewer is invested.',
    objective:
      'Hold attention for six minutes on a sensitive men’s-health topic, and earn the product pitch through story instead of claims.',
    creativeApproach:
      'Confrontation hook → the backstory → the mentor → the mechanism, explained at the gym → a week-by-week comeback → the product.',
    editingApproach:
      'Dialogue scenes cut like an episode — reactions, two-shots, flashbacks — with 3D artery inserts whenever the mentor explains the science. Two-colour captions land the key word in every line.',
    deliverables: ['6:09 master, 9:16', 'Multi-character dialogue scenes', 'Artery mechanism inserts', 'Week-by-week transformation arc'],
    tools: ['AI image generation', 'AI video generation', 'Character voices', 'Lip-sync', 'Captions', 'Sound design'],
    overview:
      'A long-form AI story ad: a cast of consistent Pixar-style characters, dialogue scenes across a bedroom, a gym and a front porch, and anatomy inserts that explain the mechanism mid-conversation.',
    stats: [
      { k: 'Runtime', v: '6:09' },
      { k: 'Arc', v: '8 weeks' },
      { k: 'Talking heads', v: '0' },
      { k: 'Ratio', v: '9:16' },
    ],
    hook: {
      line: 'Get out of my house!',
      hl: 'my house!',
      window: '0.0 – 9.0s',
      seconds: 9,
      points: [
        { k: 'What it communicates', v: 'Instant conflict — a man walks in on his marriage ending. No context needed to feel it.' },
        { k: 'The curiosity gap', v: 'Who is the other man, and how did it get here? The next five minutes answer both.' },
        { k: 'Why the visual matches', v: 'Groceries in hand, his wife and a younger man in the bedroom — the shot tells the story before the line lands.' },
        { k: 'The first shot', v: 'The husband in the doorway, back to camera: the viewer sees exactly what he sees.' },
        { k: 'No slow intro', v: 'It opens mid-argument. The product doesn’t appear for another five minutes.' },
      ],
    },
    breakdown: [
      { t: 0, at: 2.0, kind: 'aroll', vo: 'Get out of my house!', visual: 'He walks in on his wife and her trainer', edit: 'Cold open mid-scene, no intro' },
      { t: 22, at: 23.1, kind: 'aroll', vo: 'Twenty years I was married to that woman.', visual: 'Alone on the bed with their wedding photo', edit: 'Flashback grade, slow push-in' },
      { t: 88, at: 92.3, kind: 'aroll', vo: 'None of that is age. It’s your arteries.', visual: 'The mentor explains it at the gym', edit: 'Two-shot dialogue, reaction cutaways' },
      { t: 106.5, at: 115.3, kind: 'ai', vo: 'There’s a protein called fibrin that builds up wherever it’s rough.', visual: '3D artery cutaway, layers building on the wall', edit: 'Mechanism insert on every claim' },
      { t: 243.4, at: 276.8, kind: 'aroll', vo: 'Week five, two miles in the morning. Up the stairs without stopping.', visual: 'The comeback — stairs, mirror, the ex-wife returns', edit: 'Week cards carry the progress' },
      { t: 335.3, at: 345.8, kind: 'product', vo: 'It’s called Corbel — 20,000 FU of the NSK-SD strain.', visual: 'Bottle hero, then the product on a store shelf', edit: 'Ingredient card + scarcity close' },
    ],
  }),

  /* ------------------------------------------------------------------ */
  project({
    slug: 'serene-fourteen-days',
    media: { id: 'hooks-02', src: 'ad-02-hook-a.mp4', poster: 2.0 },
    title: 'Fourteen Days',
    kicker: 'Glass-Anatomy Hook Test',
    client: 'Serene Herbs',
    year: 2026,
    runtime: 221,
    format: 'Explainer',
    formatLabel: 'AI Explainer VSL',
    styles: ['Glass anatomy', 'Transformation'],
    production: ['AI visuals', 'Editing', 'Hook variations'],
    platforms: LONG,
    tone: '#7ccf6a',
    summary:
      'A fourteen-day bitters story told through a crystal-glass skeleton, rebuilt in the second person and cut with five openings — so the test measures the angle, not the edit.',
    objective: 'Scale a winning glass-anatomy concept to a new audience and find its strongest opening before spending on the full body.',
    creativeApproach:
      'Five hooks → day-by-day transformation → each “unlike…” line dismantles the cleanse, pill or diet the viewer already tried → herb-by-herb mechanism → offer.',
    editingApproach:
      'A glass skeleton in a sunlit apartment with the build-up visible inside it. Each day moves to a new room, each comparison gets its own beat, and one-word captions keep pace with the voice.',
    deliverables: ['5 hook variations', '1 locked body (≈3:35)', 'Day 1 → 14 arc', 'Comparison beats vs. cleanses, pills and diets'],
    tools: ['AI image generation', 'AI video generation', 'Voiceover', 'Single-word captions', 'Sound design'],
    overview:
      'A hook test on a long-form explainer: five openings that frame the same problem five ways, cut onto one body built around a crystal-glass anatomy character.',
    stats: [
      { k: 'Runtime', v: '3:41' },
      { k: 'Hooks', v: '5' },
      { k: 'Story', v: '14 days' },
      { k: 'Ratio', v: '9:16' },
    ],
    hook: {
      line: 'This is what drops off your body when you take two tablespoons of African bitter herbs every morning.',
      hl: 'two tablespoons',
      window: '0.0 – 6.0s',
      seconds: 6,
      points: [
        { k: 'What it communicates', v: 'A tiny daily action with a visible payoff — and a promise to show exactly what happens.' },
        { k: 'The curiosity gap', v: 'What “drops off”? The viewer needs the next shot to find out.' },
        { k: 'Why the visual matches', v: 'The bitters pour through a glass skeleton and light the gut on “African herbs”.' },
        { k: 'The first shot', v: 'A transparent body with the problem already visible inside it — no explanation needed.' },
        { k: 'No slow intro', v: 'Day one starts at six seconds; the brand isn’t named until the mechanism.' },
      ],
    },
    breakdown: [
      { t: 0, at: 2.0, kind: 'ai', vo: 'This is what drops off your body…', visual: 'Glass skeleton, the bitters lighting up the gut', edit: 'Hook slot — one of five openings' },
      { t: 6, at: 7.0, kind: 'ai', vo: 'Day one, you pour two tablespoons.', visual: 'Kitchen counter, the bottle and a spoon', edit: 'Body starts — day counter on screen' },
      { t: 26.9, at: 55.3, kind: 'ai', vo: 'Day 3. Your stomach rumbles.', visual: 'Inside the gut — the build-up the herbs break through', edit: 'Macro push-in, low rumble SFX' },
      { t: 109, at: 110.5, kind: 'ai', vo: 'Your body has become a fat-burning machine.', visual: 'The skeleton standing tall, light running up the spine', edit: 'Posture and light carry the progress' },
      { t: 174.1, at: 175.5, kind: 'product', vo: 'Soursop Bitters from Serene Herbs — 15 African herbs.', visual: 'Bottle close-up with the herbs', edit: 'Herb-by-herb mechanism recap' },
      { t: 209, at: 218.1, kind: 'product', vo: 'Over 300,000 people… Link below.', visual: 'Three bottles over a map of Africa', edit: 'Offer stack + scarcity close' },
    ],
    hooks: [
      { id: 'A', type: 'Demonstration', line: 'This is what drops off your body when you take two tablespoons of African bitter herbs every morning for two weeks.', dur: 6.0, src: 'ad-02-hook-a.mp4' },
      { id: 'B', type: 'Curiosity', line: 'You already know parasites can make you hold weight. Here is why the cleanse you tried did not flush them.', dur: 4.8, src: 'ad-02-hook-b.mp4' },
      { id: 'C', type: 'Discovery', line: 'You have tried the flushes and the cleanses. Here is the one that actually clears what is making you store fat.', dur: 5.6, src: 'ad-02-hook-c.mp4' },
      { id: 'D', type: 'Problem', line: 'If your last parasite cleanse did nothing, it never got through the build-up they hide behind. This one does.', dur: 5.9, src: 'ad-02-hook-d.mp4' },
      { id: 'E', type: 'Transformation', line: 'This is what your body goes through when you finally flush what has been making you gain weight.', dur: 5.0, src: 'ad-02-hook-e.mp4' },
    ],
  }),

  /* ------------------------------------------------------------------ */
  project({
    slug: 'corvael-the-bodyguard',
    media: { id: 'ad-03', src: 'ad-03.mp4', poster: 0.4 },
    title: 'The Bodyguard',
    kicker: 'Cinematic 3D Story VSL',
    client: 'Corvael',
    year: 2026,
    runtime: 265,
    format: 'Story',
    formatLabel: 'AI Story VSL',
    styles: ['Cinematic 3D', 'Story'],
    production: ['AI visuals', 'Editing'],
    platforms: LONG,
    tone: '#c9a45c',
    summary:
      'A four-minute story told by a bodyguard about the billionaire he protected — the product is introduced as the one habit the most powerful man in the room never skips.',
    objective: 'Sell a premium supplement through aspiration: make the viewer want the habit before they know what it is.',
    creativeApproach:
      'Insider hook → the man who never slows down → the morning ritual → the mechanism, in the boss’s words → the narrator’s own results → the offer.',
    editingApproach:
      'Cinematic 3D scenes — estates, boardrooms, a black car at dawn — cut against macro artery visuals whenever the science lands. Clean sentence-case captions keep the tone premium.',
    deliverables: ['4:25 master, 9:16', 'Narrated story scenes', 'Macro artery and bone inserts', 'Offer + scarcity close'],
    tools: ['AI image generation', 'AI video generation', 'Voiceover', 'Captions', 'Sound design'],
    overview:
      'A narrated AI story ad: a consistent cast of two, luxury environments that sell the aspiration, and macro anatomy inserts that make an invisible mechanism concrete.',
    stats: [
      { k: 'Runtime', v: '4:25' },
      { k: 'Voice', v: '1st person' },
      { k: 'Leads', v: '2' },
      { k: 'Ratio', v: '9:16' },
    ],
    hook: {
      line: 'I protected athletes, celebrities and politicians — but the most imposing man I ever worked for was a 61-year-old billionaire.',
      hl: 'billionaire',
      window: '0.0 – 11.8s',
      seconds: 11.8,
      points: [
        { k: 'What it communicates', v: 'Access. The narrator has stood next to the most powerful people in the country — and he’s about to tell you what he saw.' },
        { k: 'The curiosity gap', v: 'Why would a 61-year-old be the most imposing man he ever guarded? The answer is the product.' },
        { k: 'Why the visual matches', v: 'A security detail through a cheering crowd, then marble halls and a man in a suit — status in every frame.' },
        { k: 'The first shot', v: 'The narrator escorting an athlete past the fans: instant scale, instant stakes.' },
        { k: 'No slow intro', v: 'No doctor, no ingredients, no brand. The story does the selling for the first two minutes.' },
      ],
    },
    breakdown: [
      { t: 0, at: 0.4, kind: 'aroll', vo: 'I protected athletes, celebrities and politicians…', visual: 'The narrator escorting an athlete through a crowd', edit: 'Cold open on scale and status' },
      { t: 11.8, at: 16.5, kind: 'aroll', vo: 'Every morning before coffee he did one thing.', visual: 'The billionaire at his marble counter, capsules and coffee', edit: 'Slow push-ins sell the aspiration' },
      { t: 61.5, at: 66.1, kind: 'aroll', vo: 'Marcus, come here. Let me save you ten years of mistakes.', visual: 'The boss calls him over by the car', edit: 'Dialogue two-shot — the mentor beat' },
      { t: 89.9, at: 104.6, kind: 'ai', vo: 'Your blood sugar runs high all day and that roughens the inside of the artery.', visual: 'Macro artery wall, fibrin layering', edit: 'Mechanism inserts cut on each claim' },
      { t: 148.5, at: 181.8, kind: 'aroll', vo: 'Within a week, my hands… I actually wanted to train again.', visual: 'The narrator’s own results, at home and at work', edit: 'Personal proof, beat by beat' },
      { t: 199.2, at: 203.8, kind: 'product', vo: 'He told me the exact formula was called Corvael.', visual: 'Bottle hero, then the checkout on a phone', edit: 'Product card + offer stack' },
    ],
  }),

  /* ------------------------------------------------------------------ */
  project({
    slug: 'serene-cortisol-loop',
    media: { id: 'hooks-03', src: 'ad-03-hook-a.mp4', poster: 0.4 },
    title: 'The Cortisol Loop',
    kicker: 'Dark-Fantasy Hook Test',
    client: 'Serene Herbs',
    year: 2026,
    runtime: 289,
    format: 'Explainer',
    formatLabel: 'AI Explainer VSL',
    styles: ['Cinematic 3D', 'Mechanism'],
    production: ['AI visuals', 'Editing', 'Hook variations'],
    platforms: LONG,
    tone: '#d4553a',
    summary:
      'A three-product bundle sold through one unforgettable character — a figure in a torch-lit crypt whose body shows what years of processed food have done — tested with five openings.',
    objective: 'Explain why a bundle beats a single product, and find the opening that makes a long, mechanism-heavy script worth watching.',
    creativeApproach:
      'Five hooks → the cortisol chain reaction → what it costs over decades → a three-step protocol, one product per job → the timeline of results → offer.',
    editingApproach:
      'A dark, stylised world keeps a familiar message from feeling familiar. Organs glow on the words that name them, each product gets its own table-top reveal, and the grade warms as the protocol takes effect.',
    deliverables: ['5 hook variations', '1 locked body (≈4:40)', 'Three-product protocol sequence', 'Bundle offer close'],
    tools: ['AI image generation', 'AI video generation', 'Voiceover', 'Captions', 'Sound design'],
    overview:
      'A hook test for a bundle offer: five openings on one long body, built around a single stylised character whose glowing anatomy carries the whole mechanism.',
    stats: [
      { k: 'Runtime', v: '4:49' },
      { k: 'Hooks', v: '5' },
      { k: 'Products', v: '3' },
      { k: 'Ratio', v: '9:16' },
    ],
    hook: {
      line: 'The reason your belly won’t shift isn’t your diet — it’s a cortisol chain reaction.',
      hl: 'cortisol chain reaction',
      window: '0.0 – 9.5s',
      seconds: 9.5,
      points: [
        { k: 'What it communicates', v: 'It’s not your fault — and there’s a specific, nameable reason.' },
        { k: 'The curiosity gap', v: '“Chain reaction” implies a sequence. The viewer stays to learn what sets it off.' },
        { k: 'Why the visual matches', v: 'A gaunt figure clutches his stomach under a shaft of light — the problem made physical.' },
        { k: 'The first shot', v: 'A torch-lit crypt, skeletons at the tables: nothing else in the feed looks like this.' },
        { k: 'No slow intro', v: 'The reframe is the first sentence. The products don’t appear for almost two minutes.' },
      ],
    },
    breakdown: [
      { t: 0, at: 0.4, kind: 'ai', vo: 'The reason your belly won’t shift isn’t your diet…', visual: 'The figure in the crypt, clutching his stomach', edit: 'Hook slot — one of five openings' },
      { t: 9.5, at: 12.0, kind: 'ai', vo: 'If you eat processed food regularly and your belly looks like this…', visual: 'A table heaped with fast food', edit: 'Body starts — the call-out' },
      { t: 29.2, at: 39.7, kind: 'ai', vo: 'Your body dumps cortisol into your bloodstream 24 hours a day.', visual: 'Glowing organs inside the figure', edit: 'Anatomy lights on the named organ' },
      { t: 116.8, at: 120.0, kind: 'product', vo: 'Step one is Nervous Balance drops — two droppers under your tongue.', visual: 'The three bottles on a carved wooden table', edit: 'One product, one job, one reveal' },
      { t: 150, at: 150.0, kind: 'ai', vo: 'Two capsules with lunch.', visual: 'The figure eating a real meal, skeletons behind', edit: 'Ritual shots between the claims' },
      { t: 247.2, at: 286.4, kind: 'product', vo: 'Every three-step reset comes with the full Soursop Bitters bottle free.', visual: 'The figure in daylight, restored', edit: 'Warm grade for the payoff, offer stack' },
    ],
    hooks: [
      { id: 'A', type: 'Contrarian', line: 'The reason your belly won’t shift isn’t your diet — it’s a cortisol chain reaction American food has been running on you for years.', dur: 9.5, src: 'ad-03-hook-a.mp4' },
      { id: 'B', type: 'Problem', line: 'Every drive-through meal, every snack aisle run, every frozen dinner has been quietly locking fat onto your midsection.', dur: 10.0, src: 'ad-03-hook-b.mp4' },
      { id: 'C', type: 'Warning', line: 'Every man and woman over 40 who lives on modern American food needs to hear what it’s been doing to their cortisol.', dur: 10.0, src: 'ad-03-hook-c.mp4' },
      { id: 'D', type: 'Demonstration', line: 'This is what decades of processed food do to a body from the inside — and exactly what reverses it.', dur: 9.2, src: 'ad-03-hook-d.mp4' },
      { id: 'E', type: 'Question', line: 'If your belly won’t shift no matter what you do, this is the cortisol chain reaction behind it.', dur: 9.7, src: 'ad-03-hook-e.mp4' },
    ],
  }),

  /* ------------------------------------------------------------------ */
  project({
    slug: 'serene-the-reunion',
    media: { id: 'hooks-04', src: 'ad-04-hook-a.mp4', poster: 2.0 },
    title: 'The Reunion',
    kicker: 'Pixar-Style Story Hook Test',
    client: 'Serene Herbs',
    year: 2026,
    runtime: 305,
    format: 'Story',
    formatLabel: 'AI Story VSL',
    styles: ['Pixar-style 3D', 'Story'],
    production: ['AI visuals', 'Editing', 'Hook variations'],
    platforms: LONG,
    tone: '#3fb87f',
    summary:
      'A five-minute animated confession — a woman dreading her high-school reunion — that makes a bitters supplement the turning point of her story. Five openings, one locked body.',
    objective:
      'Reach women with an emotional first-person story instead of a claims-led ad, and find which version of her first line earns the next five minutes.',
    creativeApproach:
      'Five hooks → the dread and the diets that failed → the facialist who explains the gut → two tablespoons a day → the reunion night → offer.',
    editingApproach:
      'Pixar-style scenes that play like a short film — closet, bathroom, spa, party — with a thought-bubble flashback, a grade that warms as she heals, and two-tone word captions.',
    deliverables: ['5 hook variations', '1 locked body (≈5 min)', 'Story arc: dread → reunion night', 'Offer + guarantee close'],
    tools: ['AI image generation', 'AI video generation', 'Character voice', 'Captions', 'Sound design'],
    overview:
      'A hook test on a long-form story ad: one consistent character across more than a dozen scenes, and five first lines that each frame her fear a different way.',
    stats: [
      { k: 'Runtime', v: '5:05' },
      { k: 'Hooks', v: '5' },
      { k: 'Arc', v: '6 weeks' },
      { k: 'Ratio', v: '9:16' },
    ],
    hook: {
      line: 'My high school reunion was six weeks out, and I cried trying on every single thing in my closet.',
      hl: 'reunion',
      window: '0.0 – 7.0s',
      seconds: 7,
      points: [
        { k: 'What it communicates', v: 'A deadline and a feeling everyone knows — the dread of being seen after years.' },
        { k: 'The curiosity gap', v: 'Six weeks out: will she go, and what changes? The viewer signs up for the whole arc.' },
        { k: 'Why the visual matches', v: 'Clothes piled on the closet floor, a top held up and put back — the line is happening on screen.' },
        { k: 'The first shot', v: 'A close, warm, animated face in tears: emotion first, product nowhere.' },
        { k: 'No slow intro', v: 'It starts mid-confession. The bitters don’t appear until the two-minute mark.' },
      ],
    },
    breakdown: [
      { t: 0, at: 2.0, kind: 'aroll', vo: 'My high school reunion was six weeks out and I cried…', visual: 'Trying on everything in her closet', edit: 'Hook slot — one of five openings' },
      { t: 7, at: 19.0, kind: 'aroll', vo: 'I didn’t wanna walk in and have everyone see me like this.', visual: 'A thought-bubble memory of her old classmates', edit: 'Body starts — flashback cutaway' },
      { t: 31.4, at: 31.7, kind: 'aroll', vo: 'It’s not like I wasn’t trying — I cut out bread, I cut out dairy.', visual: 'Salad in the kitchen, the scale that won’t move', edit: 'Montage of the diets that failed' },
      { t: 78.9, at: 95.2, kind: 'ai', vo: 'When your gut slows down, the waste backs up and hardens on the walls.', visual: 'The facialist explains it with a glowing gut model', edit: 'Mechanism told by a character, not a narrator' },
      { t: 144, at: 146.0, kind: 'product', vo: 'Two tablespoons in the morning — I figured I had nothing to lose.', visual: 'The first spoonful of Soursop Bitters', edit: 'The product enters as part of the story' },
      { t: 221, at: 234.9, kind: 'aroll', vo: 'The night of the reunion I put on the dress I’d been too scared to wear.', visual: 'The green dress, heads turning at the party', edit: 'Warm grade, the music lifts for the payoff' },
    ],
    hooks: [
      { id: 'A', type: 'Story', line: 'My high school reunion was six weeks out, and I cried trying on every single thing in my closet.', dur: 7.0, src: 'ad-04-hook-a.mp4' },
      { id: 'B', type: 'Problem', line: 'The reunion was six weeks out, and I couldn’t find one thing in my closet that fit right.', dur: 6.5, src: 'ad-04-hook-b.mp4' },
      { id: 'C', type: 'Curiosity', line: 'My 20-year reunion was coming up, and I’d already started making excuses not to go.', dur: 6.8, src: 'ad-04-hook-c.mp4' },
      { id: 'D', type: 'Pattern-Interrupt', line: 'My 20-year reunion was six weeks away, and the thought of walking in made me sick.', dur: 7.4, src: 'ad-04-hook-d.mp4' },
      { id: 'E', type: 'Transformation', line: 'I used to be the pretty one in school. Now my reunion was coming, and I was terrified.', dur: 10.5, src: 'ad-04-hook-e.mp4' },
    ],
  }),

  /* ------------------------------------------------------------------ */
  project({
    slug: 'corvael-wrong-fire',
    media: { id: 'hooks-05', src: 'ad-05-hook-1.mp4', poster: 0.4 },
    title: 'The Wrong Fire',
    kicker: 'Pixar-Style Hook Test',
    client: 'Corvael',
    year: 2026,
    runtime: 92,
    format: 'Story',
    formatLabel: 'AI Story Ad',
    styles: ['Pixar-style 3D', 'Story'],
    production: ['AI visuals', 'Editing', 'Hook variations'],
    platforms: ['Meta', 'Reels'],
    tone: '#ff7a3d',
    summary:
      'A ninety-second animated story ad for a nattokinase supplement, delivered as a five-hook test — from reverse psychology to a flat contrarian claim — on one shared body.',
    objective: 'Find the strongest reason for a heart-health buyer to stop scrolling, in a format short enough to test fast.',
    creativeApproach:
      'Five hooks → what his doctor and his wife noticed → the mechanism in one sentence → the ritual, two capsules a day → sale and guarantee.',
    editingApproach:
      'A bright Pixar-style world — kitchen, pharmacy, sunny street — with one clean explainer shot of the artery wall. Boxed two-line captions keep every hook legible with the sound off.',
    deliverables: ['5 hook variations', '1 locked body (≈85s)', 'Artery explainer insert', 'Sale + guarantee close'],
    tools: ['AI image generation', 'AI video generation', 'Voiceover', 'Captions', 'Sound design'],
    overview:
      'A short-form hook test: five openings — pattern interrupt, problem, story, curiosity and contrarian — each landing on the same Pixar-style body, so the only variable is the first line.',
    stats: [
      { k: 'Runtime', v: '1:32' },
      { k: 'Hooks', v: '5' },
      { k: 'Body', v: '1 locked' },
      { k: 'Ratio', v: '9:16' },
    ],
    hook: {
      line: 'Do not buy Corvael nattokinase if you like your calcium score going up.',
      hl: 'Do not buy',
      window: '0.0 – 6.6s',
      seconds: 6.6,
      points: [
        { k: 'What it communicates', v: 'Reverse psychology — the ad tells you not to buy, which is the fastest way to make you listen.' },
        { k: 'The curiosity gap', v: 'Who would want their calcium score going up? The contradiction demands the next line.' },
        { k: 'Why the visual matches', v: 'The bottle pushed toward the lens, then a hand held up: “don’t”.' },
        { k: 'The first shot', v: 'The product itself, label to camera, in frame one.' },
        { k: 'No slow intro', v: 'The brand name is the third word. There is nothing to wait for.' },
      ],
    },
    breakdown: [
      { t: 0, at: 0.4, kind: 'product', vo: 'Do not buy Corvael nattokinase…', visual: 'The bottle pushed toward the lens', edit: 'Hook slot — one of five openings' },
      { t: 6.6, at: 12.0, kind: 'aroll', vo: 'They told him it was gonna help his arteries — but not what his wife would say.', visual: 'At the pharmacy counter, bottle in hand', edit: 'Body starts — the story beat' },
      { t: 21, at: 23.0, kind: 'aroll', vo: 'His doctor looked at the chart one morning and said, what have you changed?', visual: 'The doctor reading his results', edit: 'Proof told as a scene' },
      { t: 43, at: 46.1, kind: 'ai', vo: 'The nattokinase gets into his arteries and breaks down the fibrin.', visual: 'Light running through his chest and arteries', edit: 'One mechanism shot, one sentence' },
      { t: 61.2, at: 69.1, kind: 'aroll', vo: 'Keep cutting the salt and walking the dog — he’ll be taking his two capsules a day.', visual: 'Split screen: out in the rain vs. two capsules at home', edit: 'Contrast split for the payoff' },
      { t: 71.8, at: 89.2, kind: 'product', vo: 'They’re doing a huge sale right now — up to 71% off.', visual: 'Holding a three-pack with the 71% off badge', edit: 'Sale badge + guarantee close' },
    ],
    hooks: [
      { id: 'A', type: 'Pattern-Interrupt', line: 'Do not buy Corvael nattokinase if you like your calcium score going up.', dur: 6.6, src: 'ad-05-hook-1.mp4' },
      { id: 'B', type: 'Problem', line: 'If you’ve cut the salt for six years and the number still went up — you don’t lack discipline.', dur: 6.9, src: 'ad-05-hook-b.mp4' },
      { id: 'C', type: 'Story', line: 'For years, they told him to walk more to fix his arteries. But you can’t walk off what’s in the wall.', dur: 7.5, src: 'ad-05-hook-c.mp4' },
      { id: 'D', type: 'Curiosity', line: 'Problem one: cholesterol pills don’t work on plaque that isn’t in your blood. Here’s why.', dur: 7.6, src: 'ad-05-hook-d.mp4' },
      { id: 'E', type: 'Contrarian', line: 'Stop cutting the salt for a problem that’s built into the artery wall. You’re fighting the wrong fire.', dur: 9.0, src: 'ad-05-hook-e.mp4' },
    ],
  }),

  /* ------------------------------------------------------------------ */
  project({
    slug: 'serene-two-tablespoons',
    media: { id: 'ad-01', src: 'ad-01.mp4', poster: 2.0 },
    title: 'Two Tablespoons',
    kicker: 'Glass-Anatomy Explainer',
    client: 'Serene Herbs',
    year: 2026,
    runtime: 153,
    format: 'Explainer',
    formatLabel: 'AI Explainer VSL',
    styles: ['Glass anatomy', 'Transformation'],
    production: ['AI visuals', 'Editing'],
    platforms: LONG,
    tone: '#f08a3c',
    summary:
      'A two-and-a-half-minute explainer told through a see-through glass skeleton — every line of the voiceover becomes something you can watch happen inside the body.',
    objective: 'Make an invisible gut problem visible, and hold attention through a long direct-response script without a single talking head.',
    creativeApproach:
      'Transformation hook → day-by-day progression (1 → 3 → 5 → 7 → 10 → 14) → the mechanism, herb by herb → offer and scarcity close.',
    editingApproach:
      'One transparent character carries the whole ad. Each day is a new room and a new action, the gut lights up on the words that matter, and single-word captions keep pace with the voice.',
    deliverables: ['2:33 master, 9:16', 'Day 1 → 14 story arc', 'Herb-by-herb mechanism sequence', 'Offer + CTA close'],
    tools: ['AI image generation', 'AI video generation', 'Voiceover', 'Single-word captions', 'Sound design'],
    overview:
      'A long-form AI explainer: one consistent glass-anatomy character, a fourteen-day story told room by room, and an X-ray view that turns every line of the voiceover into a visual.',
    stats: [
      { k: 'Runtime', v: '2:33' },
      { k: 'Story', v: '14 days' },
      { k: 'Talking heads', v: '0' },
      { k: 'Ratio', v: '9:16' },
    ],
    hook: {
      line: 'This is what drops off a man’s body when he takes two tablespoons of African bitter herbs every morning.',
      hl: 'two tablespoons',
      window: '0.0 – 6.3s',
      seconds: 6.3,
      points: [
        { k: 'What it communicates', v: 'A specific ritual with a visible result — two tablespoons, every morning, and something drops off.' },
        { k: 'The curiosity gap', v: '“What drops off?” The line promises to show it, so the viewer stays to see it.' },
        { k: 'Why the visual matches', v: 'A glass skeleton at the kitchen counter, the build-up in his gut already glowing — the problem is on screen before it’s named.' },
        { k: 'The first shot', v: 'The transparent body fills the frame from frame one: this ad is about what happens inside.' },
        { k: 'No slow intro', v: 'No brand, no greeting — the first word is the hook and the bottle is already on the counter.' },
      ],
    },
    breakdown: [
      { t: 0, at: 2.0, kind: 'ai', vo: 'This is what drops off a man’s body…', visual: 'Glass skeleton at the counter, gut glowing', edit: 'Cold open on the result — no intro' },
      { t: 6.3, at: 9.5, kind: 'ai', vo: 'Day one. He pours two tablespoons.', visual: 'Spoon to mouth, the bottle in frame', edit: 'Day counter starts; one word per caption' },
      { t: 20.5, at: 22.3, kind: 'ai', vo: 'Day three, his stomach rumbles.', visual: 'X-ray cutaway — the herbs breaking through the build-up', edit: 'Anatomy glow timed to the line' },
      { t: 52, at: 60.4, kind: 'ai', vo: 'Day 7. In the mirror, the puffiness is gone.', visual: 'The mirror check, then the jeans button', edit: 'Progress carried by posture and wardrobe' },
      { t: 117.5, at: 117.7, kind: 'product', vo: 'Soursop Bitters from Serene Herbs — 15 African herbs.', visual: 'Bottle hero with the ingredient callouts', edit: 'Mechanism recap, one herb per beat' },
      { t: 145.8, at: 149.5, kind: 'product', vo: 'Over 500,000 people. Free shipping. Link below.', visual: 'The skeleton on the savanna, bottle in hand', edit: 'Offer stack, then a scarcity close' },
    ],
  }),

  /* ------------------------------------------------------------------ */
  project({
    slug: 'cleantra-tight-ring',
    media: { id: 'ad-05', src: 'ad-05.mp4', poster: 1.2 },
    title: 'The Tight Ring',
    kicker: 'Talking-Object Mascot Ad',
    client: 'Cleantra',
    year: 2026,
    runtime: 59,
    format: 'Mascot',
    formatLabel: 'AI Mascot Ad',
    styles: ['Pixar-style 3D', 'Talking objects'],
    production: ['AI visuals', 'Editing'],
    platforms: SHORT,
    tone: '#f2b544',
    summary:
      'A one-minute ad where the objects do the talking — a wedding ring, a water pill and a compression stocking each admit why they failed, until the product introduces itself.',
    objective: 'Explain lymphatic swelling — an invisible, unglamorous problem — in under a minute, and make it memorable enough to rewatch.',
    creativeApproach:
      'The ring names the symptom → the water pill and the stocking admit what they can’t do → the product answers both → the herbs, one per job → proof and guarantee.',
    editingApproach:
      'Every character gets one line and one reveal. Cuts land on each “Hi, I’m…”, the herbs are characters too, and a golden swirl ties the product world together.',
    deliverables: ['0:59 master, 9:16', 'Four talking-object characters', 'Herb-character mechanism sequence', 'Tested + guarantee end card'],
    tools: ['AI image generation', 'AI video generation', 'Character voices', 'Lip-sync', 'Captions', 'Sound design'],
    overview:
      'A short-form mascot ad: four consistent talking-object characters, a comparison structure that dismisses the alternatives in their own voices, and a product that arrives as the hero of the story.',
    stats: [
      { k: 'Runtime', v: '0:59' },
      { k: 'Characters', v: '4' },
      { k: 'Hook', v: '0–7s' },
      { k: 'Ratio', v: '9:16' },
    ],
    hook: {
      line: 'Hi, I’m your wedding ring. I used to slide right over your finger — now by evening you can barely get me off.',
      hl: 'wedding ring',
      window: '0.0 – 7.4s',
      seconds: 7.4,
      points: [
        { k: 'What it communicates', v: 'A symptom the viewer can check on their own hand, right now.' },
        { k: 'The curiosity gap', v: '“You haven’t gained weight” — so what is it? The answer is the product’s reason to exist.' },
        { k: 'Why the visual matches', v: 'A ring with a face, straining around a swollen finger — the problem is the character.' },
        { k: 'The first shot', v: 'A macro of a golden ring that talks: impossible to scroll past.' },
        { k: 'No slow intro', v: 'The object introduces itself in the first line; the diagnosis lands by 5.9s.' },
      ],
    },
    breakdown: [
      { t: 0, at: 1.2, kind: 'ai', vo: 'Hi, I’m your wedding ring. I used to slide right over your finger.', visual: 'A talking gold ring on a swollen finger', edit: 'Cold open on the character' },
      { t: 7.4, at: 8.6, kind: 'ai', vo: 'Hi, I’m the water pill. All I do is make you run to the bathroom.', visual: 'A pill character in the bathroom', edit: 'Each object gets one line, one cut' },
      { t: 12.5, at: 13.5, kind: 'ai', vo: 'But the protein sludge clogging your lymphatic vessel stays right where it is.', visual: 'Inside the vessel — the sludge the pill can’t reach', edit: 'Cutaway into the body on “sludge”' },
      { t: 18.7, at: 20.9, kind: 'ai', vo: 'Hi, I’m the compression stocking. I only squeeze from the outside.', visual: 'A worried stocking character on a leg', edit: 'Comparison beat — the third alternative' },
      { t: 28, at: 30.7, kind: 'product', vo: 'Hi, I’m Cleantra. From the inside, my herbs clear the build-up.', visual: 'The bottle and its herb characters in a golden swirl', edit: 'The product enters as a character' },
      { t: 54.8, at: 57.8, kind: 'product', vo: 'Third-party tested, 90-day guarantee, link below.', visual: 'The bottle with the lab-tested and 90-day badges', edit: 'Trust badges + CTA' },
    ],
  }),

  /* ------------------------------------------------------------------ */
  project({
    slug: 'serene-the-snap',
    media: { id: 'ad-06', src: 'ad-06.mp4', poster: 3.9, live: true },
    title: 'The Snap',
    kicker: 'Creator-Led Explainer',
    client: 'Serene Herbs',
    year: 2026,
    runtime: 62,
    format: 'Creator-led',
    formatLabel: 'Creator-Led Ad',
    styles: ['Live footage', 'Mechanism'],
    production: ['Editing'],
    platforms: SHORT,
    tone: '#9b7bff',
    summary:
      'A one-minute creator-led explainer that reframes snapping at the end of the day as a mechanical problem — the creator talks over a relentless run of B-roll that shows every input he names.',
    objective: 'Make an everyday frustration feel explained rather than judged, and introduce a calming product without sounding like a supplement ad.',
    creativeApproach:
      'Confession hook → the mechanical reframe → a normal day, input by input → why an early night won’t fix it → the drops → the evening you get back.',
    editingApproach:
      'The creator sits in the corner of the frame while full-screen B-roll changes on almost every phrase — alarm, traffic, notifications, a spilled cup — with keyword captions and one neuron shot for the mechanism.',
    deliverables: ['1:02 master, 9:16', 'Creator composite over B-roll', 'Everyday-trigger B-roll sequence', 'Link-below CTA'],
    tools: ['Creator A-roll', 'Stock + UGC B-roll', 'Compositing', 'Captions', 'Sound design'],
    overview:
      'A creator-led direct-response ad: one voice, one framing, and a fast B-roll run that turns every line of the script into a picture of the day it describes.',
    stats: [
      { k: 'Runtime', v: '1:02' },
      { k: 'A-roll', v: 'Creator' },
      { k: 'B-roll', v: '1 shot / line' },
      { k: 'Ratio', v: '9:16' },
    ],
    hook: {
      line: 'I used to snap at the end of every day and blame myself for it. It turned out to be a lot more mechanical than that.',
      hl: 'mechanical',
      window: '0.0 – 5.4s',
      seconds: 5.4,
      points: [
        { k: 'What it communicates', v: 'A private habit said out loud — and an immediate promise that it isn’t a character flaw.' },
        { k: 'The curiosity gap', v: '“More mechanical than that” — what mechanism? The viewer stays for the explanation.' },
        { k: 'Why the visual matches', v: 'The creator at home at the end of the day, then straight to camera — a real person, a real evening.' },
        { k: 'The first shot', v: 'A home kitchen after dark, with the creator already in frame.' },
        { k: 'No slow intro', v: 'No name, no product, no greeting. The confession is the first sentence.' },
      ],
    },
    breakdown: [
      { t: 0, at: 1.3, kind: 'aroll', vo: 'I used to snap at the end of every day and blame myself for it.', visual: 'The creator at home at the end of the day', edit: 'Cold open on the confession' },
      { t: 5.4, at: 6.5, kind: 'broll', vo: 'Think about a normal day. Alarm, phone, traffic, work, notifications, noise.', visual: 'One trigger per shot — alarm clock, speaker, laptop', edit: 'A cut on every noun' },
      { t: 20.3, at: 22.0, kind: 'broll', vo: 'The spilled cup, a millionth question — there’s no space left.', visual: 'Coffee boiling over on the stove', edit: 'The breaking point, in B-roll' },
      { t: 31.4, at: 32.4, kind: 'ai', vo: 'It’s a nervous system that never got to downshift all day.', visual: 'A glowing neuron firing', edit: 'One mechanism visual, then back to life' },
      { t: 40.1, at: 40.2, kind: 'product', vo: 'That’s what Nervous Balance drops are for.', visual: 'The bottle held up outdoors', edit: 'Product reveal on the line' },
      { t: 56.4, at: 58.3, kind: 'broll', vo: 'Reach the end of the day with something left for the people you care about.', visual: 'A family together on the front steps', edit: 'Emotional payoff, link-below CTA' },
    ],
  }),

  /* ------------------------------------------------------------------ */
  project({
    slug: 'corvael-cold-hands',
    media: { id: 'ad-07', src: 'ad-07.mp4', poster: 1.9 },
    title: 'Cold Hands',
    kicker: 'Pixar-Style Future-Pacing Ad',
    client: 'Corvael',
    year: 2026,
    runtime: 89,
    format: 'Story',
    formatLabel: 'AI Story Ad',
    styles: ['Pixar-style 3D', 'Transformation'],
    production: ['AI visuals', 'Editing'],
    platforms: ['Meta', 'Reels'],
    tone: '#ff9a52',
    summary:
      'A ninety-second “if he takes it” ad — every line future-paces one small, specific win, and every win gets its own golden-hour scene.',
    objective: 'Sell a heart-health supplement through relatable everyday improvements rather than numbers and warnings.',
    creativeApproach:
      'Future-pacing hook → week-by-week wins: warm hands, the stairs, the shopping, bedtime → the mechanism → how to spot a weak brand → product and guarantee.',
    editingApproach:
      'One Pixar-style character in autumn light, a new location for every win, a glowing artery reveal for the mechanism, and a buyer’s-guide sequence that makes the shelf brands the villain.',
    deliverables: ['1:29 master, 9:16', 'Future-pacing scene set', 'Mechanism + buyer’s-guide sequence', 'Guarantee + scarcity close'],
    tools: ['AI image generation', 'AI video generation', 'Voiceover', 'Captions', 'Sound design'],
    overview:
      'A short-form AI story ad built on future pacing: one consistent character, a scene for every small win, and a comparison beat that makes the product the obvious choice.',
    stats: [
      { k: 'Runtime', v: '1:29' },
      { k: 'Wins shown', v: '6' },
      { k: 'Structure', v: 'If → then' },
      { k: 'Ratio', v: '9:16' },
    ],
    hook: {
      line: 'If a man with cold hands takes nattokinase for three weeks, his hands warm up — and the ache in his legs finally starts to fade.',
      hl: 'cold hands',
      window: '0.0 – 10.0s',
      seconds: 10,
      points: [
        { k: 'What it communicates', v: 'A cause and an effect stated as a rule: take this, and this specific thing happens.' },
        { k: 'The curiosity gap', v: 'Most men have never connected cold hands to their arteries. The ad makes the link.' },
        { k: 'Why the visual matches', v: 'Warm light glows through his hands on a park bench, exactly on “warm up”.' },
        { k: 'The first shot', v: 'A smiling, grey-haired man at a café table — the audience, reflected back.' },
        { k: 'No slow intro', v: '“If a man with cold hands…” — the viewer self-selects in the first five words.' },
      ],
    },
    breakdown: [
      { t: 0, at: 1.9, kind: 'aroll', vo: 'If a man with cold hands takes nattokinase for three weeks…', visual: 'A grey-haired man at a café table', edit: 'Future-pacing hook — the audience self-selects' },
      { t: 5, at: 5.6, kind: 'ai', vo: 'His hands warm up, and the ache in his legs finally starts to fade.', visual: 'Warm light glowing through his hands on a park bench', edit: 'The effect drawn on the exact word' },
      { t: 10, at: 13.0, kind: 'aroll', vo: 'He stops stopping halfway up his own stairs.', visual: 'Climbing the stairs at home without a pause', edit: 'One win, one location' },
      { t: 30.2, at: 31.5, kind: 'ai', vo: 'The nattokinase gets into the artery wall and breaks down the fibrin underneath.', visual: 'Capsules dissolving into a glowing artery wall', edit: 'Macro mechanism, then back to the story' },
      { t: 47.9, at: 53.7, kind: 'broll', vo: 'Most of what’s on the shelf is 2,000 FU spread across three capsules.', visual: 'A laptop comparing weak shelf brands', edit: 'Buyer’s-guide beat — the competition as the villain' },
      { t: 76, at: 79.6, kind: 'product', vo: 'If you don’t like it for any reason, you get all your money back within 60 days.', visual: 'The bottle inside a golden guarantee badge', edit: 'Guarantee graphic + sold-out scarcity' },
    ],
  }),

  /* ------------------------------------------------------------------ */
  project({
    slug: 'corbel-the-mirror',
    media: { id: 'ad-08', src: 'ad-08.mp4', poster: 2.3 },
    title: 'The Mirror',
    kicker: 'Photoreal AI Transformation Ad',
    client: 'Corbel',
    year: 2026,
    runtime: 111,
    format: 'Story',
    formatLabel: 'AI Story Ad',
    styles: ['Photoreal AI', 'Transformation'],
    production: ['AI visuals', 'Editing'],
    platforms: ['Meta', 'Reels'],
    tone: '#e5484d',
    summary:
      'A photoreal AI ad that swaps numbers for things a man can see — the puffiness in his face, the notch on his belt, the line on his ankle — and ties all three to one cause.',
    objective: 'Make an internal mechanism feel physical by starting from symptoms the viewer can check in their own mirror.',
    creativeApproach:
      'Three-week hook → face, belt, ankles, afternoon energy → the mirror moment → the mechanism: fibrin in the wall → same cause, same fix → proof you can check yourself.',
    editingApproach:
      'Photoreal AI performances in a real-feeling home, split screens for the before-and-after moments, and macro vessel shots for the explanation. Bold uppercase captions keep the list of wins punchy.',
    deliverables: ['1:51 master, 9:16', 'Photoreal character scenes', 'Split-screen transformation beats', 'Macro vessel mechanism sequence'],
    tools: ['AI image generation', 'AI video generation', 'Voiceover', 'Captions', 'Sound design'],
    overview:
      'A photoreal AI transformation ad: one consistent middle-aged character, symptom-by-symptom proof shots, and a mechanism sequence that connects them all to a single cause.',
    stats: [
      { k: 'Runtime', v: '1:51' },
      { k: 'Symptoms', v: '4' },
      { k: 'Style', v: 'Photoreal' },
      { k: 'Ratio', v: '9:16' },
    ],
    hook: {
      line: 'If a man over fifty takes twenty thousand FU of nattokinase for three weeks, the puffiness in his face goes down.',
      hl: 'puffiness',
      window: '0.0 – 9.8s',
      seconds: 9.8,
      points: [
        { k: 'What it communicates', v: 'A precise dose, a precise timeframe, and a result he can see in the mirror.' },
        { k: 'The curiosity gap', v: 'Why would a heart supplement change his face? The next minute answers it.' },
        { k: 'Why the visual matches', v: 'He studies his puffy face in the bathroom mirror, glass of water in hand.' },
        { k: 'The first shot', v: 'A photoreal man at the mirror — so real it reads like UGC.' },
        { k: 'No slow intro', v: 'The dose and the promise are both in the first sentence.' },
      ],
    },
    breakdown: [
      { t: 0, at: 2.3, kind: 'aroll', vo: 'If a man over fifty takes twenty thousand FU of nattokinase for three weeks…', visual: 'Checking his face in the bathroom mirror', edit: 'Photoreal cold open, the dose in line one' },
      { t: 14.6, at: 16.1, kind: 'aroll', vo: 'Three weeks in and his belt goes back a notch.', visual: 'Tightening his belt in front of the mirror', edit: 'One symptom per beat, uppercase captions' },
      { t: 22, at: 29.9, kind: 'aroll', vo: 'He pulls his socks off at night and there’s no line on the ankle.', visual: 'Socks off on the sofa, the ankle lit warm', edit: 'Close-up on the proof point' },
      { t: 45, at: 48.3, kind: 'aroll', vo: 'He looks in the mirror and recognises the man looking back at him.', visual: 'Face to face with his reflection, smiling', edit: 'The emotional turn, held a beat longer' },
      { t: 56.6, at: 57.5, kind: 'ai', vo: 'There’s a protein called fibrin building up inside your artery wall.', visual: 'Macro vessel wall, fibrin and trapped cells', edit: 'Mechanism in macro, cut on each clause' },
      { t: 96, at: 103.5, kind: 'product', vo: 'Send the empty bottles back and you get every dollar.', visual: 'Behind a row of bottles with the 30-day badge', edit: 'Guarantee close + stock check' },
    ],
  }),

  /* ------------------------------------------------------------------ */
  project({
    slug: 'bark-brush-forever',
    media: { id: 'ad-09', src: 'ad-09.mp4', poster: 8.1, live: true },
    title: 'A Forever Place',
    kicker: 'UGC Product Ad',
    client: 'Bark & Brush',
    year: 2026,
    runtime: 30,
    format: 'UGC',
    formatLabel: 'UGC Ad',
    styles: ['Live footage', 'Emotional'],
    production: ['Editing'],
    platforms: SHORT,
    tone: '#e8b77e',
    summary:
      'A thirty-second UGC ad for custom pet portraits that sells a feeling, not a frame — real dogs, real homes and real unboxings, cut to a warm, story-first voiceover.',
    objective: 'Turn a gift product into an emotional purchase in thirty seconds, for cold audiences on Meta and TikTok.',
    creativeApproach:
      'Reframe hook (“not just a photo”) → the moments that make a dog family → the portrait as a keepsake → social proof → offer.',
    editingApproach:
      'Real customer and product footage cut to the rhythm of the voiceover — portraits held beside the dogs they were painted from, hand-drawn sticker accents and bright, warm colour.',
    deliverables: ['0:30 master, 9:16', 'UGC + product footage edit', 'Animated sticker accents', 'Offer end card'],
    tools: ['UGC footage', 'Product footage', 'Captions', 'Motion graphics', 'Music'],
    overview:
      'A short UGC product ad: real dogs beside their portraits, customer reactions, and a sticker-accented caption style that feels native to the feed.',
    stats: [
      { k: 'Runtime', v: '0:30' },
      { k: 'Footage', v: 'Real UGC' },
      { k: 'Offer', v: '30% off' },
      { k: 'Ratio', v: '9:16' },
    ],
    hook: {
      line: 'This isn’t just a photo of your dog. It’s a piece of your story.',
      hl: 'piece of your story',
      window: '0.0 – 3.9s',
      seconds: 3.9,
      points: [
        { k: 'What it communicates', v: 'The product isn’t décor — it’s the dog, and every memory that comes with it.' },
        { k: 'The curiosity gap', v: 'If it isn’t just a photo, what is it? The next shots answer with real dogs.' },
        { k: 'Why the visual matches', v: 'A finished portrait held up to camera, a tiny dog sticker bouncing above it.' },
        { k: 'The first shot', v: 'Hands, a frame and a painted dog: the product, in frame one.' },
        { k: 'No slow intro', v: 'The reframe and the product arrive together in the first second.' },
      ],
    },
    breakdown: [
      { t: 0, at: 0.6, kind: 'broll', vo: 'This isn’t just a photo of your dog.', visual: 'A framed portrait held up to camera', edit: 'Product in frame from the first second' },
      { t: 3.9, at: 4.4, kind: 'aroll', vo: 'From the silly moments to the quiet ones beside you…', visual: 'A dog and its owner on the sofa', edit: 'Cut on the rhythm of the VO' },
      { t: 10, at: 13.1, kind: 'product', vo: 'Now you can turn those memories into something you’ll keep forever.', visual: 'A finished portrait of a golden retriever', edit: 'Hero product shot, sticker accent' },
      { t: 14, at: 15.6, kind: 'product', vo: 'Your best friend becomes timeless art.', visual: 'A spaniel sitting beside its own portrait', edit: 'The side-by-side proof shot' },
      { t: 17.9, at: 19.3, kind: 'aroll', vo: 'Join thousands of happy customers across Australia.', visual: 'Unboxing reactions from real customers', edit: 'Social proof in reaction shots' },
      { t: 27.2, at: 28.1, kind: 'product', vo: 'Order now and enjoy 30% off for a limited time.', visual: 'Two spaniels in front of their portrait', edit: 'Offer end card' },
    ],
  }),
]

/** Display order: the home page features the first six (the hero fans out 2–5) */
const ORDER = [
  'corbel-the-trainer',
  'corvael-in-the-wall',
  'serene-fourteen-days',
  'serene-the-reunion',
  'corvael-the-bodyguard',
  'bark-brush-forever',
  'corvael-wrong-fire',
  'cleantra-tight-ring',
  'corvael-cold-hands',
  'corbel-the-mirror',
  'serene-cortisol-loop',
  'serene-two-tablespoons',
  'serene-the-snap',
]
PROJECTS.sort((a, b) => ORDER.indexOf(a.slug) - ORDER.indexOf(b.slug))

/** Filter vocabularies — only what the work actually contains, in first-seen order */
const uniq = (list) => [...new Set(list)]
export const FORMATS = uniq(PROJECTS.map((p) => p.format))
export const STYLES = uniq(PROJECTS.flatMap((p) => p.styles))
export const PRODUCTION = uniq(PROJECTS.flatMap((p) => p.production))

export const FEATURED = PROJECTS.slice(0, 6)
export const getProject = (slug) => PROJECTS.find((p) => p.slug === slug)
export const nextProject = (slug) => {
  const i = PROJECTS.findIndex((p) => p.slug === slug)
  return PROJECTS[(i + 1) % PROJECTS.length]
}
