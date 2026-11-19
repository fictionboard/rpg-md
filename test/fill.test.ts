/**
 * A fill is its template with values in place of declarations, addressed by heading path,
 * label and ordinal rather than by a label map.
 *
 * These are the characterization tests that were written against `parseFilledMarkdown`,
 * carried over onto the structural parser that replaced it, plus repeated labels, which the
 * label map dropped (one key per label) and this one keeps.
 */
import { beforeAll, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
	applyFillOp,
	buildHast,
	parseFill,
	serializeFill,
	templateSlots
} from '../src/index.ts';
import { silenceParserLogs } from './helpers.ts';

silenceParserLogs();

const TEMPLATE = `## About

Name: Text()
Class: Select([Fighter, Mage])

## Stats

Strength: Number(0-20)
Injury: Text()
`;

let template: Awaited<ReturnType<typeof buildHast>>;

beforeAll(async () => {
	template = await buildHast(TEMPLATE, 'markdown');
});

describe('parseFill', () => {
	test('values land under the section-prefixed component id, not the label', () => {
		expect(parseFill('## About\n\nName: Björn\n\n## Stats\n\nStrength: 16', template).data).toEqual({
			about__name: 'Björn',
			stats__strength: 16
		});
	});

	test('numeric values are coerced, everything else stays a string', () => {
		const fill = '## Stats\n\nStrength: 16\nInjury: 18/20\n\n## About\n\nName: Björn';
		expect(parseFill(fill, template).data).toEqual({
			stats__strength: 16,
			stats__injury: '18/20',
			about__name: 'Björn'
		});
	});

	test('labels match case-insensitively', () => {
		expect(parseFill('## About\n\nNAME: Björn', template).data).toEqual({ about__name: 'Björn' });
	});

	test('surrounding whitespace on label and value is trimmed', () => {
		expect(parseFill('## About\n\n   Name :  Björn  ', template).data).toEqual({
			about__name: 'Björn'
		});
	});

	test('only the first colon splits the line', () => {
		expect(parseFill('## About\n\nName: Björn: the Bold', template).data).toEqual({
			about__name: 'Björn: the Bold'
		});
	});

	test('blank and colon-less lines are skipped', () => {
		expect(parseFill('## About\n\nno colon here\nName: Björn\n', template).data).toEqual({
			about__name: 'Björn'
		});
	});

	test('an empty value writes no key, so the template default still applies', () => {
		// The label map read it as the number 0 — `Number('')` — and a blank field
		// rendered as a zero. A blank line carries no value at all now.
		expect(parseFill('## About\n\nName:', template).data).toEqual({});
	});

	test('a blank line still claims its slot, so the ordinals below it do not shift', async () => {
		const hast = await buildHast('## Heart\n\nRating: Number()\nRating: Number()\nRating: Number()\n', 'markdown');
		expect(parseFill('## Heart\n\nRating: 6\nRating:\nRating: 2', hast).data).toEqual({
			heart__rating: 6,
			heart__rating_3: 2
		});
	});

	test('a label no slot claims is surfaced, never dropped', () => {
		const result = parseFill('## About\n\nUnknown: 5\nName: Björn', template);
		expect(result.data).toEqual({ about__name: 'Björn' });
		expect(result.unresolved).toEqual([
			{ path: ['about'], label: 'Unknown', ordinal: 1, value: 5 }
		]);
	});

	test('frontmatter carries the template key and version', () => {
		const result = parseFill('---\ntemplate: simple-rpg\nversion: 2\n---\n\nName: Björn', template);
		expect(result.template).toBe('simple-rpg');
		expect(result.version).toBe(2);
	});

	test('a value under the wrong heading still resolves by label order', () => {
		// A heading rename is a text edit, not a reorder — it must not orphan values.
		expect(parseFill('## Who\n\nName: Björn', template).data).toEqual({ about__name: 'Björn' });
	});

	test('a pre-0013 flat body, with no headings at all, still resolves', () => {
		expect(parseFill('Name: Björn\nStrength: 16', template).data).toEqual({
			about__name: 'Björn',
			stats__strength: 16
		});
	});

	test('multi-line and list values survive a round trip', () => {
		const data = { about__name: 'line one\nline two', about__class: ['fighter', 'mage'] };
		const fill = serializeFill(TEMPLATE, template, data);
		expect(parseFill(fill, template).data).toMatchObject(data);
	});
});

