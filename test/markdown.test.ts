/**
 * The markdown path of `buildHast`: CommonMark + GFM with RPG-MD's rules on top.
 *
 * The invariant that matters most: one Enter is one paragraph. Component detection
 * reads a whole `<p>`, so a change that merges two lines into one silently stops those
 * components from being detected. Much of this file is ported from the line scanner's own
 * tests (`rpgmdToHtml.test.ts`, `rehypeEmphasis.test.ts`); where an RPG-MD rule overturned
 * one, the test says which.
 */
import { describe, expect, test } from 'bun:test';
import { buildHast, inlineMarkdown, textOf, toSlug } from '../src/index.ts';
import { componentIds, components, elementsByTag, markup, silenceParserLogs } from './helpers.ts';
import type { Root } from 'hast';

silenceParserLogs();

/** The body as compact markup; components show as `<div>` with their id. */
const html = async (md: string, attrs: string[] = []) =>
	markup(await buildHast(md), ['data-component-id', ...attrs]).replace(/<div data-component-id="([^"]*)">.*?<\/div>/g, '[$1]');

describe('one Enter is one paragraph', () => {
	test('each non-blank line becomes its own paragraph', async () => {
		expect(await html('Line one\nLine two\nLine three')).toBe('<p>Line one</p><p>Line two</p><p>Line three</p>');
	});

	test('so each component line stays a component', async () => {
		expect(await html('Strength: Number(10)\nDexterity: Number(10)')).toBe('[strength][dexterity]');
	});

	test('blank lines produce no output', async () => {
		expect(await html('A\n\n\nB')).toBe('<p>A</p><p>B</p>');
		expect((await buildHast('   \n')).children.filter((c) => c.type === 'element')).toEqual([]);
	});

	test('lines are trimmed; indentation is not code', async () => {
		expect(await html('   Name: Text()   ')).toBe('[name]');
		expect(await html('    indented')).toBe('<p>indented</p>');
	});

	test('inside a quote and inside a list item too', async () => {
		expect(await html('> a\n> b')).toBe('<blockquote><p>a</p><p>b</p></blockquote>');
		expect(await html('- a\n  b')).toBe('<ul><li><p>a</p><p>b</p></li></ul>');
	});

	test('a construct across a line ending falls back to its source text', async () => {
		expect(await html('**a\nb**')).toBe('<p>**a</p><p>b**</p>');
		expect(await html('[a\nb](/c)')).toBe('<p>[a</p><p>b](/c)</p>');
		expect(await html('> *a\n> b*')).toBe('<blockquote><p>*a</p><p>b*</p></blockquote>');
	});

	test('a hard break is a line ending like any other', async () => {
		expect(await html('a  \nb')).toBe('<p>a</p><p>b</p>');
		expect(await html('a\\\nb')).toBe('<p>a</p><p>b</p>');
	});
});

describe('blocks', () => {
	test('# through ###### become h1…h6', async () => {
		for (let level = 1; level <= 6; level++) {
			expect(elementsByTag(await buildHast(`${'#'.repeat(level)} Title`), `h${level}`)).toHaveLength(1);
		}
	});

	test('seven hashes, or no space, is not a heading', async () => {
		expect(await html('####### Title')).toBe('<p>####### Title</p>');
		expect(await html('#Title')).toBe('<p>#Title</p>');
	});

	test('setext is off: text then --- is a paragraph and an <hr>', async () => {
		expect(await html('text\n---')).toBe('<p>text</p><hr></hr>');
	});

	test('a lone ---, and ***, ___, - - -, is an <hr>', async () => {
		expect(await html('---\n\n***\n___\n- - -')).toBe('<hr></hr><hr></hr><hr></hr><hr></hr>');
	});

	test('a lone \\ is an empty line that keeps its height; blank lines are not', async () => {
		expect(await html('One\n\n\\\nTwo')).toBe('<p>One</p><p><br></br></p><p>Two</p>');
		expect(await html('One\n\\\nTwo')).toBe('<p>One</p><p><br></br></p><p>Two</p>');
		expect(await html('> a\n> \\')).toBe('<blockquote><p>a</p><p><br></br></p></blockquote>');
	});

	test('fenced code is code: a component or heading inside it is neither', async () => {
		const tree = await buildHast('## Stats\n\n```\nStr: Number(3)\n# x\n```\n');
		expect(components(tree)).toHaveLength(0);
		expect(elementsByTag(tree, 'h1')).toHaveLength(0);
		expect(textOf(elementsByTag(tree, 'code')[0]!)).toBe('Str: Number(3)\n# x\n');
	});
});

