/**
 * RPG-MD component detection: a `<p>` whose whole text parses as a component line
 * (`Strength: Number(10)`) becomes a `div.rpg-component` carrying the config as data
 * attributes, with an id unique within the document. Runs after `rehype-sections.ts`
 * (component ids are prefixed with the enclosing section's `data-slug`) and before the
 * macro pass (`rehype-links.ts`). Not heading or section handling — beyond reading a
 * choice's `(#slug)` source section into options and splicing it out.
 *
 * Only a `<p>` of plain text is a candidate. `markdown-to-hast.ts` leaves a component line as
 * one raw text node and nothing else does — components are detected on source text — so a
 * prose line whose *rendered* text happens to parse (`` `Str`: Number(3) ``, a code span over
 * the label) stays prose. A `<p>` in a list item is never one: the classifier calls it a continuation.
 *
 * The file's value is the body the tree was built from. Option and description text is read back
 * out of it by position, so it is the markdown the author wrote, not the rendered text.
 */
import { visit } from 'unist-util-visit';
import type { Element, ElementContent, Parents, Root, RootContent } from 'hast';
import { COMMENT_MARKER } from './notes.ts';
import { parseOptionItem, parseToken, type ChoiceOption } from './rpg-components-registry.ts';
import { textOf } from './slug.ts';

/** The components whose options can come from a markdown list under the line. */
const CHOICE_TYPES: ReadonlySet<string> = new Set(['Select', 'Radio', 'MultiSelect']);

/** A `<p>` that may be a component line: plain text only, not in a list item. */
function candidateText(node: Element, parent: Parents | undefined): string | null {
	if (node.tagName !== 'p') return null;
	if (parent?.type === 'element' && parent.tagName === 'li') return null;
	if (!node.children.every((c) => c.type === 'text')) return null;
	return textOf(node);
}

export default function rehypeComponents() {
	return (tree: Root, file?: { value?: unknown }) => {
		const source = typeof file?.value === 'string' ? file.value : undefined;
		// Read before the visit converts anything: a source section above its component
		// would otherwise have had its own lines turned into components already.
		const sources = readSourceSections(tree, source);
		const usedIds = new Set<string>();
		// Preorder and never reset on leaving a section: a component after a nested section
		// closes keeps the inner section's slug. Changing that renames component ids, which
		// fills are keyed by.
		let sectionSlug: string | null = null;

		visit(tree, 'element', (node: Element, index, parent) => {
			if (node.tagName === 'section') {
				const slug = node.properties?.['data-slug'];
				if (slug && typeof slug === 'string') sectionSlug = slug;
			}

			if (!parent || typeof index !== 'number') return;
			const text = candidateText(node, parent);
			if (text === null) return;

			const componentConfig = parseToken(text);
			if (!componentConfig) return;

			if (CHOICE_TYPES.has(componentConfig.type)) {
				if (componentConfig.source) {
					const found = sources.get(componentConfig.source);
					if (!found) console.warn(`rpg-md: no section #${componentConfig.source} for ${componentConfig.label}`);
					applyOptions(componentConfig, found?.options ?? []);
				} else {
					const listOptions = extractFollowingListOptions(parent.children, index, source);
					const hasInlineOptions =
						componentConfig.options &&
						Array.isArray(componentConfig.options) &&
						componentConfig.options.length > 0;
					if (listOptions.length > 0 && !hasInlineOptions) applyOptions(componentConfig, listOptions);
				}
			}

			parent.children[index] = rpgComponentToHast(componentConfig, sectionSlug, usedIds);
		});

		// After the visit, so ids and the never-reset `sectionSlug` above are what they
		// would be without the splice.
		const consumed = new Set([...sources.values()].map((s) => s.section));
		if (consumed.size) {
			visit(tree, 'element', (node: Element, index, parent) => {
				if (!consumed.has(node) || !parent || typeof index !== 'number') return;
				parent.children.splice(index, 1);
				return index;
			});
		}
	};
}

/**
 * The star only reaches the config here: the component's own line had no bracket list
 * for `parseToken` to read it out of.
 */