describe('repeated labels', () => {
	const REPEATED_TEMPLATE = `## Heart

Rating: Number(0-6)
Rating: Number(0-6)
Rating: Number(0-6)
`;

	test('each occurrence keeps its own value', async () => {
		const hast = await buildHast(REPEATED_TEMPLATE, 'markdown');
		const fill = '## Heart\n\nRating: 6\nRating: 4\nRating: 2';

		// Identity is (heading path, label, ordinal) — three ratings, three values, in order.
		expect(Object.values(parseFill(fill, hast).data)).toEqual([6, 4, 2]);
	});

	test('repeated labels get distinct component ids', async () => {
		const hast = await buildHast(REPEATED_TEMPLATE, 'markdown');
		expect(templateSlots(hast).map((s) => s.id)).toEqual([
			'heart__rating',
			'heart__rating_2',
			'heart__rating_3'
		]);
	});

	test('three ratings round-trip through the serializer', async () => {
		const hast = await buildHast(REPEATED_TEMPLATE, 'markdown');
		const data = { heart__rating: 6, heart__rating_2: 4, heart__rating_3: 2 };
		const fill = serializeFill(REPEATED_TEMPLATE, hast, data);
		expect(parseFill(fill, hast).data).toEqual(data);
	});
});

describe('serializeFill', () => {
	test('emits the template document with values in place of declarations', () => {
		const fill = serializeFill(TEMPLATE, template, {
			about__name: 'Björn',
			about__class: 'Fighter',
			stats__strength: 16
		});

		expect(fill).toBe(
			['## About', '', 'Name: Björn', 'Class: Fighter', '', '## Stats', '', 'Strength: 16', 'Injury: ', ''].join(
				'\n'
			)
		);
	});

	test('an option list under a Select is dropped — a fill records the choice', () => {
		const src = '## About\n\nClass: Select()\n\n- Fighter\n- Mage\n';
		const fill = serializeFill(src, template, {});
		expect(fill).not.toContain('- Fighter');
	});

	test('frontmatter declares the template and its version', () => {
		const fill = serializeFill(TEMPLATE, template, {}, { template: 'simple-rpg', version: 3 });
		expect(fill.startsWith('---\ntemplate: simple-rpg\nversion: 3\n---\n')).toBe(true);
	});
});

/**
 * Part 4 of the fixed-choices job: a value the slot does not offer is *reported*, not
 * refused. Every assertion here checks the value still landed in `data`.
 */
describe('parseFill — invalid values', () => {
	const CHOICES = `## About

Class: Select([Fighter, Mage])
Heritage: Radio([Akoros, The Dagger Isles])
Conditions: MultiSelect([Cold, Haunted])
Awe: Checks(0/5)
Patron: Select(#patrons)
Strength: Number(0-20)
`;

	let choices: Awaited<ReturnType<typeof buildHast>>;

	beforeAll(async () => {
		choices = await buildHast(CHOICES, 'markdown');
	});

	test('a value outside the option list is reported and still written', () => {
		const doc = parseFill('## About\n\nClass: Warlock', choices);
		expect(doc.data['about__class']).toBe('Warlock');
		expect(doc.invalid).toEqual([
			{
				path: ['about'],
				label: 'Class',
				ordinal: 1,
				id: 'about__class',
				value: 'Warlock',
				expected: 'one of Fighter, Mage'
			}
		]);
	});

	test('a label matches case-folded, so an old slugged fill is not a typo', () => {
		expect(parseFill('## About\n\nClass: fighter', choices).invalid).toEqual([]);
	});

	test('Checks accepts 0..total and nothing else', () => {
		expect(parseFill('## About\n\nAwe: 5', choices).invalid).toEqual([]);
		const doc = parseFill('## About\n\nAwe: 6', choices);
		expect(doc.data['about__awe']).toBe(6);
		expect(doc.invalid[0]?.expected).toBe('a whole number from 0 to 5');
	});

	test('one bad entry condemns a MultiSelect line', () => {
		const doc = parseFill('## About\n\nConditions: [Cold, Smug]', choices);
		expect(doc.data['about__conditions']).toEqual(['Cold', 'Smug']);
		expect(doc.invalid).toHaveLength(1);
		expect(parseFill('## About\n\nConditions: [Cold, Haunted]', choices).invalid).toEqual([]);
		expect(parseFill('## About\n\nConditions: []', choices).invalid).toEqual([]);
	});

	test('a Radio validates like a Select, multi-word labels included', () => {
		expect(parseFill('## About\n\nHeritage: The Dagger Isles', choices).invalid).toEqual([]);
		expect(parseFill('## About\n\nHeritage: Tycheros', choices).invalid).toHaveLength(1);
	});

	test('an unresolved source list and a Number range are unvalidatable, not invalid', () => {
		// A clamp is not a typo, and `#patrons` names no section, so it has no options.
		const doc = parseFill('## About\n\nPatron: Anyone\nStrength: 99', choices);
		expect(doc.invalid).toEqual([]);
	});
});

