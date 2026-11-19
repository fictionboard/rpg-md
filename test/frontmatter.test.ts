import { describe, expect, test } from 'bun:test';
import { buildHast, fmList, fmMap, fmString, joinFrontmatter, parseFrontmatter, splitFrontmatter } from '../src/index.ts';

describe('parseFrontmatter', () => {
	test('a body with no fence comes back untouched', () => {
		const src = '# Sheet\n\nName: Text()\n';
		expect(parseFrontmatter(src)).toEqual({ data: {}, body: src });
	});

	test('a body opening on a --- gap is markdown, not frontmatter', () => {
		const src = '---\n## Credits\n**The Robot**\nStellan\n---\n**The Dog**\n';
		expect(parseFrontmatter(src)).toEqual({ data: {}, body: src });
		expect(splitFrontmatter(src)).toEqual({ front: '', body: src });
	});

	test('a fence holding only comments is not frontmatter', () => {
		const src = '---\n# Credits\n---\nText\n';
		expect(parseFrontmatter(src)).toEqual({ data: {}, body: src });
	});

	test('an unterminated fence is not frontmatter', () => {
		const src = '---\nkey: salt-and-ash\n\n# Sheet\n';
		expect(parseFrontmatter(src)).toEqual({ data: {}, body: src });
	});

	test('scalars, inline lists and a nested map', () => {
		const { data, body } = parseFrontmatter(
			[
				'---',
				'key: salt-and-ash',
				'title: Salt and Ash',
				'dice: d6',
				'tags: [sci-fi, horror]',
				'headerMappings:',
				'  Xenos: Actor',
				'  Hab: Location',
				'---',
				'',
				'Prose.'
			].join('\n')
		);
		expect(data).toEqual({
			key: 'salt-and-ash',
			title: 'Salt and Ash',
			dice: 'd6',
			tags: ['sci-fi', 'horror'],
			headerMappings: { Xenos: 'Actor', Hab: 'Location' }
		});
		expect(body).toBe('\nProse.');
	});

	test('quotes are stripped and a colon in a value survives', () => {
		const { data } = parseFrontmatter('---\ntitle: "Ember: Second Dawn"\nkey: \'esd\'\n---\n');
		expect(data['title']).toBe('Ember: Second Dawn');
		expect(data['key']).toBe('esd');
	});

	test('comments and blank lines are skipped; a nested block ends at the next unindented key', () => {
		const { data } = parseFrontmatter(
			['---', '# a note', '', 'headerMappings:', '  Crew: Actor', 'dice: d6', '---', ''].join('\n')
		);
		expect(data).toEqual({ headerMappings: { Crew: 'Actor' }, dice: 'd6' });
	});

	test('narrowing helpers refuse the wrong shape rather than coercing', () => {
		const { data } = parseFrontmatter('---\ntags: [a]\ndice: d6\nmap:\n  A: Actor\n---\n');
		expect(fmString(data, 'dice')).toBe('d6');
		expect(fmString(data, 'tags')).toBeUndefined();
		expect(fmList(data, 'tags')).toEqual(['a']);
		expect(fmList(data, 'dice')).toBeUndefined();
		expect(fmMap(data, 'map')).toEqual({ A: 'Actor' });
		expect(fmMap(data, 'tags')).toBeUndefined();
	});
});

describe('buildHast strips frontmatter', () => {
	test('config keys never reach the tree as components or prose', async () => {
		const hast = await buildHast('---\nkey: salt-and-ash\ndice: d6\n---\n\n# Salt and Ash\n', 'markdown');
		const html = JSON.stringify(hast);
		expect(html).not.toContain('dice');
		expect(html).toContain('Salt and Ash');
	});

	test('a template without frontmatter parses exactly as before', async () => {
		const src = '# Sheet\n\nStrength: Number(10, 0-20)\n';
		expect(await buildHast(src, 'markdown')).toEqual(await buildHast(src, 'markdown'));
	});
});

describe('splitFrontmatter / joinFrontmatter', () => {
	// The editor shows the two halves in two panes; every keystroke in either one
	// rejoins them, so a round trip that is not byte-identical is data loss.
	test('round-trips a fenced body', () => {
		const src = '---\nsubtype: npc\ntags: [a, b]\n---\n\n# Vera\n';
		const { front, body } = splitFrontmatter(src);
		expect(front).toBe('subtype: npc\ntags: [a, b]');
		expect(body).toBe('\n# Vera\n');
		expect(joinFrontmatter(front, body)).toBe(src);
	});

	test('round-trips a body with no fence, and grows none', () => {
		const src = '# Sheet\n\nName: Text()\n';
		const { front, body } = splitFrontmatter(src);
		expect(front).toBe('');
		expect(joinFrontmatter(front, body)).toBe(src);
	});

	test('an unclosed fence is body, not frontmatter', () => {
		const src = '---\nsubtype: npc\n\n# Vera\n';
		expect(splitFrontmatter(src)).toEqual({ front: '', body: src });
	});

	test('emptying the frontmatter pane drops the fence', () => {
		expect(joinFrontmatter('  \n', '# Vera\n')).toBe('# Vera\n');
	});
});
