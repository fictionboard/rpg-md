/**
 * The one dice parser and roller — `NdM±K`, `d66`, `d100`, and forced notation (`2d6@3,5`): the
 * notation plus the faces each die showed, which is how a roll is recorded and replayed: a shared
 * roll stores the faces, so every client and the roll log show the same result.
 *
 * `d66` is two d6 read as tens and ones, so its forced form is `d66@3,4` = 34. Every other shape is
 * N dice of M faces summed, plus K.
 *
 * Not an expression language: no keep-highest (`kh`), no success counting (`>4`), no `{@field}`
 * formulas, no dice inside arithmetic. Those return `null` rather than rolling something else.
 */

export interface Dice {
	count: number;
	sides: number;
	modifier: number;
	/** The faces each die must show, or `null` to roll. For `d66`, `[tens, ones]`. */
	forced: number[] | null;
}

export interface DiceRoll {
	/** Forced notation of what was rolled — replaying it gives the same total. */
	notation: string;
	/** One face per physical die (two for `d66`). */
	rolls: number[];
	total: number;
}

/** A float in [0, 1), as `Math.random`. Injected so a test or a replay controls every face. */
export type Rng = () => number;

export const cryptoRng: Rng = () => crypto.getRandomValues(new Uint32Array(1))[0]! / 2 ** 32;

const NOTATION = /^(\d*)d(\d+)(?:\s*([+-])\s*(\d+))?(?:@(\d+(?:,\d+)*))?$/i;
// ponytail: caps keep a typo like `1000000d6` from looping; raise if a real system needs more.
const MAX_COUNT = 100;
const MAX_SIDES = 10000;
// A table's key column enumerates every total for its gap check (tableModel); past this it is not dice.
const MAX_FACES = 10000;

const isD66 = (d: Pick<Dice, 'count' | 'sides'>): boolean => d.count === 1 && d.sides === 66;

/** How many physical dice, and how many faces each has. */
const physical = (d: Dice): { n: number; sides: number } => (isD66(d) ? { n: 2, sides: 6 } : { n: d.count, sides: d.sides });

/** `null` for anything that is not exactly one dice term, or a forced list that does not fit it. */
export function parseDice(text: string): Dice | null {
	const m = NOTATION.exec(text.trim());
	if (!m) return null;
	const count = Number(m[1] || 1);
	const sides = Number(m[2]);
	if (count < 1 || count > MAX_COUNT || sides < 1 || sides > MAX_SIDES) return null;
	const modifier = m[4] === undefined ? 0 : Number(m[4]) * (m[3] === '-' ? -1 : 1);
	const dice: Dice = { count, sides, modifier, forced: null };
	if (m[5] === undefined) return dice;
	const forced = m[5].split(',').map(Number);
	const p = physical(dice);
	if (forced.length !== p.n || forced.some((f) => f < 1 || f > p.sides)) return null;
	return { ...dice, forced };
}

export function formatDice(d: Dice): string {
	const base = isD66(d) ? 'd66' : `${d.count}d${d.sides}`;
	const mod = d.modifier ? `${d.modifier > 0 ? '+' : ''}${d.modifier}` : '';
	return base + mod + (d.forced ? `@${d.forced.join(',')}` : '');
}

/** Every total the dice can show, in order (d66: 11–16, 21–26, …); `null` past `MAX_FACES`. */
export function diceFaces(d: Dice): number[] | null {
	const k = d.modifier;
	if (isD66(d)) return [1, 2, 3, 4, 5, 6].flatMap((t) => [1, 2, 3, 4, 5, 6].map((o) => t * 10 + o + k));
	if (d.count * d.sides > MAX_FACES) return null;
	return Array.from({ length: d.count * d.sides - d.count + 1 }, (_, i) => d.count + i + k);
}

/** Rolls `dice` (a `Dice` or its notation); a forced roll ignores `rng`. `null` if it does not parse. */
export function rollDice(dice: Dice | string, rng: Rng = cryptoRng): DiceRoll | null {
	const d = typeof dice === 'string' ? parseDice(dice) : dice;
	if (!d) return null;
	const p = physical(d);
	const rolls = d.forced ?? Array.from({ length: p.n }, () => Math.floor(rng() * p.sides) + 1);
	const sum = isD66(d) ? rolls[0]! * 10 + rolls[1]! : rolls.reduce((a, b) => a + b, 0);
	return { notation: formatDice({ ...d, forced: rolls }), rolls, total: sum + d.modifier };
}
