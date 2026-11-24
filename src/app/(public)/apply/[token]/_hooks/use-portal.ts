"use client";

import { useEffect, useState } from "react";
import { publicApplicationService } from "@/services/public-application.service";
import type { PublicPortal } from "@/types/public-application";
import { publicErrorMessage } from "../_lib/errors";

type Loaded = { key: string; portal: PublicPortal | null; error: string | null };

/**
 * What the public link offers: the organization, products, documents, the
 * texts to accept, and whether it takes applications now. `reload` reads it
 * again, for example when the link stops taking applications mid-way.
 */
export function usePortal(token: string) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [reloads, setReloads] = useState(0);
  const key = `${token}#${reloads}`;

  useEffect(() => {
    let live = true;
    publicApplicationService
      .portal(token)
      .then((portal) => live && setLoaded({ key, portal, error: null }))
      .catch((err) => live && setLoaded({ key, portal: null, error: publicErrorMessage(err, "This application link could not be opened.") }));
    return () => {
      live = false;
    };
  }, [token, key]);

  const current = loaded?.key === key ? loaded : null;
  return {
    portal: current?.portal ?? null,
    error: current?.error ?? null,
    loading: current === null,
    reload: () => setReloads((n) => n + 1),
  };
}
