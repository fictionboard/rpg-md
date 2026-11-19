/**
 * Heading → `<section>` wrapping: every heading and the content up to the next heading of
 * equal or lesser depth become one section, with a hierarchical id, the heading's slug and
 * `(.class)` classes, and a `data-content-type` — the heading's own header mapping, else the
 * nearest ancestor section's. Templates' CSS targets these classes, so the bundled-template
 * snapshots guard this file.
 * Only a heading on the document's spine — at the root, or inside a section — opens a
 * section; a heading in a quote or a list item stays where it is, as the classifier (`classify.ts`)
 * and so `fill.ts` read it. A heading's text is its rendered text: inline markdown slugs the same
 * as its source (`The *Ring*` and `The Ring`), which is what keeps ids from moving.
 * Not component detection (`rehype-components.ts`, which runs after and reads `data-slug`)
 * and not macros (`rehype-links.ts`).
 */
import { visit } from 'unist-util-visit';
import type { Element, ElementContent, Parents, Root } from 'hast';
import { headerMappingSystem } from './header-mapping-system.ts';
import { headingAttrs, headingRoles, textOf, toSlug, uniqueSlugs } from './slug.ts';

const MAX_HEADING_DEPTH = 6;

/** The root, or a section this pass made: where a heading opens a section. */
const onSpine = (parent: Parents | undefined): boolean =>
	parent?.type === 'root' || (parent?.type === 'element' && parent.tagName === 'section');

interface SectionsOptions {
	campaignId?: string;
}

export default function rehypeSections(options: SectionsOptions = {}) {
	const { campaignId } = options;

	return (tree: Root) => {
		// Deepest first, so a section's children are already sections when its own heading
		// is wrapped — `findSectionEndIndex`'s h1 case depends on that.
		for (let depth = MAX_HEADING_DEPTH; depth > 0; depth--) {
			const headingTag = `h${depth}`;
			visit(tree, 'element', (node: Element, index, parent) => {
				if (node.tagName !== headingTag || !parent || !onSpine(parent) || typeof index !== 'number') return;
				wrapHeadingInSection(node, index, parent, depth, campaignId);
			});
		}

		inheritContentTypes(tree, []);
		updateHeadingIds(tree);
	};
}

function wrapHeadingInSection(
	heading: Element,
	headingIndex: number,
	parent: Root | Element,
	depth: number,
	campaignId: string | undefined
) {
	const headerText = textOf(heading);
	const slug = toSlug(headerText);
	const endIndex = findSectionEndIndex(parent.children as ElementContent[], headingIndex, depth);
	const sectionContent = parent.children.slice(headingIndex, endIndex);

	// Header mapping is used for the content type only, never for ids or classes.
	const contentType = headerMappingSystem.resolveHeader(stripHeaderMetadata(headerText), campaignId);

	const properties: Element['properties'] = {
		id: slug, // replaced by the hierarchical id in updateHeadingIds
		className: [`node-level-${depth}`, ...getClass(headerText)],
		level: depth,
		'data-slug': slug
	};
	if (contentType) properties['data-content-type'] = contentType;
	// Read by `filterRoles`; a nested section is removed with its parent, so the gate covers it.
	const roles = headingRoles(headerText);
	if (roles.length > 0) properties['data-roles'] = roles.join(' ');
	// hast's camelCase property form (`in` → `dataIn`, `x-y` → `dataXY`) renders as `data-in`.
	for (const [key, value] of Object.entries(headingAttrs(headerText))) {
		properties['data' + key.split('-').map((p) => p[0]!.toUpperCase() + p.slice(1)).join('')] = value;
	}

	const section: Element = {
		type: 'element',
		tagName: 'section',
		properties,
		children: sectionContent as ElementContent[]
	};
	parent.children.splice(headingIndex, sectionContent.length, section);
}

/**
 * Next heading of equal or lesser depth. An h1 section also ends at an h2 — or at an
 * already-wrapped level-2 section — so an h1 never swallows the h2 sections under it.
 */
function findSectionEndIndex(
	children: ElementContent[],
	startIndex: number,
	currentDepth: number
): number {
	for (let i = startIndex + 1; i < children.length; i++) {
		const child = children[i];
		if (!child || child.type !== 'element') continue;

		if (/^h[1-6]$/.test(child.tagName)) {
			const headingDepth = parseInt(child.tagName.substring(1), 10);
			if (headingDepth <= (currentDepth === 1 ? 2 : currentDepth)) return i;
		}

		if (currentDepth === 1 && child.tagName === 'section' && child.properties?.level === 2) {
			return i;
		}
	}
	return children.length;
}