function applyOptions(config: any, options: ChoiceOption[]) {
	config.options = options;
	const starred = options.filter((o) => o.default).map((o) => o.value ?? o.label);
	if (config.type === 'MultiSelect') config.defaultValue = starred;
	else if (starred.length) config.defaultValue ??= starred[0];
}

interface SourceSection {
	section: Element;
	options: ChoiceOption[];
}

/**
 * `Class: Select(#classes)`: each direct child section of `#classes` is one option — its
 * heading through `parseOptionItem`, its body (nested sections excluded) the description,
 * one `\n` per element, as its source text — raw markdown, which is what `description` holds.
 * Only slugs some choice line references are read; the first section with that slug wins.
 */
function readSourceSections(tree: Root, source: string | undefined): Map<string, SourceSection> {
	const wanted = new Set<string>();
	visit(tree, 'element', (node: Element, _index, parent) => {
		const text = candidateText(node, parent);
		if (text === null || !text.includes('#')) return;
		const config = parseToken(text);
		if (config && CHOICE_TYPES.has(config.type) && config.source) wanted.add(config.source);
	});

	const found = new Map<string, SourceSection>();
	if (!wanted.size) return found;
	visit(tree, 'element', (node: Element) => {
		const slug = node.tagName === 'section' ? node.properties?.['data-slug'] : undefined;
		if (typeof slug !== 'string' || !wanted.has(slug) || found.has(slug)) return;
		const options: ChoiceOption[] = [];
		for (const child of node.children) {
			if (child.type !== 'element' || child.tagName !== 'section') continue;
			const heading = child.children.find((c): c is Element => c.type === 'element' && /^h[1-6]$/.test(c.tagName));
			if (!heading) continue;
			const option = parseOptionItem(textOf(heading));
			const description = child.children
				.filter((c): c is Element => c.type === 'element' && c !== heading && c.tagName !== 'section')
				// A `<p><br></p>` or an image has no text, and gives no description line.
				.map((c) => (textOf(c).trim() ? sourceText(c, source) : ''))
				.filter(Boolean)
				.join('\n');
			if (description) option.description = description;
			options.push(option);
		}
		found.set(slug, { section: node, options });
	});
	return found;
}

/** `li` / a list item's marker, and a nested list's. */
const LIST_MARKER = /^[ \t]*(?:[-*+]|\d{1,9}[.)])(?:[ \t]+|$)/;
/** Quote markers and indentation at the head of a continuation line. */
const LINE_PREFIX = /^(?:[ \t]*>)*[ \t]*/;

/**
 * `node`'s markdown as written: its source lines, quote markers and indentation off each,
 * trimmed, joined with `\n`. Without a position or source (a hand-built tree) its text.
 */
function sourceText(node: Element, source: string | undefined): string {
	const { start, end } = node.position ?? {};
	if (source === undefined || start?.offset === undefined || end?.offset === undefined) return textOf(node).trim();
	return source
		.slice(start.offset, end.offset)
		.split('\n')
		.map((line, i) => (i ? line.replace(LINE_PREFIX, '') : line).trim())
		.filter(Boolean)
		.join('\n');
}

/**
 * An option list item's text as written, so it reads exactly as it did when a list item was
 * one source line: the marker off, a task box kept (`parseOptionItem` reads `[x]` as the
 * default), editor-note markers off. A nested list ends it.
 */
function optionText(li: Element, source: string | undefined): string {
	const { start, end } = li.position ?? {};
	if (source === undefined || start?.offset === undefined || end?.offset === undefined) return textOf(li).trim();
	const [head = '', ...rest] = source.slice(start.offset, end.offset).split('\n');
	const parts = [head.replace(LIST_MARKER, '')];
	for (const line of rest) {
		const text = line.replace(LINE_PREFIX, '');
		if (!text.trim() || LIST_MARKER.test(text)) break;
		parts.push(text);
	}
	return parts
		.map((p) => p.trim())
		.join(' ')
		.replace(COMMENT_MARKER, '')
		.trim();
}

const isBlank = (node: ElementContent): boolean =>
	node.type === 'text' ? !node.value.trim() : node.type === 'element' && node.tagName === 'br';

