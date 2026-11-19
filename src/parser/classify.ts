/**
 * The line classifier: what every source line of an RPG-MD body *is*, read off the
 * CommonMark parse (`micromark-setup.ts`) rather than guessed from the line's own text
 * — one classifier, so the renderer and the fill agree. It is what keeps a
 * `# x` or `Str: 3` inside a fence from being a heading or a field to `fill.ts`.
 *
 * Deliberately not a parser of RPG-MD: it never runs `parseToken` (except to word
 * `bodyWarnings`), never slugs, never renders. It labels lines by index; the callers
 * decide what a label means to them. It takes a body with frontmatter already stripped
 * (`parseFrontmatter`) — an opening `---` block would otherwise read as an `<hr>` and a
 * paragraph of `key: value` candidates.
 */
import type { Nodes, Parents } from 'mdast';
import { parseFrontmatter } from './frontmatter.ts';
import { parseMarkdown } from './micromark-setup.ts';
import { parseToken } from './rpg-components-registry.ts';
import { COMMENT_DEFINITION } from './notes.ts';

export const LINE_KINDS = ['heading', 'candidate', 'continuation', 'note', 'code', 'other'] as const;
export type LineKind = (typeof LINE_KINDS)[number];

export type ClassifiedLine =
	/** A top-level ATX heading. `text` is the raw source after the `#`s, trimmed — `(#id)` included. */
	| { kind: 'heading'; level: number; text: string }
	/**
	 * A paragraph line at top level or in a blockquote, not under a code span at its label:
	 * the only place a component or a fill value can sit. `prefix` is the `>` markers and
	 * indentation, `text` the rest, so `prefix + text` is the source line.
	 */
	| { kind: 'candidate'; prefix: string; text: string }
	/** A list item's paragraph text past its first line — swallowed into the item. */
	| { kind: 'continuation'; text: string }
	/** A one-line `[^…_note_…]:` / `[^…_comment_…]:` editor-note definition. */
	| { kind: 'note' }
	/** Inside a fenced code block, fence lines included. */
	| { kind: 'code' }
	/** Anything else: blank, a list item's first line, table, `<hr>`, HTML, nested heading. */
	| { kind: 'other'; listItem?: true };

const QUOTE_MARKER = /^[ \t]*>[ \t]?/;
const ATX_OPEN = /^[ \t]*#{1,6}(?:[ \t]+|$)/;

/** Strips up to `depth` `>` markers, then indentation. A lazy line has fewer markers. */
function splitPrefix(line: string, depth: number): { prefix: string; text: string } {
	let rest = line;
	for (let i = 0; i < depth; i++) {
		const marker = QUOTE_MARKER.exec(rest);
		if (!marker) break;
		rest = rest.slice(marker[0].length);
	}
	const indent = /^[ \t]*/.exec(rest)![0].length;
	const cut = line.length - rest.length + indent;
	return { prefix: line.slice(0, cut), text: line.slice(cut) };
}

/** Offsets of every single-line code span under `node` — a span over the label or colon makes a line prose. */
function codeSpans(node: Nodes, out: Array<[number, number]> = []): Array<[number, number]> {
	if (node.type === 'inlineCode') {
		const pos = node.position;
		// A span across a line ending goes back to literal text once paragraphs are cut
		// per line, so it covers nothing.
		if (pos && pos.start.line === pos.end.line && pos.start.offset !== undefined && pos.end.offset !== undefined) {
			out.push([pos.start.offset, pos.end.offset]);
		}
		return out;
	}
	if ('children' in node) for (const child of node.children) codeSpans(child, out);
	return out;
}

/**
 * Every line of `body` (split on `\n`), labelled. `body` must not carry frontmatter.
 * Runs micromark once per call; the server pays that per fill op, a cost accepted for
 * having one classifier.
 */
