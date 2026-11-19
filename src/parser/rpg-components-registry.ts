/**
 * RPG Component Registry - Single Source of Truth
 *
 * This file defines all valid RPG-MD components, their aliases, and parsing logic.
 * Import from here to ensure consistency across the codebase.
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Parsed component before type-specific processing
 */
export interface ParsedComponent {
	label: string;
	componentAlias: string;
	component: string;
	id?: string;
	raw: string;
}

/**
 * Generic attributes extracted from component syntax
 */
export interface ParsedAttributes {
	defaultValue?: string | number | boolean;
	range?: { min: number; max: number };
	attributes: Record<string, string | number | boolean>;
}

/**
 * Final component configuration after parsing
 */
export interface ComponentConfig {
	type: string;
	alias: string;
	label: string;
	id: string;
	[key: string]: any;
}

// ============================================================================
// COMPONENT-SPECIFIC CONFIG TYPES
// ============================================================================

/**
 * Type-safe configuration interfaces for each component type
 */
export interface ActorConfig {
	type: 'Actor';
	alias: string;
	label: string;
	id: string;
	defaultValue: string;
}

export interface TextConfig {
	type: 'Text';
	alias: string;
	label: string;
	id: string;
	defaultValue: string;
	placeholder?: string;
	max?: number;
}

export interface NumberConfig {
	type: 'Number';
	alias: string;
	label: string;
	id: string;
	defaultValue: number;
	min?: number;
	max?: number;
	step?: number;
}

export interface TextAreaConfig {
	type: 'Textarea';
	alias: string;
	label: string;
	id: string;
	defaultValue: string;
	placeholder?: string;
	rows?: number;
	max?: number;
}

export interface ChecksConfig {
	type: 'Checks';
	alias: string;
	label: string;
	id: string;
	checked: number;
	total: number;
}

export interface ValueConfig {
	type: 'Value';
	alias: string;
	label: string;
	id: string;
	value: string | number;
}

/**
 * One fixed choice. `value` exists only where the author wrote `Label | value`; with
 * no pipe the **label is the stored value**, so a fill reads `Class: Fighter` and not
 * a slug nobody typed. `default` is the `*Mage` star in the option list —
 * the only way to declare a default here, because a positional one cannot be told
 * apart from a second bracket list.
 *
 * `description` is inline markdown *source* (links and emphasis unrendered; `inlineMarkdown`
 * renders it), `\n` between paragraphs. Written `Label — text` / `Label -- text`, or as the
 * body of a heading in a `Select(#slug)` section. Display only: it never touches the stored value.
 */
export interface ChoiceOption {
	label: string;
	value?: string;
	default?: boolean;
	description?: string;
}

export interface SelectConfig {
	type: 'Select';
	alias: string;
	label: string;
	id: string;
	defaultValue?: string;
	options?: ChoiceOption[];
	source?: string;
}

/**
 * A row of pips, not a dropdown. Its own type rather than a flag on `Select` because
 * the two are different controls; everything else about them is shared.
 */
export interface RadioConfig {
	type: 'Radio';
	alias: string;
	label: string;
	id: string;
	defaultValue?: string;
	options?: ChoiceOption[];
	source?: string;
}

export interface MultiSelectConfig {
	type: 'MultiSelect';
	alias: string;
	label: string;
	id: string;
	defaultValue: string[];
	options?: ChoiceOption[];
	source?: string;
}

export interface ModifierConfig {
	type: 'Modifier';
	alias: string;
	label: string;
	id: string;
	formula?: string;
	defaultValue: number;
	range?: { min: number; max: number };
}

export interface RollConfig {
	type: 'Roll';
	alias: string;
	label: string;
	id: string;
	formula: string;
}

export interface DiceConfig {
	type: 'Dice';
	alias: string;
	label: string;
	id: string;
	defaultValue: string;
}

export interface ComputedConfig {
	type: 'Computed';
	alias: string;
	label: string;
	id: string;
	formula: string;
}

