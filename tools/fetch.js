#!/usr/bin/env node
// Fetches rendered English Wiktionary pages into tools/cache/, slowly (Wiktionary rate-limits),
// skipping any already cached. A page that doesn't exist is cached as empty.
//   node tools/fetch.js title...        or        node tools/fetch.js --words tools/a1.json
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const CACHE = fileURLToPath(new URL('cache/', import.meta.url))
const UA = 'czech-etymology/0.1 (https://github.com/czech-grammar/etymology)'
const sleep = ms => new Promise(r => setTimeout(r, ms))
export const cachePath = title => join(CACHE, encodeURIComponent(title) + '.html')

export async function fetchPage(title) {
  const file = cachePath(title)
  if (existsSync(file)) return readFileSync(file, 'utf8')
  mkdirSync(CACHE, { recursive: true })
  for (let wait = 20000; ; wait *= 2) {
    const url = `https://en.wiktionary.org/w/api.php?action=parse&page=${encodeURIComponent(title)}&prop=text&format=json&formatversion=2&redirects=1`
    let body = ''
    try {
      body = await (await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(30000) })).text()
    } catch {}
    if (body.startsWith('{')) {
      const html = JSON.parse(body).parse?.text ?? ''
      writeFileSync(file, html)
      await sleep(2500)
      return html
    }
    if (wait > 320000) throw new Error(`gave up on ${title}`)
    await sleep(wait) // rate-limited or down: back off
  }
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2)
  const titles = args[0] === '--words' ? JSON.parse(readFileSync(args[1], 'utf8')).map(w => w.cs) : args
  let n = 0
  for (const t of titles) {
    const html = await fetchPage(t)
    if (++n % 25 === 0 || !html) console.log(`${n}/${titles.length} ${t}${html ? '' : ' (missing)'}`)
  }
  console.log(`done: ${n}`)
}