describe('applyFillOp', () => {
	const FILL = '---\ntemplate: t\nversion: 1\n---\n\n## Heart\n\nRating: 6\nRating: 4\n';

	test('splices the addressed line and leaves the rest alone', () => {
		const out = applyFillOp(FILL, { path: ['heart'], label: 'Rating', ordinal: 2, value: 5 });
		expect(out).toBe('---\ntemplate: t\nversion: 1\n---\n\n## Heart\n\nRating: 6\nRating: 5\n');
	});

	test('falls back to the global label ordinal when the path has drifted', () => {
		const out = applyFillOp(FILL, {
			path: ['soul'],
			label: 'Rating',
			ordinal: 1,
			globalOrdinal: 1,
			value: 3
		});
		expect(out).toContain('Rating: 3\nRating: 4');
	});

	test('appends a label the body does not have yet', () => {
		const out = applyFillOp('', { path: [], label: 'Name', ordinal: 1, value: 'Björn' });
		expect(out.trim()).toBe('Name: Björn');
	});
});

describe('the sampler sheet', () => {
	const SHEET = join(import.meta.dir, 'fixtures/templates/sampler.md');

	test('every value survives a serialize → parse round trip', async () => {
		const source = readFileSync(SHEET, 'utf-8');
		const hast = await buildHast(source, 'markdown');
		const slots = templateSlots(hast);

		// A distinct value per slot, so a lost or misfiled one — a repeated label landing on
		// its neighbour's ordinal — is visible.
		const data = Object.fromEntries(slots.map((slot, i) => [slot.id, i + 1]));
		const fill = serializeFill(source, hast, data, { template: 'sampler', version: 1 });
		const parsed = parseFill(fill, hast);

		expect(parsed.data).toEqual(data);
		expect(parsed.unresolved).toEqual([]);
		expect(parsed.template).toBe('sampler');
	});

	test('a label repeated under one heading resolves to one id per ordinal', async () => {
		const hast = await buildHast(readFileSync(SHEET, 'utf-8'), 'markdown');
		const bonds = templateSlots(hast).filter((s) => s.label === 'Bond');
		expect(bonds.map((s) => s.id)).toEqual(['bonds__bond', 'bonds__bond_2', 'bonds__bond_3']);
	});

	test('a label repeated across headings resolves by heading', async () => {
		const hast = await buildHast(readFileSync(SHEET, 'utf-8'), 'markdown');
		const slots = templateSlots(hast);
		expect(slots.filter((s) => s.label === 'Rating').map((s) => s.id)).toEqual([
			'hands__hands_rating',
			'feet__feet_rating',
			'head__head_rating'
		]);
		expect(slots.filter((s) => s.label === 'Name').map((s) => s.id)).toEqual([
			'identity__name',
			'tool_1__name',
			'tool_2__name',
			'tool_3__name'
		]);
	});
});

/**
 * The scanners read `classifyLines`, the same line labels the renderer uses, so code, notes
 * and swallowed list text are never fields and a fenced `# x` is never a heading.
 */
describe('fill on the line classifier', () => {
	const FENCED = '## About\n\n```\n# Stats\nStrength: 3\n```\n\nName: Björn\n';

	test('parseFill: a fenced `Str: 3` is not a field, a fenced `# x` is not a heading', () => {
		const doc = parseFill(FENCED, template);
		expect(doc.data).toEqual({ about__name: 'Björn' });
		expect(doc.unresolved).toEqual([]);
	});

	test('applyFillOp: a fenced line is never spliced, and the path skips the fenced heading', () => {
		const out = applyFillOp(FENCED, { path: ['about'], label: 'Strength', ordinal: 1, value: 9 });
		expect(out).toContain('```\n# Stats\nStrength: 3\n```');
		expect(out.trimEnd().endsWith('Strength: 9')).toBe(true);

		const named = applyFillOp(FENCED, { path: ['about'], label: 'Name', ordinal: 1, value: 'Ulf' });
		expect(named).toBe(FENCED.replace('Name: Björn', 'Name: Ulf'));
	});

	test('serializeFill: fenced lines survive verbatim and do not move the path', () => {
		const src = '## About\n\n```\n# Stats\nName: Text()\n```\n\nName: Text()\n';
		const fill = serializeFill(src, template, { about__name: 'Björn' });
		expect(fill).toBe('## About\n\n```\n# Stats\nName: Text()\n```\n\nName: Björn\n');
	});

	test('a note definition is skipped, not reported', () => {
		const doc = parseFill('## About\n\n[^x_note_1]: Name: nope\nName: Björn', template);
		expect(doc.data).toEqual({ about__name: 'Björn' });
		expect(doc.unresolved).toEqual([]);
	});

	test('a quoted field keeps its marker when spliced', () => {
		const out = applyFillOp('## About\n\n> Name: Björn\n', {
			path: ['about'],
			label: 'Name',
			ordinal: 1,
			value: 'Ulf'
		});
		expect(out).toBe('## About\n\n> Name: Ulf\n');
	});
});
