import { unified } from 'unified';
import type { Root } from 'hast';
import rehypeSections from './parser/rehype-sections.ts';
import rehypeComponents from './parser/rehype-components.ts';
import rehypeLinks from './parser/rehype-links.ts';
import rehypeTableIds from './parser/rehype-table-ids.ts';
import rehypeFountain from './parser/rehype-fountain.ts';
import { markdownToHast } from './parser/markdown-to-hast.ts';
import { parseFrontmatter } from './parser/frontmatter.ts';

/** `markdown` is RPG-MD; `fountain` is a screenplay (a Session body renders as a script). */
export const BODY_FORMATS = ['markdown', 'fountain'] as const;
export type BodyFormat = (typeof BODY_FORMATS)[number];

export interface BuildHastOptions {
	/**
	 * The system key this body belongs to. Unread for now: it is what authored
	 * `headerMappings` will flow through once content needs per-system heading
	 * vocabulary. Added here rather than later because changing this signature once
	 * is cheaper than changing it twice.
	 */
	system?: string;
}

// Built once: every plugin keeps its state inside the transformer, so a frozen
// processor is safe to share across calls. A plugin with module-level mutable
// state would leak it between bodies. No parser: `markdownToHast` builds the tree.
const processor = unified()
	.use(rehypeSections)
	// After sections: component ids take the section's slug.
	.use(rehypeComponents)
	// After components: a choice's option list is spliced out there and must take no id.
	.use(rehypeTableIds)
	// Last: a component's text is never claimed for a macro, and it is a component by now.
	.use(rehypeLinks)
	.freeze();

// No rehype-sections: rehype-fountain replaces the whole tree with its own scene
// sections (ids, `data-slug`), which components then prefix their ids with. No table
// ids either — a screenplay has no tables. Its elements' inline markdown, macros
// included, is rendered inside rehype-fountain.
const fountainProcessor = unified().use(rehypeFountain).use(rehypeComponents).freeze();

/**
 * Frontmatter is stripped before parsing, for every body and not only a system's —
 * otherwise `dice: d6` renders as a paragraph, and in RPG-MD it
 * would be read as a component line. A body without frontmatter is unaffected.
 *
 * `'fountain'` skips markdown's block structure: the body goes in as one text node, so a
 * `# ` or `- ` line is never a heading or a list.
 *
 * There was an `'html'` format that handed the body to parse5 raw — a
 * script-injection door with no caller that needed it. Do not bring it back: in
 * `'markdown'`, raw HTML is dropped (`to-hast.ts`), so nothing an author writes becomes markup.
 *
 * The body rides along as the file, so `rehype-components` can read an option's source text
 * back out by position.
 */
export async function buildHast(
	source: string,
	format: BodyFormat = 'markdown',
	opts?: BuildHastOptions
): Promise<Root> {
	const { body } = parseFrontmatter(source);
	if (format === 'fountain') {
		const tree: Root = { type: 'root', children: [{ type: 'text', value: body }] };
		return fountainProcessor.runSync(tree) as Root;
	}
	return markdownHast(body);
}

/**
 * A markdown body (frontmatter already stripped) to its tree, synchronously — `buildHast`'s own
 * work, for a pure string rewrite that must stay sync (`literal.ts`). Not exported from the package.
 */
export function markdownHast(body: string): Root {
	return processor.runSync(markdownToHast(body), body) as Root;
}
