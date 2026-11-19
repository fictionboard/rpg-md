/**
 * Characterization tests for buildHast — section wrapping, ids, classes and
 * component detection. This is the shape every renderer in fictionboard reads.
 */
import { describe, expect, test } from 'bun:test';
import { buildHast, filterRoles, headingAttrs, headingRoles, textOf, toSlug } from '../src/index.ts';
import {
	classNames,
	componentIds,
	components,
	elements,
	elementsByTag,
	silenceParserLogs
} from './helpers.ts';

silenceParserLogs();

const SHEET = `# Björn

## Stats

Strength: Number(10, 0-20)
Dexterity: Number(10)

### Physical (.wide)

Rating: Number(0-6)

## Gear

Just prose.

- Sword
- Shield
`;

describe('component detection', () => {
	test('a component paragraph becomes a div carrying its config as data attributes', async () => {
		const tree = await buildHast('## Stats\n\nStrength: Number(10, 0-20)\n', 'markdown');
		const [component] = components(tree);

		expect(component?.tagName).toBe('div');
		expect(component?.properties).toMatchObject({
			'data-component-type': 'Number',
			'data-component-alias': 'Number',
			'data-component-id': 'stats__strength',
			'data-label': 'Strength',
			'data-min': 0,
			'data-max': 20
		});
		expect(classNames(component!)).toEqual(['rpg-component rpg-number']);
	});

	test('a component id is prefixed with the slug of its innermost section', async () => {
		const tree = await buildHast(SHEET, 'markdown');
		expect(componentIds(tree)).toEqual([
			'stats__strength',
			'stats__dexterity',
			'physical__rating'
		]);
	});

	test('outside any section a component keeps its bare id', async () => {
		const tree = await buildHast('Strength: Number(1)', 'markdown');
		expect(componentIds(tree)).toEqual(['strength']);
	});

	test('prose paragraphs are left alone', async () => {
		const tree = await buildHast('## Stats\n\nJust prose.\n', 'markdown');
		expect(components(tree)).toHaveLength(0);
		expect(elementsByTag(tree, 'p')).toHaveLength(1);
	});

	test('a Select consumes the list that follows it', async () => {
		const tree = await buildHast('## About\n\nClass: Select()\n\n- Fighter\n- Mage\n', 'markdown');
		const [select] = components(tree);

		expect(select?.properties?.['data-options']).toBe(
			JSON.stringify([{ label: 'Fighter' }, { label: 'Mage' }])
		);
		expect(elementsByTag(tree, 'ul')).toHaveLength(0);
	});

	test('a starred item in that list is the default', async () => {
		const tree = await buildHast('## About\n\nClass: Select()\n\n- Fighter\n- *Mage\n', 'markdown');
		const [select] = components(tree);

		expect(select?.properties?.['data-defaultValue']).toBe('Mage');
	});
});

describe('section wrapping', () => {
	test('each heading is wrapped in a section carrying its level, slug and classes', async () => {
		const tree = await buildHast(SHEET, 'markdown');
		const sections = elementsByTag(tree, 'section');

		expect(sections.map((s) => s.properties?.['id'])).toEqual([
			'bjrn',
			'stats',
			'stats__physical',
			'gear'
		]);
		expect(sections.map((s) => s.properties?.['data-slug'])).toEqual([
			'bjrn',
			'stats',
			'physical',
			'gear'
		]);
		expect(sections.map((s) => s.properties?.['level'])).toEqual([1, 2, 3, 2]);
	});

	test('a section class list is node-level-N plus the heading slug', async () => {
		const tree = await buildHast('## Stats\n', 'markdown');
		expect(classNames(elementsByTag(tree, 'section')[0]!)).toEqual(['node-level-2', 'stats']);
	});

	test('(.custom) in a heading replaces the slug class and is stripped from the text', async () => {
		const tree = await buildHast('## Stats\n\n### Physical (.wide)\n', 'markdown');
		const nested = elementsByTag(tree, 'section')[1]!;

		expect(classNames(nested)).toEqual(['node-level-3', 'wide']);
		expect(elementsByTag(tree, 'h3')[0]?.children[0]).toMatchObject({
			type: 'text',
			value: 'Physical'
		});
	});

	test('a section contains everything up to the next heading of equal or lower depth', async () => {
		const tree = await buildHast(SHEET, 'markdown');
		const gear = elementsByTag(tree, 'section').find((s) => s.properties?.['id'] === 'gear')!;

		expect(elementsByTag(gear, 'p')).toHaveLength(1);
		expect(elementsByTag(gear, 'li')).toHaveLength(2);
	});

	test('a known heading gets a content type from the header mapping', async () => {
		const tree = await buildHast('## Characters\n', 'markdown');
		expect(elementsByTag(tree, 'section')[0]?.properties?.['data-content-type']).toBe('Actor');
	});

	test('an unmapped heading gets no content type', async () => {
		const tree = await buildHast('## Zzzz\n', 'markdown');
		expect(elementsByTag(tree, 'section')[0]?.properties?.['data-content-type']).toBeUndefined();
	});

	const contentTypes = async (source: string) =>
		Object.fromEntries(
			elementsByTag(await buildHast(source, 'markdown'), 'section').map((s) => [
				s.properties?.['data-slug'],
				s.properties?.['data-content-type']
			])
		);

	test('an unmapped section inherits its nearest ancestor section’s content type', async () => {
		expect(await contentTypes('## Characters\n### Anna\n#### Stats\n')).toEqual({
			characters: 'Actor',
			anna: 'Actor',
			stats: 'Actor'
		});
	});

	test('a section with its own mapping keeps it', async () => {
		const types = await contentTypes('## Characters\n### Gear\n#### Rope\n');
		expect(types).toEqual({ characters: 'Actor', gear: 'Item', rope: 'Item' });
	});

	test('inheritance follows real ancestry — no type leaks from a sibling branch', async () => {
		const types = await contentTypes('## Notes\n### A\n## Stats\n### Str\n');
		expect(types).toEqual({ notes: 'Note', a: 'Note', stats: undefined, str: undefined });
	});

	test('an h1 type does not reach the h2s after it — they are siblings', async () => {
		const types = await contentTypes('# Characters\n## Zzzz\n');
		expect(types).toEqual({ characters: 'Actor', zzzz: undefined });
	});

	test('inheritance never adds a class', async () => {
		const tree = await buildHast('## Characters\n### Anna\n', 'markdown');
		expect(classNames(elementsByTag(tree, 'section')[1]!)).not.toContain('actor');
	});
});

