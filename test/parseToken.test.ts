/**
 * Characterization tests for the component registry.
 *
 * These pin *current* behaviour, quirks included — they exist so a rewrite of parsing or fill
 * has a net, not to describe what parsing ought to do. Where a case is a known wart it
 * is labelled as such.
 */
import { describe, expect, test } from 'bun:test';
import {
	COMPONENT_ALIASES,
	VALID_COMPONENTS,
	extractComponentConfig,
	isValidComponent,
	parseToken,
	resolveComponentName
} from '../src/index.ts';

describe('resolveComponentName', () => {
	test('core component names resolve to themselves', () => {
		for (const name of VALID_COMPONENTS) {
			expect(resolveComponentName(name)).toBe(name);
			expect(isValidComponent(name)).toBe(true);
		}
	});

	test('every alias resolves to a core component', () => {
		for (const [alias, target] of Object.entries(COMPONENT_ALIASES)) {
			expect(resolveComponentName(alias)).toBe(target);
			expect(VALID_COMPONENTS).toContain(target);
		}
	});

	test('unknown names resolve to undefined', () => {
		expect(resolveComponentName('Wizard')).toBeUndefined();
		expect(isValidComponent('Wizard')).toBe(false);
	});
});

describe('parseToken — one case per core component', () => {
	test('Number with default and range', () => {
		expect(parseToken('Strength: Number(10, 0-20)')).toMatchObject({
			type: 'Number',
			alias: 'Number',
			label: 'Strength',
			id: 'strength',
			defaultValue: 10,
			min: 0,
			max: 20
		});
	});

	test('Text with quoted default', () => {
		expect(parseToken('Name: Text("Gandalf")')).toMatchObject({
			type: 'Text',
			label: 'Name',
			id: 'name',
			defaultValue: 'Gandalf'
		});
	});

	test('TextArea defaults to 3 rows', () => {
		expect(parseToken('Notes: TextArea()')).toMatchObject({ type: 'Textarea', rows: 3 });
		expect(parseToken('Notes: TextArea(rows 5)')).toMatchObject({ type: 'Textarea', rows: 5 });
	});

	test('Checks splits current/total', () => {
		expect(parseToken('Health: Checks(2/10)')).toMatchObject({
			type: 'Checks',
			checked: 2,
			total: 10
		});
	});

	test('Checks with no argument falls back to 0/1', () => {
		expect(parseToken('Health: Checks()')).toMatchObject({ checked: 0, total: 1 });
	});

	// The label *is* the stored value: the auto-slug this used to assert
	// meant a fill read `Class: fighter` for a choice nobody spelled that way.
	test('Select options carry no value of their own', () => {
		expect(parseToken('Class: Select([Fighter, Mage, Rogue])')).toMatchObject({
			type: 'Select',
			options: [{ label: 'Fighter' }, { label: 'Mage' }, { label: 'Rogue' }]
		});
	});

	test('a starred option is the default, and keeps its label', () => {
		expect(parseToken('Class: Select([Fighter, *Mage, Rogue])')).toMatchObject({
			defaultValue: 'Mage',
			options: [{ label: 'Fighter' }, { label: 'Mage', default: true }, { label: 'Rogue' }]
		});
	});

	test('an emphasised option is not a default', () => {
		expect(parseToken('Class: Select([*Mage*, Rogue])')).toMatchObject({
			defaultValue: undefined,
			options: [{ label: '*Mage*' }, { label: 'Rogue' }]
		});
	});

	test('Radio is its own type and takes the same list', () => {
		expect(parseToken('Heritage: Pips([Akoros, *Iruvia])')).toMatchObject({
			type: 'Radio',
			alias: 'Pips',
			defaultValue: 'Iruvia',
			options: [{ label: 'Akoros' }, { label: 'Iruvia', default: true }]
		});
	});

	test('a starred option with a pipe defaults to its explicit value', () => {
		expect(parseToken('Class: Select([*Fighter Mage | fm, Monk])')).toMatchObject({
			defaultValue: 'fm'
		});
	});

	test('Select honours the pipe syntax for explicit values', () => {
		expect(parseToken('Class: Select([Fighter Mage | fighter_mage])')).toMatchObject({
			options: [{ label: 'Fighter Mage', value: 'fighter_mage' }]
		});
	});

	test('MultiSelect defaultValue is always an array', () => {
		expect(parseToken('Skills: MultiSelect([Stealth, Song])')).toMatchObject({
			type: 'MultiSelect',
			defaultValue: []
		});
	});

	test('MultiSelect collects every star', () => {
		expect(parseToken('Conditions: MultiSelect([Cold, *Haunted, *Vicious])')).toMatchObject({
			defaultValue: ['Haunted', 'Vicious']
		});
	});

	test('Computed and Modifier lift the formula out of the braces', () => {
		expect(parseToken('Total: Computed({@str + @dex})')).toMatchObject({
			type: 'Computed',
			formula: '@str + @dex'
		});
		expect(parseToken('Str Mod: Modifier({(@str - 10) / 2})')).toMatchObject({
			type: 'Modifier',
			formula: '(@str - 10) / 2'
		});
	});

	test('Dice and Roll carry their notation', () => {
		expect(parseToken('Damage: Dice(2d6+3)')).toMatchObject({
			type: 'Dice',
			defaultValue: '2d6+3'
		});
		expect(parseToken('Save: Roll(2d20kh1)')).toMatchObject({ type: 'Roll', formula: '2d20kh1' });
	});

	test('Dice and Roll fall back to 1d6', () => {
		expect(parseToken('Damage: Dice()')).toMatchObject({ defaultValue: '1d6' });
		expect(parseToken('Save: Roll()')).toMatchObject({ formula: '1d6' });
	});

	test('Value keeps its literal under `value`, not `defaultValue`', () => {
		expect(parseToken('Age: Value(87)')).toMatchObject({ type: 'Value', value: 87 });
	});

	test('Action reads a bare keyword flag as boolean true', () => {
		expect(parseToken('Attack: Action("roll attack", once)')).toMatchObject({
			type: 'Action',
			action: 'roll attack',
			buttonType: 'button',
			once: true
		});
	});

	test('Actor takes no arguments', () => {
		expect(parseToken('Relations: Actor')).toMatchObject({
			type: 'Actor',
			label: 'Relations',
			defaultValue: ''
		});
	});

	test('Media reads the url from the default value', () => {
		expect(parseToken('Portrait: Media("avatar.png", circular)')).toMatchObject({
			type: 'Media',
			url: 'avatar.png',
			circular: true
		});
	});

	test('Media takes a category as `category: x`, `category="x"` or `category x`', () => {
		for (const line of [
			'npc image: Media(category: portrait)',
			'npc image: Media(category="portrait")',
			"npc image: Media(category='portrait')",
			'npc image: Media(category portrait)'
		]) {
			expect(parseToken(line)).toMatchObject({ type: 'Media', id: 'npc_image', url: '', category: 'portrait' });
		}
	});

	test('Media keeps a positional url beside a category', () => {
		expect(parseToken('Crest: Media("crest.png", category: symbol, circular)')).toMatchObject({
			url: 'crest.png',
			category: 'symbol',
			circular: true
		});
	});

	test('Media drops a category it does not know', () => {
		expect(parseToken('Pic: Media(category: selfie)')).not.toHaveProperty('category');
	});

	test('Resource is recognised', () => {
		expect(parseToken('Weapon: Resource()')).toMatchObject({ type: 'Resource', id: 'weapon' });
	});
});

