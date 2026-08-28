"use client"

import * as React from "react"
import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar"

import { cn } from "@/lib/utils"

function Avatar({
  className,
  size = "default",
  ...props
}: AvatarPrimitive.Root.Props & {
  size?: "default" | "sm" | "lg"
}) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      data-size={size}
      className={cn(
        "group/avatar relative flex size-8 shrink-0 rounded-full select-none after:absolute after:inset-0 after:rounded-full after:border after:border-border after:mix-blend-darken data-[size=lg]:size-10 data-[size=sm]:size-6 dark:after:mix-blend-lighten",
        className
      )}
      {...props}
    />
  )
}

/**
 * The avatar photo.
 *
 * Deliberately a native `<img>` rather than base-ui's `AvatarPrimitive.Image`.
 *
 * `AvatarPrimitive.Image` does not render an `<img>` and then let the browser
 * fetch it. It calls `useImageLoadingStatus(src)`, which constructs a detached
 * `new window.Image()` in a layout effect on mount, and returns `null` until
 * that resolves — so the fetch happens BEFORE any element exists in the
 * document. The browser's lazy-loading machinery works off intersection with
 * the viewport, and a detached image has no box and never intersects anything.
 * Worse, that hook destructures only `referrerPolicy`, `crossOrigin`, `sizes`
 * and `srcSet` off the props (see
 * `node_modules/@base-ui/react/avatar/image/useImageLoadingStatus.js`): the
 * `loading` attribute is not among them, so putting `loading="lazy"` on an
 * `AvatarImage` is not merely ineffective, it is unreachable. Every mounted
 * `AvatarImage` fetches its src immediately, always.
 *
 * These are member photos on the `private` disk, served as absolute signed
 * URLs straight at the API host. A single page of 100 rows therefore fired 100
 * authenticated requests in one burst; in production it was 613, which tripped
 * the API rate limiter and locked an admin out of the app.
 *
 * The fix was written once, for the members table, and stayed there — the list
 * page (100 rows), the borrower header, the registration detail page and the
 * profile page all still mounted the eager primitive. It lives here now so
 * every render site inherits it and no new one has to remember.
 *
 * Two consequences of not using the primitive, both intentional:
 *
 *  - The image is absolutely positioned OVER `AvatarFallback` rather than
 *    swapping with it. With no `AvatarPrimitive.Image` in the tree the root's
 *    loading status stays `idle`, so the fallback always renders — which is
 *    what we want anyway: initials paint on first frame instead of a blank
 *    circle, and there is no layout shift when the photo arrives. A positioned
 *    element paints above in-flow siblings regardless of source order, so the
 *    two orderings already used across the app both work.
 *  - A failed URL is remembered BY URL, not as a boolean. Rows are keyed by id,
 *    so a refetch reuses this component instance and only swaps `src`; a
 *    boolean `hasError` would outlive the URL it was set for and hide the photo
 *    forever. Comparing against the src that actually failed means a fresh
 *    signed URL retries by itself, with no effect to reset it. This mirrors the
 *    `failedPhotos` set the members table kept for exactly this reason.
 *
 * Anything the caller passes wins: `loading`, `decoding`, `alt` and `onError`
 * are defaults, not overrides.
 */
function AvatarImage({
  className,
  alt = "",
  onError,
  ...props
}: React.ComponentProps<"img">) {
  const [failedSrc, setFailedSrc] = React.useState<string | null>(null)

  const src = props.src

  // Nothing to show: no src, or the one we were given is known to 404. Render
  // nothing and let AvatarFallback's initials stand on their own.
  if (!src || (typeof src === "string" && src === failedSrc)) {
    return null
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- next/image cannot
    // take an arbitrary absolute signed URL from the API host without a
    // remotePatterns entry per deployment, and would proxy every member photo
    // through the Next server for no benefit. A plain lazy <img> is the point.
    <img
      data-slot="avatar-image"
      // Decorative by default: at every call site the person's name is rendered
      // as text right beside the avatar, so alt text repeats it. Callers that
      // need a real one pass `alt`.
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={(event) => {
        onError?.(event)
        if (typeof src === "string") {
          setFailedSrc(src)
        }
      }}
      className={cn(
        // `absolute inset-0` layers it over the fallback; the root is relative.
        "absolute inset-0 aspect-square size-full rounded-full object-cover",
        className
      )}
      {...props}
    />
  )
}

function AvatarFallback({
  className,
  ...props
}: AvatarPrimitive.Fallback.Props) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      // The initials are a visual stand-in for a photo, never information: the
      // name is rendered as text beside every avatar in this app. This matters
      // more now than it did — the fallback no longer unmounts when a photo
      // loads (see AvatarImage), so without this a screen reader would announce
      // "JD" and then the name. Overridable: `{...props}` is spread after.
      aria-hidden
      className={cn(
        "flex size-full items-center justify-center rounded-full bg-muted text-sm text-muted-foreground group-data-[size=sm]/avatar:text-xs",
        className
      )}
      {...props}
    />
  )
}

function AvatarBadge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="avatar-badge"
      className={cn(
        "absolute right-0 bottom-0 z-10 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground bg-blend-color ring-2 ring-background select-none",
        "group-data-[size=sm]/avatar:size-2 group-data-[size=sm]/avatar:[&>svg]:hidden",
        "group-data-[size=default]/avatar:size-2.5 group-data-[size=default]/avatar:[&>svg]:size-2",
        "group-data-[size=lg]/avatar:size-3 group-data-[size=lg]/avatar:[&>svg]:size-2",
        className
      )}
      {...props}
    />
  )
}

function AvatarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group"
      className={cn(
        "group/avatar-group flex -space-x-2 *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:ring-background",
        className
      )}
      {...props}
    />
  )
}

function AvatarGroupCount({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group-count"
      className={cn(
        "relative flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm text-muted-foreground ring-2 ring-background group-has-data-[size=lg]/avatar-group:size-10 group-has-data-[size=sm]/avatar-group:size-6 [&>svg]:size-4 group-has-data-[size=lg]/avatar-group:[&>svg]:size-5 group-has-data-[size=sm]/avatar-group:[&>svg]:size-3",
        className
      )}
      {...props}
    />
  )
}

export {
  Avatar,
  AvatarImage,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarBadge,
}
