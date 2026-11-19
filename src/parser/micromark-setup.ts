/**
 * The one micromark / mdast-util-from-markdown configuration RPG-MD is read with.
 *
 * It exists so the line classifier (`classify.ts`, which `fill.ts` reads) and the
 * renderer agree on what every line *is*: if they parsed with different constructs, a
 * line could be a field to the fill and a code block to the reader. Anything that parses
 * an RPG-MD body as CommonMark takes its configuration from here.
 *
 * `parseInline` is the same configuration with every block construct off — one parser
 * for a line's inline markdown wherever it lives.
 *
 * Deliberately not a renderer: no HAST, no sanitising, no RPG-MD component detection.
 * Raw HTML constructs stay on — CommonMark parses them and the renderer drops the nodes
 * (refused input is dropped silently).
 */
import type { PhrasingContent, Root } from 'mdast';
import { fromMarkdown, type Extension as MdastExtension } from 'mdast-util-from-markdown';
import { gfmStrikethroughFromMarkdown } from 'mdast-util-gfm-strikethrough';
import { gfmTableFromMarkdown } from 'mdast-util-gfm-table';
import { gfmTaskListItemFromMarkdown } from 'mdast-util-gfm-task-list-item';
import { gfmStrikethrough } from 'micromark-extension-gfm-strikethrough';
import { gfmTable } from 'micromark-extension-gfm-table';
import { gfmTaskListItem } from 'micromark-extension-gfm-task-list-item';
import type { Extension } from 'micromark-util-types';

/**
 * Constructs CommonMark has and RPG-MD turns off. Setext underlines because
 * `text⏎---` is a paragraph and a deck's section gap, never a heading; indented code
 * because indentation means list nesting and nothing else.
 */
export const DISABLED_CONSTRUCTS = ['setextUnderline', 'codeIndented'] as const;

/**
 * micromark syntax extensions. GFM is taken piecemeal: no footnotes (`[^src]` stays
 * literal) and no autolink literals; strikethrough on double tilde only, so `~5 gp` stays
 * text.
 */
export const micromarkExtensions: Extension[] = [
	gfmStrikethrough({ singleTilde: false }),
	gfmTable(),
	gfmTaskListItem(),
	{ disable: { null: [...DISABLED_CONSTRUCTS] } }
];

/** The mdast side of `micromarkExtensions`, in the same order. */
export const mdastExtensions: MdastExtension[] = [
	gfmStrikethroughFromMarkdown(),
	gfmTableFromMarkdown(),
	gfmTaskListItemFromMarkdown()
];

/** `source` as mdast, positions included, under the configuration above. */
export function parseMarkdown(source: string): Root {
	return fromMarkdown(source, { extensions: micromarkExtensions, mdastExtensions });
}

/**
 * Every CommonMark block construct, off for `parseInline`: `- x`, `# x`, `> x`, `1. x` and
 * `---` stay text. GFM tables and task lists are left out of the extension list instead.
 */
const BLOCK_CONSTRUCTS = [
	'blockQuote',
	'codeFenced',
	'codeIndented',
	'definition',
	'headingAtx',
	'htmlFlow',
	'list',
	'setextUnderline',
	'thematicBreak'
] as const;

const inlineMicromarkExtensions: Extension[] = [
	gfmStrikethrough({ singleTilde: false }),
	{ disable: { null: [...BLOCK_CONSTRUCTS] } }
];
const inlineMdastExtensions: MdastExtension[] = [gfmStrikethroughFromMarkdown()];

/**
 * One line of inline markdown as mdast phrasing — emphasis, code spans, links, images,
 * strikethrough, escapes and entities. No definitions are in scope, so a reference
 * link stays text. Leading and trailing whitespace go, as in any CommonMark paragraph.
 */
export function parseInline(line: string): PhrasingContent[] {
	const tree = fromMarkdown(line, { extensions: inlineMicromarkExtensions, mdastExtensions: inlineMdastExtensions });
	const first = tree.children[0];
	return first?.type === 'paragraph' ? first.children : [];
}
