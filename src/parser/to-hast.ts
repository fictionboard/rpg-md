/**
 * mdast → HAST for everything RPG-MD renders from markdown — bodies (`markdown-to-hast.ts`),
 * headless table cells and inline text (`inline-markdown.ts`) — so every door has the same
 * fences — refused input is dropped silently:
 *
 * - raw `html` nodes are dropped: `allowDangerousHtml` stays off, nothing authored is markup;
 * - an `<a>` whose `href` fails `isSafeUrl` is replaced by its text, an `<img>` loses `src`;
 * - every surviving `<a>` carries `rpg-link`. The app's reset is `a { color: inherit;
 *   text-decoration: none }`, right for chrome, so a prose link needs a class of its own to
 *   look like one; it is also what a template's CSS or a stage skin overrides.
 *
 * Not the macro pass (`rehype-links.ts`) and not component detection. fictionboard's `safeHast`
 * is the second fence, for trees that never met this one.
 */
import type { Element, ElementContent, Nodes as HastNodes } from 'hast';
import type { Nodes as MdastNodes } from 'mdast';
import { toHast } from 'mdast-util-to-hast';
import { isSafeUrl } from './rehype-links.ts';

export function mdastToHast(tree: MdastNodes): HastNodes {
	const hast = toHast(tree);
	if ('children' in hast) guard(hast as Element);
	return hast;
}

function guard(parent: { children: ElementContent[] }): void {
	const out: ElementContent[] = [];
	for (const child of parent.children) {
		if (child.type !== 'element') {
			out.push(child);
			continue;
		}
		guard(child);
		if (child.tagName === 'a') {
			const href = child.properties.href;
			if (typeof href !== 'string' || !isSafeUrl(href)) {
				out.push(...child.children);
				continue;
			}
			child.properties.className = ['rpg-link'];
		}
		if (child.tagName === 'img') {
			const src = child.properties.src;
			if (typeof src === 'string' && !isSafeUrl(src)) delete child.properties.src;
		}
		out.push(child);
	}
	parent.children = out;
}
