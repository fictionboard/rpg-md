/**
 * Fountain screenplay text → HAST: every scene heading opens a `section.scene`, every other
 * element becomes a `<p class="fountain-…">` (centered text `p.fountain-action.fountain-centered`;
 * notes, boneyard, sections and synopses an `aside.fountain-….hidden`). It replaces the whole
 * tree with the parsed document. Each element's text goes through the one inline parser
 * (`inlineMarkdown` in its `'fountain'` mode, `_x_` underlined, macros included), except a
 * component line, which stays one raw text node in a plain `<p>`; chain
 * `rehype-components.ts` after it to convert those.
 * `buildHast(body, 'fountain')` is the one caller, handing it the body as a single text node.
 * Deliberately no format auto-detection: guessing from text alone let one short ALL-CAPS
 * line turn an HTML body into a screenplay.
 */
import { visit } from 'unist-util-visit';
import type { Element, ElementContent, Root, Text } from 'hast';
import { isHiddenElement, parseFountainDocument, type FountainElement } from './fountain-parser.ts';
import { inlineMarkdown } from './inline-markdown.ts';
import { parseToken } from './rpg-components-registry.ts';
import { toSlug, uniqueSlugs } from './slug.ts';

const SCENE_DEPTH = 2;

export default function rehypeFountain() {
	return (tree: Root) => {
		let text = '';
		visit(tree, 'text', (node: Text) => {
			text += node.value + '\n';
		});

		const uniqueSlug = uniqueSlugs();
		tree.children = [];
		let currentSection: Element | null = null;

		for (const element of parseFountainDocument(text)) {
			const hastElement = fountainElementToHast(element);

			if (element.type === 'scene-heading') {
				if (currentSection) tree.children.push(currentSection);
				const slug = uniqueSlug(sceneSlug(element.content));
				currentSection = {
					type: 'element',
					tagName: 'section',
					properties: {
						id: slug,
						className: [`node-level-${SCENE_DEPTH}`, 'scene', slug],
						level: SCENE_DEPTH,
						'data-slug': slug,
						'data-content-type': 'Scene'
					},
					children: [hastElement]
				};
			} else if (currentSection) {
				currentSection.children.push(hastElement);
			} else {
				tree.children.push(hastElement);
			}
		}

		if (currentSection) tree.children.push(currentSection);
	};
}

/**
 * A scene heading's slug is its whole text: `(1973)` or `(PARIS)` is part of the place, not the
 * `(.class)` metadata `toSlug` cuts from the first `(`; `-` and `/` separate words. `(#id)` still wins.
 */
const sceneSlug = (heading: string) => toSlug(heading.includes('(#') ? heading : heading.replace(/[()/\-–—]/g, ' '));

/** A component line raw, anything else as inline markdown. */
function inline(value: string): ElementContent[] {
	return parseToken(value) ? [{ type: 'text', value }] : inlineMarkdown(value, 'fountain');
}

function fountainElementToHast(element: FountainElement): Element {
	const baseClass = `fountain-${element.type}`;
	const el = (tagName: string, properties: Element['properties'], className = [baseClass]): Element => ({
		type: 'element',
		tagName,
		properties: { className, ...properties },
		children: inline(element.content)
	});

	if (isHiddenElement(element.type)) return el('aside', {}, [baseClass, 'hidden']);

	switch (element.type) {
		case 'scene-heading':
			return el('h2', {
				'data-setting': element.metadata.setting,
				'data-location': element.metadata.location,
				'data-time': element.metadata.timeOfDay,
				'data-scene-number': element.metadata.sceneNumber
			});
		case 'character':
			return el(
				'p',
				{
					'data-character': element.metadata.name,
					'data-extension': element.metadata.extension,
					'data-dual': element.metadata.dual
				},
				[baseClass, 'character-name']
			);
		case 'dialogue':
		case 'parenthetical':
			return el('p', { 'data-character': element.metadata.character });
		case 'action':
			return el('p', {}, element.metadata.centered ? [baseClass, 'fountain-centered'] : [baseClass]);
		default:
			return el('p', {});
	}
}
