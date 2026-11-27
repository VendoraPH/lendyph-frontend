"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { hasIllustration, Illustration } from "@/components/common/illustration";

/**
 * The app's "page not found", for unknown addresses and for screens whose
 * module is switched off (`notFound()` in a layout). Member-portal addresses
 * lead back to the portal, everything else to the dashboard (which sends a
 * signed-out visitor to sign in).
 */
export default function NotFound() {
  const router = useRouter();
  const inPortal = usePathname()?.startsWith("/member") ?? false;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-muted/40 px-4 py-10">
      <div className="flex max-w-md flex-col items-center text-center">
        {hasIllustration("notFound") ? (
          <Illustration name="notFound" className="mb-6" />
        ) : (
          <div className="mb-6 rounded-full bg-muted p-4">
            <FileQuestion className="size-12 text-muted-foreground" aria-hidden="true" />
          </div>
        )}
        <h1 className="mb-2 text-2xl font-bold tracking-tight">Page not found</h1>
        <p className="mb-8 text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist, has moved, or isn&apos;t turned on here.
        </p>
        <div className="flex gap-3">
          <Button
            className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
            render={<Link href={inPortal ? "/member" : "/dashboard"} />}
            nativeButton={false}
          >
            {inPortal ? "Go to the member portal" : "Go to home page"}
          </Button>
          <Button variant="outline" onClick={() => router.back()}>
            Go Back
          </Button>
        </div>
      </div>
    </main>
  );
}