export function classifyLines(body: string): ClassifiedLine[] {
	const lines = body.split('\n');
	const starts: number[] = [];
	let offset = 0;
	for (const line of lines) {
		starts.push(offset);
		offset += line.length + 1;
	}
	const result: ClassifiedLine[] = lines.map(() => ({ kind: 'other' }));

	// A lone `\r` ends a line for micromark but not for `split('\n')`; a space keeps every
	// offset where it was and the two line counts in step.
	const tree = parseMarkdown(body.replace(/\r(?!\n)/g, ' '));

	const paragraph = (node: Nodes, quotes: number, item: Nodes | undefined): void => {
		const pos = node.position!;
		const first = pos.start.line - 1;
		const last = pos.end.line - 1;
		const split = lines.slice(first, last + 1).map((line) => splitPrefix(line, quotes));

		if (item) {
			const itemLine = item.position!.start.line - 1;
			split.forEach(({ text }, i) => {
				const index = first + i;
				if (COMMENT_DEFINITION.test(text)) result[index] = { kind: 'note' };
				else if (index === itemLine) result[index] = { kind: 'other', listItem: true };
				else result[index] = { kind: 'continuation', text };
			});
			return;
		}

		// A paragraph of nothing but `|` lines is a headless table: cells, never fields.
		if (split.every(({ text }) => text.startsWith('|'))) return;

		const spans = codeSpans(node);
		split.forEach(({ prefix, text }, i) => {
			const index = first + i;
			if (COMMENT_DEFINITION.test(text)) {
				result[index] = { kind: 'note' };
				return;
			}
			const colon = text.indexOf(':');
			if (colon >= 0) {
				const from = starts[index]! + prefix.length;
				const to = from + colon + 1;
				// A code span over the label or its colon makes the line prose.
				if (spans.some(([s, e]) => s < to && e > from)) return;
			}
			result[index] = { kind: 'candidate', prefix, text };
		});
	};

	const walk = (node: Parents, quotes: number, item: Nodes | undefined): void => {
		for (const child of node.children) {
			const pos = child.position;
			if (!pos) continue;
			switch (child.type) {
				case 'code':
					for (let line = pos.start.line - 1; line <= pos.end.line - 1; line++) {
						result[line] = { kind: 'code' };
					}
					break;
				case 'heading':
					// Only a top-level heading opens a section (`rehype-sections` walks the root).
					if (node.type === 'root') {
						const line = lines[pos.start.line - 1]!;
						const open = ATX_OPEN.exec(line);
						result[pos.start.line - 1] = {
							kind: 'heading',
							level: child.depth,
							text: open ? line.slice(open[0].length).trim() : ''
						};
					}
					break;
				case 'paragraph':
					paragraph(child, quotes, item);
					break;
				case 'definition': {
					const line = pos.start.line - 1;
					if (COMMENT_DEFINITION.test(splitPrefix(lines[line]!, quotes).text)) {
						result[line] = { kind: 'note' };
					}
					break;
				}
				case 'listItem':
					result[pos.start.line - 1] = { kind: 'other', listItem: true };
					walk(child, quotes, child);
					break;
				case 'blockquote':
					walk(child, quotes + 1, item);
					break;
				case 'list':
					walk(child, quotes, item);
					break;
				default:
					break;
			}
		}
	};

	walk(tree, 0, undefined);
	return result;
}

export interface BodyWarning {
	/** 1-based, counted in the text `bodyWarnings` was given. */
	line: number;
	message: string;
}

/**
 * A component line CommonMark swallows into the list item above it. It renders as
 * part of the item's text, not as a component, and nothing else would say so.
 *
 * Takes the whole document: frontmatter is stripped here and line numbers count from the
 * top of what was passed, so an editor can map them straight onto its own lines.
 */
export function bodyWarnings(source: string): BodyWarning[] {
	const { body } = parseFrontmatter(source);
	const skipped = source.slice(0, source.length - body.length).split('\n').length - 1;
	const warnings: BodyWarning[] = [];
	classifyLines(body).forEach((line, index) => {
		if (line.kind !== 'continuation') return;
		const text = line.text.trim();
		if (!text || !parseToken(text)) return;
		warnings.push({
			line: skipped + index + 1,
			message:
				'This component line continues the list item above, so it renders as list text. Put a blank line before it.'
		});
	});
	return warnings;
}
