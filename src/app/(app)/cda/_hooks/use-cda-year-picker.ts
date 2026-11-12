import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { withoutParams } from "../_lib/link-params";
import { useCdaYearStore } from "./use-cda-year";

/**
 * Changes the CDA reporting year from inside the app (the year picker,
 * opening a new year): it becomes the remembered year, and a link's `?year=`
 * is dropped from the address so it doesn't keep winning. Use it inside the
 * CDA page frame, which renders in a Suspense boundary for the address.
 */
export function useCdaYearPicker(): (year: number) => void {
  const setPreferred = useCdaYearStore((s) => s.setPreferred);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return useCallback(
    (year: number) => {
      setPreferred(year);
      if (searchParams.has("year")) router.replace(withoutParams(pathname, searchParams.toString(), ["year"]));
    },
    [setPreferred, router, pathname, searchParams],
  );
}
