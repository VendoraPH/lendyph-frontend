import { getErrorMessage } from "./api-error";

/** How a co-maker save ended — what the dialog acts on. */
export type CoMakerSaveResult =
  | { status: "saved"; coMakerId: number }
  /** Nothing was saved. The dialog stays open with everything as entered. */
  | { status: "failed"; error: unknown }
  /** The co-maker is saved; only its ID is not. */
  | { status: "id_failed"; coMakerId: number; error: unknown };

/**
 * Save a co-maker's details, then upload its ID.
 *
 * Two requests that cannot be one transaction — the upload needs the id the
 * first one returns — so this is where each failure gets its meaning. A failed
 * details save stops everything. A failed upload leaves the co-maker saved and
 * reports it with its id, so the caller can retry the upload on its own: the
 * co-maker is never rolled back, and never created a second time.
 */
export async function saveCoMaker(
  saveDetails: () => Promise<number>,
  uploadId?: (coMakerId: number) => Promise<unknown>
): Promise<CoMakerSaveResult> {
  let coMakerId: number;
  try {
    coMakerId = await saveDetails();
  } catch (error) {
    return { status: "failed", error };
  }

  if (uploadId) {
    try {
      await uploadId(coMakerId);
    } catch (error) {
      return { status: "id_failed", coMakerId, error };
    }
  }

  return { status: "saved", coMakerId };
}

/**
 * What was being saved: a new co-maker, an edited one, or — after an add
 * whose ID failed — just that ID, for a co-maker that already exists.
 */
export type CoMakerSaveAction = "add" | "update" | "id";

export interface CoMakerSaveNotice {
  tone: "success" | "error";
  message: string;
}

const SAVED: Record<CoMakerSaveAction, string> = {
  add: "Co-maker added",
  update: "Co-maker updated",
  id: "ID saved",
};

const FAILED: Record<CoMakerSaveAction, string> = {
  add: "We couldn't add the co-maker. Please try again.",
  update: "We couldn't update the co-maker. Please try again.",
  id: "We couldn't save the ID. Please try again.",
};

/**
 * The toast for a save that ended this way. A partial save says exactly what
 * happened — the co-maker was saved, the ID was not, and why — so nobody
 * re-adds a co-maker that already exists. The reason goes through
 * `getErrorMessage`, so a field-level 422 (a file type the API refuses) is
 * named and nothing technical leaks.
 */
export function coMakerSaveNotice(
  result: CoMakerSaveResult,
  action: CoMakerSaveAction
): CoMakerSaveNotice {
  switch (result.status) {
    case "saved":
      return { tone: "success", message: SAVED[action] };
    case "failed":
      return { tone: "error", message: getErrorMessage(result.error, FAILED[action]) };
    case "id_failed": {
      const reason = getErrorMessage(result.error, "Please try again.");
      const message =
        action === "id"
          ? `The ID couldn't be saved: ${reason}`
          : `Co-maker ${action === "add" ? "added" : "updated"}, but the ID couldn't be saved: ${reason}`;
      return { tone: "error", message };
    }
  }
}
