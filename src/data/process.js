export const PROCESS = [
  { n: '01', title: 'Brief', verb: 'Receive', items: ['Script', 'Product information', 'Target audience', 'Reference creatives', 'Raw footage', 'Brand assets'] },
  { n: '02', title: 'Creative Breakdown', verb: 'Identify', items: ['Hook', 'Angle', 'Story structure', 'Key claims & points', 'Required visuals', 'B-roll requirements'] },
  { n: '03', title: 'Visual Planning', verb: 'Map every line to', items: ['A-roll', 'B-roll', 'Product shots', 'AI visuals', 'Graphics', 'Animations'] },
  { n: '04', title: 'Production', verb: 'Generate or source', items: ['Missing visual assets', 'AI start frames', 'AI motion clips', 'Product scenes'] },
  { n: '05', title: 'Editing', verb: 'Assemble', items: ['Voiceover', 'A-roll', 'B-roll', 'AI visuals', 'Captions', 'Graphics', 'Music', 'SFX'] },
  { n: '06', title: 'Variations', verb: 'Create alternate', items: ['Hooks', 'Openings', 'Angles', 'CTAs', 'Visual treatments'] },
  { n: '07', title: 'Final Polish', verb: 'Check', items: ['Timing', 'Captions', 'Audio', 'Visual continuity', 'Product accuracy', 'Safe zones', 'Export quality'] },
  { n: '08', title: 'Delivery', verb: 'Ship', items: ['Platform-ready 9:16 creatives', 'Naming & testing matrix', 'Cutdowns', 'Alt ratios on request'] },
]

/** Voiceover-driven workflow (brief §14) */
export const VO_WORKFLOW = ['Voiceover', 'Script breakdown', 'Visual mapping', 'Timeline', 'Supporting B-roll', 'Final polish']

export const AI_WORKFLOW = [
  { n: '01', title: 'Controlled still', body: 'A precise start frame — composition, light, character and product locked before anything moves.' },
  { n: '02', title: 'Consistency', body: 'Character, product and environment references that carry across every scene.' },
  { n: '03', title: 'Reference', body: 'The approved still becomes the visual anchor for motion.' },
  { n: '04', title: 'Motion', body: 'Short motion clips generated from the reference frame.' },
  { n: '05', title: 'Selection', body: 'Only the strongest takes survive — hands, faces, labels and physics intact.' },
  { n: '06', title: 'Integration', body: 'Graded, captioned and sound-designed into the edit so it belongs there.' },
]

export const AI_USES = [
  'Custom B-roll', 'Product environments', 'Lifestyle scenes', 'Cinematic inserts', 'UGC-style scenes', 'Explanatory visuals',
  '3D-style animation', 'Anatomy visuals', 'Conceptual animation', 'Before / after concepts', 'Character scenes',
  'Product interaction', 'Visual metaphors', 'Impossible camera moves',
]

export const CONTINUITY = [
  { group: 'Character', items: ['Face identity', 'Hair', 'Body proportions', 'Clothing logic', 'Age', 'Visual style'] },
  { group: 'Product', items: ['Shape', 'Label', 'Packaging', 'Cap', 'Proportions', 'Colour', 'Placement', 'Orientation'] },
  { group: 'Voice', items: ['Identity', 'Accent', 'Pitch', 'Tone', 'Speaking style', 'Energy'] },
]

export const STACK = [
  { title: 'Editing', body: 'A professional short-form workflow — the spine everything else plugs into.' },
  { title: 'AI Image', body: 'Custom visual assets and controlled start frames.' },
  { title: 'AI Video', body: 'B-roll, cinematic inserts, product environments and character scenes.' },
  { title: 'Voice', body: 'Controlled voiceover production when a script needs it.' },
  { title: 'Lip-sync & Avatar', body: 'Talking-avatar and synchronised speech workflows.' },
  { title: 'Motion Graphics', body: 'Visual emphasis and explanatory elements.' },
  { title: 'Sound Design', body: 'Immersion, rhythm and retention — felt more than heard.' },
]
