# Czech word origins

Etymology mind maps for Czech words, one per word: what it means, where it comes from (Old Czech, Proto-Slavic and further back), its Slavic cousins, its wider family, related Czech words, and sources. The words come from the [nouns deck](https://grammar.ilearnczech.com/nouns/), level by level.

Browse them: https://grammar.ilearnczech.com/etymology/

[mindstr](https://mindstr.org) finds these when someone searches for a word's origin ("pivo etymology", "origin of hrad"), and opens the map at once with no AI call.

- `outlines/czech-<word>-etymology.md`: the source of each map, a Markdown list you can edit
- `maps/czech-<word>-etymology.json`: the map in the mindstr format (JSON-LD, version 0.2)
- `lookup.json`: every way of asking (as slugs) → the map's file, small, fetched on each search
- `index.json`: every map with its level, plus the lookup
- `index.html`: the directory page

## Sources

The facts come from English Wiktionary's Czech entries and its Proto-Slavic reconstructions, and each map links the pages it used. Where an origin is disputed, the map says so and lists the theories rather than picking one.

## Adding or changing a map

1. Write or edit `outlines/czech-<word>-etymology.md` (the slug drops accents: `žena` → `zena`). First lines: `category: A1 nouns` (or A2, B1, B2) and `aliases:` for other ways to ask. Labels of at most 7 words, at most one link per label (the whole label).
2. `npm run check` reports problems; `npm run build` writes `maps/`, `index.json` and `lookup.json`. `npm run links` checks the links.
3. Commit the outline, the map and the index together.

Rebuilding keeps each map's node ids, so links into a map stay stable. The build tool is shared with [mindstr-maps](https://github.com/melvincarvalho/mindstr-maps).

## Licence

The maps and outlines are [CC0](LICENSE): no rights reserved.
