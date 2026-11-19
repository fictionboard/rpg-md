/**
 * Editor notes: a footnote whose id holds `_note_` or `_comment_` (`[^_note_A4D230EE]`) is
 * for the author only and never renders, marker or definition.
 *
 * Only the patterns live here, shared by the renderer (`markdown-to-hast.ts`), the option
 * reader (`rehype-components.ts`) and the line classifier (`classify.ts`). Not footnotes in general: `[^src]` stays
 * literal text, there is no GFM footnote support.
 */

/** The marker inline: `[^_note_A4D230EE]`, `[^dolor_comment_a3f9]`. */
export const COMMENT_MARKER = /\[\^[^\]\s]*_(?:note|comment)_[^\]\s]*\]/g;

/** The head of a one-line definition: `[^dolor_comment_a3f9]: …`. */
export const COMMENT_DEFINITION = /^\[\^[^\]\s]*_(?:note|comment)_[^\]\s]*\]:/;

/** A reference label that names a note (`^_note_x`), for a marker CommonMark read as a link. */
export const NOTE_LABEL = /^\^[^\]\s]*_(?:note|comment)_[^\]\s]*$/;

/** `text` without its inline markers. */
export const stripNoteMarkers = (text: string): string => text.replace(COMMENT_MARKER, '');