describe('heading ids', () => {
	test('h1 and h2 get a bare slug, h3+ are prefixed by their h2', async () => {
		const tree = await buildHast(SHEET, 'markdown');
		expect(elementsByTag(tree, 'h1')[0]?.properties?.['id']).toBe('bjrn');
		expect(elementsByTag(tree, 'h2').map((h) => h.properties?.['id'])).toEqual(['stats', 'gear']);
		expect(elementsByTag(tree, 'h3')[0]?.properties?.['id']).toBe('stats__physical');
	});

	test('a repeated heading gets a numbered id, and so do its components', async () => {
		const tree = await buildHast('## Gear\n\nA: Text()\n\n## Gear\n\nA: Text()\n', 'markdown');

		expect(elementsByTag(tree, 'section').map((s) => s.properties?.['id'])).toEqual([
			'gear',
			'gear_1'
		]);
		// `data-slug` is still not deduplicated, so both sections prefix with `gear`.
		// Component ids are deduplicated on top of that: two components
		// sharing one id would share one value, and a fill addresses them separately.
		expect(componentIds(tree)).toEqual(['gear__a', 'gear__a_2']);
	});
});

describe('heading attributes', () => {
	const OPEN = 'Long ago (#open motion=title-card in=fade:2 hold=4 out=blur:1.5 gap=1)';

	test('the slug is the first token of the (#id …) bracket', () => {
		expect(toSlug(OPEN)).toBe('open');
		expect(toSlug('The war (#war)')).toBe('war');
		expect(toSlug('Plain heading (.wide)')).toBe('plain_heading');
	});

	test('key=value pairs after the id, a value running to the next key or the bracket end', () => {
		expect(headingAttrs(OPEN)).toEqual({
			motion: 'title-card',
			in: 'fade:2',
			hold: '4',
			out: 'blur:1.5',
			gap: '1'
		});
		expect(headingAttrs('The war (#war motion=crawl hold=40 with=letterbox, gap:fade)')).toEqual({
			motion: 'crawl',
			hold: '40',
			with: 'letterbox, gap:fade'
		});
		expect(headingAttrs('Cast (#cast)')).toEqual({});
		expect(headingAttrs('Cast')).toEqual({});
	});

	test('pairs land on the section as data-* properties; the heading keeps only its text', async () => {
		const tree = await buildHast(
			`## ${OPEN}\n\nText.\n\n## Cast (#cast stagger=0.4 with=grain sound=theme-end x-y=1)\n`,
			'markdown'
		);
		const [open, cast] = elementsByTag(tree, 'section');
		expect(open?.properties).toMatchObject({
			id: 'open',
			'data-slug': 'open',
			dataMotion: 'title-card',
			dataIn: 'fade:2',
			dataHold: '4',
			dataOut: 'blur:1.5',
			dataGap: '1'
		});
		expect(cast?.properties).toMatchObject({
			dataStagger: '0.4',
			dataWith: 'grain',
			dataSound: 'theme-end',
			dataXY: '1'
		});
		expect(elementsByTag(tree, 'h2').map((h) => textOf(h))).toEqual(['Long ago', 'Cast']);
	});
});

