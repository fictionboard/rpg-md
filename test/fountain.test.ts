/**
 * `buildHast(body, 'fountain')` — a Session body rendered as a script. Pins the shape
 * fictionboard's `safeHast` has to let through, and that nothing is read as markdown.
 * `parseFountainDocument` is pinned against the spec's own example (fixtures/brick-and-steel.fountain,
 * https://fountain.io/syntax, title page cut — frontmatter is ours) and its rules one by one, and
 * held to its counts on a longer original script that uses every element (fixtures/the-last-ferry.fountain).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';
import { buildHast, textOf } from '../src/index.ts';
import { normalizeSceneHeadings, parseFountainDocument } from '../src/parser/fountain-parser.ts';
import { classNames, components, elements, elementsByTag, markup, silenceParserLogs } from './helpers.ts';

silenceParserLogs();

const SCRIPT = `---
status: running
---
INT. TAVERN - NIGHT

The fire is low.

BOB
We should go.

not a heading <b>x</b>
`;

test('frontmatter is stripped and a scene heading opens a section', async () => {
	const tree = await buildHast(SCRIPT, 'fountain');
	const [section] = elementsByTag(tree, 'section');
	expect(section).toBeDefined();
	expect(classNames(section!)).toContain('scene');
	expect(section!.properties?.['data-slug']).toBe('int_tavern_night');
	const text = JSON.stringify(tree);
	expect(text).not.toContain('status');
});

test('a scene slug keeps what is in parentheses and splits on - and /', async () => {
	const tree = await buildHast('INT. RESTAURANT (LA RUE 14) - NIGHT (1998)\n\nINT./EXT. HALF-DARK CAR - DAY\n\nINT. CAVE (#lair)\n', 'fountain');
	expect(elementsByTag(tree, 'section').map((s) => s.properties?.['data-slug'])).toEqual(['int_restaurant_la_rue_14_night_1998', 'int_ext_half_dark_car_day', 'lair']);
});

test('character and dialogue become fountain paragraphs', async () => {
	const tree = await buildHast(SCRIPT, 'fountain');
	const kinds = elements(tree).flatMap(classNames).filter((c) => c.startsWith('fountain-'));
	expect(kinds).toContain('fountain-scene-heading');
	expect(kinds).toContain('fountain-action');
	expect(kinds).toContain('fountain-character');
	expect(kinds).toContain('fountain-dialogue');
});

test('block markdown stays text; raw markup is dropped', async () => {
	const tree = await buildHast(SCRIPT, 'fountain');
	expect(elementsByTag(tree, 'h1')).toHaveLength(0);
	expect(elementsByTag(tree, 'b')).toHaveLength(0);
	expect(elements(tree).map((el) => textOf(el))).toContain('not a heading x');
});

test('a section, synopsis, note and boneyard are hidden asides', async () => {
	const tree = await buildHast('# Act\n\n= Setup\n\n[[a note]]\n\n/*\nINT. GONE - DAY\n*/\n\nThe fire is low.\n', 'fountain');
	const asides = elementsByTag(tree, 'aside');
	expect(asides.map(classNames)).toEqual([
		['fountain-section', 'hidden'],
		['fountain-synopsis', 'hidden'],
		['fountain-note', 'hidden'],
		['fountain-boneyard', 'hidden']
	]);
	expect(elementsByTag(tree, 'section')).toHaveLength(0);
});

test('centered text is a centered action', async () => {
	const tree = await buildHast('> THE END <\n', 'fountain');
	expect(classNames(elementsByTag(tree, 'p')[0]!)).toEqual(['fountain-action', 'fountain-centered']);
});

// One inline parser for bodies, Fountain elements and descriptions.
test('an element is inline markdown — macros included — and a component line stays raw', async () => {
	const tree = await buildHast('INT. LAB - DAY\n\nShe takes *the* `key` and [runs](/set fled=1).\n\nNotes: Text(**x**)\n', 'fountain');
	const action = elements(tree).find((el) => classNames(el).includes('fountain-action'))!;
	expect(markup(action, ['data-macro'])).toBe('<p>She takes <em>the</em> <code>key</code> and <a data-macro="set">runs</a>.</p>');
	expect(components(tree).map((c) => c.properties['data-defaultValue'])).toEqual(['**x**']);
});

