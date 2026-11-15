// English glosses for Czech words, from Wiktionary's wikitext, fifty words per request, cached in
// tools/cache/glosses.json. Only a word's first Czech definition is kept, and only if it's short.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const FILE = fileURLToPath(new URL('cache/glosses.json', import.meta.url))
const UA = 'czech-etymology/0.1 (https://github.com/czech-grammar/etymology)'
const sleep = ms => new Promise(r => setTimeout(r, ms))

// "# {{lb|cs|colloquial}} [[beer]] {{gloss|drink}}" → "beer"
export function firstGloss(wikitext) {
  const cz = wikitext.split(/^==Czech==\s*$/m)[1]
  if (!cz) return null
  const body = cz.split(/^==[^=].*==\s*$/m)[0]
  for (const line of body.split('\n')) {
    if (!/^#\s/.test(line)) continue
    let s = line.slice(1)
    if (/\{\{(inflection of|form of|plural of|diminutive of|augmentative of|alternative form of|feminine of|masculine of|abbreviation of|verbal noun of|alt form|clipping of|short for)\b/i.test(s)) return null
    s = s
      .replace(/\{\{(lb|lbl|label|q|qual|qualifier|i|gloss|sense|defdate|ux|syn|ant|cln|C|topics|tlb)\|[^{}]*\}\}/g, '')
      .replace(/\{\{(l|m|w|ll|vern)\|[^|{}]*\|([^|{}]+)[^{}]*\}\}/g, '$2')
      .replace(/\{\{[^{}]*\}\}/g, '')
      .replace(/\[\[(?:[^\]|]*\|)?([^\]]+)\]\]/g, '$1')
      .replace(/<[^>]+>/g, '')
      .replace(/'''?/g, '')
      .replace(/\([^)]*\)/g, '')
      .split(/;/)[0]
      .replace(/\s+/g, ' ')
      .replace(/^[\s,:]+|[\s,.:]+$/g, '')
    if (s && s.split(' ').length <= 4 && !/[{}[\]|=]/.test(s)) return s
    return null
  }
  return null
}

export async function glosses(words) {
  const cache = existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : {}
  const todo = [...new Set(words)].filter(w => !(w in cache))
  for (let i = 0; i < todo.length; i += 50) {
    const batch = todo.slice(i, i + 50)
    const url = `https://en.wiktionary.org/w/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&format=json&formatversion=2&titles=${encodeURIComponent(batch.join('|'))}`
    for (let wait = 20000; ; wait *= 2) {
      const body = await (await fetch(url, { headers: { 'user-agent': UA } })).text().catch(() => '')
      if (body.startsWith('{')) {
        const pages = JSON.parse(body).query?.pages ?? []
        const norm = Object.fromEntries((JSON.parse(body).query?.normalized ?? []).map(n => [n.to, n.from]))
        for (const w of batch) cache[w] = null
        for (const p of pages) cache[norm[p.title] ?? p.title] = p.missing ? null : firstGloss(p.revisions?.[0]?.slots?.main?.content ?? '')
        break
      }
      if (wait > 320000) throw new Error('gave up on glosses')
      await sleep(wait)
    }
    writeFileSync(FILE, JSON.stringify(cache, null, 1))
    await sleep(3000)
  }
  return cache
}