/**
 * Hierarchical ids, deduped slugs, `(.class)` classes and metadata-free heading text. The
 * id path starts at h2 — an h3 is `h2__h3`, never `h1__h2__h3` — and the section gets the
 * same id as its heading (a known duplicate).
 */
function updateHeadingIds(tree: Root) {
	const hierarchicalIds: string[] = [];
	const uniqueSlug = uniqueSlugs();

	visit(tree, 'element', (node: Element, _index, parent) => {
		if (!/^h[1-6]$/.test(node.tagName) || !onSpine(parent)) return;

		const depth = parseInt(node.tagName.substring(1), 10);
		const headerText = textOf(node);
		const customClasses = extractCustomClasses(headerText);
		updateElementTextContent(node, stripHeaderMetadata(headerText));
		const slug = uniqueSlug(toSlug(headerText));

		// Index 0 (h1) is never read — the path starts at h2 — so keeping a stale h1 here
		// when an h2 arrives is harmless.
		hierarchicalIds.length = Math.min(hierarchicalIds.length, depth - 1);
		hierarchicalIds[depth - 1] = slug;

		let id = slug;
		if (depth > 2) {
			const validIds = hierarchicalIds.slice(1, depth).filter(Boolean);
			if (validIds.length > 0) id = validIds.join('__');
		}

		node.properties.id = id;
		if (parent?.type === 'element' && parent.tagName === 'section') parent.properties.id = id;

		if (customClasses.length > 0) {
			node.properties.className = [
				...((node.properties.className as string[] | undefined) ?? []),
				...customClasses
			];
		}
	});
}

/**
 * Cuts the heading's text down to `newText`, which is its text with the metadata bracket off
 * the end and the whitespace trimmed: the text nodes keep their places and their markup
 * (`The *Ring* (.big)` keeps its `<em>`), only the characters past the cut go.
 */
function updateElementTextContent(element: Element, newText: string) {
	const full = textOf(element);
	let skip = full.length - full.trimStart().length;
	let keep = newText.length;
	const cut = (node: Element) => {
		node.children = node.children.filter((child) => {
			if (child.type === 'element') {
				cut(child);
				return true;
			}
			if (child.type !== 'text') return true;
			const drop = Math.min(skip, child.value.length);
			skip -= drop;
			const value = child.value.slice(drop, drop + keep);
			keep -= value.length;
			child.value = value;
			return value !== '';
		});
	};
	cut(element);
}

/** Every `(.a .b)` group, split on whitespace — the heading's classes. `@role` tokens are not classes. */
function extractCustomClasses(text: string): string[] {
	return [...text.matchAll(/\(\.([^)]+)\)/g)]
		.flatMap((m) => m[1]?.trim().split(/\s+/) ?? [])
		.filter((c) => !c.startsWith('@'));
}

/**
 * The section's class: the first `(.…)` group lowercased and split on spaces, or the slug.
 * Differs from `extractCustomClasses` (first group only, `(.` at index 0 ignored, `.b`
 * kept with its dot) — both are observable in templates' CSS, so neither is unified.
 */
function getClass(text: string): string[] {
	const custom = text.indexOf('(.') > 0 ? /\(\.([^)]+)\)/.exec(text)?.[1] : undefined;
	return (custom ? custom.trim().toLowerCase() : toSlug(text))
		.split(' ')
		.filter((c) => c !== '' && !c.startsWith('@'));
}

function stripHeaderMetadata(text: string): string {
	return text.replace(/(\s*\([^)]*\))+\s*$/, '').trim();
}

/**
 * Top-down, after wrapping: a section with no own content type takes its nearest ancestor
 * section's own type. It cannot happen during wrapping — that runs deepest-first, so a child
 * is wrapped before its parent's type exists — and a depth-keyed lookup would leak a type
 * from a sibling branch. Real ancestry means an h1's type never reaches the h2s after it:
 * they are its siblings (an h1 section ends at the next h2). Attribute only, never a class —
 * a type-named class would collide with template CSS (`.actor`) and Tailwind (`.table`).
 */
function inheritContentTypes(node: Root | Element, ownTypes: string[]) {
	for (const child of node.children) {
		if (child.type !== 'element') continue;
		if (child.tagName !== 'section') {
			inheritContentTypes(child, ownTypes);
			continue;
		}
		const own = child.properties['data-content-type'] as string | undefined;
		if (!own && ownTypes.length > 0) child.properties['data-content-type'] = ownTypes.at(-1);
		inheritContentTypes(child, own ? [...ownTypes, own] : ownTypes);
	}
}