test('emphasis reads as Fountain: _underline_ is u', async () => {
	const tree = await buildHast("INT. LAB - DAY\n\n_Steel's face FILLS the *Leupold Mark 4* scope_. ***Now***.\n", 'fountain');
	const action = elements(tree).find((el) => classNames(el).includes('fountain-action'))!;
	expect(markup(action)).toBe("<p><u>Steel's face FILLS the <em>Leupold Mark 4</em> scope</u>. <em><strong>Now</strong></em>.</p>");
});

test('an empty body is an empty tree', async () => {
	const tree = await buildHast('---\nstatus: planned\n---\n', 'fountain');
	expect(tree.children).toHaveLength(0);
});

/** `[type, content]` per element, hidden parts as `type!content`. */
function shape(text: string): string[][] {
	return parseFountainDocument(text).map((el) => [el.type, el.content, ...el.hidden.map((h) => `${h.type}!${h.content}`)]);
}

test('the spec\'s example script parses element for element', () => {
	const script = readFileSync(new URL('./fixtures/brick-and-steel.fountain', import.meta.url), 'utf8');
	expect(shape(script)).toEqual([
		['scene-heading', 'EXT. BRICK\'S PATIO - DAY'],
		['action', 'A gorgeous day.  The sun is shining.  But BRICK BRADDOCK, retired police detective, is sitting quietly, contemplating -- something.'],
		['action', 'The SCREEN DOOR slides open and DICK STEEL, his former partner and fellow retiree, emerges with two cold beers.'],
		['character', 'STEEL'],
		['dialogue', 'Beer\'s ready!'],
		['character', 'BRICK'],
		['dialogue', 'Are they cold?'],
		['character', 'STEEL'],
		['dialogue', 'Does a bear crap in the woods?'],
		['action', 'Steel sits.  They laugh at the dumb joke.'],
		['character', 'STEEL'],
		['parenthetical', '(beer raised)'],
		['dialogue', 'To retirement.'],
		['character', 'BRICK'],
		['dialogue', 'To retirement.'],
		['action', 'They drink long and well from the beers.'],
		['action', 'And then there\'s a long beat.\nLonger than is funny.\nLong enough to be depressing.'],
		['action', 'The men look at each other.'],
		['character', 'STEEL'],
		['dialogue', 'Screw retirement.'],
		['character', 'BRICK'],
		['dialogue', 'Screw retirement.'],
		['transition', 'SMASH CUT TO:'],
		['scene-heading', 'INT. TRAILER HOME - DAY'],
		['action', 'This is the home of THE BOY BAND, AKA DAN and JACK.  They too are drinking beer, and counting the take from their last smash-and-grab.  Money, drugs, and ridiculous props are strewn about the table.'],
		['character', 'JACK'],
		['parenthetical', '(in Vietnamese, subtitled)'],
		['dialogue', '*Did you know Brick and Steel are retired?*'],
		['character', 'DAN'],
		['dialogue', 'Then let\'s retire them.\n_Permanently_.'],
		['action', 'Jack begins to argue vociferously in Vietnamese (?), But mercifully we...'],
		['transition', 'CUT TO:'],
		['scene-heading', 'EXT. BRICK\'S POOL - DAY'],
		['action', 'Steel, in the middle of a heated phone call:'],
		['character', 'STEEL'],
		['dialogue', 'They\'re coming out of the woodwork!'],
		['parenthetical', '(pause)'],
		['dialogue', 'No, everybody we\'ve put away!'],
		['parenthetical', '(pause)'],
		['dialogue', 'Point Blank Sniper?'],
		['scene-heading', 'SNIPER SCOPE POV'],
		['action', 'From what seems like only INCHES AWAY.  _Steel\'s face FILLS the *Leupold Mark 4* scope_.'],
		['character', 'STEEL'],
		['dialogue', 'The man\'s a myth!'],
		['action', 'Steel turns and looks straight into the cross-hairs.'],
		['character', 'STEEL'],
		['parenthetical', '(oh crap)'],
		['dialogue', 'Hello...'],
		['transition', 'CUT TO:'],
		['scene-heading', 'OPENING TITLES'],
		['action', 'BRICK BRADDOCK\n& DICK STEEL IN'],
		['action', 'BRICK & STEEL\nFULL RETIRED'],
		['transition', 'SMASH CUT TO:'],
		['scene-heading', 'EXT. WOODEN SHACK - DAY'],
		['action', 'COGNITO, the criminal mastermind, is SLAMMED against the wall.'],
		['character', 'COGNITO'],
		['dialogue', 'Woah woah woah, Brick and Steel!'],
		['action', 'Sure enough, it\'s Brick and Steel, roughing up their favorite usual suspect.'],
		['character', 'COGNITO'],
		['dialogue', 'What is it you want with me, DICK?'],
		['action', 'Steel SMACKS him.'],
		['character', 'STEEL'],
		['dialogue', 'Who\'s coming after us?'],
		['character', 'COGNITO'],
		['dialogue', 'Everyone\'s coming after you mate!  Scorpio, The Boy Band, Sparrow, Point Blank Sniper...'],
		['action', 'As he rattles off the long list, Brick and Steel share a look.  This is going to be BAD.'],
		['transition', 'CUT TO:'],
		['scene-heading', 'INT. GARAGE - DAY'],
		['action', 'BRICK and STEEL get into Mom\'s PORSCHE, Steel at the wheel.  They pause for a beat, the gravity of the situation catching up with them.'],
		['character', 'BRICK'],
		['dialogue', 'This is everybody we\'ve ever put away.'],
		['character', 'STEEL'],
		['parenthetical', '(starting the engine)'],
		['dialogue', 'So much for retirement!'],
		['action', 'They speed off.  To destiny!'],
		['transition', 'CUT TO:'],
		['scene-heading', 'EXT. PALATIAL MANSION - DAY'],
		['action', 'An EXTREMELY HANDSOME MAN drinks a beer.  Shirtless, unfortunately.'],
		['action', 'His minion approaches offscreen:'],
		['character', 'MINION'],
		['dialogue', 'We found Brick and Steel!'],
		['character', 'HANDSOME MAN'],
		['dialogue', 'I want them dead.  DEAD!'],
		['action', 'Beer flies.'],
		['transition', 'BURN TO PINK.'],
		['action', 'THE END']
	]);
	const dual = parseFountainDocument(script).filter((el) => el.metadata.dual);
	expect(dual.map((el) => el.content)).toEqual(['STEEL', 'BRICK']);
});

