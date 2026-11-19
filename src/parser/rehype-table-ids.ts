/**
 * `data-table-id` on every `<table>`, `<ul>` and `<ol>`: the address a Rollable Table's config is keyed by
 * in frontmatter `tables:`. The id is
 * the nearest enclosing section's `data-slug` — so a heading's `(#id)` overrides it — then `_2`,
 * `_3` on collision, the same counter component ids use. Before any heading the base is `table`.
 *
 * Runs after `rehype-components`: a list under a `Select` is that component's options and is
 * spliced out there, so it never takes an id or bumps the counter. Tables and lists share one
 * namespace, because `tables:` is one map; a numbered list is a list like any other, so a
 * `1. …` line before a table shifts its id. Not table inference (`tableModel.ts`).
 *
 * Renaming a heading renames its tables' ids and orphans their config — the risk component ids
 * already carry.
 */
import type { Element, Root } from 'hast';
import { uniqueComponentId } from './rehype-components.ts';

const ADDRESSED: ReadonlySet<string> = new Set(['table', 'ul', 'ol']);

export default function rehypeTableIds() {
	return (tree: Root) => {
		const used = new Set<string>();
		// Real ancestry, not `rehype-components`' never-reset preorder slug: a table after a
		// nested section closes takes the outer section's slug.
		const walk = (node: Root | Element, slug: string) => {
			for (const child of node.children) {
				if (child.type !== 'element') continue;
				if (ADDRESSED.has(child.tagName)) {
					child.properties['data-table-id'] = uniqueComponentId(used, slug);
					continue;
				}
				const own = child.tagName === 'section' ? child.properties['data-slug'] : undefined;
				walk(child, typeof own === 'string' && own ? own : slug);
			}
		};
		walk(tree, 'table');
	};
}