describe('lists', () => {
	test('- and * items are lists; a heading or --- closes one', async () => {
		expect(await html('- Sword\n- Shield')).toBe('<ul><li>Sword</li><li>Shield</li></ul>');
		expect(await html('- Sword\n## Gear')).toMatch(/^<ul><li>Sword<\/li><\/ul><section>/);
		expect(await html('- a\n---\nTwo')).toBe('<ul><li>a</li></ul><hr></hr><p>Two</p>');
	});

	// Overturned: the line scanner collected `-` and `*` into one list. CommonMark starts a new one.
	test('changing the bullet starts a new list', async () => {
		expect(await html('- Sword\n* Shield')).toBe('<ul><li>Sword</li></ul><ul><li>Shield</li></ul>');
	});

	test('a blank line between items ends the list', async () => {
		expect(await html('- Sword\n\n- Shield', ['data-table-id'])).toBe(
			'<ul data-table-id="table"><li>Sword</li></ul><ul data-table-id="table_2"><li>Shield</li></ul>'
		);
	});

	// Overturned: the scanner closed the list at any non-item line. CommonMark joins a plain
	// line under an item to the item — and one Enter is one paragraph, so it is the item's
	// second paragraph.
	test('a plain line under an item joins the item', async () => {
		expect(await html('- Sword\nsharp\n- Shield')).toBe('<ul><li><p>Sword</p><p>sharp</p></li><li><p>Shield</p></li></ul>');
	});

	test('numbered lists are <ol>, keeping their start', async () => {
		expect(await html('1. a\n2. b', ['data-table-id'])).toBe('<ol data-table-id="table"><li>a</li><li>b</li></ol>');
		expect(await html('3. a\n4. b\n\n7. c', ['start'])).toBe('<ol start="3"><li>a</li><li>b</li></ol><ol start="7"><li>c</li></ol>');
	});

	test('nested lists nest, by indentation', async () => {
		expect(await html('- a\n  - b\n    1. c\n- d')).toBe('<ul><li>a<ul><li>b<ol><li>c</li></ol></li></ul></li><li>d</li></ul>');
	});

	test('a component line in a list item is list text, never a component', async () => {
		expect(await html('- Str: Number(3)\n  Dex: Number(2)')).toBe('<ul><li><p>Str: Number(3)</p><p>Dex: Number(2)</p></li></ul>');
	});
});

describe('quotes', () => {
	test('a run of > lines is one blockquote, and the next unquoted line is not in it', async () => {
		expect(await html('> One\n>Two\nAfter')).toBe('<blockquote><p>One</p><p>Two</p></blockquote><p>After</p>');
		expect(await html('> a\n\n> b')).toBe('<blockquote><p>a</p></blockquote><blockquote><p>b</p></blockquote>');
		expect(await html('> a\nb\n> c')).toBe('<blockquote><p>a</p></blockquote><p>b</p><blockquote><p>c</p></blockquote>');
	});

	test('a component line under the quote is outside it, and still a component', async () => {
		expect(await html('> Narrator line\nHP: Number(3)')).toBe('<blockquote><p>Narrator line</p></blockquote>[hp]');
	});

	test('a component line in a quote is a component', async () => {
		expect(await html('> HP: Number(3)')).toBe('<blockquote>[hp]</blockquote>');
	});

	test('a lazy line leaves only the quotes it lacks markers for', async () => {
		expect(await html('> > a\n> b')).toBe('<blockquote><blockquote><p>a</p></blockquote><p>b</p></blockquote>');
	});

	test('a heading in a quote is no section', async () => {
		const tree = await buildHast('> # x\n\n## Real');
		expect(elementsByTag(tree, 'section').map((s) => s.properties.id)).toEqual(['real']);
	});
});

