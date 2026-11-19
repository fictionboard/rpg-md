/**
 * Fountain (https://fountain.io/syntax) → a flat list of script elements. A block parser after
 * `FastFountainParser.m` in https://github.com/nyousefi/Fountain (MIT, Nima Yousefi & John
 * August): one pass over the lines, with blank lines carrying the state — a scene heading, cue
 * or transition needs one before it, dialogue runs to the next one.
 *
 * Basic support: no title page (frontmatter is ours, stripped before this runs) and no page
 * breaks (a `===` line reads as a blank line). Emphasis is not read here; each element's
 * content goes through `inlineMarkdown` in `rehype-fountain.ts`. Every forcing mark (`.` `@`
 * `!` `~` `>` `<` `^`) is stripped from `content`.
 *
 * Notes `[[…]]`, boneyard `/* … *\/`, sections `#` and synopses `=` are parsed and hidden. A
 * note or boneyard on lines of its own is an element; one inside a line is cut out of it and
 * kept on that element's `hidden`, so a caller can tell something was there.
 */
import { splitFrontmatter } from './frontmatter.ts';

export const FOUNTAIN_ELEMENT_TYPES = [
	'scene-heading',
	'character',
	'dialogue',
	'parenthetical',
	'action',
	'transition',
	'lyrics',
	'note',
	'boneyard',
	'section',
	'synopsis'
] as const;
export type FountainElementType = (typeof FOUNTAIN_ELEMENT_TYPES)[number];

const HIDDEN_TYPES = ['note', 'boneyard', 'section', 'synopsis'] as const;
export type HiddenElementType = (typeof HIDDEN_TYPES)[number];

export function isHiddenElement(type: FountainElementType): type is HiddenElementType {
	return (HIDDEN_TYPES as readonly string[]).includes(type);
}

export interface HiddenPart {
	type: 'note' | 'boneyard';
	content: string;
}

export interface FountainElement {
	type: FountainElementType;
	/** The text as shown, forcing marks stripped; lines joined by `\n`. */
	content: string;
	/** A note or boneyard cut out of this element's lines. */
	hidden: HiddenPart[];
	/** scene-heading: setting, location, time, sceneNumber. character: name, extension, dual. dialogue / parenthetical: character. action: centered. section: depth. */
	metadata: Record<string, any>;
}

// A note or boneyard is swapped for `<n>` before the line pass, so it can span lines.
const MARK = /(\d+)/g;
const NOTE = /\[\[([\s\S]*?)\]\]/g;
const BONEYARD = /\/\*([\s\S]*?)\*\//g;

// `EXT/INT` and `E/I` aren't in the spec but get written for `INT./EXT.`; read as the same.
const SCENE_HEADING = /^(INT|EXT|EST|(I|INT)\.?\/(E|EXT)\.?|(E|EXT)\.?\/(I|INT)\.?)[.\-\s].+/i;
const SCENE_NUMBER = /\s*#([\w.-]+)#\s*$/;
const TRANSITION = /^[^a-z]*TO:$/;
const PAGE_BREAK = /^={3,}\s*$/;
const DIALOGUE_BLOCK = new Set<FountainElementType>(['character', 'dialogue', 'parenthetical']);

