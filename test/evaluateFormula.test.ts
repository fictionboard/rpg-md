/**
 * Characterization tests for the formula evaluator — `{@field_id}` resolution.
 */
import { describe, expect, test } from 'bun:test';
import { evaluateFormula } from '../src/index.ts';

describe('evaluateFormula', () => {
	test('resolves @field references against the dataset', () => {
		expect(evaluateFormula('{@str + @dex}', { str: 2, dex: 3 })).toBe(5);
	});

	test('braces are optional', () => {
		expect(evaluateFormula('@str + 1', { str: 2 })).toBe(3);
	});

	test('arithmetic, parentheses and comparison all work', () => {
		expect(evaluateFormula('{(@str - 10) / 2}', { str: 16 })).toBe(3);
		expect(evaluateFormula('{@str > 10}', { str: 16 })).toBe(0);
	});

	test('ids are matched with word characters, so section-prefixed ids resolve', () => {
		expect(evaluateFormula('{@stats__strength + 1}', { stats__strength: 4 })).toBe(5);
	});

	test('a numeric string is coerced', () => {
		expect(evaluateFormula('{@str + 1}', { str: '4' })).toBe(5);
	});

	test('booleans count as 1 and 0', () => {
		expect(evaluateFormula('{@flag + 1}', { flag: true })).toBe(2);
		expect(evaluateFormula('{@flag + 1}', { flag: false })).toBe(1);
	});

	test('missing, null and non-numeric values read as 0', () => {
		expect(evaluateFormula('{@nope + 1}', {})).toBe(1);
		expect(evaluateFormula('{@nope + 1}', { nope: null })).toBe(1);
		expect(evaluateFormula('{@nope + 1}', { nope: 'abc' })).toBe(1);
		expect(evaluateFormula('{@nope + 1}', { nope: [1, 2] })).toBe(1);
	});

	test('an empty formula is 0', () => {
		expect(evaluateFormula('', { str: 4 })).toBe(0);
	});

	test('a non-finite or non-numeric result is 0', () => {
		expect(evaluateFormula('{1 / 0}', {})).toBe(0);
		expect(evaluateFormula('{"text"}', {})).toBe(0);
	});

	test('a syntax error is swallowed and reads as 0', () => {
		const original = console.error;
		console.error = () => {};
		try {
			expect(evaluateFormula('{@str +}', { str: 4 })).toBe(0);
		} finally {
			console.error = original;
		}
	});
});