describe('tables', () => {
	test('a |---| row makes a GFM table with a thead', async () => {
		expect(await html('| d6 | Result |\n|---|:--:|\n| 1 | Goblin |')).toBe(
			'<table><thead><tr><th>d6</th><th>Result</th></tr></thead><tbody><tr><td>1</td><td>Goblin</td></tr></tbody></table>'
		);
	});

	test('a paragraph of | lines is a headless table', async () => {
		expect(await html('| a | b\n\n| c |')).toBe(
			'<table><tbody><tr><td>a</td><td>b</td></tr></tbody></table><table><tbody><tr><td>c</td></tr></tbody></table>'
		);
	});

	test('cells split on unescaped |, and each is inline markdown', async () => {
		expect(await html('| c \\| d | [x](/y) **b** |', ['href'])).toBe(
			'<table><tbody><tr><td>c | d</td><td><a href="/y">x</a> <strong>b</strong></td></tr></tbody></table>'
		);
	});

	test('one line without a | makes it no table', async () => {
		expect(await html('| a |\nb')).toBe('<p>| a |</p><p>b</p>');
	});

	test('a cell is never a component', async () => {
		expect(components(await buildHast('| Str: Number(3) |'))).toHaveLength(0);
	});
});

describe('task lists', () => {
	test('render static, disabled checkboxes', async () => {
		const tree = await buildHast('- [x] done\n- [ ] todo');
		expect(elementsByTag(tree, 'input').map((i) => i.properties)).toEqual([
			{ type: 'checkbox', checked: true, disabled: true },
			{ type: 'checkbox', checked: false, disabled: true }
		]);
		expect(elementsByTag(tree, 'li').map((li) => textOf(li).trim())).toEqual(['done', 'todo']);
	});

	test('in a fixed choice’s option list, [x] is the default and [ ] a plain option', async () => {
		const [select] = components(await buildHast('Class: Select()\n- [x] Fighter\n- [ ] Mage'));
		expect(JSON.parse(String(select!.properties['data-options']))).toEqual([{ label: 'Fighter', default: true }, { label: 'Mage' }]);
		expect(select!.properties['data-defaultValue']).toBe('Fighter');

		const [multi] = components(await buildHast('Tags: MultiSelect()\n- [x] a\n- [ ] b\n- [x] c'));
		expect(JSON.parse(String(multi!.properties['data-defaultValue']))).toEqual(['a', 'c']);
	});
});

describe('option lists are read as written', () => {
	test('markup in an item is the option text, not its rendering', async () => {
		const [select] = components(await buildHast('Class: Select()\n\n- *Fighter | f — Very *strong*\n- Mage `x`\n'));
		expect(JSON.parse(String(select!.properties['data-options']))).toEqual([
			{ label: 'Fighter', value: 'f', default: true, description: 'Very *strong*' },
			{ label: 'Mage `x`' }
		]);
	});

	test('a numbered list and a blank \\ line between are fine; a note marker is not text', async () => {
		const [select] = components(await buildHast('Class: Select()\n\\\n1. Fighter[^a_note_b]\n2. Mage\n'));
		expect(JSON.parse(String(select!.properties['data-options']))).toEqual([{ label: 'Fighter' }, { label: 'Mage' }]);
	});
});