test('a script using every element parses to the counts it has', async () => {
	const script = readFileSync(new URL('./fixtures/the-last-ferry.fountain', import.meta.url), 'utf8');
	const elements = parseFountainDocument(script);
	const counts: Record<string, number> = {};
	for (const el of elements) counts[el.type] = (counts[el.type] ?? 0) + 1;
	// 15 headings: INT, EXT, EST, INT./EXT., I/E, a reversed EXT/INT., a forced `.` one. 2 notes on
	// lines of their own (a third sits inside a dialogue line, on its `hidden`); the boneyard
	// swallows a whole cut scene, heading and cue included; `===` page breaks add nothing.
	expect(counts).toEqual({
		action: 39,
		boneyard: 1,
		character: 50,
		dialogue: 50,
		lyrics: 1,
		note: 2,
		parenthetical: 8,
		'scene-heading': 15,
		section: 4,
		synopsis: 3,
		transition: 5
	});
	expect(elements.filter((el) => el.type === 'character' && !['dialogue', 'parenthetical'].includes(elements[elements.indexOf(el) + 1]!.type))).toEqual([]);
	// The title page is ours to leave unread: it is the first action, not lost.
	expect(elements[0]!.content).toStartWith('Title: The Last Ferry\nCredit: written by');
	expect(elements.filter((el) => el.metadata.dual).map((el) => el.content)).toEqual(['TEO', 'MARA']);
	expect(elements.filter((el) => el.metadata.sceneNumber).map((el) => el.metadata.sceneNumber)).toEqual(['1', '2', '3A', '9']);
	expect(elements.at(-1)).toMatchObject({ type: 'action', content: 'THE END', metadata: { centered: true } });

	const slugs = elementsByTag(await buildHast(script, 'fountain'), 'section').map((s) => s.properties?.['data-slug']);
	expect(new Set(slugs).size).toBe(15);
	expect(slugs).toContain('ext_int_harbour_caf_day');
	expect(slugs).toContain('flashback_the_persistence_thirty_years_earlier');
	// The same heading twice: the second slug is deduplicated.
	expect(slugs).toContain('int_persistence_car_deck_later_1');
});