export interface ActionConfig {
	type: 'Action';
	alias: string;
	label: string;
	id: string;
	action?: string;
	buttonType: string;
	once: boolean;
}

export interface ResourceConfig {
	type: 'Resource';
	alias: string;
	label: string;
	id: string;
	defaultValue?: string;
	filter?: string;
	options?: ChoiceOption[];
	source?: string;
}

export interface MediaConfig {
	type: 'Media';
	alias: string;
	label: string;
	id: string;
	url: string;
	alt?: string;
	width?: string | number;
	height?: string | number;
	fit?: 'cover' | 'contain' | 'fill' | 'scale-down';
	circular?: boolean;
	category?: MediaCategory;
}

/**
 * What an image is for — one per media item. The Stage's add overlay files under the first three,
 * the Image Bezel's art picker under `bezel`, the Dice pane's tray picker under `tray`;
 * a sheet's `Media(category: portrait)` under any. fictionboard stores it on the
 * Dexie row, so renaming one here strands the items filed under the old name.
 */
export const MEDIA_CATEGORIES = ['background', 'sticker', 'map', 'bezel', 'tray', 'portrait', 'token', 'handout', 'item', 'location', 'symbol'] as const;
export type MediaCategory = (typeof MEDIA_CATEGORIES)[number];
const MEDIA_CATEGORY_SET: ReadonlySet<string> = new Set(MEDIA_CATEGORIES);

/**
 * Union type of all component configs
 */
export type AnyComponentConfig =
	| ActorConfig
	| TextConfig
	| NumberConfig
	| TextAreaConfig
	| ChecksConfig
	| ValueConfig
	| SelectConfig
	| RadioConfig
	| MultiSelectConfig
	| ModifierConfig
	| RollConfig
	| DiceConfig
	| ComputedConfig
	| ActionConfig
	| ResourceConfig
	| MediaConfig;

/**
 * Valid macro names for link actions
 * Macros are used in markdown links like: [Text](/roll 2d6+3)
 */
export const VALID_MACROS = ['roll', 'random', 'set', 'add', 'remove', 'goto', 'theme'] as const;

export type MacroName = (typeof VALID_MACROS)[number];

/**
 * Core component types supported by the RPG-MD parser
 */
export const VALID_COMPONENTS = [
	'Action',
	'Actor',
	'Checks',
	'Computed',
	'Dice',
	'Media',
	'MultiSelect',
	'Modifier',
	'Number',
	'Text',
	'TextArea',
	'Value',
	'Select',
	'Radio',
	'Roll',
	'Resource'
] as const;

export type ComponentName = (typeof VALID_COMPONENTS)[number];

/**
 * Component aliases that map to core components
 */
export const COMPONENT_ALIASES: Record<string, ComponentName> = {
	// Number aliases
	Skill: 'Number',
	Stat: 'Number',
	Ability: 'Number',
	Score: 'Number',

	// Text aliases
	Input: 'Text',
	Field: 'Text',

	// TextArea aliases
	Description: 'TextArea',
	Note: 'TextArea',

	// Select aliases
	Choice: 'Select',
	Option: 'Select',

	// Radio aliases
	Pips: 'Radio',

	// MultiSelect aliases
	Choices: 'MultiSelect',
	Options: 'MultiSelect',

	// Value aliases
	Display: 'Value',
	Label: 'Value',

	// Action aliases
	Button: 'Action',
	Trigger: 'Action',

	// Resource aliases
	Equipment: 'Resource',
	Item: 'Resource',

	// Computed aliases
	Calculation: 'Computed',
	Formula: 'Computed',

	// Media aliases
	Image: 'Media',
	Avatar: 'Media',
	Background: 'Media'
};

/**
 * Check if a component name is valid (core component or alias)
 */
export function isValidComponent(name: string): boolean {
	return VALID_COMPONENTS.includes(name as ComponentName) || name in COMPONENT_ALIASES;
}

