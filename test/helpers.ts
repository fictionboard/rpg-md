import type { Element, Node, Root } from 'hast';
import { afterAll, beforeAll, spyOn } from 'bun:test';

/** Every element in tree order. */
export function elements(tree: Root | Element): Element[] {
	const out: Element[] = [];
	const walk = (node: Node & { children?: Node[]; tagName?: string }) => {
		if (node.type === 'element') out.push(node as Element);
		for (const child of (node.children ?? []) as Node[]) walk(child as never);
	};
	walk(tree as never);
	return out;
}

export function elementsByTag(tree: Root | Element, tagName: string): Element[] {
	return elements(tree).filter((el) => el.tagName === tagName);
}

/** Every converted RPG component, in tree order. */
export function components(tree: Root | Element): Element[] {
	return elements(tree).filter((el) => el.properties?.['data-component-type']);
}

export function componentIds(tree: Root | Element): string[] {
	return components(tree).map((el) => String(el.properties?.['data-component-id']));
}

export function classNames(el: Element): string[] {
	const className = el.properties?.['className'] ?? [];
	return (Array.isArray(className) ? className : [className]).map(String);
}

/**
 * The parser no longer logs; kept so a stray `console.log` in it stays out of test output.
 */
export function silenceParserLogs(): void {
	let spy: { mockRestore(): void } | undefined;
	beforeAll(() => {
		spy = spyOn(console, 'log').mockImplementation(() => {});
	});
	afterAll(() => {
		spy?.mockRestore();
	});
}

/**
 * A compact HTML-ish rendering for asserting structure: tags and text, the `\n` text nodes
 * mdast-util-to-hast puts between blocks dropped, attributes left out except those named in `attrs`.
 */
export function markup(node: Node, attrs: string[] = []): string {
	const n = node as Node & { value?: string; tagName?: string; children?: Node[]; properties?: Record<string, unknown> };
	if (n.type === 'text') return !n.value!.trim() && n.value!.includes('\n') ? '' : n.value!;
	const inner = (n.children ?? []).map((c) => markup(c, attrs)).join('');
	if (n.type !== 'element') return inner;
	const props = attrs
		.filter((a) => n.properties?.[a] !== undefined)
		.map((a) => ` ${a}="${String(n.properties![a])}"`)
		.join('');
	return `<${n.tagName}${props}>${inner}</${n.tagName}>`;
}