describe('scene headings', () => {
	test('INT, EXT, EST, INT./EXT and I/E after a blank line, in any case', () => {
		for (const h of ['INT. HOUSE - DAY', 'EXT HOUSE', 'est. city - dawn', 'INT./EXT. CAR - NIGHT', 'INT/EXT CAR', 'I/E CAR']) {
			expect(shape(`Before.\n\n${h}\n\nAfter.`)[1]).toEqual(['scene-heading', h]);
		}
	});

	test('the reversed EXT/INT and E/I read as INT./EXT.', () => {
		for (const h of ['EXT/INT. SHACK - DAY', 'EXT./INT. SHACK - DAY', 'e/i shack - day']) {
			const [, heading] = parseFountainDocument(`Before.\n\n${h}\n\nAfter.`);
			expect(heading).toMatchObject({ type: 'scene-heading', content: h, metadata: { setting: 'INT./EXT.', location: expect.stringMatching(/shack/i) } });
		}
	});

	test('not without a blank line before it', () => {
		expect(shape('She runs.\nINT. HOUSE - DAY')).toEqual([['action', 'She runs.\nINT. HOUSE - DAY']]);
	});

	test('forced by a single period, which is stripped; an ellipsis is not', () => {
		expect(shape('.flashback')).toEqual([['scene-heading', 'flashback']]);
		expect(shape('...and then')).toEqual([['action', '...and then']]);
	});

	test('a scene number is cut off into metadata', () => {
		const [heading] = parseFountainDocument('INT. HOUSE - DAY - FLASHBACK (1944) #110A#');
		expect(heading!.content).toBe('INT. HOUSE - DAY - FLASHBACK (1944)');
		expect(heading!.metadata).toMatchObject({ setting: 'INT.', location: 'HOUSE', sceneNumber: '110A' });
		expect(parseFountainDocument('.POV #I-1-A#')[0]!.metadata.sceneNumber).toBe('I-1-A');
	});

	test('the line under it, with no blank between, is its own element', () => {
		// Story mode's example: fictionboard refuses the orphan parenthetical; the parser only reads it.
		expect(shape('INT. INSIDE THE HOUSE\n(Everyone)\nWhen you enter…')).toEqual([
			['scene-heading', 'INT. INSIDE THE HOUSE'],
			['action', '(Everyone)\nWhen you enter…']
		]);
	});
});