/**
 * Options from a `ul`/`ol` under the component, past whitespace text and blank `<p>`s
 * (a lone `\` line). The list is spliced out of the siblings once consumed.
 */
function extractFollowingListOptions(
	siblings: Array<RootContent | ElementContent>,
	componentIndex: number,
	source: string | undefined
): ChoiceOption[] {
	const options: ChoiceOption[] = [];

	for (let currentIndex = componentIndex + 1; currentIndex < siblings.length; currentIndex++) {
		const sibling = siblings[currentIndex];
		if (sibling?.type === 'text' && !sibling.value.trim()) continue;
		if (sibling?.type !== 'element') break;
		if (sibling.tagName === 'p' && sibling.children.every(isBlank)) continue;

		if (sibling.tagName === 'ul' || sibling.tagName === 'ol') {
			for (const listItem of sibling.children) {
				if (listItem.type !== 'element' || listItem.tagName !== 'li') continue;
				const text = optionText(listItem, source);
				// One reader for both forms, so `Label | value` and the `*` default
				// mean the same thing under a component as they do inside its brackets.
				if (text) options.push(parseOptionItem(text));
			}
			siblings.splice(currentIndex, 1);
		}
		break;
	}

	return options;
}

/**
 * Component ids have to be unique within a document: a fill addresses a value by
 * `(heading path, label, ordinal)` and reads it back out by component id,
 * so two components answering to one id would collapse into one value — and, in the
 * renderer, into one field that mirrors itself as you type. Bundled templates avoid
 * the clash by hand with `#id` suffixes; nothing makes an author do that, and labels
 * are deliberately not required to be unique.
 */
export function uniqueComponentId(used: Set<string>, base: string): string {
	let id = base;
	for (let n = 2; used.has(id); n++) id = `${base}_${n}`;
	used.add(id);
	return id;
}

function rpgComponentToHast(
	config: any,
	parentSectionId: string | null,
	usedIds: Set<string>
): Element {
	const componentId = uniqueComponentId(
		usedIds,
		parentSectionId ? `${parentSectionId}__${config.id}` : config.id
	);

	const dataAttributes: Record<string, any> = {
		'data-component-type': config.type,
		'data-component-alias': config.alias,
		'data-component-id': componentId,
		'data-label': config.label
	};
	for (const [key, value] of Object.entries(config)) {
		if (!['type', 'alias', 'id', 'label'].includes(key) && value !== undefined && value !== null) {
			dataAttributes[`data-${key}`] = typeof value === 'object' ? JSON.stringify(value) : value;
		}
	}

	// The original line, rebuilt so the renderer can re-parse the component from the tree.
	// Round-trips: a `| value`, a `*` default and a description are written back; a
	// description's paragraphs collapse to one line (`data-options` keeps the `\n`).
	let componentSyntax = `${config.label}: ${config.alias}`;
	if (CHOICE_TYPES.has(config.type) && config.options) {
		const optionStrings = config.options.map((opt: ChoiceOption) => {
			let text = opt.value ? `${opt.label} | ${opt.value}` : opt.label;
			if (opt.description) text += ` — ${opt.description.replace(/\n/g, ' ')}`;
			return opt.default ? `*${text}` : text;
		});
		componentSyntax += `([${optionStrings.join(', ')}])`;
	}
	const labelSlug = config.label
		.toLowerCase()
		.replace(/[^a-z0-9]/g, '_')
		.replace(/_+/g, '_')
		.replace(/^_|_$/g, '');
	if (config.id && config.id !== labelSlug) componentSyntax += ` #${config.id}`;

	return {
		type: 'element',
		tagName: 'div',
		properties: {
			className: [`rpg-component rpg-${config.type.toLowerCase()}`],
			...dataAttributes
		},
		children: [
			{
				type: 'element',
				tagName: 'label',
				properties: {},
				children: [{ type: 'text', value: config.label }]
			},
			{
				type: 'element',
				tagName: 'span',
				properties: { className: ['component-placeholder'] },
				children: [{ type: 'text', value: componentSyntax }]
			}
		]
	};
}
