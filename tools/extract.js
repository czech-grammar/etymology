// Reads cached Wiktionary pages (tools/fetch.js) into plain facts for one Czech word. Pure functions
// over HTML strings, so they can be checked against saved pages.

const ENT = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' }
export const text = html =>
  html
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<sup[\s\S]*?<\/sup>/g, '')
    .replace(/<span class="mw-editsection[\s\S]*?<\/span><\/span>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => (n === '8206' || n === '8207' ? '' : String.fromCodePoint(+n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&[a-z]+;/g, e => ENT[e] ?? ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:)”])/g, '$1')
    .replace(/([(“])\s+/g, '$1')
    .trim()

// The part of a page under one language's heading
export function section(html, lang) {
  const id = lang.replace(/ /g, '_')
  const part = html.split(new RegExp(`<h2 id="${id}"`))[1]
  return part ? part.split(/<h2 /)[0] : ''
}

// First etymology section's HTML (up to the next heading)
export function etymologyHtml(sec) {
  const part = sec.split(/<h3 id="Etymology[^"]*"/)[1]
  return part ? part.replace(/^[^>]*>/, '').split(/<h[34] /)[0].replace(/<div class="NavFrame etytree[\s\S]*?<\/div><\/div><\/div><\/div>/g, '') : ''
}

// The etymology's prose, without the tree and the image captions
export function etymologyText(sec) {
  let t = text(etymologyHtml(sec))
  const at = t.search(/\b(Inherited|Borrowed|Learned borrowing|Semi-learned borrowing|Orthographic borrowing|From|Clipping|Back-formation|Calque|Derived|Deverbal|Univerbation|Uncertain|Unknown|Of uncertain|Possibly|Probably|Originally|Most probably|Either|Onomatopoeic|Coined|Compound|By surface)\b/)
  if (at >= 0) return t.slice(at)
  return /^\*\S+.*\+/.test(t) ? 'From ' + t : '' // "*oko (“eye”) + *-ъno."
}

const words = s => s.split(/\s+/).filter(Boolean).length
const glossy = s => s.replace(/\s*\(“([^”;,]+)[^”]*”\)/g, ', “$1”').replace(/\s*\(\s*([a-zA-Z' ]+)\s*\)$/, '').trim()

// "Inherited from Old Czech žena, from Proto-Slavic *žena." → ['Old Czech žena', 'Proto-Slavic *žena'],
// with a borrowing kept as such ("Borrowed from Latin schola"). Long or unclear pieces are dropped.
const STEP = /^(Borrowed from |Short for )?(Proto-[A-Z][A-Za-z-]+|Old [A-Z][a-z]+(?: [A-Z][a-z]+)?|Middle [A-Z][a-z]+(?: [A-Z][a-z]+)?|Late Latin|Medieval Latin|New Latin|Ancient Greek|Byzantine Greek|Vulgar Latin|[A-Z][a-z]+) \S/
const UNSURE = /^(Uncertain|Unknown|Of uncertain|Of unknown|Either|Originally|Disputed|Unclear|Etymology unclear|Borrowed either)/i
const LIKELY = /^(Most probably|Probably|Possibly|Perhaps|Likely)\s+(an?\s+[^*]*?\s+from\s+|from\s+)?/i
export function chain(t, { strict = false } = {}) {
  if (!t) return []
  if (strict && UNSURE.test(t)) return ['Deeper origin uncertain']
  const likely = LIKELY.test(t)
  if (likely) t = 'From ' + t.replace(LIKELY, '')
  const first = t.split(/(?<=[^A-Z][.])\s+(?=[A-Z])/)[0].replace(/\.$/, '')
  const pieces = first.split(/,?\s+from\s+|,\s+ultimately\s+|,\s+via\s+/i)
  if (/^(Borrowed|Learned borrowing|Semi-learned borrowing|Orthographic borrowing)$/i.test(pieces[0]?.trim()) && pieces[1]) pieces.splice(0, 2, 'Borrowed from ' + pieces[1])
  const LEAD = { deverbal: 'From the verb ', 'back-formation': 'Back-formation from ', derived: 'From ', univerbation: 'Univerbation of ' }
  const lead = LEAD[pieces[0]?.trim().toLowerCase()]
  if (lead && pieces[1]) pieces.splice(0, 2, '\u0000' + lead + pieces[1])
  const out = []
  for (const [i, p] of pieces.entries()) {
    let s = p.trim()
    if (s.startsWith('\u0000')) s = s.slice(1)
    else if (i === 0) {
      if (/^(Inherited|Derived)\b/i.test(s)) s = s.replace(/^(Inherited|Derived)( from)?\s*/i, '')
      else if (/^From\s/.test(s)) s = s.slice(5)
      else if (/^Clipping of /.test(s)) s = 'Short for ' + s.slice(11)
    }
    s = glossy(s).replace(/\s+/g, ' ').replace(/^native /, '').replace(/,\s+(?![“"])[a-z][\s\S]*$/, '')
    if (!s) continue
    if (/\s\+\s/.test(s) && !STEP.test(s)) s = 'From ' + s
    const ok = STEP.test(s) || /^From \S+.* \+ /.test(s) || (!strict && i === 0) || /^(From the verb|Back-formation from|Univerbation of) /.test(s)
    if (s && ok && words(s) <= 7 && !/[;]/.test(s)) out.push(s)
    else if (strict && i === 0) {
      out.push('Deeper origin uncertain')
      break
    } else break
  }
  if (likely && out[0] && out[0] !== 'Deeper origin uncertain') out[0] = 'Probably ' + out[0].replace(/^From /, 'from ')
  return out
}

// The whole history: the Czech entry's steps, then the Proto-Slavic entry's deeper ones
// True when the Czech word is built in Czech from another word, so a Proto-Slavic page it links
// is its root's, not its own
export const derived = steps => steps.some(s => s.startsWith('Root: '))

export function history(czechText, psText, psTitle) {
  const steps = chain(czechText)
  if (psTitle && !steps.some(s => s.startsWith('Proto-Slavic'))) {
    // inherited: Old Czech, then Proto-Slavic; derived in Czech: the derivation, then its root's
    const at = steps.findIndex(s => s.startsWith('Old Czech'))
    if (at >= 0) steps.splice(at + 1, 0, 'Proto-Slavic *' + psTitle)
    else steps.push('Root: Proto-Slavic *' + psTitle)
  }
  if (psText && !steps.some(s => /^Proto-(Balto-Slavic|Indo-European)/.test(s))) {
    for (const s of chain(psText, { strict: true })) if (!steps.includes(s)) steps.push(s)
  }
  return steps
}

// Short extra sentences worth keeping: doublets and surface analyses
export function notes(t) {
  const out = []
  for (const s of t.split(/(?<=\.)\s+/).slice(1)) {
    const m = s.match(/^(Doublet of [^.]+)\.$/) || s.match(/^By surface analysis, ([^.]+)\.$/)
    if (m) {
      const n = glossy(m[1].startsWith('Doublet') ? m[1] : 'Built from ' + m[1])
      if (words(n) <= 7) out.push(n)
    }
  }
  return out
}

// Senses from the first definitions list: short glosses, labels dropped
export function senses(sec) {
  const ol = sec.match(/<ol>([\s\S]*?)<\/ol>/)
  if (!ol) return []
  const items = ol[1].split(/<li[^>]*>/).slice(1).map(li => li.replace(/<(dl|ul|ol)[\s\S]*?<\/\1>/g, ''))
  const out = []
  for (const li of items) {
    let s = text(li).replace(/^\([^)]*\)\s*/, '').replace(/\s*\([^)]*\)\s*$/, '')
    s = s.split(/;|:| ― /)[0].trim().replace(/\.$/, '')
    if (!s || words(s) > 6 || /^(synonym|antonym|see|plural|alternative|diminutive|augmentative|nominative|genitive|vocative)/i.test(s)) continue
    s = s[0].toUpperCase() + s.slice(1)
    if (!out.includes(s)) out.push(s)
    if (out.length === 2) break
  }
  return out
}

// The Proto-Slavic page the etymology names for the word itself (the last one, not a suffix)
export function protoSlavic(sec) {
  const links = [...etymologyHtml(sec).matchAll(/title="Reconstruction:Proto-Slavic\/([^"#]+?)"/g)].map(m => m[1]).filter(t => !t.startsWith('-') && !/does not exist/.test(t))
  return links.at(-1) ?? null
}

// Slavic descendants from a Proto-Slavic page: Polish, Slovak, Russian (or Ukrainian)
const modernRu = s => s.replace(/́/g, '').replace(/ѣ/g, 'е').replace(/і/g, 'и').replace(/ѳ/g, 'ф').replace(/ъ$/, '')
export function cousins(ps, czech) {
  const d = ps.split(/id="Descendants[^"]*"/)[1]
  if (!d) return []
  const lis = [...d.split(/<h[34] /)[0].matchAll(/<li>([\s\S]*?)(?=<li>|<\/ul>)/g)].map(m => text(m[1]))
  const pick = lang => {
    const li = lis.find(l => l.startsWith(lang + ':'))
    if (!li) return null
    let term = li.slice(lang.length + 1).trim().split(/\s*,\s*|\s+→|\s+⇒|\s*\(see/)[0]
    const gloss = term.match(/\(“([^”]+)”\)/)?.[1]
    term = term.replace(/\s*\([^)]*\)/g, '').replace(/[←→>].*$/, '').trim().split(' ')[0]
    if (!term || /^\*/.test(term)) return null
    if (lang === 'Russian' || lang === 'Ukrainian') term = modernRu(term)
    return `${lang} ${term}` + (gloss ? `, “${gloss}”` : '')
  }
  const out = [pick('Polish'), pick('Slovak'), pick('Russian') || pick('Ukrainian')].filter(Boolean)
  return out.filter(c => c !== `Slovak ${czech}` || true)
}

// Cognates outside Slavic named in a Proto-Slavic etymology: "Lithuanian dienà (“day”)" and the like
const WIDE = ['English', 'Latin', 'Ancient Greek', 'Sanskrit', 'German', 'Lithuanian', 'Gothic', 'Old English', 'Old Norse', 'Old Irish']
export function wider(psEtymHtml) {
  const out = []
  // only words the text calls cognates, not parallels in meaning ("compare…") or sources
  const at = psEtymHtml.search(/[Cc]ognate/)
  if (at < 0) return out
  const part = psEtymHtml.slice(at).split(/<\/p>|\. (?:Compare|See|For|But|However|Alternatively)/)[0]
  for (const m of part.matchAll(/([A-Z][A-Za-z]+(?: [A-Z][a-z]+)?)\s*(?:<\/span>|<\/a>)?\s*<i class="[^"]*mention[^"]*" lang="([a-z-]+)">([\s\S]*?)<\/i>(\s*\([\s\S]*?\))?/g)) {
    const lang = m[1]
    if (!WIDE.includes(lang)) continue
    const term = text(m[3])
    if (!term || term.startsWith('*') || words(term) > 2) continue
    const gloss = text(m[4] || '').match(/“([^”]+)”/)?.[1]
    const s = `${lang} ${term}` + (gloss && words(gloss) <= 3 ? `, “${gloss}”` : '')
    if (!out.some(o => o.startsWith(lang + ' '))) out.push(s)
    if (out.length === 3) break
  }
  return out
}

// Derived and related Czech words listed on the entry
export function related(sec, czech) {
  const out = []
  for (const part of sec.match(/<h[45] id="(Derived_terms|Related_terms)[^"]*"[\s\S]*?(?=<h[2345] |$)/g) || []) {
    for (const m of part.matchAll(/<a [^>]*title="([^"#:]+?)(?: \(page does not exist\))?"[^>]*>/g)) {
      const w = m[1]
      if (w !== czech && !/\s/.test(w) && !out.includes(w)) out.push(w)
    }
  }
  return out
}