describe('characters and dialogue', () => {
	test('a cue needs a blank line before and a non-blank line after', () => {
		expect(shape('BOB\nHi.')).toEqual([
			['character', 'BOB'],
			['dialogue', 'Hi.']
		]);
		expect(shape('BOB')).toEqual([['action', 'BOB']]);
		expect(shape('BOB\n\nHi.')).toEqual([
			['action', 'BOB'],
			['action', 'Hi.']
		]);
		expect(shape('She waits.\nBOB\nHi.')).toEqual([['action', 'She waits.\nBOB\nHi.']]);
	});

	test('an extension may be in any case; a name needs a letter', () => {
		expect(parseFountainDocument('HANS (on the radio)\nWhat?')[0]!.metadata).toEqual({ name: 'HANS', extension: '(on the radio)' });
		expect(parseFountainDocument('MOM (O. S.) (CONT\'D)\nLuke!')[0]!.metadata.extension).toBe("(O. S.) (CONT'D)");
		expect(shape('R2D2\nBeep.')[0]![0]).toBe('character');
		expect(shape('23\nBeep.')[0]![0]).toBe('action');
	});

	test('@ forces a cue in any case, and is stripped', () => {
		expect(shape('@McCLANE\nYippie ki-yay!')).toEqual([
			['character', 'McCLANE'],
			['dialogue', 'Yippie ki-yay!']
		]);
	});

	test('dialogue runs to the next blank line; two spaces keep a blank inside it', () => {
		expect(shape('DEALER\nTen.\nFour.\n  \nHit or stand sir?\n\nMONKEY\nDude.')).toEqual([
			['character', 'DEALER'],
			['dialogue', 'Ten.\nFour.\n\nHit or stand sir?'],
			['character', 'MONKEY'],
			['dialogue', 'Dude.']
		]);
	});

	test('a parenthetical only inside dialogue; dialogue carries its cue', () => {
		const els = parseFountainDocument('STEEL\n(pause)\nNo!\n(beat)\nYes.\n\n(aside)');
		expect(els.map((el) => [el.type, el.content])).toEqual([
			['character', 'STEEL'],
			['parenthetical', '(pause)'],
			['dialogue', 'No!'],
			['parenthetical', '(beat)'],
			['dialogue', 'Yes.'],
			['action', '(aside)']
		]);
		expect(els[2]!.metadata.character).toBe('STEEL');
	});

	test('indentation is ignored outside action', () => {
		expect(shape('\t\tBRICK\n\t(starting)\n    Go.')).toEqual([
			['character', 'BRICK'],
			['parenthetical', '(starting)'],
			['dialogue', 'Go.']
		]);
	});
});

describe('transitions, centered, lyrics, forced action', () => {
	test('an upper-case line ending TO: between blank lines', () => {
		expect(shape('A.\n\nCUT TO:\n\nB.')[1]).toEqual(['transition', 'CUT TO:']);
		expect(shape('A.\n\nCUT TO: \n\nB.')[1]).toEqual(['action', 'CUT TO:']);
		expect(shape('A.\n\nCut to:\n\nB.')[1]).toEqual(['action', 'Cut to:']);
	});

	test('> forces a transition; >…< is centered; both stripped', () => {
		expect(shape('> Burn to White.')).toEqual([['transition', 'Burn to White.']]);
		const [centered] = parseFountainDocument('>  THE END  <');
		expect([centered!.type, centered!.content, centered!.metadata.centered]).toEqual(['action', 'THE END', true]);
	});

	test('~ is lyrics, the tilde stripped, consecutive lines one element', () => {
		expect(shape('~Willy Wonka!\n~Everybody cheer!')).toEqual([['lyrics', 'Willy Wonka!\nEverybody cheer!']]);
	});

	test('! forces action, so an upper-case line is not a cue', () => {
		expect(shape('THE DEALER looks.\n\n!SCANNING THE AISLES\nWhere is he?')).toEqual([
			['action', 'THE DEALER looks.'],
			['action', 'SCANNING THE AISLES\nWhere is he?']
		]);
	});

	test('! ends a dialogue block', () => {
		expect(shape('BOB\nHi.\n!He leaves.\nGone.')).toEqual([
			['character', 'BOB'],
			['dialogue', 'Hi.'],
			['action', 'He leaves.\nGone.']
		]);
	});
});

describe('action', () => {
	test('lines merge with their breaks; a blank line starts a new one', () => {
		expect(shape('One.\nTwo.\n\nThree.')).toEqual([
			['action', 'One.\nTwo.'],
			['action', 'Three.']
		]);
	});

	test('indent is kept, tabs as four spaces', () => {
		expect(shape('He reads:\n    Scott --\n\tPalace Hotel')).toEqual([['action', 'He reads:\n    Scott --\n    Palace Hotel']]);
	});

	test('a page break reads as a blank line', () => {
		expect(shape('End.\n===\nStart.')).toEqual([
			['action', 'End.'],
			['action', 'Start.']
		]);
	});
});