/**
 * Resolve a component name (handles aliases)
 * Returns the core component name, or undefined if invalid
 */
export function resolveComponentName(name: string): ComponentName | undefined {
	// Check if it's a direct component name
	if (VALID_COMPONENTS.includes(name as ComponentName)) {
		return name as ComponentName;
	}

	// Check if it's an alias
	if (COMPONENT_ALIASES[name]) {
		return COMPONENT_ALIASES[name];
	}

	return undefined;
}

/**
 * Component metadata for UI and documentation
 */
export const COMPONENT_METADATA: Record<
	ComponentName,
	{
		description: string;
		category: 'input' | 'display' | 'calculation' | 'action' | 'resource';
		examples: string[];
	}
> = {
	Actor: {
		description: 'Used for relations or similar',
		category: 'input',
		examples: ['Relations: Actor']
	},
	Number: {
		description: 'Numeric input with optional range',
		category: 'input',
		examples: ['Strength: Number(10, 0-20)', 'Level: Number(1)']
	},
	Checks: {
		description: 'Checkbox tracker (current/max). A total of 1 is a single checkbox.',
		category: 'input',
		examples: ['Health: Checks(2/10)', 'XP: Checks(3/10)', 'Wounded: Checks(0/1)']
	},
	Text: {
		description: 'Single-line text input',
		category: 'input',
		examples: ['Name: Text("Gandalf")', 'Title: Text()']
	},
	TextArea: {
		description: 'Multi-line text input',
		category: 'input',
		examples: ['Description: TextArea(rows 5)', 'Notes: TextArea()']
	},
	Value: {
		description: 'Display-only value',
		category: 'display',
		examples: ['Age: Value(87)', 'Status: Value("Active")']
	},
	Computed: {
		description: 'Calculated value from formula',
		category: 'calculation',
		examples: ['Total: Computed({@str + @dex})', 'AC: Computed({10 + @dex_mod})']
	},
	Select: {
		description: 'Dropdown selection. Star an option to make it the default.',
		category: 'input',
		examples: [
			'Class: Select([Fighter, Mage, Rogue])',
			'Race: Select([Human, *Elf, Dwarf])',
			'Class: Select()\n- Fighter\n- *Mage\n- Rogue',
			'Class: Select([Fighter Mage | fighter_mage, Monk])',
			'Class: Select()\n- Fighter — Strong in melee.\n- Mage | mage — Fragile, but bends reality.'
		]
	},
	Radio: {
		description: 'A row of pips — one choice, all options visible. Star one for the default.',
		category: 'input',
		examples: ['Heritage: Radio([Akoros, *Iruvia, Skovlan])', 'Stress: Pips([Low, Mid, High])']
	},
	MultiSelect: {
		description: 'Multiple selection. Star every option that starts selected.',
		category: 'input',
		examples: [
			'Skills: MultiSelect([Stealth, Lockpicking, Persuasion])',
			'Conditions: MultiSelect([Cold, *Haunted, *Vicious])'
		]
	},
	Action: {
		description: 'Interactive button/action',
		category: 'action',
		examples: ['Attack: Action("roll attack")', 'Heal: Action("use potion", once)']
	},
	Dice: {
		description: 'Dice roller',
		category: 'calculation',
		examples: ['Damage: Dice(2d6+3)', 'Initiative: Dice(1d20)']
	},
	Modifier: {
		description: 'Numeric modifier with formula',
		category: 'calculation',
		examples: ['Str Mod: Modifier({(@str - 10) / 2})', 'Bonus: Modifier({@level + 2})']
	},
	Roll: {
		description: 'Advanced roll expression',
		category: 'calculation',
		examples: ['Save: Roll({@wisdom}d6>4)', 'Check: Roll(2d20kh1)']
	},
	Resource: {
		description: 'Resource reference/picker',
		category: 'resource',
		examples: ['Weapon: Resource([filter weapons])', 'Armor: Resource()']
	},
	Media: {
		description: 'Display media assets (images, avatars, backgrounds)',
		category: 'display',
		examples: [
			'Portrait: Media("avatar.png", circular)',
			'NPC image: Media(category: portrait)',
			'Banner: Image("banner.jpg", width 100%)',
			'Token: Avatar("token.png", width 64, height 64)'
		]
	}
};

