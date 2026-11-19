# rpg-md

Character sheets written as Markdown. `rpg-md` parses **RPG-MD** — CommonMark + GFM with
component lines for fields, formulas and dice — into a [HAST](https://github.com/syntax-tree/hast)
tree you render however you like. It is the parser behind [FictionBoard](https://github.com/fictionboard).

```md
## Attributes

Strength: Number(3)
Agility: Number(2)
Defense: Computed(Strength + Agility)
```

Headings become nested `<section>`s with stable ids; each component line becomes an element carrying
its type and config as `data-*` attributes, ready for a renderer to turn into an input.

## Install

```sh
npm install rpg-md
```

ESM only. Runs in Node ≥ 20, Bun and the browser; no DOM needed. Types included.

## Use

```ts
import { buildHast, templateSlots, serializeFill, parseFill } from 'rpg-md';

const template = await buildHast(source, 'markdown');

// Every field the sheet declares, with the id it binds to.
const slots = templateSlots(template);

// A filled sheet is the template with values in place of declarations, and reads back.
const filled = serializeFill(source, template, { attributes__strength: 4 });
const { data, unresolved } = parseFill(filled, template);
```

Also exported: `evaluateFormula`, the dice helpers (`parseDice`, `rollDice`), frontmatter helpers,
`tableModel` for roll tables, and the individual rehype plugins.

## Documentation

Syntax reference and guides: <https://fictionboard.github.io/rpg-md/>

## Contributing

This repository is a read-only mirror; development happens upstream. Issues are welcome.

## License

[MIT](./LICENSE)