describe('hidden elements', () => {
	test('sections carry their depth; synopses and sections lose their marks', () => {
		const els = parseFountainDocument('# Act\n\n## Sequence\n\n= Set up the story.');
		expect(els.map((el) => [el.type, el.content, el.metadata.depth])).toEqual([
			['section', 'Act', 1],
			['section', 'Sequence', 2],
			['synopsis', 'Set up the story.', undefined]
		]);
	});

	test('a note on its own line is an element and keeps the blank before it', () => {
		expect(shape('A.\n\n[[Vietnamese?]]\nJACK\nHi.')).toEqual([
			['action', 'A.'],
			['note', 'Vietnamese?'],
			['character', 'JACK'],
			['dialogue', 'Hi.']
		]);
	});

	test('a note inside a line is cut out and kept on that element, across lines and a two-space blank', () => {
		expect(shape('DAN and JACK[[names?]]. They drink.')).toEqual([['action', 'DAN and JACK. They drink.', 'note!names?']]);
		expect(shape('It RINGS.[[Needs work.\n  \nCoffee.]] He looks.')).toEqual([
			['action', 'It RINGS. He looks.', 'note!Needs work.\n  \nCoffee.']
		]);
	});

	test('a note does not look past a blank line for its close', () => {
		expect(shape('[[open\n\nclose]]')).toEqual([
			['action', '[[open'],
			['action', 'close]]']
		]);
	});

	test('a boneyard spans blank lines and hides everything in it', () => {
		expect(shape('CUT TO:\n\n/*\nINT. GARAGE - DAY\n\nBRICK\nGo.\n*/\n\nEXT. MANSION - DAY')).toEqual([
			['transition', 'CUT TO:'],
			['boneyard', 'INT. GARAGE - DAY\n\nBRICK\nGo.'],
			['scene-heading', 'EXT. MANSION - DAY']
		]);
	});
});

describe('normalizeSceneHeadings', () => {
	test('adds the missing period and puts a reversed prefix the spec way round', () => {
		const cases: [string, string][] = [
			['INT HOUSE - DAY', 'INT. HOUSE - DAY'],
			['ext house', 'EXT. house'],
			['est. city - dawn', 'EST. city - dawn'],
			['INT/EXT CAR', 'INT./EXT. CAR'],
			['EXT/INT. SHACK - DAY', 'INT./EXT. SHACK - DAY'],
			['EXT./INT. SHACK', 'INT./EXT. SHACK'],
			['E/I CAR', 'I/E CAR'],
			['  INT  HOUSE', '  INT.  HOUSE']
		];
		for (const [from, to] of cases) expect(normalizeSceneHeadings(`Before.\n\n${from}\n\nAfter.`)).toBe(`Before.\n\n${to}\n\nAfter.`);
	});

	test('leaves the spec spelling, forced headings and the rest of the line alone', () => {
		const body = 'INT. HOUSE - DAY\n\nINT./EXT. CAR\n\nI/E VAN\n\n.int flashback\n\nShe sits.';
		expect(normalizeSceneHeadings(body)).toBe(body);
	});

	test('only where the parser reads a heading: after a blank line, outside a boneyard and frontmatter', () => {
		const body = '---\nstatus: running\n---\nShe runs.\nINT HOUSE\n\n/*\n\nEXT YARD\n*/\n\nBOB\nHi.\n  \nEXT pause';
		expect(normalizeSceneHeadings(body)).toBe(body);
		expect(normalizeSceneHeadings('---\nstatus: running\n---\nEXT YARD\n')).toBe('---\nstatus: running\n---\nEXT. YARD\n');
	});

	test('renders the same before and after', () => {
		const body = 'EXT/INT SHACK - DAY\n\nJENNY\nHello.';
		expect(parseFountainDocument(normalizeSceneHeadings(body))[0]!.metadata).toEqual(parseFountainDocument(body)[0]!.metadata);
	});
});
