import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Linda's pictures, from Arvin's own avatar (`public/linda/`), used as they
 * are. `unoptimized`: local files already sized and compressed, served as
 * plain <img>.
 */

interface LindaPictureProps {
  className?: string;
  /** Beside the word "Linda" the picture adds nothing for a screen reader. */
  decorative?: boolean;
}

/** Her face in a circle: the panel header and each of her messages. */
export function LindaAvatar({ className, decorative = false }: LindaPictureProps) {
  return (
    <Image
      src="/linda/linda-face-64.webp"
      alt={decorative ? "" : "Linda"}
      width={64}
      height={64}
      unoptimized
      draggable={false}
      className={cn(
        "size-7 shrink-0 select-none rounded-full bg-brand-orange/10 object-cover ring-1 ring-brand-orange/25",
        className,
      )}
    />
  );
}

/** Her bust: the /linda page's header and its empty state. */
export function LindaBust({ className, decorative = false }: LindaPictureProps) {
  return (
    <Image
      src="/linda/linda-bust-256.webp"
      alt={decorative ? "" : "Linda"}
      width={256}
      height={256}
      unoptimized
      draggable={false}
      className={cn("shrink-0 select-none object-contain", className)}
    />
  );
}