describe('role-gated sections', () => {
	const HELP = `## Everyone

Shared.

## Stage bar (@narrator)

Curtain.

### Live

On air.

## Rolls (#rolls @narrator @player)

Dice.

## Sheets (.wide @player)

Yours.
`;

	const headings = (tree: Awaited<ReturnType<typeof buildHast>>) =>
		elementsByTag(tree, 'h2').map((h) => textOf(h));

	test('@role tokens are read from any heading bracket, never from a formula', () => {
		expect(headingRoles('Stage bar (@narrator)')).toEqual(['narrator']);
		expect(headingRoles('Rolls (#rolls @narrator @player)')).toEqual(['narrator', 'player']);
		expect(headingRoles('Sheets (.wide @player)')).toEqual(['player']);
		expect(headingRoles('Initiative (@dex - 10)')).toEqual([]);
		expect(headingRoles('Plain')).toEqual([]);
	});

	test('roles are not slugs, classes or key=value pairs, and leave the heading text', async () => {
		expect(toSlug('Rolls (#rolls @narrator)')).toBe('rolls');
		expect(toSlug('Stage bar (@narrator)')).toBe('stage_bar');
		expect(headingAttrs('Rolls (#rolls hold=4 @narrator)')).toEqual({ hold: '4' });
		const tree = await buildHast(HELP, 'markdown');
		const sections = elementsByTag(tree, 'section');
		expect(sections.map((s) => s.properties['data-roles'])).toEqual([
			undefined,
			'narrator',
			undefined,
			'narrator player',
			'player'
		]);
		expect(classNames(sections[4]!)).toEqual(['node-level-2', 'wide']);
		expect(headings(tree)).toEqual(['Everyone', 'Stage bar', 'Rolls', 'Sheets']);
	});

	test('filterRoles drops each section the role is not named on, subsections with it', async () => {
		const narrator = filterRoles(await buildHast(HELP, 'markdown'), 'narrator');
		expect(headings(narrator)).toEqual(['Everyone', 'Stage bar', 'Rolls']);
		expect(elementsByTag(narrator, 'h3').map((h) => textOf(h))).toEqual(['Live']);

		const player = filterRoles(await buildHast(HELP, 'markdown'), 'player');
		expect(headings(player)).toEqual(['Everyone', 'Rolls', 'Sheets']);
		expect(elementsByTag(player, 'h3')).toEqual([]);
	});

	test('no role keeps only ungated sections', async () => {
		expect(headings(filterRoles(await buildHast(HELP, 'markdown')))).toEqual(['Everyone']);
	});
});

describe('table of contents', () => {
	// The parser used to splice a `nav.toc` in after the first h1 section. It is gone:
	// the navigator is the editor's Outline panel, which derives the same list from the
	// heading ids (`documentHeadings`) and renders it beside the document rather than
	// inside it. A generated node in the body was also the one element an author could
	// neither style through their own markdown nor remove.
	test('the tree holds only what the author wrote', async () => {
		const tree = await buildHast(SHEET, 'markdown');
		expect(elementsByTag(tree, 'nav')).toHaveLength(0);
	});
});

describe('hostile input', () => {
	const HOSTILE = [
		'# <script>alert(1)</script>',
		'<iframe src="javascript:alert(1)"></iframe>',
		'<style>body{display:none}</style>',
		'- <img src=x onerror=alert(1)>',
		'<div onclick="alert(1)">x</div>',
		'![x](x" onerror="alert(1))',
		'Name: Text(<b onmouseover=alert(1)>)'
	].join('\n\n');

	test('no script, iframe or style element and no on* property anywhere', async () => {
		const tree = await buildHast(HOSTILE, 'markdown');
		const els = elements(tree);
		expect(els.filter((el) => ['script', 'iframe', 'style'].includes(el.tagName))).toEqual([]);
		expect(els.flatMap((el) => Object.keys(el.properties ?? {})).filter((k) => /^on/i.test(k))).toEqual([]);
	});

	// The tag used to survive as literal text; now raw html is dropped and what it wrapped kept.
	test('the tag is dropped, its text survives', async () => {
		const tree = await buildHast('<b>bold</b> text', 'markdown');
		const p = elementsByTag(tree, 'p')[0]!;
		expect(p.children.map((c) => c.type === 'text' && c.value)).toEqual(['bold', ' text']);
	});

	test('an image cannot break out of src', async () => {
		// Unbracketed, `x"` is no destination and the line stays text.
		expect(elementsByTag(await buildHast('![x](x" onerror="a)', 'markdown'), 'img')).toHaveLength(0);
		const img = elementsByTag(await buildHast('![x](<x" onerror="a>)', 'markdown'), 'img');
		expect(img).toHaveLength(1);
		expect(img[0]!.properties).toEqual({ src: 'x%22%20onerror=%22a', alt: 'x' });
		expect(elementsByTag(await buildHast('![x](café.png)', 'markdown'), 'img')[0]!.properties.src).toBe('caf%C3%A9.png');
	});

	test('a < inside a component default is kept', async () => {
		const tree = await buildHast('Note: Text(a<b)', 'markdown');
		expect(components(tree)[0]!.properties?.['data-defaultValue']).toBe('a<b');
	});
});
