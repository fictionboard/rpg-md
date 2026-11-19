/**
 * The line classifier every `fill.ts` scanner reads, and `bodyWarnings` (a component line
 * swallowed into a list item warns).
 */
import { describe, expect, test } from 'bun:test';
import { bodyWarnings, classifyLines, type ClassifiedLine } from '../src/index.ts';

const kinds = (body: string): string[] => classifyLines(body).map((line) => line.kind);
const at = (body: string, index: number): ClassifiedLine => classifyLines(body)[index]!;

describe('classifyLines', () => {
	test('one label per source line, blank lines included', () => {
		expect(kinds('## A\n\nStr: Number(3)\n')).toEqual(['heading', 'other', 'candidate', 'other']);
	});

	test('a heading carries its level and the raw text after the hashes, bracket included', () => {
		expect(at('### The *Ring* (#ring @narrator)  ', 0)).toEqual({
			kind: 'heading',
			level: 3,
			text: 'The *Ring* (#ring @narrator)'
		});
	});

	test('a `# x` and a `Str: 3` inside a fence are code, fence lines too', () => {
		expect(kinds('```\n# x\nStr: 3\n```\nStr: 4')).toEqual(['code', 'code', 'code', 'code', 'candidate']);
	});

	test('an unclosed fence runs to the end', () => {
		expect(kinds('~~~\n# x\nStr: 3')).toEqual(['code', 'code', 'code']);
	});

	test('setext is off: `text⏎---` is a candidate then an hr, not a heading', () => {
		expect(kinds('Title\n---\nTitle\n===')).toEqual(['candidate', 'other', 'candidate', 'candidate']);
	});

	test('indented code is off: an indented line is still a candidate', () => {
		expect(at('Str: 3\n\n    Dex: 4', 2)).toEqual({ kind: 'candidate', prefix: '    ', text: 'Dex: 4' });
	});

	test('quote lines are candidates, markers in the prefix; a lazy line too', () => {
		const lines = classifyLines('> Str: Number(3)\n> > Dex: 4\nWis: 5');
		expect(lines[0]).toEqual({ kind: 'candidate', prefix: '> ', text: 'Str: Number(3)' });
		expect(lines[1]).toEqual({ kind: 'candidate', prefix: '> > ', text: 'Dex: 4' });
		expect(lines[2]).toEqual({ kind: 'candidate', prefix: '', text: 'Wis: 5' });
	});

	test('a heading inside a quote opens no section', () => {
		expect(kinds('> # x')).toEqual(['other']);
	});

	test('a list item first line is other; its continuations are continuation', () => {
		const lines = classifyLines('- Fighter\nStr: Number(3)\n  more\n\n  Dex: 4\n- Mage');
		expect(lines.map((l) => l.kind)).toEqual([
			'other',
			'continuation',
			'continuation',
			'other',
			'continuation',
			'other'
		]);
		expect(lines[0]).toEqual({ kind: 'other', listItem: true });
		expect(lines[1]).toEqual({ kind: 'continuation', text: 'Str: Number(3)' });
	});

	test('a blank line ends the list, so the line after it is a candidate', () => {
		expect(kinds('- a\n\nStr: 3')).toEqual(['other', 'other', 'candidate']);
	});

	test('a note definition is a note, as a paragraph and as a valid definition', () => {
		expect(kinds('[^x_note_y]: Rating(3) is wrong\n\n[^_comment_1]: word\n\n[^src]: a b')).toEqual([
			'note',
			'other',
			'note',
			'other',
			'candidate'
		]);
	});

	test('table rows are other; a headless `|` paragraph is other', () => {
		expect(kinds('| a: b |\n|---|\n| c: d |\n\n| e: f |\n| g |')).toEqual([
			'other',
			'other',
			'other',
			'other',
			'other',
			'other'
		]);
	});

	describe('a code span over the label or colon makes the line prose', () => {
		test('over the whole line', () => {
			expect(kinds('`Strength: Number(10)`')).toEqual(['other']);
		});

		test('over the label only', () => {
			expect(kinds('`Strength`: Number(10)')).toEqual(['other']);
		});

		test('over the colon only', () => {
			expect(kinds('Strength`: `Number(10)')).toEqual(['other']);
		});

		test('in the value, the line is still a candidate', () => {
			expect(at('Notes: Text(use `x`)', 0)).toEqual({
				kind: 'candidate',
				prefix: '',
				text: 'Notes: Text(use `x`)'
			});
		});

		test('in a quote', () => {
			expect(kinds('> `Str: 3`\n> Dex: `4`')).toEqual(['other', 'candidate']);
		});

		test('a span across a line ending covers nothing (one paragraph per line cuts it back to text)', () => {
			expect(kinds('Notes: a `b\nStr: c` d')).toEqual(['candidate', 'candidate']);
		});
	});
});

describe('bodyWarnings', () => {
	test('a component line swallowed into a list item warns with its 1-based line', () => {
		const warnings = bodyWarnings('## A\n\n- Fighter\n- Mage\nStr: Number(3)\n');
		expect(warnings).toHaveLength(1);
		expect(warnings[0]!.line).toBe(5);
		expect(warnings[0]!.message).toContain('blank line');
	});

	test('plain continuation text and a separated component do not warn', () => {
		expect(bodyWarnings('- Fighter\n  a fine choice\n\nStr: Number(3)')).toEqual([]);
	});

	test('line numbers count the frontmatter it strips', () => {
		expect(bodyWarnings('---\ntemplate: x\n---\n- a\nStr: Number(3)')[0]?.line).toBe(5);
	});
});
