// A co-maker's name for display. Dependency-free, so it runs under `tsx --test`.

import type { CoMaker } from "@/types";

type NamedCoMaker = Pick<
  CoMaker,
  "full_name" | "name" | "first_name" | "middle_name" | "last_name" | "suffix"
>;

/** A co-maker's name as shown: the API's `full_name`, else its parts; "" if none. */
export function coMakerName(cm: NamedCoMaker): string {
  return (
    cm.full_name ??
    cm.name ??
    [cm.first_name, cm.middle_name, cm.last_name, cm.suffix].filter(Boolean).join(" ")
  );
}
