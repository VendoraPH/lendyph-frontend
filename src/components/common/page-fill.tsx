import type { ComponentProps } from "react";
import { Spinner } from "@/components/ui/spinner";
import { FIT_CLASSES, scrollBoxClass } from "@/lib/page-fill";
import { cn } from "@/lib/utils";

/**
 * Pages that fit the screen: the page fills the space under the header and
 * only its long parts scroll, inside their own box. Every rule applies at the
 * `fit:` size (at least 1024 x 640, globals.css); below it a page scrolls
 * exactly as before. The class lists are in `@/lib/page-fill` (`FIT_CLASSES`,
 * `scrollBoxClass`) for elements that can't be these components, such as a
 * `Card`.
 *
 * Deliberately NOT re-exported from `@/components/common`; import by path.
 */

/**
 * The page root, in place of `<div className="space-y-6">`. A `gap-6` column
 * that takes the main area's height at fit. Headers, filters, tabs and totals
 * keep their natural height; give the part that should take the rest
 * `FillSection` (or `FIT_CLASSES.section`).
 *
 *     <PageFill>
 *       <PageHeader title="Members" />
 *       <Filters />
 *       <Card className={FIT_CLASSES.section}>…</Card>
 *     </PageFill>
 */
export function PageFill({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="page-fill" className={cn(FIT_CLASSES.page, className)} {...props} />;
}

/**
 * Takes the height left in its column at fit and is a column itself, so a
 * `ScrollBox` inside it can take the rest again. On a `Card` or a
 * `CardContent`, use the same classes: `className={FIT_CLASSES.section}`.
 *
 *     <FillSection className="gap-4">
 *       <Tabs … />
 *       <ScrollBox><Table>…</Table></ScrollBox>
 *     </FillSection>
 */
export function FillSection({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="fill-section" className={cn(FIT_CLASSES.section, className)} {...props} />;
}

/**
 * The scroll region. At fit it takes the height left in its column and
 * scrolls both ways; the table inside keeps its headings (and a `tfoot` or a
 * `<TableRow data-total>`) pinned. Below fit it is a plain block that only
 * scrolls sideways. `always` scrolls at every size (the expand dialog uses it).
 *
 *     <Card className={FIT_CLASSES.section}>
 *       <CardContent className={FIT_CLASSES.section}>
 *         <ScrollBox><Table>…</Table></ScrollBox>
 *         <TablePagination … />
 *       </CardContent>
 *     </Card>
 */
export function ScrollBox({
  className,
  always = false,
  ...props
}: ComponentProps<"div"> & { always?: boolean }) {
  return <div data-slot="scroll-box" className={cn(scrollBoxClass({ always }), className)} {...props} />;
}

/**
 * The page's loading state, filling the page (as its root or inside
 * `PageFill`) instead of `min-h-[calc(100vh-6rem)]`.
 *
 *     if (loading) return <PageLoader />;
 */
export function PageLoader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div data-slot="page-loader" className={cn(FIT_CLASSES.loader, className)} {...props}>
      <Spinner className="size-6 text-muted-foreground" />
    </div>
  );
}
