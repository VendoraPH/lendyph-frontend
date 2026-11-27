/** A note's longest length (backend S4, `SavingsAccountNote::MAX_LENGTH`). */
export const NOTE_MAX_LENGTH = 1000;

/** Notes are permanent (never edited or deleted), so they hold no personal identifiers. */
export const NOTE_PRIVACY_HINT =
  "Notes are permanent and can't be edited or deleted. Don't type ID numbers, contact numbers, emails or addresses.";

export type NoteCheck = { ok: true; note: string } | { ok: false; message: string };

/** The note to send, trimmed as the server trims it, or why it can't be added. */
export function checkNote(raw: string): NoteCheck {
  const note = raw.trim();
  if (note === "") return { ok: false, message: "Write the note." };
  if (note.length > NOTE_MAX_LENGTH) return { ok: false, message: "A note can be at most 1,000 characters." };
  return { ok: true, note };
}

/** "12 / 1,000" under the box. */
export function noteLengthText(raw: string): string {
  return `${raw.trim().length.toLocaleString("en-PH")} / ${NOTE_MAX_LENGTH.toLocaleString("en-PH")}`;
}
