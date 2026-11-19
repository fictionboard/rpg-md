/**
 * A counter's default rewritten in place, for a body-first document whose value lives in the
 * component line itself — a Plot's `Progress: Checks(0/8)`, a location's `Torches: Number(6, 0-6)`
 * (fictionboard's Clocks: any counter field can be a clock). A fill has no such
 * line: its value replaces the declaration, which is `applyFillOp`'s job, not this one's.
 *
 * The component is found by its `data-component-id`, never re-derived from the line: the id comes
 * off the built tree (`templateSlots`), and the line is found by that slot's `(heading path, label,
 * ordinal)` the way `serializeFill` walks a template — so the id rule (`rehype-components`'
 * never-reset section slug, `_2` on collision) lives in one place.
 */
import { markdownHast } from '../hast.ts';
import { classifyLines } from './classify.ts';
import { HeadingStack, templateSlots } from './fill.ts';
import { parseFrontmatter } from './frontmatter.ts';
import { KNOWN_ATTRIBUTES, parseToken } from './rpg-components-registry.ts';

const KNOWN: ReadonlySet<string> = new Set(KNOWN_ATTRIBUTES);

/** `content` split on top-level commas — `parseGenericAttributes`' split, kept verbatim per part. */
function splitArgs(content: string): string[] {
	const parts: string[] = [];
	let current = '';
	let depth = 0;
	let quote = '';
	for (const ch of content) {
		if (quote) {
			if (ch === quote) quote = '';
		} else if (ch === '"' || ch === "'") quote = ch;
		else if ('([{'.includes(ch)) depth++;
		else if (')]}'.includes(ch)) depth--;
		else if (ch === ',' && depth === 0) {
			parts.push(current);
			current = '';
			continue;
		}
		current += ch;
	}
	parts.push(current);
	return parts;
}

/**
 * Whether `part` is what `parseGenericAttributes` would read as the positional default: not a
 * range, not a bracket list, not a known `name value` attribute or bare flag.
 */
function isPositional(part: string): boolean {
	const t = part.trim();
	if (!t || /^\d+-\d+$/.test(t) || t.startsWith('[')) return false;
	const attr = /^(\w+)\s+(.+)$/.exec(t);
	if (attr && KNOWN.has(attr[1]!)) return false;
	return !(KNOWN.has(t) && /^[a-zA-Z_]\w*$/.test(t));
}

/** `line`'s component arguments with the positional default set to `literal`, inserted first when absent. */
function replaceDefault(text: string, component: string, literal: string): string {
	const colon = text.indexOf(':');
	const name = text.indexOf(component, colon);
	const afterName = name + component.length;
	const open = text.indexOf('(', afterName);
	// `Torches: Number` with no brackets, or brackets only after an `#id`: give it some.
	if (open < 0 || text.slice(afterName, open).trim()) return `${text.slice(0, afterName)}(${literal})${text.slice(afterName)}`;
	let depth = 0;
	let close = -1;
	for (let i = open; i < text.length; i++) {
		if (text[i] === '(') depth++;
		else if (text[i] === ')' && --depth === 0) {
			close = i;
			break;
		}
	}
	if (close < 0) return text;
	const parts = splitArgs(text.slice(open + 1, close));
	const at = parts.findIndex(isPositional);
	if (at >= 0) parts[at] = parts[at]!.replace(/\S(.*\S)?/, literal);
	else if (parts.length === 1 && !parts[0]!.trim()) parts[0] = literal;
	else parts.unshift(literal, ...parts.splice(0, 1).map((p) => (/^\s/.test(p) ? p : ` ${p}`)));
	return `${text.slice(0, open + 1)}${parts.join(',')}${text.slice(close)}`;
}

/**
 * `source` with counter `id`'s literal default set to `value`: `Checks(3/8)` (held to `0…total`,
 * whole boxes), `Number(4, 0-6)` (range and attributes kept, no clamp — the caller holds the
 * range). Unchanged when no `Number` or `Checks` component (aliases included) has that id, or
 * `value` is not finite.
 */
export function withCounterDefault(source: string, id: string, value: number): string {
	if (!Number.isFinite(value)) return source;
	const { body } = parseFrontmatter(source);
	const slot = templateSlots(markdownHast(body)).find((s) => s.id === id);
	if (!slot || (slot.type !== 'Number' && slot.type !== 'Checks')) return source;
	const prefix = body === source ? '' : source.slice(0, source.length - body.length);

	const lines = body.split('\n');
	const kinds = classifyLines(body);
	const headings = new HeadingStack();
	const counts = new Map<string, number>();
	const wanted = JSON.stringify([slot.path, slot.label.trim().toLowerCase()]);
	for (let i = 0; i < lines.length; i++) {
		const kind = kinds[i]!;
		if (kind.kind === 'heading') {
			headings.push(kind.level, kind.text);
			continue;
		}
		if (kind.kind !== 'candidate') continue;
		const config = kind.text.trim() ? parseToken(kind.text.trim()) : undefined;
		if (!config) continue;
		const key = JSON.stringify([headings.path(), config.label.trim().toLowerCase()]);
		const ordinal = (counts.get(key) ?? 0) + 1;
		counts.set(key, ordinal);
		if (key !== wanted || ordinal !== slot.ordinal) continue;
		const total = slot.total ?? ('total' in config ? Number(config.total) : 1);
		const literal = slot.type === 'Checks' ? `${Math.min(total, Math.max(0, Math.round(value)))}/${total}` : String(value);
		lines[i] = kind.prefix + replaceDefault(kind.text, config.alias, literal);
		return prefix + lines.join('\n');
	}
	return source;
}