/**
 * Check if a link href is a macro action
 * Macros must start with "/" followed by a macro name
 * Examples: "/roll 2d6+3", "/goto scene_1", "/theme dark"
 */
export function isMacro(href: string): boolean {
	if (!href || typeof href !== 'string') {
		return false;
	}

	const trimmed = href.trim();

	// Must start with /
	if (!trimmed.startsWith('/')) {
		return false;
	}

	// Remove leading / and check if it starts with a valid macro name
	const withoutSlash = trimmed.substring(1);

	return VALID_MACROS.some((macro) => {
		// Check if the href starts with the macro name
		// Must be followed by a space or be the entire string
		return withoutSlash === macro || withoutSlash.startsWith(macro + ' ');
	});
}

/**
 * Extract macro name from a macro href
 * Example: "/roll 2d6+3" -> "roll"
 */
export function getMacroName(href: string): MacroName | undefined {
	if (!isMacro(href)) {
		return undefined;
	}

	const withoutSlash = href.trim().substring(1);
	const macro = VALID_MACROS.find((m) => withoutSlash === m || withoutSlash.startsWith(m + ' '));
	return macro;
}

/**
 * Extract macro parameters from a macro href
 * Example: "/roll 2d6+3" -> "2d6+3"
 * Example: "/goto scene_1" -> "scene_1"
 */
export function getMacroParams(href: string): string {
	if (!isMacro(href)) {
		return '';
	}

	const macroName = getMacroName(href);
	if (!macroName) {
		return '';
	}

	const withoutSlash = href.trim().substring(1);
	const afterMacroName = withoutSlash.substring(macroName.length).trim();
	return afterMacroName;
}

// ============================================================================
// HAST ELEMENT TO CONFIG EXTRACTION
// ============================================================================

/**
 * Extract component configuration from a HAST element's data attributes
 * This provides type-safe access to component properties in renderers
 */
export function extractComponentConfig<T extends AnyComponentConfig>(element: any): T | undefined {
	const props = element?.properties;
	if (!props) return undefined;

	const type = props['data-component-type'];
	if (!type) return undefined;

	// Helper to parse JSON or return value as-is
	const parseDataAttr = (value: any): any => {
		if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
			try {
				return JSON.parse(value);
			} catch {
				return value;
			}
		}
		return value;
	};

	// Base config that all components share
	const baseConfig = {
		type,
		alias: props['data-component-alias'] || type,
		label: props['data-label']?.toString() || '',
		id: props['data-component-id']?.toString() || ''
	};

	// Extract all data-* attributes
	const dataAttrs: Record<string, any> = {};
	for (const [key, value] of Object.entries(props)) {
		if (key.startsWith('data-') && !key.startsWith('data-component-')) {
			const attrName = key.replace('data-', '');
			dataAttrs[attrName] = parseDataAttr(value);
		}
	}

	return { ...baseConfig, ...dataAttrs } as T;
}

// ============================================================================
// PARSING UTILITIES
// ============================================================================

/**
 * Generate an ID from a label
 */
function generateIdFromLabel(label: string): string {
	// Remove content within parentheses first
	let cleanLabel = label.replace(/\([^)]*\)/g, '');

	return cleanLabel
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]/g, '_')
		.replace(/_+/g, '_')
		.replace(/^_|_$/g, '');
}

/**
 * The content between the first `open` in `raw` and its matching `close`, nesting
 * respected; undefined when there is no `open` or it is never closed.
 */
function enclosed(raw: string, open: string, close: string): string | undefined {
	const start = raw.indexOf(open);
	if (start === -1) return undefined;

	let depth = 0;
	for (let i = start; i < raw.length; i++) {
		if (raw[i] === open) depth++;
		else if (raw[i] === close && --depth === 0) return raw.substring(start + 1, i);
	}
	return undefined;
}

