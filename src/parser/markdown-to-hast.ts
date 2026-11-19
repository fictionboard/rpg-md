/**
 * An RPG-MD body (frontmatter already stripped) → HAST, before sections, components, table ids
 * and macros. CommonMark + GFM (`micromark-setup.ts`) does the parsing; the passes here put back
 * what RPG-MD means on top of it:
 *
 * - One Enter is one paragraph: every `paragraph` is cut at its line endings, in quotes and
 *   list items too. An inline construct spanning a line ending falls back to its source text.
 * - Quotes are strict: a lazy line under `>` leaves the quote. A list ends at a blank line
 *   between items.
 * - A lone `\` line is `<p><br></p>`.
 * - A component line, as the classifier (`classify.ts`) and `parseToken` read it, is one
 *   `<p>` holding the raw line as one text node — no inline markdown, so `rehype-components`
 *   sees the text it always saw. The rule that a code span over the label or colon makes the
 *   line prose comes from the classifier.
 * - A paragraph of nothing but `|` lines is a headless `<table><tbody>`.
 * - Editor notes are removed, definition lines and inline markers.
 *
 * Every split paragraph keeps a `position` over its line, so `rehype-components` can read an
 * option's or a description's source text back out of the body.
 *
 * Not component detection, sectioning or the macro pass — those run on the HAST (`hast.ts`).
 */
import type { Element, Root as HastRoot } from 'hast';
import type { Blockquote, List, ListItem, Nodes, Paragraph, Parents, PhrasingContent, RootContent } from 'mdast';
import { classifyLines, type ClassifiedLine } from './classify.ts';
import { parseInline, parseMarkdown } from './micromark-setup.ts';
import { phrasingToHast } from './inline-markdown.ts';
import { COMMENT_DEFINITION, NOTE_LABEL, stripNoteMarkers } from './notes.ts';
import { parseToken } from './rpg-components-registry.ts';
import { mdastToHast } from './to-hast.ts';

const QUOTE_MARKER = /^[ \t]*>[ \t]?/;

interface Context {
	source: string;
	lines: string[];
	/** Offset of each line's first character. */
	starts: number[];
	classified: ClassifiedLine[];
}

/** A block, and how many `>` markers its line really had — fewer than its depth means lazy. */
interface Placed {
	node: RootContent;
	markers: number;
}

export function markdownToHast(body: string): HastRoot {
	// As `classifyLines` does: a lone `\r` ends a line for micromark but not for `split('\n')`.
	const source = body.replace(/\r(?!\n)/g, ' ');
	const lines = source.split('\n');
	const starts: number[] = [];
	let offset = 0;
	for (const line of lines) {
		starts.push(offset);
		offset += line.length + 1;
	}
	const ctx: Context = { source, lines, starts, classified: classifyLines(body) };

	const tree = parseMarkdown(source);
	stripNotes(tree);
	tree.children = blocks(tree.children, ctx, 0, false).map((p) => p.node);
	return mdastToHast(tree) as HastRoot;
}

/** Editor notes: inline markers out of text (never `inlineCode`), and a marker CommonMark read as a reference link. */
function stripNotes(parent: Parents): void {
	parent.children = (parent.children as Nodes[]).flatMap((child): Nodes[] => {
		if (child.type === 'text') {
			const value = stripNoteMarkers(child.value);
			return value ? [{ ...child, value }] : [];
		}
		if (child.type === 'linkReference' && NOTE_LABEL.test(child.label ?? child.identifier)) return [];
		if ('children' in child) stripNotes(child);
		return [child];
	}) as typeof parent.children;
}

/** Up to `depth` `>` markers off the front of `line`, then indentation; `markers` is how many were there. */
function splitPrefix(line: string, depth: number): { prefix: number; markers: number } {
	let rest = line;
	let markers = 0;
	for (; markers < depth; markers++) {
		const marker = QUOTE_MARKER.exec(rest);
		if (!marker) break;
		rest = rest.slice(marker[0].length);
	}
	const indent = /^[ \t]*/.exec(rest)![0].length;
	return { prefix: line.length - rest.length + indent, markers };
}

