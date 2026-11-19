# packages/rpg-md — parser library

Converts RPG-flavored markdown → HAST (Hypertext Abstract Syntax Tree). No Svelte, no DOM; `bun
--cwd=packages/rpg-md run typecheck` is tsc only.

## Exports

- `buildHast(source, format?, opts?)` — parses markdown into HAST: CommonMark + GFM
  (`micromark-setup.ts`, the one configuration) through `markdown-to-hast.ts`, which puts RPG-MD's
  line rules back on top (Syntax below) and converts with `to-hast.ts`; then `rehype-sections`
  (heading → `<section>`, hierarchical ids, classes, `data-content-type`: the heading's own header
  mapping, else the nearest ancestor section's — attribute only, never a class), `rehype-components`
  (RPG-MD component lines → data-attribute-annotated nodes, ids prefixed with the section's
  `data-slug`), `rehype-table-ids` and the macro pass (`rehype-links`); each plugin runs on its own.
  `format` (`BodyFormat`) is `'markdown'` or `'fountain'` — the raw `'html'` format is gone (it
  handed a body to parse5 unescaped). `'fountain'` (a Session body) skips markdown's block structure
  and `rehype-sections`: the body goes in as one text node to `rehype-fountain` (scene heading →
  `section.scene`, elements → `p.fountain-*` through `inlineMarkdown`, centered text →
  `p.fountain-action.fountain-centered`, notes / boneyard / sections / synopses →
  `aside.fountain-*.hidden`), then `rehype-components`. See *Fountain* below. `toSlug` / `textOf`
  live in `slug.ts`, shared with `fill.ts`, and are exported — a Guide slugs a label and a link's text exactly as a section is slugged. `opts.system`
  is threaded through and deliberately unread — it is where a system's authored header mappings will
  enter, so the signature changes only once.
- `classifyLines(body)` / `bodyWarnings(source)` (`classify.ts`) — one label per source line,
  `heading` / `candidate` / `continuation` / `note` / `code` / `other`, read off the same micromark
  parse the renderer uses. The renderer's component detection and all three `fill.ts` scanners read
  it, so a `# x` or `Str: 3` inside a fence is never a heading or a field, and fill and render
  cannot disagree about which line is a field. `bodyWarnings` is a `continuation` line `parseToken`
  accepts — a component swallowed into the list item above; the template editor shows it as a lint
  warning. It strips frontmatter itself and numbers lines from the top of what it is given.
- `rehypeLinks` / `MD_LINK` — the **macro pass** only. Ordinary links are CommonMark's, and every
  `<a>` gets `rpg-link` in `to-hast.ts`. `[x](/set a=1, b=2)` is not a CommonMark link (a space in
  the destination), so this pass claims `/set`, `/add` and `/remove` out of text nodes — never inside
  `a`, `code`, `pre` or a component. `MD_LINK` is the `[text](target)` regex, exported so
  fictionboard finds the links in a body — it only resolves `objectHref`
  paths, which always pass `isSafeUrl`, so it needs no check of its own.
- `isSafeUrl(url)` — the one url rule: http(s), mailto, or no scheme (relative, `/abs`, `#frag`,
  a percent-encoded `caf%C3%A9.png`); control characters and leading whitespace refused. `to-hast.ts` and fictionboard's
  HAST renderer allowlist both use it.
- `parseFill(filled, templateHast)` / `serializeFill(templateMarkdown, templateHast, data, meta?)` —
  a **fill** is the template document with values in place of declarations. Addressing is
  `(heading path, label, ordinal)`, so repeated labels — three `Rating:` down a column — each keep
  their own value. Returns `{ template, version, data, unresolved, invalid }`; anything the current
  template has no slot for is reported in `unresolved`, and a value outside a fixed choice's declared
  set is reported in `invalid`. **Both are written anyway** — the read is permissive and the report is
  non-blocking, so no fill is ever refused for a typo. `applyFillOp(body, op)` splices one line and is the
  only thing the server does to a body.
- `templateSlots(templateHast)` — every component's structural address, the `data-component-id` it
  binds to, its type, and the values it accepts where the template can say. The client turns a changed
  value into a `FillOp` with it; `slotValues` and `slotRejection` are the legal set and the message
  for a value outside it, shared by `parseFill` and the editor's Fields panel so the two cannot
  disagree.
- `tableModel(el, override?)` — a `<table>` or `<ul>` carrying `data-table-id` read as a roll table:
  `{ id, dice, keyColumn, header, rows: [{ min, max, cells }], warnings }`. Inference: a dice first header cell makes column 1 the
  key; else a first column of keys/ranges (`1-2`, `11–16`, `00` = 100) makes it the key with dice
  from the top key (`d66` when every key is digits 1–6); else uniform `1dN`, `keyColumn: 0`. A list is
  always uniform. Gaps, overlaps and unparseable keys are `warnings`, never thrown; a bad-key row gets
  `min = max = 0`. `cells` is every cell, key included (column indexes are 1-based over all columns),
  as markdown with links kept as `[text](href)`. `override` is the table config's `key` / `dice`, because
  they change inference: `key: 0` forces uniform, `key: n` keys on column n (its header dice, else its
  top key; a bad key warns, no fallback), `dice` replaces the inferred dice and gaps are checked
  against it (a forced or unparseable one is ignored). The rest of the config (`draw`, `pick`,
  `columns`, `each`) is fictionboard's.
- `parseDice` / `rollDice(dice, rng?)` / `formatDice` / `diceFaces` (`dice.ts`) — the one dice
  parser and roller. `NdM±K`, `d66` (two d6, tens and ones), `d100`, and **forced notation**
  `2d6+1@3,5`: the faces each die showed, which is how a roll is recorded and replayed.
  `rollDice` returns `{ notation, rolls, total }` with `notation` always forced, so
  `rollDice(r.notation)` reproduces `r`. The RNG is injected (`() => [0, 1)`, as `Math.random`),
  defaulting to `cryptoRng` (`crypto.getRandomValues`). Not an expression language: `kh`, `>N`,
  `{@field}` and text around the dice parse to `null`, so `Dice.svelte` / `Roll.svelte` (both on it)
  disable their button rather than roll something else. Caps: 100 dice, 10000 sides; `diceFaces`
  (every total, `tableModel`'s gap check) is `null` past 10000 totals. `tableModel` reads dice
  through it and refuses a forced header.
- `parseToken(text)` — one RPG-MD component line (`Strength: Number(10, 0-20)`) into a typed
  `ComponentConfig`.
- `evaluateFormula(formula, data)` — evaluates `{@field_id}` expressions via `Function()`
  construction.
- `parseFrontmatter(source)` — splits `---`-fenced frontmatter off **any** object body, not only a
  system's. `buildHast` strips it before parsing, so config never renders as a
  paragraph. Deliberately not YAML: scalars, one inline `[a, b]` list, one flat nested map, no
  dependency; anything else is ignored rather than thrown on. `fmString` / `fmList` / `fmMap` narrow
  the result. A fenced block is frontmatter only if it has a `key:` line and every other unindented
  line is a `#` comment (`fenceEnd`); otherwise the opening `---` is a markdown gap and the whole body
  is markdown. `splitFrontmatter` uses the same check.

## Syntax

RPG-MD is CommonMark + GFM (strikethrough, tables, task lists) with line rules on top.

**One Enter is one paragraph**. Every `paragraph` is cut at its line endings — in quotes and
list items too — because every component line must be its own `<p>`. An inline construct spanning a
line ending (`**a⏎b**`) goes back to literal source text. Blank lines make no space; a line that is
only `\` is an empty `<p><br></p>` that does (a pause in a deck slide), and a thematic break is
an `<hr>` (a deck's section gap — `TextEffect.svelte` draws it as ~2.5 lines of space, 5 under
`credits`; `***`, `___`, `- - -` count too; an opening `---` is frontmatter only when the block reads
as such, see above).

**Off:** setext headings (`text⏎---` is a `<p>` then an `<hr>`), indented code (indentation is
list nesting only), GFM footnotes (`[^src]` stays literal), autolink literals and single
`~` strikethrough (`~5 gp` stays text). Raw HTML is dropped silently and entities decode
(`&amp;` → `&`); a link or image failing `isSafeUrl` loses its url, a link keeps its text.
`fictionboard`'s `safeHast` stays the second fence.

**Component lines** are `Label: ComponentType(args) #optional_id`, alone on a paragraph line.
Detection is on source text: a line `classifyLines` calls a `candidate` and `parseToken` accepts is
one `<p>` holding the raw line as one text node — no inline markdown, so `Text(**x**)` keeps `**x**`
as its default. A code span over the label or the colon makes the line prose:
`` `Strength: Number(10)` `` is a `<p><code>`, which is how the editor help shows syntax;
`` Notes: Text(use `x`) `` is still a component. A list item's continuation line is never a
component — `bodyWarnings` flags one that reads like one. Formulas use `{@field_id}`.

**Quotes are strict, lists are CommonMark**. A plain line under `>` is outside the quote — in a
Scene deck that is the slide's text, and the quote is the narrator's (fictionboard's narrator
notes); lines inside a quote are still component candidates. A plain line under `- item` joins the
item, and a list ends at a blank line between items. Numbered, nested and task lists render; task
boxes are static `<input type="checkbox" disabled>`. A heading inside a quote or list item
opens no section.

**Tables.** A GFM table needs its `|---|` row. A paragraph whose every line starts with `|` is a
**headless table**, `<table><tbody>`, cells split on unescaped `|`, each cell inline-parsed; a
paragraph with any other line is not a table. Cells are never component candidates.

**Images** are inline, wrapped in `<p>` as CommonMark has it — a skin hiding everything but
the picture keeps `p:has(> img)`.

Every `<table>`, `<ul>` and `<ol>` gets a `data-table-id` (`rehype-table-ids.ts`): the nearest
section's `data-slug`, `_2`, `_3` on collision, `table` before any heading. Tables and lists share one
counter (frontmatter `tables:` is one map), so a numbered list in user content shifts later table ids.
An `<ol>` is read like a `<ul>` (uniform `1dN`, `start` ignored). The override is the heading's
`(#id)`, which already sets the slug — there is no per-table `#id` syntax. The bracket's id is its
first token; any `key=value` pairs after it (`(#open motion=title-card hold=4)`) land on the
heading's `<section>` as `data-<key>` (`headingAttrs` in `slug.ts`) — the Text overlay's per-slide
shot in fictionboard. `@role` tokens in any heading bracket — `(@narrator)`, `(#rolls
@narrator @player)`, `(.wide @player)` — are read by `headingRoles` into `data-roles` on the section
and are never a slug, class or pair; a bracket opening with `@` counts only when every token is a
role, so `(@dex - 10)` stays text. `filterRoles(tree, role?)` removes each gated section the role is
not named on, its subsections with it; no role keeps only ungated ones. Any role string parses —
fictionboard's help decides which exist. It hides, it does not protect: the
text is still in the source. It runs after `rehype-components`, so a choice's option list or
`(#slug)` source section, spliced out there, takes no id. Heading slugs are stable across inline
markup: `toSlug` of the raw and the rendered text agree (`The *Ring*`), and a test pins it.

**One inline parser**: `inlineMarkdown(md)` is `fromMarkdown` with block constructs off, GFM
inline and the macro pass, one `br` per `\n` — for choice descriptions and Fountain elements, so they
read markdown exactly as a body does. `inlineMarkdown(md, 'fountain')` (what `rehype-fountain` calls)
reads emphasis as the Fountain spec does: `_x_` is `<u>`, not `<em>` — told apart by the marker at
the node's source offset, so it has to run before positions drop. `***x***`, `\*` and no emphasis
across a line are CommonMark's already; `__x__` stays `<strong>`.

## Fountain

`parseFountainDocument` (`fountain-parser.ts`) is a block parser after `FastFountainParser.m`
(https://github.com/nyousefi/Fountain, MIT) against https://fountain.io/syntax; blank lines carry the
state. `test/fountain.test.ts` pins it against the spec's example script
(`test/fixtures/brick-and-steel.fountain`) and each rule. What a body author needs to know:

- A scene heading (`INT` `EXT` `EST` `INT./EXT` `I/E`, any case; the off-spec `EXT/INT` / `E/I` too,
  `setting` `INT./EXT.`) needs a blank line **before** only —
  the line under it is a new element, not merged in (the spec wants a blank after too; we don't, so
  Story mode's `INT. X⏎(Everyone)` reads as heading + orphan line). A cue needs a blank before and a
  non-blank after, a transition (`…TO:`) a blank on both sides.
- Dialogue runs to the next blank line; a line of exactly two spaces keeps a blank inside it. A
  parenthetical exists only inside a dialogue block; anywhere else `(…)` is action.
- Action and lyric lines merge with their `\n`s; action keeps its indent (tabs → four spaces) and
  every other element's indent is dropped.
- Forcing marks (`.` `@` `!` `~` `>` `>…<` `^`) are stripped from `content` — except a forced
  transition ending in `TO:` (`> SMASH CUT TO:`), which the plain `TO:` rule takes first, `>` kept. `^` sets `dual` on that
  cue and the one before it.
- Notes, boneyard, `#` sections and `=` synopses are elements of their own, hidden. A note or
  boneyard **inside** a line is cut out and kept on that element's `hidden` — never rendered.
  A note won't close across a true blank line; a boneyard spans anything.
- A scene's slug is the whole heading — parentheses kept, `-` and `/` split words — unlike a
  section's, which `toSlug` cuts at the first `(`; `(#id)` still overrides.
- `normalizeSceneHeadings(body)` respells each heading's prefix the spec's way — `INT HOUSE` →
  `INT. HOUSE`, `EXT/INT` → `INT./EXT.`, `E/I` → `I/E` — only where the parser reads a heading,
  never in frontmatter or a boneyard. fictionboard's `saveObject` runs it on every Session write.
- No title page (frontmatter is ours) and no page breaks: `===` reads as a blank line.
- Element text is inline markdown in Fountain mode — `_underline_` is `<u>` (*One inline parser*
  above). fictionboard's `safeHast` lists `u`; a new tag here needs adding there or it vanishes.

Old Session bodies re-render under these rules: a `#` line that used to show as text is now a hidden
section, consecutive lines merge into one element, and the old heuristic `data-caps-words` /
`data-possible-characters` attributes are gone.

A footnote whose id contains `_note_` or `_comment_` is an **editor note** (`notes.ts`): a one-line definition is a classifier `note`, removed by the renderer and
skipped by fill; inline markers are removed from text nodes, never from code.

All 16 component types and their aliases live in `rpg-components-registry.ts` — the single source of
truth. Aliases (`Skill → Number`, `Description → TextArea`, `Pips → Radio`) resolve before parsing.
`COMPONENT_METADATA` is typed to cover every one of them, so a new type cannot land undocumented.

Four of them are **fixed choices** — `Select`, `Radio`, `MultiSelect`, `Checks` — and they share one
option reader, `parseOptionItem`, whichever form the options were written in (a bracket list, or a
markdown list under the line). A `*` prefix marks the default — so does a task box `[x]` on a list
option, and `[ ]` is a plain one; the label is the stored value unless
the author wrote `Label | value`. A ` — ` / ` -- ` splits off a `description` (raw inline
markdown, split off *before* the star and pipe are read). List options and source-section descriptions are
read from the body's source text by position, so they are what the author wrote. `(#slug)` sets `source` and
`rehype-components` reads that section's direct child sections as options (`readSourceSections`,
before the visit, from the untouched tree), then splices the section out *after* the visit, so ids
are what they would be without it. `fill.ts` validates the resolved list like any other.
`inlineMarkdown(md)` (above) turns a description into HAST for the renderers.

`parseGenericAttributes` reads a positional default only for arguments that are **not** a bracket list
and **not** in `KNOWN_ATTRIBUTES`. That allow-list is load-bearing: without the gate `Text(John Doe)`
parsed to `{ John: 'Doe' }` with an empty default, and a one-word default became a boolean flag. An
attribute missing from the list is silently read as a default value instead. A known name takes
its value after a space, `:` or `=` (`category portrait`, `category: portrait`, `category="portrait"`).

Component ids are unique within a document: `sectionSlug__labelSlug`, then `_2`, `_3` on collision.
Bundled templates dodge the collision by hand with `#id` suffixes. Default is a slug of the label
(`generateIdFromLabel`); override with the `#custom_id` suffix.

`fill.ts` contains six NUL bytes — the key separators in `pathKey` and friends — so git treats the
whole file as binary. It works; left alone deliberately.

A fill value coerces to number where possible, `[a, b]` becomes an array, and a newline escapes as
`\n` — one value, one line. A line with **no** value after the colon claims its slot but writes no
key, so the component falls back to its template default.

**`/set` macro links** — `[Barbarian](/set class=barbarian, str=+1)` becomes
`<a class="rpg-link rpg-macro" data-macro="set" data-args="class=barbarian, str=+1">`, no `href`: a
macro is not a navigation, so the shell's click interception and the middle click never see one. The
args run to the first `)`, so a value cannot hold one. What the args mean — the op grammar, key
resolution, Guides — is fictionboard's; this package only carries them.
`/add` and `/remove` links are the same anchor with `data-macro="add"` / `"remove"` and their raw args
(`items Dagger`).

*Planned, unbuilt*: the other macros (`/roll`, `/random`, `/goto`, `/theme`) — `VALID_MACROS` and its
helpers are declared in the registry and read by nothing, and those links stay literal text. `Action` parses but does not act: `Action.svelte` only
`console.log`s and its `once` flag is inert. No bundled template uses it — documented as unbuilt
rather than deleted or finished.

## Tests

`test/` holds characterization tests for the parser, the frontmatter splitter, the formula evaluator
and the fill parser, plus a snapshot of every fixture sheet's section classes, component ids and
component types. The fixtures in `test/fixtures/` are original — `simple-rpg`, `beach-party`,
`beach-party-npc` and `sampler.md`, a made-up game that carries every component type, the aliases,
repeated labels under one heading and across headings, `#id` suffixes, section classes, a source
section and a roll table; `the-last-ferry.fountain` is the full-script Fountain fixture. Nothing under
`test/` reaches outside the package. fictionboard's bundled sheets are checked by
`fb-sheets-templates`' own test, not here. A new syntax case goes into `sampler.md` (or a new original
fixture), with the snapshot change explained. Types are in the snapshot because ids and section
classes are blind to a type change, yet the type picks the renderer and — via the alias — the
`div.<alias>` class the template's CSS targets. **A snapshot change is a finding, not something to
`--update-snapshots` away.**

`fill.test.ts` includes a full serialize → parse round trip of `sampler.md` with a distinct value per
slot; that is the test that catches a misfiled ordinal.

## Packaging

Published to npm as `rpg-md` (MIT, `LICENSE` holder *FictionBoard contributors*) and mirrored to
`fictionboard/rpg-md`, so the package stands alone: its own `tsconfig.json` (no `tsconfig.base.json`),
its own `.gitignore`, no path outside the directory. This file ships to the mirror too — it is public.

**The name has no `remark-` / `rehype-` prefix on purpose.** unified reserves those for packages that
work with `remark().use()` / `rehype().use()`; `buildHast` parses with its own micromark setup, not
through remark, and the package also carries fill, dice and table tools. RPG-MD is a language, named
like `micromark`; the `rehype*` exports are real plugins and the keywords say `unified`, `remark`,
`rehype`. A real remark plugin would ship under its own name, `remark-rpg-md`.

**Nothing here may point outside the package.** No `docs/…` paths, ADR numbers, design-rule codes or
plan steps of the private monorepo, in comments, tests, this file or the README: a comment that needs
a reason states it. fictionboard may be named as the consumer; its file paths may not. Fixtures are
original — no sheets or scripts from published games or films. The mirror's history is one snapshot
commit per sync, never the monorepo's log, so commit messages here do not go public.

**The mirror is this directory's tracked files, nothing more.** Each sync replaces the mirror's whole
tree with them, so a file that exists only for the public repo — `CONTRIBUTING.md` (read-only
mirror, issues welcome), later its CI — lives here, and an untracked or ignored file never goes. The
commit message is the source commit's short sha.

**`exports` names `src/index.ts` in the repo and `dist/` only in the tarball.** `prepack` builds
(`tsconfig.build.json`: `tsc` emit, `rewriteRelativeImportExtensions`) and runs
`scripts/pack-exports.mjs`, which rewrites `main` / `types` / `exports` to `dist` and drops `scripts`
and `devDependencies`; `postpack` restores the file. A conditional export (`"bun"` / `"source"` → `src`)
was the plan and does not work: mochi's client build is `Bun.build({ target: 'browser' })`, which skips
`bun` and takes no custom condition from us, so the islands would resolve a `dist/` that is not there;
and a published `bun` → `src` would point Bun users at files the tarball does not hold. A pack that
dies midway leaves `package.json.orig` — move it back.

`files: ["dist"]` — the tarball is `dist/`, README, LICENSE, `package.json`. `.d.ts` files keep `.ts`
import specifiers; TypeScript resolves them under `nodenext` and `bundler`, checked against a clean
install with `skipLibCheck: false`. To check a release by hand: `npm pack`, install the `.tgz` in an
empty directory, import it from plain Node.