/**
 * Split content by commas, respecting quotes and nested structures
 */
function splitByComma(content: string): string[] {
	const parts: string[] = [];
	let current = '';
	let depth = 0;
	let inQuotes = false;
	let quoteChar = '';

	for (let i = 0; i < content.length; i++) {
		const char = content[i];

		if ((char === '"' || char === "'") && !inQuotes) {
			inQuotes = true;
			quoteChar = char;
		} else if (char === quoteChar && inQuotes) {
			inQuotes = false;
			quoteChar = '';
		} else if (!inQuotes) {
			if (char === '(' || char === '[' || char === '{') {
				depth++;
			} else if (char === ')' || char === ']' || char === '}') {
				depth--;
			} else if (char === ',' && depth === 0) {
				parts.push(current);
				current = '';
				continue;
			}
		}

		current += char;
	}

	if (current) {
		parts.push(current);
	}

	return parts;
}

/**
 * Parse a value (string, number, or boolean)
 */
function parseValue(value: string): string | number | boolean {
	const trimmed = value.trim();

	// Remove quotes
	if (
		(trimmed.startsWith('"') && trimmed.endsWith('"')) ||
		(trimmed.startsWith("'") && trimmed.endsWith("'"))
	) {
		return trimmed.slice(1, -1);
	}

	// Parse numbers
	const num = Number(trimmed);
	if (!isNaN(num) && isFinite(num)) {
		return num;
	}

	// Parse booleans
	if (trimmed === 'true') return true;
	if (trimmed === 'false') return false;

	return trimmed;
}

/**
 * Reads one option, wherever it was written: a comma-separated bracket list or a
 * markdown list item under the component.
 *
 * A leading `*` marks the default. Emphasis is the collision, so the star is only a
 * marker when the item does not *also* end in one — `*Mage*` stays italic — and `\*`
 * escapes a literal star. Both forms arrive as source text: `rehype-components` reads a
 * list item back out of the body, not its rendered text.
 *
 * A GFM task box at the head of a list item is the other way to say it: `[x] Mage` is
 * `*Mage`, `[ ] Mage` a plain option, the box stripped either way
 * (task lists are otherwise static).
 *
 * ` — ` (or ` -- `) splits off a description first, so a description ending in `*x*`
 * cannot read as the label's emphasis and swallow the star. Not `:` — labels hold colons.
 */
export function parseOptionItem(text: string): ChoiceOption {
	const sep = / (?:—|--) /.exec(text);
	const description = sep ? text.slice(sep.index + sep[0].length).trim() : '';
	let trimmed = (sep ? text.slice(0, sep.index) : text).trim();
	let isDefault = false;

	const box = /^\[([ xX])\][ \t]+/.exec(trimmed);
	if (box) {
		trimmed = trimmed.slice(box[0].length).trim();
		isDefault = box[1] !== ' ';
	} else if (trimmed.startsWith('\\*')) {
		trimmed = trimmed.slice(1);
	} else if (trimmed.startsWith('*') && !trimmed.endsWith('*')) {
		trimmed = trimmed.slice(1).trim();
		isDefault = true;
	}

	// `Label | value` is the only thing that gives an option a value distinct from its
	// label. Without it the label *is* the value, so a fill reads the way the sheet does.
	const pipeIndex = trimmed.indexOf('|');
	const option: ChoiceOption =
		pipeIndex > -1
			? {
					label: parseValue(trimmed.substring(0, pipeIndex).trim()).toString(),
					value: parseValue(trimmed.substring(pipeIndex + 1).trim()).toString()
				}
			: { label: parseValue(trimmed).toString() };

	if (isDefault) option.default = true;
	if (description) option.description = description;
	return option;
}

/** The stored value of an option: its explicit `| value`, else its label. */
export function optionValue(option: ChoiceOption): string {
	return option.value ?? option.label;
}

