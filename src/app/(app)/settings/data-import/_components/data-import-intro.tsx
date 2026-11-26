"use client";

import { useMenuVisibility } from "@/hooks/use-menu-visibility";
import { dataImportParts } from "@/lib/hidden-module-parts";
import { dataImportIntro } from "./import-files";

/** The page's intro line, without share capital while Menu Visibility hides it. */
export function DataImportIntro() {
  const { isHidden } = useMenuVisibility();
  return <p className="mt-1 text-sm text-muted-foreground">{dataImportIntro(dataImportParts(isHidden).shareCapitalFile)}</p>;
}
