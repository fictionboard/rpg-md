/**
 * Regression net for template sheets.
 *
 * Every fixture's section ids and class lists are snapshotted. Template CSS is written
 * against exactly these classes — headings become sections whose classes the sheet's
 * stylesheet targets — so any change to rehype-sections that shifts them silently unstyles
 * every sheet built on them. The fixtures in `fixtures/templates/` (`<template>.md`) are
 * original sheets; `sampler.md` touches every component type, alias form and section
 * pattern at least once, so a change to any of them moves a snapshot here.
 */
import { describe, expect, test } from 'bun:test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { buildHast } from '../src/index.ts';
import { classNames, componentIds, components, elementsByTag, silenceParserLogs } from './helpers.ts';

silenceParserLogs();

const TEMPLATES_DIR = join(import.meta.dir, 'fixtures/templates');

const templates = readdirSync(TEMPLATES_DIR)
	.filter((name) => name.endsWith('.md'))
	.map((name) => name.slice(0, -'.md'.length))
	.sort();

test('every template fixture is discovered', () => {
	expect(templates).toEqual(['beach-party', 'beach-party-npc', 'sampler', 'simple-rpg']);
});

describe.each(templates)('%s', (name) => {
	const source = readFileSync(join(TEMPLATES_DIR, `${name}.md`), 'utf-8');

	test('section class lists', async () => {
		const tree = await buildHast(source, 'markdown');
		const sections = elementsByTag(tree, 'section').map((section) => ({
			id: String(section.properties?.['id']),
			classes: classNames(section)
		}));

		expect(sections).toMatchSnapshot();
	});

	test('component ids', async () => {
		const tree = await buildHast(source, 'markdown');
		expect(componentIds(tree)).toMatchSnapshot();
	});

	/**
	 * Ids and section classes are blind to a component's type: swapping a `Select` for a
	 * `Radio` moves neither. Yet the type decides which renderer draws the field and —
	 * through the alias — the `div.<alias>` class the template's CSS targets, so it is
	 * pinned on its own.
	 */
	test('component types', async () => {
		const tree = await buildHast(source, 'markdown');
		expect(components(tree).map((el) => String(el.properties?.['data-component-type']))).toMatchSnapshot();
	});
});