/** `Class: Select(#classes)` — options from the section whose `data-slug` is `classes`. */
const SOURCE_REF = /^#([\w-]+)$/;

/** The starred option's stored value, for `Select` and `Radio`. First star wins. */
function singleDefault(options: ChoiceOption[]): string | undefined {
	const starred = options.find((option) => option.default);
	return starred ? optionValue(starred) : undefined;
}

/** Every starred option, for `MultiSelect`. */
function multiDefault(options: ChoiceOption[]): string[] {
	return options.filter((option) => option.default).map(optionValue);
}

/**
 * The fixed-choice components differ in exactly two things: whether their default
 * is one value or many, and which control the renderer draws. Everything else — the
 * bracket list, the `(#slug)` source, the star — is shared, so it is written once
 * here rather than three times with a typo in one of them. `Resource` reads its list
 * the same way and adds only `filter`.
 */
function buildChoice(isMulti: boolean, raw: string, attrs: ParsedAttributes): Record<string, any> {
	// `(#slug)` reaches here as the positional default; it is the source, never a default.
	const ref = typeof attrs.defaultValue === 'string' ? SOURCE_REF.exec(attrs.defaultValue) : null;
	const config: Record<string, any> = {
		defaultValue: isMulti ? [] : ref ? undefined : (attrs.defaultValue as string | undefined),
		...attrs.attributes
	};

	if (ref) {
		// `rehype-components` resolves the section and applies its stars; a bracket list
		// beside the ref is ignored.
		config.source = ref[1];
		return config;
	}

	const listContent = enclosed(raw, '[', ']');
	const parsedOptions = listContent ? splitByComma(listContent).map(parseOptionItem) : [];
	config.options = parsedOptions;
	if (isMulti) config.defaultValue = multiDefault(parsedOptions);
	else config.defaultValue ??= singleDefault(parsedOptions);
	return config;
}

// ============================================================================
// MAIN PARSING FUNCTIONS
// ============================================================================

/**
 * Parse a component line into its basic structure
 * Example: "Name: Text(John Doe) #custom_id"
 */
