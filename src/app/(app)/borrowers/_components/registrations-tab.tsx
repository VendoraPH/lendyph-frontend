"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { TablePagination } from "@/components/common";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Registration } from "@/services/registration.service";
import {
  REGISTRATION_VARIANTS,
  SharedCells,
  fullNameOf,
  type RegistrationTabStatus,
} from "./registration-row";

export type { RegistrationTabStatus };

interface RegistrationsTabProps {
  status: RegistrationTabStatus;
  registrations: Registration[];
  /** Row count for the whole filter, from `meta.total` — not `registrations.length`. */
  total: number;
  loading: boolean;
  error: string | null;
  page: number;
  perPage: number;
  onPageChange: (page: number) => void;
  onPerPageChange: (perPage: number) => void;
  onRetry: () => void;
  branchNameById: Map<number, string>;
}

/**
 * One page of registrations, for whichever status owns the tab.
 *
 * Purely presentational: rows, `total` and the loading/error flags are passed
 * in, so the page can drive the tab badge from the very same query that fills
 * this table instead of a second, separately-counted one. Everything that
 * differs between pending and rejected lives in `REGISTRATION_VARIANTS`.
 */
export function RegistrationsTab({
  status,
  registrations,
  total,
  loading,
  error,
  page,
  perPage,
  onPageChange,
  onPerPageChange,
  onRetry,
  branchNameById,
}: RegistrationsTabProps) {
  const variant = REGISTRATION_VARIANTS[status];

  const body = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <Spinner className="size-6 text-muted-foreground" />
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive/60 mb-3" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <button
            onClick={onRetry}
            className="mt-3 inline-flex items-center rounded-md border border-brand-orange/50 px-3 py-1.5 text-xs font-semibold text-brand-orange hover:bg-brand-orange/5 transition-colors"
          >
            Retry
          </button>
        </div>
      );
    }

    if (registrations.length === 0) {
      const { Icon, title, hint } = variant.empty;
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Icon className="h-10 w-10 text-muted-foreground/40 mb-3" aria-hidden="true" />
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-xs text-muted-foreground/70 mt-1">{hint}</p>
        </div>
      );
    }

    return (
      <Table>
        <TableCaption className="sr-only">{variant.caption}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">Member</TableHead>
            <TableHead scope="col">Contact</TableHead>
            <TableHead scope="col">Branch</TableHead>
            {variant.headers.map((h) => (
              <TableHead key={h.label} scope="col" className={h.className}>
                {h.label}
              </TableHead>
            ))}
            <TableHead scope="col" className="w-24">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {registrations.map((reg) => (
            <TableRow key={reg.id} className="hover:bg-muted/50">
              <SharedCells
                reg={reg}
                codePrefix={variant.codePrefix}
                branchNameById={branchNameById}
                align={variant.align}
              />
              <variant.Cells reg={reg} />
              <TableCell className={`text-right ${variant.align}`}>
                <Link
                  href={`/borrowers/registrations/${reg.id}`}
                  className="inline-flex items-center rounded-md border border-brand-orange/50 px-3 py-1.5 text-xs font-semibold text-brand-orange hover:bg-brand-orange/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/40"
                >
                  {variant.action}
                  <span className="sr-only"> application from {fullNameOf(reg)}</span>
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <>
      {body()}
      {/* Outside the loading/error branches on purpose: the paginator is how an
          admin gets off a page that failed, and hiding it strands them there. */}
      <TablePagination
        page={page}
        perPage={perPage}
        total={total}
        onPageChange={onPageChange}
        onPerPageChange={onPerPageChange}
      />
    </>
  );
}
