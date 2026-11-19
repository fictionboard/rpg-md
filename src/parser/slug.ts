/**
 * Heading slugs and element text, shared by section wrapping, Fountain scenes and the fill
 * addresser. `fill.ts` must slug a heading exactly as `rehype-sections.ts` does, or a fill's
 * heading path stops matching the section it was written for — so there is one `toSlug`.
 * Not a general slugify: it knows RPG-MD's `(#id)`, `(.class)` and `(@role)` heading metadata.
 */
import type { Nodes } from 'hast';

const ID_BRACKET = /\(#([^)]+)\)/;
const ROLE_TOKENS = /\s@[\w-]+(?=\s|$)/g;

/**
 * `(#id …)`'s first token replaces the text; otherwise everything from the first `(` is
 * metadata. Only the first token: the rest of the bracket is `headingAttrs`' key=value pairs.
 */
export function toSlug(text: string): string {
	const paren = text.indexOf('(');
	const source = text.includes('(#')
		? (ID_BRACKET.exec(text)?.[1]?.trim().split(/\s+/)[0] ?? '')
		: paren > -1
			? text.slice(0, paren)
			: text;
	return source
		.trim()
		.toLowerCase()
		.replace(/[^\w ]+/g, '')
		.replace(/\s/g, '_')
		.replace(/_+/g, '_')
		.replace(/^_|_$/g, '');
}

/**
 * The `key=value` pairs after the id in `(#id key=value …)` — a slide's shot overrides
 * in fictionboard's stage. A value runs to the next ` key=` or the `)`, so it may hold
 * spaces and commas (`with=letterbox, gap:fade`); it cannot hold `)`.
 */
export function headingAttrs(text: string): Record<string, string> {
	const rest = (ID_BRACKET.exec(text)?.[1]?.trim().replace(/^\S+/, '') ?? '').replace(ROLE_TOKENS, '');
	const attrs: Record<string, string> = {};
	for (const [, key, value] of rest.matchAll(/\s(\w[\w-]*)=(.*?)(?=\s+\w[\w-]*=|$)/g)) {
		attrs[key!] = value!.trim();
	}
	return attrs;
}

/**
 * The `@role` tokens in a heading's brackets — `(@narrator)`, `(#rolls @narrator @player)`,
 * `(.wide @player)`. A bracket that opens with `@` counts only when every token is a role,
 * so a formula like `(@dex - 10)` in a heading stays text. Any role string is accepted; the
 * app decides which exist (`filterRoles`).
 */
export function headingRoles(text: string): string[] {
	return [...text.matchAll(/\(([^)]*)\)/g)].flatMap(([, inner]) => {
		const tokens = inner!.trim().split(/\s+/);
		const roles = tokens.filter((t) => /^@[\w-]+$/.test(t)).map((t) => t.slice(1));
		if (tokens[0]?.startsWith('@')) return roles.length === tokens.length ? roles : [];
		return /^[#.]/.test(tokens[0] ?? '') ? roles : [];
	});
}

/** Per-document duplicate counter: the first `a` stays `a`, then `a_1`, `a_2`. */
export function uniqueSlugs(): (slug: string) => string {
	const seen = new Map<string, number>();
	return (slug) => {
		const count = seen.get(slug) ?? 0;
		seen.set(slug, count + 1);
		return count === 0 ? slug : `${slug}_${count}`;
	};
}

/** Concatenated text of every descendant text node. */
export function textOf(node: Nodes): string {
	if (node.type === 'text') return node.value;
	return 'children' in node ? node.children.map(textOf).join('') : '';
}
