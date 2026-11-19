export { parseToken, extractComponentConfig, VALID_COMPONENTS, COMPONENT_ALIASES, COMPONENT_METADATA, resolveComponentName, isValidComponent, MEDIA_CATEGORIES } from './parser/rpg-components-registry.ts';
export type { ComponentName } from './parser/rpg-components-registry.ts';
export type { ComponentConfig, AnyComponentConfig, NumberConfig, TextConfig, TextAreaConfig, SelectConfig, MultiSelectConfig, ChecksConfig, ComputedConfig, ModifierConfig, ResourceConfig, ActionConfig, ActorConfig, ValueConfig, DiceConfig, RollConfig, MediaConfig, MediaCategory, RadioConfig, ChoiceOption } from './parser/rpg-components-registry.ts';

export { default as rehypeSections } from './parser/rehype-sections.ts';
export { default as rehypeComponents } from './parser/rehype-components.ts';
export { default as rehypeLinks, MD_LINK, isSafeUrl } from './parser/rehype-links.ts';
export { inlineMarkdown } from './parser/inline-markdown.ts';
export { evaluateFormula } from './utils/formulaEvaluator.ts';

export { buildHast, BODY_FORMATS } from './hast.ts';
export { isCue, isHiddenElement, isSceneHeading, normalizeSceneHeadings, parseFountainDocument } from './parser/fountain-parser.ts';
export type { FountainElement } from './parser/fountain-parser.ts';
export { toSlug, textOf, headingAttrs, headingRoles } from './parser/slug.ts';
export { filterRoles } from './parser/roles.ts';
export type { BuildHastOptions, BodyFormat } from './hast.ts';

export {
	parseFill,
	serializeFill,
	applyFillOp,
	templateSlots,
	formatFillValue,
	parseFillValue,
	slotValues,
	slotRejection
} from './parser/fill.ts';
export type { FillDocument, FillOp, FillSlot, UnresolvedValue, InvalidValue } from './parser/fill.ts';

export { classifyLines, bodyWarnings, LINE_KINDS } from './parser/classify.ts';
export type { ClassifiedLine, LineKind, BodyWarning } from './parser/classify.ts';

export { parseFrontmatter, splitFrontmatter, joinFrontmatter, fmString, fmList, fmMap } from './parser/frontmatter.ts';
export type { Frontmatter, FrontmatterValue } from './parser/frontmatter.ts';

export { tableModel } from './parser/tableModel.ts';
export type { TableModel, TableOverride, TableRow } from './parser/tableModel.ts';

export { parseDice, formatDice, diceFaces, rollDice, cryptoRng } from './dice.ts';
export type { Dice, DiceRoll, Rng } from './dice.ts';

export { withCounterDefault } from './parser/literal.ts';
