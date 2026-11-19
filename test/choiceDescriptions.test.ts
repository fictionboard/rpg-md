/**
 * Option descriptions on fixed choices: the inline `Label — text` form, the `Select(#slug)`
 * section form, and `inlineMarkdown`, which renders a description.
 */
import { describe, expect, spyOn, test } from 'bun:test';
import { buildHast, inlineMarkdown, parseToken, textOf } from '../src/index.ts';
import { parseOptionItem } from '../src/parser/rpg-components-registry.ts';
import { components, elementsByTag } from './helpers.ts';

const optionsOf = (el: { properties?: Record<string, unknown> } | undefined) =>
	JSON.parse(String(el?.properties?.['data-options']));

describe('inline description', () => {
	test('em dash and ASCII separators', () => {
		expect(parseOptionItem('Fighter — Strong in melee.')).toEqual({ label: 'Fighter', description: 'Strong in melee.' });
		expect(parseOptionItem('Fighter -- Strong.')).toEqual({ label: 'Fighter', description: 'Strong.' });
	});

	test('value, default star, and a description ending in emphasis', () => {
		expect(parseOptionItem('*Fighter | fighter — Very *strong*')).toEqual({
			label: 'Fighter',
			value: 'fighter',
			default: true,
			description: 'Very *strong*'
		});
	});

	test('only the first separator splits; no separator, no key', () => {
		expect(parseOptionItem('A — b — c')).toEqual({ label: 'A', description: 'b — c' });
		expect(parseOptionItem('Half-Elf')).toEqual({ label: 'Half-Elf' });
	});

	test('bracket list', () => {
		expect(parseToken('Class: Select([Fighter — Melee, *Mage — Spells])')).toMatchObject({
			options: [{ label: 'Fighter', description: 'Melee' }, { label: 'Mage', default: true, description: 'Spells' }],
			defaultValue: 'Mage'
		});
	});

	test('markdown-list form, round-tripped in the placeholder', async () => {
		const tree = await buildHast('## About\n\nClass: Select()\n\n- Fighter — Strong.\n- *Mage | mage — Smart.\n');
		const [select] = components(tree);
		expect(optionsOf(select)).toEqual([
			{ label: 'Fighter', description: 'Strong.' },
			{ label: 'Mage', value: 'mage', default: true, description: 'Smart.' }
		]);
		expect(select?.properties?.['data-defaultValue']).toBe('mage');
		expect(textOf(select!)).toContain('Select([Fighter — Strong., *Mage | mage — Smart.])');
	});
});

describe('section form', () => {
	const DOC = `## Classes (#classes)

### Fighter
Strong in [melee](/rules).

Second paragraph.

#### Nested
Not part of it.

### *Mage | mage

## Sheet

Class: Radio(#classes)
Classes: MultiSelect(#classes)
`;

	test('child headings are options, bodies descriptions, stars defaults', async () => {
		const tree = await buildHast(DOC);
		const [radio, multi] = components(tree);
		const expected = [
			{ label: 'Fighter', description: 'Strong in [melee](/rules).\nSecond paragraph.' },
			{ label: 'Mage', value: 'mage', default: true }
		];
		expect(optionsOf(radio)).toEqual(expected);
		expect(radio?.properties?.['data-defaultValue']).toBe('mage');
		expect(radio?.properties?.['data-source']).toBe('classes');
		expect(optionsOf(multi)).toEqual(expected);
		expect(JSON.parse(String(multi?.properties?.['data-defaultValue']))).toEqual(['mage']);
	});

	test('the source section is spliced out; ids are unchanged', async () => {
		const tree = await buildHast(DOC);
		expect(elementsByTag(tree, 'section').map((s) => s.properties?.['data-slug'])).toEqual(['sheet']);
		expect(components(tree).map((c) => c.properties?.['data-component-id'])).toEqual(['sheet__class', 'sheet__classes']);
	});

	test('a source after its component resolves too', async () => {
		const tree = await buildHast('## Sheet\n\nClass: Select(#classes)\n\n## Classes (#classes)\n\n### Fighter\n');
		expect(optionsOf(components(tree)[0])).toEqual([{ label: 'Fighter' }]);
		expect(elementsByTag(tree, 'h2')).toHaveLength(1);
	});

	test('a component line inside the source stays raw text in the description', async () => {
		const tree = await buildHast('## Classes (#classes)\n\n### Fighter\nHit Die: Number(10)\n\n## Sheet\n\nClass: Select(#classes)\n');
		expect(optionsOf(components(tree).at(-1))).toEqual([{ label: 'Fighter', description: 'Hit Die: Number(10)' }]);
	});

	test('unknown slug warns and yields no options', async () => {
		const warn = spyOn(console, 'warn').mockImplementation(() => {});
		const tree = await buildHast('## Sheet\n\nClass: Select(#nope)\n');
		expect(optionsOf(components(tree)[0])).toEqual([]);
		expect(warn).toHaveBeenCalledTimes(1);
		warn.mockRestore();
	});

	test('#slug is never a positional default', () => {
		const config = parseToken('Class: Select(#classes)');
		expect(config).toMatchObject({ source: 'classes' });
		expect(config?.defaultValue).toBeUndefined();
	});
});

describe('inlineMarkdown', () => {
	test('links, emphasis and br', () => {
		const out = inlineMarkdown('A [link](/x) and *em*\n**bold**');
		expect(out.map((n) => (n.type === 'element' ? n.tagName : 'text'))).toEqual(['text', 'a', 'text', 'em', 'br', 'strong']);
		const a = out[1] as { properties: Record<string, unknown> };
		expect(a.properties.href).toBe('/x');
	});
});
