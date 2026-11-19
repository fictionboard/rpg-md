/**
 * A built `<table>`, `<ul>` or `<ol>` read as a roll table: which dice, which column is the key, and which
 * faces each row covers, inferred:
 *
 * 1. The first header cell is dice (`d6`, `2d6`, `d66`, `d100`, `2d6+1`; `dice.ts`, never forced) → column 1 is the key.
 * 2. Else, every first cell is a key or range (`3`, `1-2`, `11–16`, `00`) → key column, dice from
 *    the highest key (`d66` when every key is two digits 1–6 and the top is 66).
 * 3. Else uniform: `1dN`, row i is face i. A list is always this — an `<ol>` too, its `start`
 *    ignored.
 *
 * Gaps and overlaps are warnings, never errors — an uncovered face rolls "no entry". A row whose
 * key does not parse gets `min = max = 0`, which no face reaches.
 *
 * The author's `key` / `dice` overrides from frontmatter `tables:` enter as the second argument,
 * because they change inference. The rest of the config (`draw`, `pick`, `columns`, `each`) is
 * fictionboard's and not applied here, and nothing rolls. Cells come back as markdown (`[text](href)` kept) so a subtable
 * link or inline dice survives into the roller and the roll log, where they resolve.
 */
import type { Element, ElementContent } from 'hast';
import { diceFaces, parseDice } from '../dice.ts';

export interface TableRow {
	min: number;
	max: number;
	/** Every cell, the key cell included, so the config's 1-based column indexes line up. */
	cells: string[];
}

export interface TableModel {
	id: string;
	dice: string;
	/** 1-based; 0 means none (uniform), as the config's `key`. */
	keyColumn: number;
	header: string[];
	rows: TableRow[];
	warnings: string[];
}

const KEY = /^(\d+)(?:\s*[-–—]\s*(\d+))?$/;

/** Every face `text` can show, or `null` when it is not table dice — a forced roll is a result, not a die. */
function faces(text: string): number[] | null {
	const d = parseDice(text);
	return d && !d.forced ? diceFaces(d) : null;
}

/** `00` is 100, the percentile convention. */
const num = (s: string): number => (s === '00' ? 100 : Number(s));

function parseKey(cell: string): { min: number; max: number; digits: string[] } | null {
	const m = KEY.exec(cell.trim());
	if (!m) return null;
	const min = num(m[1]!);
	const max = m[2] === undefined ? min : num(m[2]);
	return min <= max ? { min, max, digits: [m[1]!, m[2] ?? m[1]!] } : null;
}

function markdownOf(node: ElementContent): string {
	if (node.type === 'text') return node.value;
	if (node.type !== 'element') return '';
	const inner = node.children.map(markdownOf).join('');
	return node.tagName === 'a' ? `[${inner}](${String(node.properties.href)})` : inner;
}

const kids = (el: Element, tags: string[]): Element[] =>
	el.children.filter((c): c is Element => c.type === 'element' && tags.includes(c.tagName));

const cellsOf = (tr: Element): string[] => kids(tr, ['th', 'td']).map((c) => c.children.map(markdownOf).join('').trim());

const rowsOf = (table: Element, section: string): string[][] =>
	kids(table, [section]).flatMap((s) => kids(s, ['tr'])).map(cellsOf);

/** Consecutive faces (in `all`'s order, so d66's 16 → 21 is one step) as `a` or `a–b`. */
function runs(hits: number[], all: number[]): string[] {
	const out: string[] = [];
	let start = -1;
	for (let i = 0; i <= all.length; i++) {
		const hit = i < all.length && hits.includes(all[i]!);
		if (hit && start < 0) start = i;
		if (!hit && start >= 0) {
			out.push(start === i - 1 ? `${all[start]}` : `${all[start]}–${all[i - 1]}`);
			start = -1;
		}
	}
	return out;
}

/** The config's `key` and `dice`, applied before inference so gaps are checked against what will roll. */
export interface TableOverride {
	/** 1-based key column; 0 = none, uniform. */
	key?: number;
	/** Ignored unless it parses as unforced table dice. */
	dice?: string;
}

/** Rows keyed on column `key` (0 = row i is face i), with gaps and overlaps checked against `dice`. */
function build(id: string, dice: string, key: number, header: string[], body: string[][]): TableModel {
	const warnings: string[] = [];
	const rows = body.map((cells, i) => {
		if (!key) return { min: i + 1, max: i + 1, cells };
		const k = parseKey(cells[key - 1] ?? '');
		if (!k) warnings.push(`Row ${i + 1} has no key`);
		return { min: k?.min ?? 0, max: k?.max ?? 0, cells };
	});
	const all = faces(dice);
	if (!rows.length || !all) return { id, dice, keyColumn: key, header, rows, warnings: [...warnings, 'No rows'] };
	const count = (f: number) => rows.filter((r) => r.min <= f && f <= r.max).length;
	for (const r of runs(all.filter((f) => count(f) === 0), all)) warnings.push(`No entry for ${r}`);
	for (const r of runs(all.filter((f) => count(f) > 1), all)) warnings.push(`Overlap on ${r}`);
	return { id, dice, keyColumn: key, header, rows, warnings };
}

/** Dice read off key column `key`'s header, else from its highest key; `null` when it is no die. */
function keyDice(header: string[], body: string[][], key: number): string | null {
	const head = (header[key - 1] ?? '').toLowerCase();
	if (faces(head)) return head;
	const keys = body.map((r) => parseKey(r[key - 1] ?? '')).filter((k) => k !== null);
	if (!keys.length) return null;
	const top = Math.max(...keys.map((k) => k.max));
	const d66 = top === 66 && keys.every((k) => k.digits.every((d) => /^[1-6]{2}$/.test(d)));
	const dice = d66 ? 'd66' : `d${top}`;
	// A top key past dice.ts's caps is not a die (page numbers, years in the ten thousands).
	return faces(dice) ? dice : null;
}

/**
 * The roll model of a table or list `rehype-table-ids` addressed; `null` for anything else.
 * `override` is the config's `key` / `dice`: an explicit key column skips inference (a bad key there
 * warns rather than falling back), `key: 0` forces uniform, and `dice` replaces what was inferred.
 */
export function tableModel(el: Element, override: TableOverride = {}): TableModel | null {
	const id = el.properties['data-table-id'];
	if (typeof id !== 'string') return null;
	let header: string[] = [];
	let body: string[][];
	if (el.tagName === 'ul' || el.tagName === 'ol') body = kids(el, ['li']).map((li) => [li.children.map(markdownOf).join('').trim()]);
	else if (el.tagName === 'table') {
		header = rowsOf(el, 'thead')[0] ?? [];
		body = rowsOf(el, 'tbody');
	} else return null;

	const forced = override.dice && faces(override.dice.toLowerCase()) ? override.dice.toLowerCase() : null;
	let key = 0;
	let dice: string | null = null;
	if (el.tagName === 'table' && override.key !== 0) {
		if (override.key && override.key > 0) {
			key = override.key;
			dice = keyDice(header, body, key);
		} else if (faces((header[0] ?? '').toLowerCase()) || (body.length && body.every((r) => parseKey(r[0] ?? '')))) {
			// Rules 1 and 2 above: a dice header, or a first column that is all keys.
			dice = keyDice(header, body, 1);
			if (dice) key = 1;
		}
	}
	return build(id, forced ?? dice ?? `1d${body.length}`, key, header, body);
}
