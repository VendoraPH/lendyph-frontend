/**
 * The 3D icon set (Higgsfield, 2026-11-17) and where it is used.
 *
 * WHAT THIS PROVES: the registry holds exactly the thirty-two icons, each a
 * local path under /icons/3d/ whose file is really in public/, a 192x192 WebP
 * with an alpha channel, and stays light; every side-menu item (every module
 * switched on) has its agreed icon, except Linda, who keeps her face; GCash and
 * AMLA show their own icons (GCash's brand mark stays its line icon); every
 * dashboard figure card, report and printable has a 3D icon mapped, the agreed
 * one for its line icon, and the AMLA report cards show AMLA's; and the module
 * headers show their module's icon.
 * WHAT IT DOES NOT PROVE: how the icons look (clean edges on the light and dark
 * menu), or that every page still fits at 1366x768 (browser check).
 */
import { before, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { ICON_3D_NAMES, ICON_3D_TILE_CLASS, ICONS_3D, icon3dSrc } from "./icons-3d";

const EXPECTED = [
  "icon-dashboard",
  "icon-credit-score",
  "icon-portal",
  "icon-users",
  "icon-audit",
  "icon-settings",
  "icon-wallet",
  "icon-alert",
  "icon-coin",
  "icon-pie",
  "icon-trend",
  "icon-hourglass",
  "icon-transfer",
  "icon-layers",
  "icon-scale",
  "icon-signed",
  "icon-moon",
  "icon-calendar",
  "icon-gcash",
  "icon-amla",
  "empty-loans",
  "empty-members",
  "empty-payments",
  "empty-savings",
  "empty-share-capital",
  "empty-collaterals",
  "empty-wallet",
  "empty-ledger",
  "empty-compliance",
  "empty-reminders",
  "empty-documents",
  "pick-report",
];

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

let nav: typeof import("@/constants/navigation");

before(async () => {
  // Every module on, so the menu holds every item it can show. The flags are
  // read when `@/config/env` loads; this file runs in its own process.
  for (const name of [
    "NEXT_PUBLIC_ENABLE_LINDA",
    "NEXT_PUBLIC_ENABLE_SAVINGS",
    "NEXT_PUBLIC_ENABLE_CDA",
    "NEXT_PUBLIC_ENABLE_MEMBER_PORTAL",
    "NEXT_PUBLIC_ENABLE_CREDIT_SCORING",
    "NEXT_PUBLIC_ENABLE_CIC",
    "NEXT_PUBLIC_ENABLE_AMLA",
  ]) {
    process.env[name] = "true";
  }
  nav = await import("@/constants/navigation");
});

test("the registry holds exactly the thirty-two icons", () => {
  assert.equal(EXPECTED.length, 32);
  assert.deepEqual([...ICON_3D_NAMES].sort(), [...EXPECTED].sort());
  assert.deepEqual(Object.keys(ICONS_3D).sort(), [...EXPECTED].sort());
});

test("every icon is a local path under /icons/3d/, named after its file", () => {
  for (const name of ICON_3D_NAMES) {
    assert.equal(ICONS_3D[name], `/icons/3d/${name}.webp`, name);
    assert.equal(icon3dSrc(name), ICONS_3D[name], name);
  }
});

test("every icon's file is in public/ and stays light (under 12 KB)", () => {
  for (const name of ICON_3D_NAMES) {
    const file = join(process.cwd(), "public", ICONS_3D[name]);
    assert.ok(existsSync(file), `${name}: public${ICONS_3D[name]} is missing`);
    assert.ok(statSync(file).size < 12 * 1024, `${name} is ${statSync(file).size} bytes`);
  }
});

/** A WebP's canvas size and whether it carries alpha, read from its VP8X header. */
function webpInfo(file: string): { width: number; height: number; alpha: boolean } {
  const b = readFileSync(file);
  assert.equal(b.toString("ascii", 0, 4), "RIFF", `${file} is not a RIFF file`);
  assert.equal(b.toString("ascii", 8, 12), "WEBP", `${file} is not a WebP`);
  assert.equal(b.toString("ascii", 12, 16), "VP8X", `${file} has no extended header (no alpha)`);
  return {
    alpha: (b[20] & 0x10) !== 0,
    width: 1 + b.readUIntLE(24, 3),
    height: 1 + b.readUIntLE(27, 3),
  };
}

test("every icon's file is a 192x192 WebP with an alpha channel", () => {
  for (const name of ICON_3D_NAMES) {
    const info = webpInfo(join(process.cwd(), "public", ICONS_3D[name]));
    assert.deepEqual(info, { width: 192, height: 192, alpha: true }, name);
  }
});

test("the menu tile is a soft neutral tile: light in light mode, the card colour in dark mode", () => {
  const classes = ICON_3D_TILE_CLASS.split(/\s+/);
  for (const t of ["bg-white", "dark:bg-card"]) assert.ok(classes.includes(t), t);
  assert.ok(!classes.some((c) => /^bg-gradient|^from-|^to-/.test(c)), "no coloured gradient");
});

test("every side-menu item shows its agreed 3D icon; only Linda keeps her own", () => {
  const byHref = Object.fromEntries(nav.SIDEBAR_NAV.map((item) => [item.href, item.icon3d]));
  assert.deepEqual(byHref, {
    "/dashboard": "icon-dashboard",
    "/linda": undefined,
    "/borrowers": "empty-members",
    "/loans": "empty-loans",
    "/payments": "empty-payments",
    "/share-capital": "empty-share-capital",
    "/savings": "empty-savings",
    "/collaterals": "empty-collaterals",
    "/gcash": "icon-gcash",
    "/credit-scoring": "icon-credit-score",
    "/cic": "empty-compliance",
    "/cda": "empty-compliance",
    "/member-portal": "icon-portal",
    "/amla": "icon-amla",
    "/accounting": "empty-ledger",
    "/users": "icon-users",
    "/reports": "pick-report",
    "/printables": "empty-documents",
    "/audit-trail": "icon-audit",
    "/settings": "icon-settings",
  });
});

test("the side menu draws the 3D icon on the neutral tile, in both the full and the collapsed menu", () => {
  const sidebar = read("src/components/layout/sidebar.tsx");
  assert.match(sidebar, /from "@\/components\/common\/icon-3d"/);
  assert.match(sidebar, /ICON_3D_TILE_CLASS/);
  // One helper draws the item's icon for all three layouts (collapsed, plain
  // link, expander), so the collapsed menu shows the same icons.
  assert.equal((sidebar.match(/<NavItemIcon\b/g) ?? []).length, 3);
  // The line icon is drawn once, inside that helper, for an item with no 3D icon.
  assert.equal((sidebar.match(/<item\.icon\b/g) ?? []).length, 1);
});

test("GCash keeps its brand mark as its line icon, for the command palette, beside its 3D icon", async () => {
  const { GCashIcon } = await import("@/components/icons/gcash-icon");
  const gcash = nav.SIDEBAR_NAV.find((item) => item.href === "/gcash");
  assert.equal(gcash?.icon, GCashIcon);
  assert.equal(gcash?.icon3d, "icon-gcash");
  assert.equal(nav.AMLA_NAV.icon3d, "icon-amla");
});

test("Linda's menu tile shows her face on the neutral tile, as her floating button does", () => {
  const sidebar = read("src/components/layout/sidebar.tsx");
  assert.match(sidebar, /from "@\/components\/linda\/linda-avatar"/);
  assert.match(sidebar, /item\.href === LINDA_NAV\.href/);
  assert.equal((sidebar.match(/<LindaAvatar\b/g) ?? []).length, 1);
});

test("every dashboard figure card has its agreed 3D icon", async () => {
  const { KPI_ICONS_3D } = await import("@/app/(app)/dashboard/_lib/kpi-layout");
  assert.deepEqual(KPI_ICONS_3D, {
    portfolio: "icon-wallet",
    active_loans: "empty-loans",
    collected: "icon-coin",
    overdue: "icon-alert",
    share_capital: "empty-share-capital",
  });
  const page = read("src/app/(app)/dashboard/page.tsx");
  assert.match(page, /KPI_ICONS_3D\[kpi\.key\]/);
});

test("every report has a 3D icon mapped from its line icon", async () => {
  const { REPORT_CATALOG } = await import("@/app/(app)/reports/_lib/report-catalog");
  const { REPORT_ICONS_3D } = await import("@/app/(app)/reports/_lib/report-icons-3d");
  for (const report of REPORT_CATALOG) {
    assert.ok(REPORT_ICONS_3D.has(report.icon), `${report.id} has no 3D icon`);
  }
});

test("the report line icons map to the agreed 3D icons", async () => {
  const lucide = await import("lucide-react");
  const { REPORT_ICONS_3D } = await import("@/app/(app)/reports/_lib/report-icons-3d");
  const agreed: Record<string, string> = {
    PieChart: "icon-pie",
    Percent: "icon-pie",
    TrendingUp: "icon-trend",
    Activity: "icon-trend",
    ChartColumn: "icon-trend",
    Clock: "icon-hourglass",
    Hourglass: "icon-hourglass",
    Layers: "icon-layers",
    AlertTriangle: "icon-alert",
    Siren: "icon-alert",
    ShieldAlert: "icon-alert",
    Users: "empty-members",
    UserRound: "empty-members",
    Banknote: "icon-coin",
    Coins: "icon-coin",
    ListChecks: "pick-report",
    List: "pick-report",
    ClipboardList: "pick-report",
    FileText: "empty-documents",
    BookOpen: "empty-ledger",
    Wallet: "icon-wallet",
    ArrowLeftRight: "icon-transfer",
    ArrowDownToLine: "icon-transfer",
    ArrowUpFromLine: "icon-transfer",
    MoonStar: "icon-moon",
    Scale: "icon-scale",
    PiggyBank: "empty-savings",
    ReceiptText: "empty-payments",
    Landmark: "empty-share-capital",
    CalendarClock: "icon-calendar",
    // Not in the brief's table: the closest match.
    Gauge: "icon-credit-score",
    Target: "icon-trend",
  };
  for (const [line, icon] of Object.entries(agreed)) {
    const component = lucide[line as keyof typeof lucide] as Parameters<typeof REPORT_ICONS_3D.get>[0];
    assert.equal(REPORT_ICONS_3D.get(component), icon, line);
  }
});

test("every printable has a 3D icon mapped from its line icon, the agreed one", async () => {
  const lucide = await import("lucide-react");
  const { PRINTABLE_CATALOG } = await import("@/lib/printables/catalog");
  const { PRINTABLE_ICONS_3D } = await import("@/lib/printables/icons-3d");
  for (const printable of PRINTABLE_CATALOG) {
    assert.ok(PRINTABLE_ICONS_3D.has(printable.icon), `${printable.id} has no 3D icon`);
  }
  const agreed: Record<string, string> = {
    FileText: "empty-documents",
    FileX: "empty-documents",
    FileSignature: "icon-signed",
    ScrollText: "icon-signed",
    Wallet: "icon-wallet",
    CalendarClock: "icon-calendar",
    ReceiptText: "empty-payments",
    Landmark: "empty-share-capital",
    BookUser: "empty-members",
    UserPlus: "empty-members",
    MoonStar: "icon-moon",
    HandCoins: "icon-coin",
    BellRing: "empty-reminders",
    TimerOff: "icon-hourglass",
  };
  for (const [line, icon] of Object.entries(agreed)) {
    const component = lucide[line as keyof typeof lucide] as Parameters<typeof PRINTABLE_ICONS_3D.get>[0];
    assert.equal(PRINTABLE_ICONS_3D.get(component), icon, line);
  }
});

test("every AMLA report card, and the AMLA section on the Reports page, shows AMLA's icon", async () => {
  const { AMLA_REPORT_CATALOG } = await import("@/app/(app)/reports/_lib/report-catalog");
  assert.equal(AMLA_REPORT_CATALOG.length, 10);
  for (const report of AMLA_REPORT_CATALOG) assert.equal(report.icon3d, "icon-amla", report.key);
  const page = read("src/app/(app)/reports/page.tsx");
  assert.match(page, /<Icon3D name=\{report\.icon3d \?\? reportIcon3D\(report\.icon\)\} size=\{30\} \/>/);
  assert.match(page, /<Icon3D name="icon-amla" size=\{56\} \/>/);
  assert.doesNotMatch(page, /name="emptyCompliance"/);
});

test("the report and printable cards and their page headers draw the 3D icon", () => {
  for (const path of [
    "src/app/(app)/reports/page.tsx",
    "src/app/(app)/reports/[reportId]/page.tsx",
    "src/app/(app)/printables/page.tsx",
    "src/app/(app)/printables/[printableId]/page.tsx",
  ]) {
    const source = read(path);
    assert.match(source, /<Icon3D\b/, path);
    // No line icon drawn in the tile's accent colour any more.
    assert.doesNotMatch(source, /<Icon className=\{cn\("h-[56] w-[56]", (report\.)?accent\.text\)\}/, path);
  }
});

test("each module header shows its module's 3D icon", () => {
  const headers: Record<string, string> = {
    "src/app/(app)/reports/page.tsx": "pick-report",
    "src/app/(app)/printables/page.tsx": "empty-documents",
    "src/app/(app)/printables/data-template/page.tsx": "icon-layers",
    "src/app/(app)/accounting/_components/page-header.tsx": "empty-ledger",
    "src/app/(app)/credit-scoring/_components/page-header.tsx": "icon-credit-score",
    "src/app/(app)/cda/_components/cda-page.tsx": "empty-compliance",
    "src/app/(app)/loans/reminders/_components/reminders-shell.tsx": "empty-reminders",
    "src/app/(app)/loans/past-due/page.tsx": "icon-alert",
    "src/app/(app)/gcash/page.tsx": "icon-gcash",
    "src/app/(app)/amla/_components/amla-dashboard.tsx": "icon-amla",
  };
  for (const [path, icon] of Object.entries(headers)) {
    assert.match(read(path), new RegExp(`<Icon3D name="${icon}"`), path);
  }
});

test("module headers draw their icon at 40px beside the title, Reminders included", () => {
  // Reminders drew its bell at 28px inside the <h1>; the other headers draw 40px beside it.
  for (const path of [
    "src/app/(app)/accounting/_components/page-header.tsx",
    "src/app/(app)/credit-scoring/_components/page-header.tsx",
    "src/app/(app)/cda/_components/cda-page.tsx",
    "src/app/(app)/loans/reminders/_components/reminders-shell.tsx",
    "src/app/(app)/gcash/page.tsx",
    "src/app/(app)/amla/_components/amla-dashboard.tsx",
  ]) {
    const src = read(path);
    assert.match(src, /<Icon3D name="[a-z0-9-]+" size=\{40\} className="hidden sm:block[^"]*" \/>/, path);
    assert.doesNotMatch(src, /<h1[^>]*>\s*<Icon3D/, path);
  }
});

test("the white reminders bell carries a soft shadow, so it reads on the light page", () => {
  assert.match(
    read("src/app/(app)/loans/reminders/_components/reminders-shell.tsx"),
    /<Icon3D name="empty-reminders" size=\{40\} className="hidden sm:block drop-shadow-\[0_1px_3px_rgb\(0_0_0\/0\.25\)\]" \/>/,
  );
});

test("the sign-in pages have no 3D icons", () => {
  for (const path of ["src/app/(auth)/login/page.tsx", "src/app/member/(auth)/login/page.tsx"]) {
    assert.doesNotMatch(read(path), /icon-3d|Icon3D/, path);
  }
});
