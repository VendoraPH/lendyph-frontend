"use client";

import { useEffect, useState } from "react";
import { publicApplicationService, publicErrorMessage } from "@/services/public-application.service";
import type { PublicApplicationPortal } from "@/types/loan-origination";

type Loaded = { token: string; portal: PublicApplicationPortal | null; error: string | null };

/** What the public link offers: organization, products, documents and the texts to accept. */
export function usePortal(token: string) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    let live = true;
    publicApplicationService
      .portal(token)
      .then((portal) => live && setLoaded({ token, portal, error: null }))
      .catch((err) => live && setLoaded({ token, portal: null, error: publicErrorMessage(err, "This application link could not be opened.") }));
    return () => {
      live = false;
    };
  }, [token]);

  const current = loaded?.token === token ? loaded : null;
  return { portal: current?.portal ?? null, error: current?.error ?? null, loading: current === null };
}