describe('components read source text', () => {
	test('a component line has no inline markdown: Text(**x**) keeps **x**', async () => {
		const [text] = components(await buildHast('Notes: Text(**x**)'));
		expect(text!.properties['data-defaultValue']).toBe('**x**');
	});

	test('a code span over the label or the colon makes the line prose', async () => {
		expect(await html('`Strength: Number(10)`')).toBe('<p><code>Strength: Number(10)</code></p>');
		expect(await html('`Str`: Number(3)')).toBe('<p><code>Str</code>: Number(3)</p>');
	});

	test('a code span after the colon does not', async () => {
		const [notes] = components(await buildHast('Notes: Text(use `x`)'));
		expect(notes!.properties['data-defaultValue']).toBe('use `x`');
	});

	test('a prose line keeps its markup; a code span is never a component', async () => {
		expect(await html('a `Str: 3` b')).toBe('<p>a <code>Str: 3</code> b</p>');
	});
});

describe('editor notes', () => {
	test('a _comment_ marker is stripped from the paragraph', async () => {
		expect(await html('Dolor sit amet[^dolor_comment_a3f9], consectetur')).toBe('<p>Dolor sit amet, consectetur</p>');
	});

	test('a _comment_ definition line produces nothing', async () => {
		expect(await html('A\n[^dolor_comment_a3f9]: Not very good\nB')).toBe('<p>A</p><p>B</p>');
	});

	test('a definition that looks like a component is not one', async () => {
		expect(await html('[^x_comment_y]: Rating(3)')).toBe('');
		expect(await html('[^x_comment_y]: Rating: Number(3)')).toBe('');
	});

	test('a _note_ footnote is stripped the same way — even when CommonMark reads it as a reference', async () => {
		expect(await html('Dolor[^_note_A4D230EE]\n[^_note_A4D230EE]: Mine')).toBe('<p>Dolor</p>');
		expect(await html('Dolor [^_note_q] x\n\n[^_note_q]: one-word')).toBe('<p>Dolor  x</p>');
	});

	test('a footnote without the infix is left alone — no GFM footnotes', async () => {
		expect(await html('Amet[^src]\n[^src]: Handbook p.12')).toBe('<p>Amet[^src]</p><p>[^src]: Handbook p.12</p>');
	});

	test('a marker inside a list item, a heading or a cell is stripped; inside code it stays', async () => {
		expect(await html('- Sword[^gear_comment_1]')).toBe('<ul><li>Sword</li></ul>');
		expect(textOf(elementsByTag(await buildHast('## Gear[^a_note_b]'), 'h2')[0]!)).toBe('Gear');
		expect(await html('| a[^a_note_b] |')).toBe('<table><tbody><tr><td>a</td></tr></tbody></table>');
		expect(await html('A `[^x_note_y]` B')).toBe('<p>A <code>[^x_note_y]</code> B</p>');
	});

	// Overturned: the scanner closed the list at the blank-after-strip line. In CommonMark the
	// marker line is a lazy line of the item, and stripping it leaves the one list.
	test('a line holding only a marker leaves nothing', async () => {
		expect(await html('- Sword\n[^a_comment_b]\n- Shield')).toBe('<ul><li>Sword</li><li>Shield</li></ul>');
		expect(await html('A\n[^a_comment_b]\nB')).toBe('<p>A</p><p>B</p>');
	});
});

