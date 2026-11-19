/**
 * `withCounterDefault` — a body-first counter's literal rewritten in place, found by the id the
 * renderer gives it. Every case is checked by building the result: the id and its new default.
 */
import { describe, expect, test } from 'bun:test';
import { buildHast, templateSlots, withCounterDefault } from '../src/index.ts';
import { components } from './helpers.ts';

/** `id`'s component props in the built body. */
async function props(source: string, id: string) {
	const el = components(await buildHast(source)).find((c) => c.properties?.['data-component-id'] === id);
	return el?.properties;
}

const BODY = `---
clocks:
  time:
    clock: true
---
# The Vault

Progress: Checks(2/8)
Torches: Number(6, 0-6)
Str: Stat(min -4, max 4) #grit

## Gear

Torches: Number(6, 0-6)
Torches: Number(0-6)

\`\`\`
Torches: Number(6, 0-6)
\`\`\`
> Rations: Number
`;

describe('withCounterDefault', () => {
	test('Checks keeps its total and is held to it', async () => {
		const out = withCounterDefault(BODY, 'the_vault__progress', 5);
		expect(out).toContain('Progress: Checks(5/8)');
		expect((await props(out, 'the_vault__progress'))?.['data-checked']).toBe(5);
		expect(withCounterDefault(BODY, 'the_vault__progress', 12)).toContain('Checks(8/8)');
		expect(withCounterDefault(BODY, 'the_vault__progress', -1)).toContain('Checks(0/8)');
	});

	test('Number keeps its range; the repeated label under its own heading is its own line', async () => {
		const out = withCounterDefault(BODY, 'gear__torches', 3);
		expect(out.split('\n').slice(0, 16).filter((l) => l.startsWith('Torches:'))).toEqual(['Torches: Number(6, 0-6)', 'Torches: Number(3, 0-6)', 'Torches: Number(0-6)']);
		expect((await props(out, 'gear__torches'))?.['data-defaultValue']).toBe(3);
		expect((await props(out, 'gear__torches'))?.['data-max']).toBe(6);
	});

	test('a missing default is inserted before the range and the attributes', async () => {
		const range = withCounterDefault(BODY, 'gear__torches_2', 2);
		expect(range).toContain('Torches: Number(2, 0-6)');
		expect((await props(range, 'gear__torches_2'))?.['data-defaultValue']).toBe(2);
		const attrs = withCounterDefault(BODY, 'the_vault__grit', -3);
		expect(attrs).toContain('Str: Stat(-3, min -4, max 4) #grit');
		expect((await props(attrs, 'the_vault__grit'))?.['data-defaultValue']).toBe(-3);
	});

	test('no brackets get some; a quote prefix is kept', async () => {
		const out = withCounterDefault(BODY, 'gear__rations', 4);
		expect(out).toContain('> Rations: Number(4)');
		expect((await props(out, 'gear__rations'))?.['data-defaultValue']).toBe(4);
	});

	test('frontmatter, fences and every other line survive; an unknown id or a non-counter is unchanged', async () => {
		const out = withCounterDefault(BODY, 'the_vault__torches', 1);
		expect(out.startsWith('---\nclocks:\n  time:\n    clock: true\n---\n')).toBe(true);
		expect(out).toContain('```\nTorches: Number(6, 0-6)\n```');
		expect(out.split('\n').length).toBe(BODY.split('\n').length);
		expect(withCounterDefault(BODY, 'nope', 1)).toBe(BODY);
		expect(withCounterDefault('Name: Text(x)', 'name', 1)).toBe('Name: Text(x)');
		expect(withCounterDefault(BODY, 'gear__torches', Number.NaN)).toBe(BODY);
		expect(templateSlots(await buildHast(out)).map((s) => s.id)).toEqual(templateSlots(await buildHast(BODY)).map((s) => s.id));
	});
});