describe('parseToken — aliases', () => {
	test('an alias produces the core type and records the alias used', () => {
		expect(parseToken('Athletics: Skill(2)')).toMatchObject({
			type: 'Number',
			alias: 'Skill',
			label: 'Athletics'
		});
		expect(parseToken('History: Description()')).toMatchObject({
			type: 'Textarea',
			alias: 'Description'
		});
		expect(parseToken('Portrait: Avatar("p.png")')).toMatchObject({
			type: 'Media',
			alias: 'Avatar'
		});
	});
});

describe('parseToken — ids', () => {
	test('id defaults to a slug of the label', () => {
		expect(parseToken('Max HP: Number(10)')).toMatchObject({ id: 'max_hp' });
	});

	test('parenthetical content is stripped before slugging', () => {
		expect(parseToken('Hit Points (HP): Number(10)')).toMatchObject({ id: 'hit_points' });
	});

	test('a #suffix overrides the generated id', () => {
		expect(parseToken('Hit Points (HP): Number(10) #hp')).toMatchObject({ id: 'hp' });
	});
});

describe('parseToken — non-components', () => {
	test('prose is not a component', () => {
		expect(parseToken('Just a sentence.')).toBeUndefined();
		expect(parseToken('')).toBeUndefined();
	});

	test('a label with no colon is not a component', () => {
		expect(parseToken('Strength Number(10)')).toBeUndefined();
	});

	test('an unknown component name is not a component', () => {
		expect(parseToken('Name: NotAComponent(1)')).toBeUndefined();
	});
});

describe('parseToken — known warts', () => {

	test('Modifier duplicates the formula into defaultValue', () => {
		expect(parseToken('Mod: Modifier({@str})')).toMatchObject({ defaultValue: '{@str}' });
	});

	test('Resource turns a filter into an option instead of a filter', () => {
		expect(parseToken('Weapon: Resource([filter weapons])')).toMatchObject({
			options: [{ label: 'filter weapons' }]
		});
	});

	// The gate that stops `Text(John Doe)` becoming `{ John: 'Doe' }` is an allow-list,
	// so an attribute nobody added to `KNOWN_ATTRIBUTES` reads as the default instead.
	test('an unknown attribute name is read as a default value', () => {
		expect(parseToken('Name: Text(colour red)')).toMatchObject({ defaultValue: 'colour red' });
	});
});

describe('extractComponentConfig', () => {
	test('reads a config back off a HAST element\'s data attributes', () => {
		const config = extractComponentConfig({
			properties: {
				'data-component-type': 'Number',
				'data-component-alias': 'Skill',
				'data-component-id': 'stats__strength',
				'data-label': 'Strength',
				'data-min': 0,
				'data-max': 20,
				'data-options': '[{"label":"A"}]'
			}
		});
		expect(config).toMatchObject({
			type: 'Number',
			alias: 'Skill',
			id: 'stats__strength',
			label: 'Strength',
			min: 0,
			max: 20,
			options: [{ label: 'A' }]
		});
	});

	test('an element with no component type yields undefined', () => {
		expect(extractComponentConfig({ properties: { id: 'x' } })).toBeUndefined();
		expect(extractComponentConfig({})).toBeUndefined();
	});
});
