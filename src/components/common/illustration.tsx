import Image from "next/image";
import { illustrationSrc, illustrationTileClass, type IllustrationName } from "@/lib/illustrations";
import { cn } from "@/lib/utils";

/**
 * A decorative picture for an empty, error or no-access screen, a catalog
 * heading or the member portal's greeting, read from
 * `@/lib/illustrations`. Renders nothing while the slot is empty, so callers
 * keep their own icon as the fallback:
 *
 *     {hasIllustration("empty") ? <Illustration name="empty" /> : <InboxIcon />}
 *
 * At most 10rem tall, and never more than a fifth of the window's height, so
 * it still fits a short laptop screen.
 */
export function Illustration({ name, className }: { name: IllustrationName; className?: string }) {
  const src = illustrationSrc(name);
  if (!src) return null;
  return (
    // `unoptimized`: a local file, already sized and compressed, so it is served
    // as it is and renders as a plain <img>. Width and height only reserve the
    // shape until it loads; the classes size it.
    <Image
      src={src}
      alt=""
      aria-hidden="true"
      width={480}
      height={360}
      unoptimized
      draggable={false}
      className={cn(
        "h-auto max-h-[min(10rem,20dvh)] w-auto max-w-full select-none object-contain",
        // Object pictures sit on plain white: a rounded white tile, in both
        // modes, so their corners never show as a hard square.
        illustrationTileClass(),
        className,
      )}
    />
  );
}

/** Whether a slot has a picture; screens show their own icon when it hasn't. */
export function hasIllustration(name: IllustrationName): boolean {
  return illustrationSrc(name) !== null;
}
