import { describe, expect, test } from 'bun:test';
import { buildHast, tableModel } from '../src/index.ts';
import { elements } from './helpers.ts';

const tables = async (md: string) =>
	elements(await buildHast(md)).filter((el) => el.properties['data-table-id'] !== undefined);
const model = async (md: string) => tableModel((await tables(md))[0]!)!;

describe('data-table-id', () => {
	test('section slug, _2 on collision, (#id) wins, one namespace for tables and lists', async () => {
		const md = [
			'| a |',
			'## Loot',
			'| a |',
			'- x',
			'### Deep',
			'- y',
			'## Other (#enc)',
			'| a |'
		].join('\n');
		expect((await tables(md)).map((t) => `${t.tagName}:${t.properties['data-table-id']}`)).toEqual([
			'table:table',
			'table:loot',
			'ul:loot_2',
			'ul:deep',
			'table:enc'
		]);
	});

	test('a numbered list is a list: it takes an id from the same counter', async () => {
		expect((await tables('## Loot\n1. a\n2. b\n\n| a |')).map((t) => `${t.tagName}:${t.properties['data-table-id']}`)).toEqual([
			'ol:loot',
			'table:loot_2'
		]);
	});

	test("a choice's option list takes no id", async () => {
		expect(await tables('## A\nPick: Select\n- one\n- two\n\n- real')).toHaveLength(1);
		expect((await tables('## A\nPick: Select\n- one\n\n- real'))[0]!.properties['data-table-id']).toBe('a');
	});
});

describe('tableModel inference', () => {
	test('dice header: key column, ranges, gaps and overlaps warn', async () => {
		const m = await model('| 2d6 | Loot |\n|---|---|\n| 2-4 | Coins |\n| 5–8 | [Gem](#gems) |\n| 8 | Sword |\n| 12 | Crown |');
		expect(m.dice).toBe('2d6');
		expect(m.keyColumn).toBe(1);
		expect(m.header).toEqual(['2d6', 'Loot']);
		expect(m.rows.map((r) => [r.min, r.max])).toEqual([[2, 4], [5, 8], [8, 8], [12, 12]]);
		expect(m.rows[1]!.cells).toEqual(['5–8', '[Gem](#gems)']);
		expect(m.warnings).toEqual(['No entry for 9–11', 'Overlap on 8']);
	});

	test('no dice header, all keys: d66 from digits 1–6, gaps step over non-faces', async () => {
		const rows = ['11-16', '21-36', '41-66'].map((k) => `| ${k} | x |`).join('\n');
		expect(await model(`| Roll | Result |\n|---|---|\n${rows}`)).toMatchObject({ dice: 'd66', keyColumn: 1, warnings: [] });
		const gap = await model('| 11-15 | a |\n| 21-66 | b |');
		expect(gap.warnings).toEqual(['No entry for 16']);
	});

	test('no dice header: dice from the max key, 00 is 100', async () => {
		expect(await model('| 1-3 | a |\n| 4-6 | b |')).toMatchObject({ dice: 'd6', warnings: [] });
		expect((await model('| 01-50 | a |\n| 51-00 | b |')).dice).toBe('d100');
	});

	test('a bad key under a dice header warns and is unreachable', async () => {
		const m = await model('| d4 | x |\n|---|---|\n| 1-3 | a |\n| four | b |');
		expect(m.rows[1]).toMatchObject({ min: 0, max: 0 });
		expect(m.warnings).toEqual(['Row 2 has no key', 'No entry for 4']);
	});

	test('neither: uniform 1dN, no key column; a list is always uniform', async () => {
		expect(await model('| Name | Trait |\n|---|---|\n| Ann | shy |\n| Bo | loud |')).toMatchObject({
			dice: '1d2',
			keyColumn: 0,
			rows: [{ min: 1, max: 1, cells: ['Ann', 'shy'] }, { min: 2, max: 2, cells: ['Bo', 'loud'] }]
		});
		expect(await model('| 1 | a |\n| 99999 | b |')).toMatchObject({ dice: '1d2', keyColumn: 0 });
		expect(await model('- 1 gold\n- a [map](#maps)')).toMatchObject({
			dice: '1d2',
			keyColumn: 0,
			header: [],
			rows: [{ min: 1, max: 1, cells: ['1 gold'] }, { min: 2, max: 2, cells: ['a [map](#maps)'] }]
		});
	});

	test('an <ol> reads like a <ul>: uniform 1dN, its start ignored', async () => {
		expect(await model('3. Ann\n4. Bo\n5. Cy')).toMatchObject({
			dice: '1d3',
			keyColumn: 0,
			rows: [{ min: 1, max: 1, cells: ['Ann'] }, { min: 2, max: 2, cells: ['Bo'] }, { min: 3, max: 3, cells: ['Cy'] }]
		});
	});

	test('a headless table is a table: key column inferred as ever', async () => {
		expect(await model('| 1-3 | a |\n| 4-6 | [b](#bs) |')).toMatchObject({
			dice: 'd6',
			keyColumn: 1,
			rows: [{ cells: ['1-3', 'a'] }, { cells: ['4-6', '[b](#bs)'] }]
		});
	});
});

describe('tableModel overrides (key / dice)', () => {
	const md = '| d6 | Name | 2d6 |\n|---|---|---|\n| 1-3 | Ann | 2-7 |\n| 4-6 | Bo | 8-12 |';
	const el = async () => (await tables(md))[0]!;

	test('key: 0 is uniform over the rows, whatever the header says', async () => {
		expect(tableModel(await el(), { key: 0 })).toMatchObject({ dice: '1d2', keyColumn: 0, warnings: [] });
	});

	test('key: n keys on that column and reads its header dice', async () => {
		const m = tableModel(await el(), { key: 3 })!;
		expect(m).toMatchObject({ dice: '2d6', keyColumn: 3, warnings: [] });
		expect(m.rows.map((r) => [r.min, r.max])).toEqual([[2, 7], [8, 12]]);
	});

	test('dice replaces the inferred dice and gaps are checked against it; bad dice is ignored', async () => {
		expect(tableModel(await el(), { dice: 'd8' })).toMatchObject({ dice: 'd8', keyColumn: 1, warnings: ['No entry for 7–8'] });
		expect(tableModel(await el(), { dice: 'd6@3' })!.dice).toBe('d6');
	});
});
