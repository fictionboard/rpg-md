import { describe, expect, test } from 'bun:test';
import { diceFaces, formatDice, parseDice, rollDice, type Rng } from '../src/index.ts';

/** Returns each face in turn for dice of `sides`. */
const faces = (sides: number, ...fs: number[]): Rng => () => (fs.shift()! - 1) / sides;

describe('parseDice', () => {
	test('shapes', () => {
		expect(parseDice('d6')).toEqual({ count: 1, sides: 6, modifier: 0, forced: null });
		expect(parseDice('2D6 + 3')).toEqual({ count: 2, sides: 6, modifier: 3, forced: null });
		expect(parseDice('1d20-1')).toMatchObject({ modifier: -1 });
		expect(parseDice('2d6+1@3,5')).toEqual({ count: 2, sides: 6, modifier: 1, forced: [3, 5] });
		expect(parseDice('d66@3,4')).toMatchObject({ sides: 66, forced: [3, 4] });
	});

	test('not dice', () => {
		for (const s of ['', 'd', '2d20kh1', '3d6>4', '{@wis}d6', '0d6', '101d6', 'd10001', '2d6 silver']) {
			expect(parseDice(s)).toBeNull();
		}
	});

	test('a forced list must fit the dice', () => {
		expect(parseDice('2d6@3')).toBeNull();
		expect(parseDice('2d6@3,7')).toBeNull();
		expect(parseDice('d66@34')).toBeNull();
		expect(parseDice('d66@3,7')).toBeNull();
		expect(parseDice('d100@100')).toMatchObject({ forced: [100] });
	});
});

describe('rollDice', () => {
	test('injected rng, forced notation out, replay gives the same total', () => {
		const r = rollDice('2d6+3', faces(6, 3, 5))!;
		expect(r).toEqual({ notation: '2d6+3@3,5', rolls: [3, 5], total: 11 });
		expect(rollDice(r.notation, () => 0.99)).toEqual(r);
	});

	test('d66 is tens and ones', () => {
		expect(rollDice('d66', faces(6, 3, 4))).toEqual({ notation: 'd66@3,4', rolls: [3, 4], total: 34 });
	});

	test('default rng stays in range', () => {
		for (let i = 0; i < 200; i++) {
			const { total } = rollDice('d100')!;
			expect(total >= 1 && total <= 100).toBe(true);
		}
	});

	test('unparseable is null', () => {
		expect(rollDice('2d20kh1')).toBeNull();
	});
});

test('formatDice and diceFaces', () => {
	expect(formatDice(parseDice('1d6-0')!)).toBe('1d6');
	expect(diceFaces(parseDice('2d6+1')!)).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
	expect(diceFaces(parseDice('d66')!)!.slice(4, 8)).toEqual([15, 16, 21, 22]);
	expect(diceFaces(parseDice('100d1000')!)).toBeNull();
});
