export { AccessDenied } from "./access-denied";
export { PermissionButton } from "./permission-button";
export { PermissionGate } from "./permission-gate";
export { RouteGuard } from "./route-guard";
export { BrandLogo } from "./brand-logo";
export { PoweredByLendy } from "./powered-by-lendy";
export { ImagePreviewDialog, type PreviewImage } from "./image-preview-dialog";
export { PrintableMenu } from "./printable-menu";
export { TablePagination } from "./table-pagination";
export type { TablePaginationProps } from "./table-pagination";

/**
 * `SubjectPicker` is deliberately NOT re-exported here, and adding it is a
 * regression rather than a tidy-up.
 *
 * This barrel is not tree-shaken: `RouteGuard` is imported from it by nearly
 * every page, and a re-export drags the whole named module into the shared
 * chunk those pages load. `SubjectPicker` pulls `@/components/ui/combobox` plus
 * the borrower and loan services behind it, which measured at **+52 kB of
 * eager client JS on 43 routes** — /login, /dashboard and /users included, none
 * of which can render it. Its two real consumers import it directly:
 *
 *     import { SubjectPicker } from "@/components/common/subject-picker";
 */
