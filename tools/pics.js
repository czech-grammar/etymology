#!/usr/bin/env node
// Copies each word's flash-card picture from the nouns deck (a sibling checkout of
// czech-grammar/nouns) to pics/<word>.svg, for the words that have a map here.
// The directory page shows them, loading each only as it scrolls into view.
//   node tools/pics.js [../nouns]
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import vm from 'node:vm'

const nouns = process.argv[2] || '../nouns'
const slug = t => String(t).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

// run the deck's word files: the A1 ones its page loads, then the A2–B2 folders it loads on demand
const html = readFileSync(join(nouns, 'index.html'), 'utf8')
const scripts = [...html.matchAll(/<script src="(words[^"]*\.js)"><\/script>/g)].map(m => m[1])
for (const lv of ['a2', 'b1', 'b2']) scripts.push(...readdirSync(join(nouns, 'words', lv)).filter(f => f.endsWith('.js')).sort().map(f => `words/${lv}/${f}`))
const ctx = vm.createContext({})
for (const s of scripts) vm.runInContext(readFileSync(join(nouns, s), 'utf8'), ctx, { filename: s })
const words = vm.runInContext('WORDS', ctx)

const maps = new Set(JSON.parse(readFileSync('index.json', 'utf8')).maps.map(m => m.slug))
mkdirSync('pics', { recursive: true })
let n = 0
for (const w of words) {
  const s = slug(w.cs)
  if (!w.svg || !maps.has(`czech-${s}-etymology`) || existsSync(`pics/${s}.svg`)) continue
  writeFileSync(`pics/${s}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 100">${w.svg.trim()}</svg>\n`)
  n++
}
console.log(`${n} pictures written from ${scripts.length} word files (${words.length} words)`)