describe('inline markdown', () => {
	test('bold and italic render, nested too', async () => {
		expect(await html('**The Robot**')).toBe('<p><strong>The Robot</strong></p>');
		expect(await html('a __b__ *c* _d_ e')).toBe('<p>a <strong>b</strong> <em>c</em> <em>d</em> e</p>');
		expect(await html('**bold *and* more**')).toBe('<p><strong>bold <em>and</em> more</strong></p>');
		expect(await html('[**x**](/y)')).toBe('<p><a><strong>x</strong></a></p>');
	});

	test('what stays text', async () => {
		expect(await html('snake_case_name')).toBe('<p>snake_case_name</p>');
		expect(await html('2 * 3 * 4')).toBe('<p>2 * 3 * 4</p>');
		expect(await html('** loose **')).toBe('<p>** loose **</p>');
		expect(await html('roll [2d6](/roll 2d6)')).toBe('<p>roll [2d6](/roll 2d6)</p>');
	});

	// Overturned: backticks were literal text.
	test('a code span is code, its content literal', async () => {
		expect(await html('`code` and `**x**`')).toBe('<p><code>code</code> and <code>**x**</code></p>');
	});

	test('strikethrough is double tilde only', async () => {
		expect(await html('~~gone~~ ~5 gp')).toBe('<p><del>gone</del> ~5 gp</p>');
	});

	test('no autolink literals; a CommonMark <autolink> is a link', async () => {
		expect(await html('www.x.com https://x.com')).toBe('<p>www.x.com https://x.com</p>');
		expect(await html('<https://x.com>', ['href'])).toBe('<p><a href="https://x.com">https://x.com</a></p>');
	});

	test('reference links resolve; the definition renders nothing', async () => {
		expect(await html('[x][r] and [r]\n\n[r]: /there "T"', ['href', 'title'])).toBe(
			'<p><a href="/there" title="T">x</a> and <a href="/there" title="T">r</a></p>'
		);
	});

	// Overturned: an entity stayed the characters written.
	test('entities decode; plain & and < are the same text', async () => {
		expect(await html('&amp; &copy;')).toBe('<p>& ©</p>');
		expect(await html('A & B')).toBe('<p>A & B</p>');
		expect(await html('a < b')).toBe('<p>a < b</p>');
	});

	test('backslash escapes are CommonMark’s', async () => {
		expect(await html('\\[-Employee Record-\\] \\*x\\*')).toBe('<p>[-Employee Record-] *x*</p>');
	});
});

describe('images', () => {
	// Overturned: a whole-line image was a bare <img>.
	test('an image is wrapped in a <p>, whole-line or inline', async () => {
		expect(await html('![Portrait](p.png)', ['src', 'alt'])).toBe('<p><img src="p.png" alt="Portrait"></img></p>');
		expect(await html('![Portrait](p.png) and more', ['src'])).toBe('<p><img src="p.png"></img> and more</p>');
	});
});

describe('refused input is dropped silently', () => {
	// Overturned: inline HTML rendered as its literal text.
	test('raw html vanishes, block or inline; its text content stays', async () => {
		expect(await html('<div>x</div>\n\nfoo <span>bar</span>')).toBe('<p>foo bar</p>');
		expect(await html('## <b>Bold</b>')).toMatch(/<h2>Bold<\/h2>/);
		expect(await html('- <img src=x onerror=alert(1)>')).toBe('<ul><li></li></ul>');
	});

	// Overturned: an unsafe link stayed literal text.
	test('a link failing isSafeUrl keeps its text, an image loses its src', async () => {
		expect(await html('click [me](javascript:alert(1)) now')).toBe('<p>click me now</p>');
		expect(await html('![i](javascript:y)', ['src', 'alt'])).toBe('<p><img alt="i"></img></p>');
	});

	test('a component line is untouched', async () => {
		expect(components(await buildHast('Name: Text(<b onmouseover=alert(1)>)'))[0]!.properties['data-defaultValue']).toBe(
			'<b onmouseover=alert(1)>'
		);
	});
});