export function parseFormComponent(text: string): ParsedComponent | undefined {
	const raw = text.trim();

	// Skip empty lines
	if (!raw) return undefined;

	// Parse basic structure: Label: Component(...) #id
	const colonIndex = raw.indexOf(':');
	if (colonIndex === -1) return undefined;

	const label = raw.substring(0, colonIndex).trim();
	const remaining = raw.substring(colonIndex + 1).trim();

	// Extract component name
	const componentMatch = remaining.match(/^([A-Za-z]+)/);
	if (!componentMatch) return undefined;

	const componentName = componentMatch[1] ?? '';
	if (!componentName) return undefined;
	let afterComponent = remaining.substring(componentName.length);

	// Extract ID if present (at the end)
	const idMatch = afterComponent.match(/\s*(#\w+)\s*$/);
	const idPart = idMatch?.[1];
	if (idPart) {
		afterComponent = afterComponent.replace(/\s*#\w+\s*$/, '');
	}

	// Resolve component name (handle aliases)
	const resolvedComponent = resolveComponentName(componentName);
	if (!resolvedComponent) return undefined;

	const id = idPart ? idPart.substring(1) : generateIdFromLabel(label);

	return {
		label,
		componentAlias: componentName,
		component: resolvedComponent,
		id,
		raw
	};
}

/**
 * Every named attribute a component config reads, and the bare flags among them.
 *
 * `parseGenericAttributes` gates on this list because its two shapes — `name value`
 * and a bare `flag` — are otherwise indistinguishable from a default that happens to
 * be one or two words: without the gate `Text(John Doe)` parsed to `{John: 'Doe'}`
 * with an empty default, and a one-word default became `{Mage: true}`. An attribute
 * missing from this list is silently read as a default value instead, which is the
 * failure this list exists to make loud in review rather than at runtime.
 */
export const KNOWN_ATTRIBUTES = [
	'action',
	'alt',
	'button',
	'category',
	'circular',
	'filter',
	'fit',
	'height',
	'max',
	'min',
	'once',
	'placeholder',
	'rows',
	'source',
	'step',
	'width'
] as const;

const KNOWN_ATTRIBUTE_SET: ReadonlySet<string> = new Set(KNOWN_ATTRIBUTES);

/**
 * Parse generic attributes from component syntax
 * Extracts default values, ranges, and named attributes
 */
export function parseGenericAttributes(raw: string): ParsedAttributes {
	const result: ParsedAttributes = {
		attributes: {}
	};

	let contentToSearch = raw;

	// Check if this looks like a full component line (has colon and component name)
	const colonIndex = raw.indexOf(':');
	if (colonIndex !== -1) {
		// Full component line - find the component parentheses
		const afterColon = raw.substring(colonIndex + 1).trim();
		const componentMatch = afterColon.match(/^([A-Za-z]+)/);
		const matchedName = componentMatch?.[1];
		if (matchedName) {
			contentToSearch = afterColon.substring(matchedName.length);
		}
	}

	const content = enclosed(contentToSearch, '(', ')')?.trim();
	if (!content) return result;

	// Split by commas, but be careful with nested structures
	const parts = splitByComma(content);

	let defaultValueSet = false;

	for (const part of parts) {
		const trimmed = part.trim();
		if (!trimmed) continue;

		// Check for range (e.g., "0-5" or "2, 0-5")
		const rangeMatch = trimmed.match(/^(\d+)-(\d+)$/);
		if (rangeMatch) {
			result.range = {
				min: parseInt(rangeMatch[1] ?? '0'),
				max: parseInt(rangeMatch[2] ?? '0')
			};
			continue;
		}

		// A bracket list is the option list — `Select`, `Radio`, `MultiSelect` and
		// `Resource` read it themselves off the raw line. Swallowing it here as the
		// first positional is what left every fixed choice unable to declare anything
		// after it.
		if (trimmed.startsWith('[')) continue;

		// Check for attribute-value pairs (e.g., "placeholder Enter name", "rows 20", "category: portrait",
		// 'category="portrait"'). Only a known name claims the `:` or `=`, so a default like `a=b` is untouched.
		const attrMatch = trimmed.match(/^(\w+)\s*(?:[:=]\s*|\s+)(.+)$/);
		if (attrMatch && KNOWN_ATTRIBUTE_SET.has(attrMatch[1]!)) {
			const attr = attrMatch[1];
			const value = attrMatch[2];
			if (attr !== undefined && value !== undefined) {
				result.attributes[attr] = parseValue(value);
			}
			continue;
		}

		// Check for bare keyword flags (e.g., "circular", "once")
		// These are single words without values that should be treated as boolean true
		if (KNOWN_ATTRIBUTE_SET.has(trimmed) && trimmed.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/)) {
			result.attributes[trimmed] = true;
			continue;
		}

		// If no attribute pattern matched and no default value set, treat as default value
		if (!defaultValueSet) {
			// Check if this looks like a range pattern first
			if (!trimmed.match(/^\d+-\d+$/)) {
				result.defaultValue = parseValue(trimmed);
				defaultValueSet = true;
			}
		}
	}

	return result;
}

/**
 * The type-specific fields of one component. `parseToken` supplies `type`, `alias`,
 * `label` and `id` and spreads this over them; only `TextArea` overrides `type`.
 * Attribute keys are all in `KNOWN_ATTRIBUTES`, so a spread of `attrs.attributes`
 * can never clobber a base field, whichever side of it the spread sits.
 */
type ComponentParser = (parsed: ParsedComponent, attrs: ParsedAttributes) => Record<string, any>;

const formulaOf = (raw: string) => raw.match(/\{([^}]+)\}/)?.[1];

/** A fixed choice that picks one option. */
const single: ComponentParser = (parsed, attrs) => buildChoice(false, parsed.raw, attrs);

/**
 * Component-specific parsers
 */
export const componentParsers: Record<ComponentName, ComponentParser> = {
	Actor: (_, attrs) => ({ defaultValue: (attrs.defaultValue as string) || '', ...attrs.attributes }),

	Number: (_, attrs) => ({
		defaultValue: (attrs.defaultValue as number) || 0,
		...attrs.attributes,
		min: attrs.range?.min ?? (attrs.attributes.min as number),
		max: attrs.range?.max ?? (attrs.attributes.max as number),
		step: attrs.attributes.step as number
	}),

	Text: (_, attrs) => ({
		defaultValue: (attrs.defaultValue as string) || '',
		...attrs.attributes,
		placeholder: attrs.attributes.placeholder as string,
		max: attrs.attributes.max as number
	}),

	TextArea: (_, attrs) => ({
		type: 'Textarea',
		defaultValue: (attrs.defaultValue as string) || '',
		...attrs.attributes,
		placeholder: attrs.attributes.placeholder as string,
		rows: (attrs.attributes.rows as number) || 3,
		max: attrs.attributes.max as number
	}),

	Checks: (_, attrs) => {
		const checksMatch = String(attrs.defaultValue || '0/1').match(/^(\d+)\/(\d+)$/);
		return {
			checked: checksMatch ? parseInt(checksMatch[1] ?? '0') : 0,
			total: checksMatch ? parseInt(checksMatch[2] ?? '1') : 1,
			...attrs.attributes
		};
	},

	Value: (_, attrs) => ({ value: attrs.defaultValue || '', ...attrs.attributes }),

	Select: single,
	Radio: single,
	MultiSelect: (parsed, attrs) => buildChoice(true, parsed.raw, attrs),

	Modifier: (parsed, attrs) => ({
		formula: formulaOf(parsed.raw),
		defaultValue: (attrs.defaultValue as number) || 0,
		range: attrs.range,
		...attrs.attributes
	}),

	Roll: (_, attrs) => ({ formula: (attrs.defaultValue as string) || '1d6', ...attrs.attributes }),

	Dice: (_, attrs) => ({ defaultValue: (attrs.defaultValue as string) || '1d6', ...attrs.attributes }),

	Computed: (parsed, attrs) => ({ formula: formulaOf(parsed.raw) ?? '', ...attrs.attributes }),

	Action: (_, attrs) => {
		// `button` is renamed to `buttonType`, so it must not also pass through.
		const { button, ...rest } = attrs.attributes;
		return {
			...rest,
			action: (attrs.defaultValue as string) || (attrs.attributes.action as string),
			buttonType: (button as string) || 'button',
			once: (attrs.attributes.once as boolean) || false
		};
	},

	Resource: (parsed, attrs) => ({
		...buildChoice(false, parsed.raw, attrs),
		filter: attrs.attributes.filter as string
	}),

	Media: (_, attrs) => {
		const { category, ...rest } = attrs.attributes;
		return {
			...rest,
			url: attrs.defaultValue?.toString() || '',
			alt: rest.alt?.toString(),
			width: rest.width,
			height: rest.height,
			fit: rest.fit as MediaConfig['fit'],
			circular: rest.circular === true || rest.circular === 'true',
			// An unknown one is dropped: the picker would file uploads under a name nothing lists.
			...(MEDIA_CATEGORY_SET.has(String(category)) && { category: category as MediaCategory })
		};
	}
};

/**
 * Main entry point - parse a token and return the appropriate component config
 */
export function parseToken(text: string): ComponentConfig | undefined {
	const parsed = parseFormComponent(text);
	if (!parsed) return undefined;

	const type = parsed.component as ComponentName;
	return {
		type,
		alias: parsed.componentAlias,
		label: parsed.label,
		id: parsed.id!,
		...componentParsers[type](parsed, parseGenericAttributes(parsed.raw))
	};
}
