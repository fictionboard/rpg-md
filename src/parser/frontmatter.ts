/**
 * YAML-shaped frontmatter, for any object body — not only systems.
 *
 * Deliberately not a YAML parser: the authored vocabulary is scalars, one flat
 * inline list, and one flat nested map, and a real YAML dependency to read that
 * would be the whole library for three shapes. Anything outside those shapes is
 * ignored rather than thrown on — a body that fails to parse must still render.
 */

export type FrontmatterValue = string | string[] | Record<string, string>;
export type Frontmatter = Record<string, FrontmatterValue>;

const FENCE = /^---[ \t]*$/;
/** A top-level frontmatter line: `key:` with a space-free key. Markdown prose (`**The Robot**`, `My Wife`) fails it. */
const KEY_LINE = /^[A-Za-z_][\w.-]*:(\s|$)/;

/**
 * The closing fence's line index, or -1 when the body has no frontmatter. A fenced block counts only
 * when it reads as frontmatter — at least one `key:` line, every other unindented line a `#` comment
 * — because a lone `---` is also markdown's section gap (`<hr>`, CommonMark's thematic break), and a body that
 * opens with one must not lose everything up to the next. Indented lines are a key's children, any shape.
 */
function fenceEnd(lines: string[]): number {
	if (!lines[0] || !FENCE.test(lines[0])) return -1;
	const end = lines.findIndex((l, i) => i > 0 && FENCE.test(l));
	if (end === -1) return -1;
	let keys = 0;
	for (const line of lines.slice(1, end)) {
		if (!line.trim() || /^[ \t]/.test(line) || line.startsWith('#')) continue;
		if (!KEY_LINE.test(line)) return -1;
		keys++;
	}
	return keys ? end : -1;
}

/** Strips the surrounding quotes an author may or may not have written. */
function unquote(raw: string): string {
	const s = raw.trim();
	if (s.length > 1 && ((s[0] === '"' && s.endsWith('"')) || (s[0] === "'" && s.endsWith("'")))) {
		return s.slice(1, -1);
	}
	return s;
}

function splitKey(line: string): [string, string] | null {
	const idx = line.indexOf(':');
	if (idx <= 0) return null;
	return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
}

/**
 * Splits a body into its frontmatter and the markdown after it. A body with no
 * frontmatter (`fenceEnd`) is returned untouched with empty data, so every caller
 * can run this unconditionally.
 */
export function parseFrontmatter(source: string): { data: Frontmatter; body: string } {
	const lines = source.split('\n');
	const end = fenceEnd(lines);
	if (end === -1) return { data: {}, body: source };

	const data: Frontmatter = {};
	// Set while a `key:` with no value is collecting its indented children.
	let nested: { key: string; map: Record<string, string> } | null = null;

	for (const line of lines.slice(1, end)) {
		if (!line.trim() || line.trimStart().startsWith('#')) continue;

		const indented = /^[ \t]/.test(line);
		if (indented && nested) {
			const pair = splitKey(line);
			if (pair) nested.map[unquote(pair[0])] = unquote(pair[1]);
			continue;
		}

		nested = null;
		const pair = splitKey(line);
		if (!pair) continue;
		const [key, raw] = pair;

		if (raw === '') {
			nested = { key, map: {} };
			data[key] = nested.map;
		} else if (raw.startsWith('[') && raw.endsWith(']')) {
			data[key] = raw
				.slice(1, -1)
				.split(',')
				.map(unquote)
				.filter((v) => v !== '');
		} else {
			data[key] = unquote(raw);
		}
	}

	return { data, body: lines.slice(end + 1).join('\n') };
}

/** Narrowing helpers — frontmatter is authored by hand, so nothing is guaranteed. */
export function fmString(data: Frontmatter, key: string): string | undefined {
	const v = data[key];
	return typeof v === 'string' && v !== '' ? v : undefined;
}

export function fmList(data: Frontmatter, key: string): string[] | undefined {
	const v = data[key];
	return Array.isArray(v) ? v : undefined;
}

export function fmMap(data: Frontmatter, key: string): Record<string, string> | undefined {
	const v = data[key];
	return v && !Array.isArray(v) && typeof v === 'object' ? v : undefined;
}

/**
 * The same fence scan as `parseFrontmatter`, but keeping the frontmatter as the
 * text the author wrote — what an editor needs to show the two halves in two
 * panes and put them back together unchanged. `front` excludes the fences.
 */
export function splitFrontmatter(source: string): { front: string; body: string } {
	const lines = source.split('\n');
	const end = fenceEnd(lines);
	if (end === -1) return { front: '', body: source };

	return { front: lines.slice(1, end).join('\n'), body: lines.slice(end + 1).join('\n') };
}

/**
 * Inverse of `splitFrontmatter`. An empty `front` writes no fence at all — an
 * empty pair is punctuation, not frontmatter, and `withFrontKey` and
 * `parseBookFile` in fictionboard both read a fence as "there is data here".
 */
export function joinFrontmatter(front: string, body: string): string {
	return front.trim() ? `---\n${front.replace(/^\n+|\n+$/g, '')}\n---\n${body}` : body;
}
