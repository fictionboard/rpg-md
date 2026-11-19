/**
 * Inline markdown source → HAST children, for text that lives outside a markdown body: an
 * option's `description` (`ChoiceOption`) and each Fountain element (`rehype-fountain.ts`).
 * The same inline parser a body's paragraphs get — CommonMark inline plus GFM strikethrough
 * (`micromark-setup.ts` `parseInline`), the same url fences (`to-hast.ts`) and the macro pass
 * (`rehype-links.ts`) — so a description renders as its text would in a body.
 *
 * One `br` per `\n`, each line parsed alone, so no construct spans a line (one Enter is one
 * paragraph, as in a body). Not
 * block markdown: no paragraphs, lists, headings or components.
 *
 * `'fountain'` reads emphasis as https://fountain.io/syntax does: `_x_` is underline (`u`), where
 * CommonMark has it italic. The rest already agrees — `***x***` is bold italic, `\*` escapes,
 * nothing spans a line. A `__x__` stays bold: the spec has no double underscore.
 */
import type { Element, ElementContent, Root } from 'hast';
import type { PhrasingContent } from 'mdast';
import type { BodyFormat } from '../hast.ts';
import { parseInline } from './micromark-setup.ts';
import rehypeLinks from './rehype-links.ts';
import { mdastToHast } from './to-hast.ts';

/**
 * mdast phrasing → HAST children, through `to-hast.ts`'s fences. No macro pass. Positions are
 * dropped: they count from wherever the text was parsed alone, not from any body, and
 * `rehype-components` reads source text by position.
 */
export function phrasingToHast(children: PhrasingContent[]): ElementContent[] {
	const unplace = (node: ElementContent): ElementContent => {
		delete node.position;
		if (node.type === 'element') node.children.forEach(unplace);
		return node;
	};
	return (mdastToHast({ type: 'paragraph', children }) as Element).children.map(unplace);
}

export function inlineMarkdown(md: string, format: BodyFormat = 'markdown'): ElementContent[] {
	const tree: Root = {
		type: 'root',
		children: md.split('\n').flatMap((line, i): ElementContent[] => {
			const phrasing = parseInline(line);
			if (format === 'fountain') underline(phrasing, line);
			return [
				...(i ? [{ type: 'element', tagName: 'br', properties: {}, children: [] } as ElementContent] : []),
				...phrasingToHast(phrasing)
			];
		})
	};
	rehypeLinks()(tree);
	return tree.children as ElementContent[];
}

/**
 * Every `_`-delimited emphasis becomes `u`. mdast keeps no marker, so it is read off the line at
 * the node's start offset — which is why this runs before `phrasingToHast` drops positions.
 */
function underline(nodes: PhrasingContent[], line: string): void {
	for (const node of nodes) {
		if (node.type === 'emphasis' && line[node.position?.start.offset ?? -1] === '_') {
			node.data = { ...node.data, hName: 'u' };
		}
		if ('children' in node) underline(node.children as PhrasingContent[], line);
	}
}