export function parseFountainDocument(text: string): FountainElement[] {
	const parts: HiddenPart[] = [];
	const mark = (type: HiddenPart['type']) => (_: string, content: string) => {
		parts.push({ type, content: content.trim() });
		return `${parts.length - 1}`;
	};
	const source = text
		.replace(/\r\n?/g, '\n')
		.replace(/[\uE000\uE001]/g, '')
		.replace(BONEYARD, mark('boneyard'))
		// A note won't look past a blank line for its close; two spaces keep a blank inside it.
		.replace(NOTE, (match, content: string) => (/\n\n/.test(content) ? match : mark('note')(match, content)));

	const lines = source.split('\n');
	const elements: FountainElement[] = [];
	let blankBefore = true;
	let inDialogue = false;

	const last = () => elements[elements.length - 1];
	const push = (type: FountainElementType, content: string, metadata: Record<string, any> = {}) => {
		const element: FountainElement = { type, content, hidden: [], metadata };
		elements.push(element);
		return element;
	};
	/** Appends to the last element when it is `type` and no blank line came between, else starts one. */
	const extend = (type: FountainElementType, content: string, metadata: Record<string, any> = {}) => {
		const previous = last();
		const same = previous?.type === type && JSON.stringify(previous.metadata) === JSON.stringify(metadata);
		if (!blankBefore && same) {
			previous.content += '\n' + content;
			return previous;
		}
		return push(type, content, metadata);
	};

	for (const [i, raw] of lines.entries()) {
		const hidden: HiddenPart[] = [];
		const line = raw.replace(MARK, (_, n: string) => {
			hidden.push(parts[Number(n)]!);
			return '';
		});

		// A note or boneyard on lines of its own: an element, and the blank-line state is untouched.
		if (hidden.length && !line.trim()) {
			const previous = last();
			if (blankBefore || !previous) for (const part of hidden) push(part.type, part.content);
			else previous.hidden.push(...hidden);
			continue;
		}

		const element = parseLine(line, lines[i + 1]);
		if (element) element.hidden.push(...hidden);
	}

	return elements;

	function parseLine(line: string, next: string | undefined): FountainElement | undefined {
		const t = line.trimStart();

		// Two spaces: a blank kept inside dialogue.
		if (inDialogue && /^ {2}$/.test(line)) {
			const previous = last();
			if (previous?.type === 'dialogue') previous.content += '\n';
			return previous;
		}

		if (!line.trim() || PAGE_BREAK.test(line)) {
			blankBefore = true;
			inDialogue = false;
			return undefined;
		}

		const element = classify(line, t, next);
		blankBefore = false;
		if (!DIALOGUE_BLOCK.has(element.type) && !isHiddenElement(element.type)) inDialogue = false;
		return element;
	}

	function classify(line: string, t: string, next: string | undefined): FountainElement {
		if (t.startsWith('!')) return action(line.replace(/^(\s*)!/, '$1'));

		if (t.startsWith('@')) return character(t.slice(1));

		if (t.startsWith('~')) return extend('lyrics', t.slice(1));

		if (t.startsWith('=')) return push('synopsis', t.slice(1).trim());

		if (t.startsWith('#')) {
			const depth = t.match(/^#+/)![0].length;
			return push('section', t.slice(depth).trim(), { depth });
		}

		if (/^\.[^.\s]/.test(t)) return sceneHeading(t.slice(1).trim(), true);

		if (blankBefore && SCENE_HEADING.test(t)) return sceneHeading(t.trim(), false);

		if (blankBefore && TRANSITION.test(t) && !next?.trim()) return push('transition', t);

		if (t.startsWith('>')) {
			const inner = t.slice(1).trim();
			if (inner.endsWith('<')) return extend('action', inner.slice(0, -1).trim(), { centered: true });
			return push('transition', inner);
		}

		if (blankBefore && next?.trim() && isCue(t)) return character(t);

		if (inDialogue) {
			const cue = lastCue();
			if (/^\(.*\)\s*$/.test(t) && last()?.type !== 'parenthetical') return push('parenthetical', t.trim(), { character: cue });
			return extend('dialogue', t, { character: cue });
		}

		return action(line);
	}

	function action(line: string): FountainElement {
		return extend('action', line.replace(/\t/g, '    ').trimEnd());
	}

	function sceneHeading(text: string, forced: boolean): FountainElement {
		const number = text.match(SCENE_NUMBER);
		const content = number ? text.slice(0, number.index).trim() : text;
		const metadata: Record<string, any> = { ...headingParts(content, forced) };
		if (number) metadata.sceneNumber = number[1];
		return push('scene-heading', content, metadata);
	}

	function character(text: string): FountainElement {
		const dual = /\^\s*$/.test(text);
		const content = text.replace(/\s*\^\s*$/, '').trim();
		const [, name, extension] = content.match(/^(.*?)\s*((?:\([^)]*\)\s*)*)$/)!;
		if (dual) {
			const previous = [...elements].reverse().find((el) => el.type === 'character');
			if (previous) previous.metadata.dual = true;
		}
		inDialogue = true;
		return push('character', content, { name: name!.trim(), extension: extension!.trim() || undefined, dual: dual || undefined });
	}

	function lastCue(): string | undefined {
		for (let i = elements.length - 1; i >= 0; i--) {
			if (elements[i]!.type === 'character') return elements[i]!.metadata.name;
		}
		return undefined;
	}
}

