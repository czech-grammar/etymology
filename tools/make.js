#!/usr/bin/env node
// Writes outlines/czech-<word>-etymology.md for each word in a list (tools/a1.json), from the
// Wiktionary pages tools/fetch.js cached. Outlines that already exist are left alone, so hand
// edits survive; delete one to regenerate it.
//   node tools/make.js tools/a1.json "A1 nouns"           (fetches what's missing, slowly)
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fetchPage } from './fetch.js'
import { glosses } from './glosses.js'
import * as x from './extract.js'

const [list = 'tools/a1.json', category = 'A1 nouns'] = process.argv.slice(2)
const words = JSON.parse(readFileSync(list, 'utf8'))
const enc = u => encodeURI(u).replace(/\(/g, "%28").replace(/\)/g, "%29")
const W = 'https://en.wiktionary.org/wiki/'
const slug = t => String(t).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
const cap = s => s[0].toUpperCase() + s.slice(1)
const short = s => s.split(/\s+/).length <= 7

// pass 1: read every entry, fetching the Proto-Slavic pages they name
const facts = []
const skipped = []
for (const w of words) {
  const file = `outlines/czech-${slug(w.cs)}-etymology.md`
  if (existsSync(file)) continue
  const sec = x.section(await fetchPage(w.cs), 'Czech')
  if (!sec) {
    skipped.push(`${w.cs}: no Czech entry`)
    continue
  }
  const ps = x.protoSlavic(sec)
  const psSec = ps ? x.section(await fetchPage('Reconstruction:Proto-Slavic/' + ps), 'Proto-Slavic') : ''
  const ety = x.etymologyText(sec)
  const history = x.history(ety, psSec ? x.etymologyText(psSec) : '', ps)
  if (!history.length) {
    skipped.push(`${w.cs}: no etymology`)
    continue
  }
  facts.push({ w, file, sec, ps, psSec, history: [...history, ...x.notes(ety)], related: x.related(sec, w.cs) })
}

// pass 2: glosses for related words, then the outlines
const gloss = await glosses(facts.flatMap(f => f.related.slice(0, 10)))
for (const { w, file, sec, ps, psSec, history, related } of facts) {
  const norm = s => s.toLowerCase().replace(/[’']/g, "'").trim()
  const meaning = [cap(w.en)]
  for (const s of x.senses(sec).slice(0, 1)) if (!norm(s).includes(norm(w.en)) && !norm(w.en).includes(norm(s)) && short(s)) meaning.push(s)
  const seenGloss = new Set([w.en.toLowerCase()])
  const rel = []
  for (const r of related) {
    const g = gloss[r]?.split(',')[0].trim()
    if (!g || seenGloss.has(g.toLowerCase()) || !short(`${r}: ${g}`)) continue
    // an adjective whose first sense has nothing to do with this word is likely a homograph (vinný: guilty)
    if (/[ýí]$/.test(r) && !w.en.toLowerCase().split(/\W+/).some(t => t.length > 2 && g.toLowerCase().includes(t))) continue
    seenGloss.add(g.toLowerCase())
    rel.push(`${r}: ${g}`)
    if (rel.length === 3) break
  }
  const lines = [`category: ${category}`, `aliases: ${w.cs} etymology, origin of ${w.cs}, ${w.cs} word origin, etymology of ${w.cs}`, `- Czech ${w.cs} etymology`]
  const branch = (name, items) => items.length && lines.push(`  - ${name}`, ...items.map(i => `    - ${i}`))
  branch(`Meaning: “${w.en}”`, meaning)
  branch('Word history', history.filter(short))
  branch(x.derived(history) ? `Cousins of the root *${ps}` : 'Slavic cousins', psSec ? x.cousins(psSec, w.cs) : [])
  branch('Wider family', psSec ? x.wider(x.etymologyHtml(psSec)) : [])
  branch('Related Czech words', rel)
  branch('Sources', [`[Wiktionary: ${w.cs}](${enc(W + w.cs)}#Czech)`, ...(ps ? [`[Wiktionary: Proto-Slavic *${ps}](${enc(W + "Reconstruction:Proto-Slavic/" + ps)})`] : [])])
  writeFileSync(file, lines.join('\n') + '\n')
}
console.log(`${facts.length} outlines written, ${skipped.length} skipped`)
for (const s of skipped) console.log('  ' + s)