function blocks(children: RootContent[], ctx: Context, quotes: number, inItem: boolean): Placed[] {
	const out: Placed[] = [];
	for (const child of children) {
		switch (child.type) {
			case 'paragraph':
				out.push(...paragraph(child, ctx, quotes, inItem));
				break;
			case 'blockquote':
				out.push(...blockquote(child, ctx, quotes, inItem));
				break;
			case 'list':
				for (const list of splitList(child, ctx)) {
					for (const item of list.children) listItem(item, ctx, quotes);
					out.push({ node: list, markers: quotes });
				}
				break;
			default:
				out.push({ node: child, markers: quotes });
		}
	}
	return out;
}

/**
 * Strict quotes: a lazy line CommonMark kept in the quote goes back out of it, in place. A run of quoted
 * blocks either side of it stays one blockquote each.
 */
function blockquote(node: Blockquote, ctx: Context, quotes: number, inItem: boolean): Placed[] {
	const depth = quotes + 1;
	const out: Placed[] = [];
	let run: RootContent[] = [];
	const flush = () => {
		if (run.length) out.push({ node: { ...node, children: run } as Blockquote, markers: quotes });
		run = [];
	};
	for (const placed of blocks(node.children, ctx, depth, inItem)) {
		if (placed.markers >= depth) run.push(placed.node);
		else {
			flush();
			out.push(placed);
		}
	}
	flush();
	return out;
}

/** One Enter is one paragraph, in a list item. Two paragraphs make the list loose, as CommonMark's own two would. */
function listItem(item: ListItem, ctx: Context, quotes: number): void {
	item.children = blocks(item.children, ctx, quotes, true).map((p) => p.node) as ListItem['children'];
	if (item.children.filter((c) => c.type === 'paragraph').length > 1) item.spread = true;
}

/** A blank line between two items ends the list; the next item starts another. */
function splitList(list: List, ctx: Context): List[] {
	const out: List[] = [];
	let current: ListItem[] = [];
	const flush = () => {
		if (!current.length) return;
		const first = current[0]!.position;
		const last = current.at(-1)!.position;
		// A later run of a numbered list starts at its own first item's number.
		const number = list.ordered && first?.start.offset !== undefined ? /\d+/.exec(lineAt(ctx, first.start.offset))?.[0] : undefined;
		out.push({
			...list,
			start: number ? Number(number) : list.start,
			// The blank lines that made CommonMark call it loose are gone; an item's own still count.
			spread: false,
			children: current,
			position: first && last ? { start: first.start, end: last.end } : list.position
		});
		current = [];
	};
	for (const item of list.children) {
		const prev = current.at(-1);
		if (prev?.position && item.position && item.position.start.line - prev.position.end.line > 1) flush();
		current.push(item);
	}
	flush();
	return out;
}

/** The rest of the line from `offset`. */
function lineAt(ctx: Context, offset: number): string {
	const end = ctx.source.indexOf('\n', offset);
	return ctx.source.slice(offset, end < 0 ? undefined : end);
}

/** Each line's phrasing, by source line. A construct across a line ending becomes its source text. */
function phrasingByLine(node: Paragraph, ctx: Context, quotes: number): PhrasingContent[][] {
	const first = node.position!.start.line - 1;
	const last = node.position!.end.line - 1;
	const out: PhrasingContent[][] = Array.from({ length: last - first + 1 }, () => []);
	const put = (line: number, child: PhrasingContent) => out[Math.min(Math.max(line - first, 0), last - first)]!.push(child);

	for (const child of node.children) {
		const pos = child.position;
		if (child.type === 'break' || !pos) continue;
		const startLine = pos.start.line - 1;
		if (child.type === 'text') {
			child.value.split('\n').forEach((value, k) => {
				if (value) put(startLine + k, { type: 'text', value });
			});
		} else if (pos.start.line === pos.end.line) {
			put(startLine, child);
		} else {
			ctx.source
				.slice(pos.start.offset, pos.end.offset)
				.split('\n')
				.forEach((raw, k) => {
					const value = k ? raw.slice(splitPrefix(raw, quotes).prefix) : raw;
					if (value) put(startLine + k, { type: 'text', value });
				});
		}
	}
	return out;
}

