import Image from "next/image";
import { icon3dSrc, type Icon3DName } from "@/lib/icons-3d";
import { cn } from "@/lib/utils";

/**
 * A decorative 3D icon from `@/lib/icons-3d`, drawn `size` pixels square. The
 * visible label beside it carries the meaning, so it is hidden from screen
 * readers. Lazy by default; the side menu and the dashboard pass `eager`,
 * since they show on first paint.
 *
 * Import it by path, not through `@/components/common`'s barrel.
 */
export function Icon3D({
  name,
  size,
  className,
  eager = false,
}: {
  name: Icon3DName;
  size: number;
  className?: string;
  eager?: boolean;
}) {
  return (
    // `unoptimized`: a local file, already sized and compressed, served as it is.
    <Image
      src={icon3dSrc(name)}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      unoptimized
      loading={eager ? "eager" : "lazy"}
      draggable={false}
      className={cn("shrink-0 select-none object-contain", className)}
      style={{ width: size, height: size }}
    />
  );
}
