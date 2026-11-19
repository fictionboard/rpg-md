/**
 * The macro pass: `[Barbarian](/set class=barbarian, str=+1)`, `/add`, `/remove` → an `<a>`
 * with no `href`, classes `rpg-link rpg-macro`, `data-macro` and `data-args`, claimed from the
 * text nodes of a built tree. Also home to `isSafeUrl` and `MD_LINK`.
 *
 * It exists because a macro link is not a CommonMark link — the destination holds whitespace —
 * so CommonMark leaves it as text.
 * Ordinary links are CommonMark's (`to-hast.ts` gives them `rpg-link`); this pass never makes an
 * `href`. No `href` on purpose: a macro is not a navigation, so the shell's click interception
 * and the middle click never see one. What the args mean is up to the consuming app.
 *
 * Never inside an `<a>`, a code span or block, or a component (its text is its declaration). The
 * args run to the first `)`. A run is matched inside one text node, so emphasis inside the
 * bracket (`[**x**](/set a=1)`) keeps the macro literal. Other macros (`/roll`, `/random`, …)
 * are unbuilt and stay text.
 */

import { SKIP, visit } from 'unist-util-visit';
import type { Element, ElementContent, Root, Text } from 'hast';

/**
 * `[text](target)`, a target without whitespace. Group 1 is the text, group 2 the target.
 * Not used to render; fictionboard reads markdown with it for the links that render as links.
 */
export const MD_LINK = /(?<!!)\[([^\]]*)\]\(([^)\s]+)\)/g;

/** Group 1 the text, 2 the macro, 3 its args. */
const MACRO_LINK = /(?<!!)\[([^\]]*)\]\(\/(set|add|remove)\s+([^)]*)\)/g;

/** Subtrees whose text is never prose to claim from. */
function skipSubtree(node: Element): boolean {
	if (node.tagName === 'a' || node.tagName === 'code' || node.tagName === 'pre') return true;
	const classNames = node.properties?.className;
	// One array entry holding both classes, as `rpgComponentToHast` writes it.
	return (
		Array.isArray(classNames) &&
		classNames.some((c) => typeof c === 'string' && c.includes('rpg-component'))
	);
}

/**
 * http(s), mailto, or no scheme at all: a relative path, `/abs`, `#frag`, `?q`, or a
 * first segment that ends before any `:` (`page?q=a:b`, `rel/x:y`, `caf%C3%A9.png` — CommonMark
 * percent-encodes a url, so a segment is more than scheme characters). Anything else that
 * looks like `scheme:` is refused. Control characters anywhere and whitespace up front
 * are refused, because browsers strip them before reading the scheme (`\x01javascript:`,
 * ` javascript:`).
 *
 * The one rule for every url a document carries: `to-hast.ts` drops a refused one, and
 * fictionboard's `HastRenderer` allowlist checks `href` and `src` with it too, so a tree that never met this parser is held to the same test.
 */
const SAFE_URL = /^(?:https?:|mailto:|[^a-z\s]|[a-z][^:/?#]*(?:[/?#]|$))/i;
const CONTROL = /[\x00-\x1f\x7f]/;
export const isSafeUrl = (url: string): boolean => SAFE_URL.test(url) && !CONTROL.test(url);

function split(value: string): ElementContent[] | null {
	const out: ElementContent[] = [];
	let last = 0;
	for (const m of value.matchAll(MACRO_LINK)) {
		const args = m[3]!.trim();
		if (!args) continue;
		const at = m.index!;
		if (at > last) out.push({ type: 'text', value: value.slice(last, at) });
		out.push({
			type: 'element',
			tagName: 'a',
			properties: { className: ['rpg-link', 'rpg-macro'], 'data-macro': m[2]!, 'data-args': args },
			children: [{ type: 'text', value: m[1]! }]
		});
		last = at + m[0].length;
	}
	if (!out.length) return null;
	if (last < value.length) out.push({ type: 'text', value: value.slice(last) });
	return out;
}

export default function rehypeLinks() {
	return (tree: Root) => {
		visit(tree, (node, index, parent) => {
			if (node.type === 'element' && skipSubtree(node as Element)) return SKIP;
			if (node.type !== 'text' || !parent || index === undefined) return;
			const parts = split((node as Text).value);
			if (!parts) return;
			parent.children.splice(index, 1, ...parts);
			return index + parts.length;
		});
	};
}
