import {
  BellRing,
  BookUser,
  CalendarClock,
  FileSignature,
  FileText,
  FileX,
  HandCoins,
  Landmark,
  MoonStar,
  ReceiptText,
  ScrollText,
  TimerOff,
  UserPlus,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { Icon3DName } from "@/lib/icons-3d";

/**
 * A printable's 3D icon, by the line icon its catalog entry names, so the card
 * and the document's own header draw the same picture on the same tinted tile.
 */
export const PRINTABLE_ICONS_3D: ReadonlyMap<LucideIcon, Icon3DName> = new Map<LucideIcon, Icon3DName>([
  [FileText, "empty-documents"],
  [FileX, "empty-documents"],
  [FileSignature, "icon-signed"],
  [ScrollText, "icon-signed"],
  [Wallet, "icon-wallet"],
  [CalendarClock, "icon-calendar"],
  [ReceiptText, "empty-payments"],
  [Landmark, "empty-share-capital"],
  [BookUser, "empty-members"],
  [UserPlus, "empty-members"],
  [MoonStar, "icon-moon"],
  [HandCoins, "icon-coin"],
  [BellRing, "empty-reminders"],
  [TimerOff, "icon-hourglass"],
]);

/** A printable's 3D icon; the documents picture for a line icon not mapped yet. */
export function printableIcon3D(icon: LucideIcon): Icon3DName {
  return PRINTABLE_ICONS_3D.get(icon) ?? "empty-documents";
}