describe('headings', () => {
	// The renderer slugs a heading's rendered text and `fill.ts` its raw source text; ids,
	// and the fills keyed by them, hold only while the two slug alike.
	test.each(['The *Ring*', 'Use `x`', 'The __Ring__', '**Bold** move', 'Q\\&A', 'Gear (#gear)'])(
		'slugs are stable: %p raw and rendered agree',
		async (raw) => {
			const h2 = elementsByTag(await buildHast(`## ${raw}`), 'h2')[0]!;
			expect(toSlug(textOf(h2))).toBe(toSlug(raw));
			expect(h2.properties.id).toBe(toSlug(raw));
		}
	);

	test('inline markdown in a heading renders; its bracket still works', async () => {
		const tree = await buildHast('## The *Ring* (#ring hold=4 @narrator)\n\nA: Text()\n\n### Use `x` (.wide)\n');
		const [ring, use] = elementsByTag(tree, 'section');
		expect(ring!.properties).toMatchObject({ id: 'ring', 'data-slug': 'ring', dataHold: '4', 'data-roles': 'narrator' });
		expect(markup(elementsByTag(tree, 'h2')[0]!)).toBe('<h2>The <em>Ring</em></h2>');
		expect(use!.properties).toMatchObject({ id: 'ring__use_x', className: ['node-level-3', 'wide'] });
		expect(markup(elementsByTag(tree, 'h3')[0]!)).toBe('<h3>Use <code>x</code></h3>');
		expect(componentIds(tree)).toEqual(['ring__a']);
	});
});

describe('macro links', () => {
	test('claimed from prose, never from code', async () => {
		expect(await html('`[a](/set x=1)` [a](/set x=1)', ['data-macro', 'data-args'])).toBe(
			'<p><code>[a](/set x=1)</code> <a data-macro="set" data-args="x=1">a</a></p>'
		);
		expect(await html('```\n[a](/set x=1)\n```')).toBe('<pre><code>[a](/set x=1)\n</code></pre>');
	});

	test('in a quote, a list item and a table cell', async () => {
		const tree = await buildHast('> [a](/set x=1)\n\n- [b](/add items Rope)\n\n| [c](/remove items Rope) |');
		expect(elementsByTag(tree, 'a').map((a) => a.properties['data-macro'])).toEqual(['set', 'add', 'remove']);
	});
});

describe('inlineMarkdown', () => {
	const show = (md: string) => markup({ type: 'root', children: inlineMarkdown(md) } as Root, ['href', 'data-macro']);

	test('the same inline parser: code, strikethrough, macros, br per line', () => {
		expect(show('A [l](/x) *em* `c` ~~s~~\n**b** [m](/set a=1)')).toBe(
			'A <a href="/x">l</a> <em>em</em> <code>c</code> <del>s</del><br></br><strong>b</strong> <a data-macro="set">m</a>'
		);
	});

	test('block syntax stays text; raw html and unsafe urls go', () => {
		expect(show('- a\n# b\n> c\n1. d')).toBe('- a<br></br># b<br></br>> c<br></br>1. d');
		expect(show('<b>x</b> [y](javascript:z)')).toBe('x y');
	});

	test('a construct never spans a line', () => {
		expect(show('**a\nb**')).toBe('**a<br></br>b**');
	});
});

describe("inlineMarkdown(…, 'fountain')", () => {
	const show = (md: string) => markup({ type: 'root', children: inlineMarkdown(md, 'fountain') } as Root, ['data-macro']);

	test('_underline_ is u; markdown mode keeps it italic', () => {
		expect(show('_a_ *b* **c**')).toBe('<u>a</u> <em>b</em> <strong>c</strong>');
		expect(markup({ type: 'root', children: inlineMarkdown('_a_') } as Root)).toBe('<em>a</em>');
	});

	test('***bold italic***, nesting, escapes', () => {
		expect(show('***a*** _b *c*_ *d _e_*')).toBe('<em><strong>a</strong></em> <u>b <em>c</em></u> <em>d <u>e</u></em>');
		expect(show('\\*a\\* \\_b\\_ snake_case_word')).toBe('*a* _b_ snake_case_word');
	});

	test('no emphasis across a line break; macros kept', () => {
		expect(show('_a\nb_')).toBe('_a<br></br>b_');
		expect(show('_[m](/set a=1)_')).toBe('<u><a data-macro="set">m</a></u>');
	});
});
