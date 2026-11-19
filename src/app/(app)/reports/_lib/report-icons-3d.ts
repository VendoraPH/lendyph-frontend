import {
  Activity,
  AlertTriangle,
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  Banknote,
  BookOpen,
  CalendarClock,
  ChartColumn,
  ClipboardList,
  Clock,
  Coins,
  FileText,
  Gauge,
  Hourglass,
  Landmark,
  Layers,
  List,
  ListChecks,
  MoonStar,
  Percent,
  PieChart,
  PiggyBank,
  ReceiptText,
  Scale,
  ShieldAlert,
  Siren,
  Target,
  TrendingUp,
  UserRound,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { Icon3DName } from "@/lib/icons-3d";

/**
 * A report's 3D icon, by the line icon its catalog entry names, so the card and
 * the report's own header draw the same picture on the same tinted tile.
 */
export const REPORT_ICONS_3D: ReadonlyMap<LucideIcon, Icon3DName> = new Map<LucideIcon, Icon3DName>([
  [PieChart, "icon-pie"],
  [Percent, "icon-pie"],
  [TrendingUp, "icon-trend"],
  [Activity, "icon-trend"],
  [ChartColumn, "icon-trend"],
  [Clock, "icon-hourglass"],
  [Hourglass, "icon-hourglass"],
  [Layers, "icon-layers"],
  [AlertTriangle, "icon-alert"],
  [Siren, "icon-alert"],
  [ShieldAlert, "icon-alert"],
  [Users, "empty-members"],
  [UserRound, "empty-members"],
  [Banknote, "icon-coin"],
  [Coins, "icon-coin"],
  [ListChecks, "pick-report"],
  [List, "pick-report"],
  [ClipboardList, "pick-report"],
  [FileText, "empty-documents"],
  [BookOpen, "empty-ledger"],
  [Wallet, "icon-wallet"],
  [ArrowLeftRight, "icon-transfer"],
  [ArrowDownToLine, "icon-transfer"],
  [ArrowUpFromLine, "icon-transfer"],
  [MoonStar, "icon-moon"],
  [Scale, "icon-scale"],
  [PiggyBank, "empty-savings"],
  [ReceiptText, "empty-payments"],
  [Landmark, "empty-share-capital"],
  [CalendarClock, "icon-calendar"],
  // Closest matches for the two line icons the agreed table leaves out:
  // Collection Efficiency's gauge, and Performance's target.
  [Gauge, "icon-credit-score"],
  [Target, "icon-trend"],
]);

/** A report's 3D icon; the reports picture for a line icon not mapped yet. */
export function reportIcon3D(icon: LucideIcon): Icon3DName {
  return REPORT_ICONS_3D.get(icon) ?? "pick-report";
}