/** A scene heading's leading `INT` / `EXT` / `EST` / `I/E` (or the reversed `EXT/INT`) — read only after a blank line. */
export const isSceneHeading = (line: string): boolean => SCENE_HEADING.test(line.trim());

/** A scene heading's prefix as written, and the spec's spelling of it (`normalizeSceneHeadings`). */
const PREFIX = /^(INT\.?\s*\/\s*EXT|EXT\.?\s*\/\s*INT|I\s*\/\s*E|E\s*\/\s*I|INT|EXT|EST)\.?(?=\s)/i;
const CANONICAL: Record<string, string> = { 'INT/EXT': 'INT./EXT.', 'EXT/INT': 'INT./EXT.', 'I/E': 'I/E', 'E/I': 'I/E', INT: 'INT.', EXT: 'EXT.', EST: 'EST.' };

/**
 * Every scene heading's prefix in the spec's spelling — `INT HOUSE` → `INT. HOUSE`, `ext/int.
 * shack` → `INT./EXT. shack`, `E/I` → `I/E` — for a body on save. Only the prefix changes; a
 * line reads as a heading where the parser would read one (after a blank line, outside a
 * boneyard, not forced with `.`), frontmatter is left alone, and a body with none comes back as is.
 */
export function normalizeSceneHeadings(source: string): string {
	const lines = source.split('\n');
	const { front, body } = splitFrontmatter(source);
	const start = front || body !== source ? lines.length - body.split('\n').length : 0;
	let blankBefore = true;
	let inBoneyard = false;
	for (let i = start; i < lines.length; i++) {
		const line = lines[i]!;
		if (inBoneyard) {
			inBoneyard = !line.includes('*/');
			continue;
		}
		const t = line.trimStart();
		if (blankBefore && SCENE_HEADING.test(t)) {
			const prefix = t.match(PREFIX);
			const canonical = prefix && CANONICAL[prefix[1]!.replace(/[\s.]/g, '').toUpperCase()];
			if (canonical && prefix[0] !== canonical) lines[i] = line.slice(0, line.length - t.length) + canonical + t.slice(prefix[0].length);
		}
		// Two spaces keep a blank inside dialogue, so they never open a heading.
		blankBefore = (!line.trim() && !/^ {2}$/.test(line)) || PAGE_BREAK.test(line);
		inBoneyard = /\/\*(?![\s\S]*\*\/)/.test(line);
	}
	return lines.join('\n');
}

/** All caps, at least one letter, and an extension `(…)` at the end in any case. Read only after a blank line, with a line under it. */
export function isCue(line: string): boolean {
	const name = line
		.trim()
		.replace(/\s*\^$/, '')
		.replace(/(\s*\([^)]*\))+$/, '');
	return /\p{Lu}/u.test(name) && !/\p{Ll}/u.test(name);
}

/** `INT. TAVERN - NIGHT` → setting, location, time; a forced heading is all location. */
function headingParts(text: string, forced: boolean): { setting?: string; location: string; timeOfDay?: string } {
	const match = forced ? null : text.match(/^(INT\.?\/EXT\.?|I\/E\.?|EXT\.?\/INT\.?|E\/I\.?|INT\.?|EXT\.?|EST\.?)\s*(.*?)(?:\s+-\s+(.*))?$/i);
	if (!match) return { location: text };
	const setting = /^E/i.test(match[1]!) && match[1]!.includes('/') ? 'INT./EXT.' : match[1]!.toUpperCase();
	return { setting, location: match[2]!.trim(), timeOfDay: match[3]?.trim() || undefined };
}