/** Leading and trailing whitespace off a line's phrasing, empty text dropped. */
function trimEdges(nodes: PhrasingContent[]): PhrasingContent[] {
	const out = [...nodes];
	const edge = (i: number, trim: (s: string) => string) => {
		const n = out[i];
		if (n?.type === 'text') out[i] = { ...n, value: trim(n.value) };
	};
	edge(0, (s) => s.trimStart());
	edge(out.length - 1, (s) => s.trimEnd());
	return out.filter((n) => n.type !== 'text' || n.value);
}

/** The rules above, on one paragraph: one block per source line. */
function paragraph(node: Paragraph, ctx: Context, quotes: number, inItem: boolean): Placed[] {
	const pos = node.position;
	if (!pos || pos.start.offset === undefined) return [{ node, markers: quotes }];
	const first = pos.start.line - 1;
	const last = pos.end.line - 1;

	const lines: Array<{ index: number; from: number; to: number; text: string; markers: number }> = [];
	for (let index = first; index <= last; index++) {
		const line = ctx.lines[index]!.replace(/\r$/, '');
		const { prefix, markers } = splitPrefix(line, quotes);
		const from = index === first ? pos.start.offset : ctx.starts[index]! + prefix;
		const to = ctx.starts[index]! + line.length;
		// A lazy line is outside the quote — not inside a list item, where it stays with it.
		lines.push({ index, from, to, text: ctx.source.slice(from, to), markers: inItem ? quotes : index === first ? quotes : markers });
	}
	const at = (l: (typeof lines)[number]): Paragraph['position'] => ({
		start: { line: l.index + 1, column: l.from - ctx.starts[l.index]! + 1, offset: l.from },
		end: { line: l.index + 1, column: l.to - ctx.starts[l.index]! + 1, offset: l.to }
	});

	// A headless table, cells never components (the classifier agrees).
	if (!inItem && lines.every((l) => l.text.startsWith('|'))) {
		const tbody: Element = {
			type: 'element',
			tagName: 'tbody',
			properties: {},
			children: lines.map((l) => ({
				type: 'element',
				tagName: 'tr',
				properties: {},
				children: cells(l.text).map((cell) => {
					const root: Paragraph = { type: 'paragraph', children: parseInline(cell) };
					stripNotes(root);
					return { type: 'element', tagName: 'td', properties: {}, children: phrasingToHast(root.children) } as Element;
				})
			}))
		};
		const position = { start: at(lines[0]!)!.start, end: at(lines.at(-1)!)!.end };
		return [{ node: { type: 'paragraph', children: [], position, data: { hName: 'table', hChildren: [tbody] } }, markers: quotes }];
	}

	const phrasing = phrasingByLine(node, ctx, quotes);
	const out: Placed[] = [];
	lines.forEach((l, i) => {
		const kind = ctx.classified[l.index];
		const raw = l.text.trim();
		if (kind?.kind === 'note' || COMMENT_DEFINITION.test(raw)) return;
		const text = stripNoteMarkers(raw).trim();
		const position = at(l);
		const place = (p: Paragraph) => out.push({ node: p, markers: l.markers });

		if (text === '\\') {
			place({ type: 'paragraph', children: [], position, data: { hChildren: [{ type: 'element', tagName: 'br', properties: {}, children: [] }] } });
		} else if (!inItem && kind?.kind === 'candidate' && parseToken(text)) {
			place({ type: 'paragraph', children: [{ type: 'text', value: text }], position });
		} else {
			const children = trimEdges(phrasing[i]!);
			if (children.length) place({ type: 'paragraph', children, position });
		}
	});
	return out;
}

/** A headless table row's cells: one outer pipe off each end, split on every unescaped `|`, trimmed. */
function cells(row: string): string[] {
	return row
		.trim()
		.replace(/^\|/, '')
		.replace(/(?<!\\)\|$/, '')
		.split(/(?<!\\)\|/)
		.map((c) => c.trim());
}
