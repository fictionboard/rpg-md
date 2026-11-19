/**
 * Links through `buildHast`: ordinary ones are CommonMark's (with `rpg-link`, `to-hast.ts`),
 * macro links are `rehype-links.ts`' pass. The first tests pin that a component line is still a component and never a link; the
 * ones after, what is deliberately *not* claimed.
 */
import { describe, expect, test } from 'bun:test';
import { buildHast, isSafeUrl, rehypeLinks } from '../src/index.ts';
import type { Element, Root } from 'hast';

const find = (node: Root | Element, pred: (el: Element) => boolean): Element[] => {
	const out: Element[] = [];
	const walk = (n: Root | Element) => {
		for (const child of n.children) {
			if (child.type !== 'element') continue;
			if (pred(child)) out.push(child);
			walk(child);
		}
	};
	walk(node);
	return out;
};

const anchors = (tree: Root) => find(tree, (el) => el.tagName === 'a');
const text = (el: Element) => el.children.map((c) => (c.type === 'text' ? c.value : '')).join('');

describe('rehypeLinks', () => {
	test('a link in prose becomes an <a>', async () => {
		const tree = await buildHast('The [Threat](/systems/starfall/fragment/t1) waits.', 'markdown');
		const [a] = anchors(tree);
		expect(a?.properties?.href).toBe('/systems/starfall/fragment/t1');
		expect(text(a!)).toBe('Threat');
		// The class is what makes it *look* like a link: the app reset strips `a`.
		expect(a?.properties?.className).toEqual(['rpg-link']);
	});

	test('the text around a link survives, in order', async () => {
		const tree = await buildHast('a [one](/x) b [two](/y) c', 'markdown');
		const p = find(tree, (el) => el.tagName === 'p')[0]!;
		expect(p.children.map((c) => (c.type === 'text' ? c.value : (c as Element).tagName))).toEqual([
			'a ',
			'a',
			' b ',
			'a',
			' c'
		]);
	});

	test('a component line is still a component', async () => {
		const tree = await buildHast('Strength: Number(10, 0-20)', 'markdown');
		const [component] = find(tree, (el) => el.properties?.['data-component-type'] === 'Number');
		expect(component).toBeDefined();
		expect(anchors(tree)).toHaveLength(0);
	});

	test("a component's own text is never parsed for links", async () => {
		const tree = await buildHast('Notes: Text([a](/b))', 'markdown');
		expect(anchors(tree)).toHaveLength(0);
	});

	test('an image is not claimed — whole-line or inline', async () => {
		const whole = await buildHast('![Portrait](p.png)', 'markdown');
		expect(anchors(whole)).toHaveLength(0);
		expect(find(whole, (el) => el.tagName === 'img')).toHaveLength(1);

		const inline = await buildHast('see ![Portrait](p.png) here', 'markdown');
		expect(anchors(inline)).toHaveLength(0);
	});

	test('a note footnote is not a link — bracket without parens', async () => {
		const tree = await buildHast('Amet[^src]\n\n[^src]: Handbook p.12', 'markdown');
		expect(anchors(tree)).toHaveLength(0);
	});

	test('a macro link keeps its literal brackets — the target holds whitespace', async () => {
		const tree = await buildHast('roll [2d6](/roll 2d6)', 'markdown');
		expect(anchors(tree)).toHaveLength(0);
	});

	test('a /set link is a macro anchor with no href', async () => {
		const tree = await buildHast('- [Barbarian](/set class=barbarian, str=+1) takes it', 'markdown');
		const [a] = anchors(tree);
		expect(a?.properties).toEqual({
			className: ['rpg-link', 'rpg-macro'],
			'data-macro': 'set',
			'data-args': 'class=barbarian, str=+1'
		});
		expect(text(a!)).toBe('Barbarian');
	});

	test('/add and /remove carry their macro name and raw args', async () => {
		const tree = await buildHast('[a](/add items "Leather armor") [r](/remove items Dagger)', 'markdown');
		expect(anchors(tree).map((a) => [a.properties['data-macro'], a.properties['data-args']])).toEqual([
			['add', 'items "Leather armor"'],
			['remove', 'items Dagger']
		]);
	});

	// It used to stay text. `/set` alone is a valid CommonMark destination, so it is a plain link
	// to that path; what it never becomes is a macro.
	test('a /set link with no args is no macro', async () => {
		const tree = await buildHast('[x](/set  )', 'markdown');
		expect(anchors(tree).map((a) => a.properties)).toEqual([{ href: '/set', className: ['rpg-link'] }]);
	});

	test('a link inside a list item is found', async () => {
		const tree = await buildHast('- [Loot](/games/a4f/item/loot)', 'markdown');
		expect(anchors(tree)).toHaveLength(1);
	});

	test('an existing <a> is left alone', () => {
		// Nothing the parser builds nests one, so the plugin is run on a hand-built tree.
		const tree: Root = {
			type: 'root',
			children: [
				{
					type: 'element',
					tagName: 'a',
					properties: { href: '/x' },
					children: [{ type: 'text', value: '[not a link](/y)' }]
				}
			]
		};
		rehypeLinks()(tree);
		const found = anchors(tree);
		expect(found).toHaveLength(1);
		expect(text(found[0]!)).toBe('[not a link](/y)');
	});
});

describe('isSafeUrl', () => {
	const UNSAFE = ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,x', '\x01javascript:x', ' javascript:x', 'java\tscript:x', 'vbscript:x', ''];
	const SAFE = ['https://a.b', 'http://a.b', 'mailto:a@b.c', '/abs', '#frag', './rel', '../up', 'rel/path', 'page?q=a:b', 'rel/x:y', 'foo', '?q=1', 'caf%C3%A9.png', 'my_file.png'];

	test.each(UNSAFE)('refuses %p', (url) => expect(isSafeUrl(url)).toBe(false));
	test.each(SAFE)('allows %p', (url) => expect(isSafeUrl(url)).toBe(true));

	// It used to stay literal text, brackets and target; now a refused url is dropped and the text kept.
	test('an unsafe target loses its url, the link keeps its text', async () => {
		for (const target of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,x', 'vbscript:x']) {
			const tree = await buildHast(`click [me](${target}) now`, 'markdown');
			expect(anchors(tree)).toHaveLength(0);
			expect(text(find(tree, (el) => el.tagName === 'p')[0]!)).toBe('click me now');
		}
		// A control character makes no CommonMark link at all.
		const tree = await buildHast('click [me](\x01javascript:x) now', 'markdown');
		expect(anchors(tree)).toHaveLength(0);
	});

	test('a safe target renders', async () => {
		for (const target of ['https://a.b', 'mailto:a@b.c', '/abs', '#frag', './rel', 'rel/path', 'page?q=a:b', 'foo']) {
			const [a] = anchors(await buildHast(`[x](${target})`, 'markdown'));
			expect(a?.properties?.href).toBe(target);
		}
	});
});
