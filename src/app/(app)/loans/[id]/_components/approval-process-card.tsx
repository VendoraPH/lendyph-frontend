"use client";

import Link from "next/link";
import {
  Ban,
  CheckCircle2,
  ChevronDown,
  Clock,
  Pencil,
  Send,
  Unlock,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import type { Loan } from "@/types/loan";
import type {
  ApprovalStep,
  RevisionRound,
} from "../_lib/approval-types";

interface SendBackTarget {
  index: number;
  name: string;
}

interface CurrentUserSummary {
  roles?: string[];
}

interface ApprovalProcessCardProps {
  loan: Loan;
  steps: ApprovalStep[];
  rounds: RevisionRound[];
  currentStep: ApprovalStep | null | undefined;
  allStepsApproved: boolean;
  canActOnCurrentStep: boolean;
  isConfirmationStep: boolean;
  currentUser: CurrentUserSummary | null | undefined;
  currentUserDisplayName: string;
  canEditLoanApplication: boolean;
  stepRemarks: string;
  onStepRemarksChange: (value: string) => void;
  stepActionLoading: boolean;
  actionLoading: boolean;
  sendBackTargets: SendBackTarget[];
  sendBackTargetIndex: number;
  onSendBackTargetIndexChange: (index: number) => void;
  onStepSubmit: () => void;
  onStepApprove: () => void;
  onStepSendBack: (targetIndex: number) => void;
  onStepRelease: () => void;
  onVoidLoan: () => void;
}

export function ApprovalProcessCard({
  loan,
  steps,
  rounds,
  currentStep,
  allStepsApproved,
  canActOnCurrentStep,
  isConfirmationStep,
  currentUser,
  currentUserDisplayName,
  canEditLoanApplication,
  stepRemarks,
  onStepRemarksChange,
  stepActionLoading,
  actionLoading,
  sendBackTargets,
  sendBackTargetIndex,
  onSendBackTargetIndexChange,
  onStepSubmit,
  onStepApprove,
  onStepSendBack,
  onStepRelease,
  onVoidLoan,
}: ApprovalProcessCardProps) {
  if (loan.status === "rejected" || steps.length === 0) return null;

  return (
    <Collapsible defaultOpen={false}>
      <Card>
        <CardHeader className="cursor-pointer select-none hover:bg-muted/30 transition-colors">
          <CollapsibleTrigger className="w-full text-left group/trigger">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              Loan Approval Process
              <Badge variant="outline" className="text-xs font-normal">
                {allStepsApproved
                  ? "Complete"
                  : currentStep
                    ? `Step ${currentStep.index + 1} of ${steps.length}`
                    : `${steps.length} steps`}
              </Badge>
              <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-aria-expanded/trigger:rotate-180 shrink-0" />
            </CardTitle>
          </CollapsibleTrigger>
          {rounds.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              Revision {rounds.length + 1} — previously sent back{" "}
              {rounds.length} time{rounds.length !== 1 ? "s" : ""}
            </p>
          )}
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-5">
            {/* Horizontal progress tracker — all steps at a glance.
                Circles are clickable: click any step to view/act on it below.
                The currently-selected step is marked with an orange ring. */}
            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="flex items-center gap-1 overflow-x-auto pb-1">
                {steps.map((step, i) => {
                  const isCurrent = step.status === "pending";
                  const isDone = step.status === "approved";
                  const isSentBack = step.status === "sent_back";
                  const isLast = i === steps.length - 1;
                  return (
                    <div key={`mini-${step.index}`} className="flex items-center shrink-0">
                      <div className="flex flex-col items-center gap-1 min-w-[68px]">
                        <div
                          className={cn(
                            "h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-white text-[10px] font-semibold transition-all",
                            isCurrent && "bg-brand-orange ring-4 ring-brand-orange/20 scale-110",
                            isDone && "bg-green-600",
                            isSentBack && "bg-red-500",
                            !isCurrent && !isDone && !isSentBack && "bg-muted text-muted-foreground",
                          )}
                        >
                          {isDone ? (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          ) : isSentBack ? (
                            <XCircle className="h-3.5 w-3.5" />
                          ) : isCurrent ? (
                            step.kind === "submit" ? (
                              <Send className="h-3.5 w-3.5" />
                            ) : step.kind === "release" ? (
                              <Unlock className="h-3.5 w-3.5" />
                            ) : (
                              <Clock className="h-3.5 w-3.5" />
                            )
                          ) : (
                            <span>{i + 1}</span>
                          )}
                        </div>
                        <span
                          className={cn(
                            "text-[10px] text-center leading-tight font-medium",
                            isCurrent && "text-brand-orange",
                            isDone && "text-green-700",
                            isSentBack && "text-red-700",
                            !isCurrent && !isDone && !isSentBack && "text-muted-foreground",
                          )}
                        >
                          {step.name}
                        </span>
                      </div>
                      {!isLast && (
                        <div
                          className={cn(
                            "h-0.5 w-4 mx-0.5 shrink-0 transition-colors",
                            isDone ? "bg-green-600" : "bg-muted",
                          )}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Previous revision rounds (collapsed summary) */}
            {rounds.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Previous Revisions
                </p>
                {rounds.map((round) => (
                  <div
                    key={round.round}
                    className="rounded-lg border border-dashed bg-muted/30 p-3"
                  >
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                        Round {round.round}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Sent back by {round.sent_back_by} ·{" "}
                        {formatDateTime(round.sent_back_at)}
                      </span>
                    </div>
                    <p className="text-xs italic text-muted-foreground pl-2 border-l-2 border-red-400/40 mb-2">
                      &ldquo;{round.sent_back_remarks}&rdquo;
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {round.steps
                        .filter((s) => s.status === "approved" || s.status === "sent_back")
                        .map((s) => (
                          <Badge
                            key={s.index}
                            variant="outline"
                            className={cn(
                              "text-[10px] h-4 px-1.5",
                              s.status === "approved"
                                ? "bg-green-500/10 text-green-700 border-green-500/30"
                                : "bg-red-500/10 text-red-700 border-red-500/30",
                            )}
                          >
                            {s.status === "approved" ? "✓" : "✗"} {s.name}
                          </Badge>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Current step action panel */}
            {currentStep && canActOnCurrentStep && (
              <div>
                {/* Phase header */}
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    {currentStep.kind === "submit"
                      ? "Draft Preparation"
                      : currentStep.kind === "release"
                        ? "Release"
                        : "Approval Chain"}
                  </p>
                  <div className="flex-1 h-px bg-border" />
                </div>

                {/* Step card with orange border */}
                <div className="rounded-lg border border-brand-orange/40 bg-brand-orange/5 overflow-hidden">
                  {/* Header row */}
                  <div className="flex items-center gap-3 p-3">
                    <div className="h-9 w-9 rounded-full bg-brand-orange text-white flex items-center justify-center shrink-0">
                      {currentStep.kind === "submit" ? (
                        <Send className="h-4 w-4" />
                      ) : currentStep.kind === "release" ? (
                        <Unlock className="h-4 w-4" />
                      ) : (
                        <Clock className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold">{currentStep.name}</p>
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 h-4 bg-brand-orange/10 text-brand-orange border-brand-orange/30"
                        >
                          Pending your action
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="h-px bg-brand-orange/20" />

                  {/* Action body */}
                  <div className="p-4 space-y-3">
                    <div>
                      <p className="text-xs font-semibold">
                        You are acting as{" "}
                        <span className="text-brand-orange">{currentStep.name}</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Signed in as {currentUserDisplayName}
                        {currentStep.kind === "submit" &&
                          " — submit the draft to forward it to the Manager for approval."}
                        {currentStep.kind === "approve" &&
                          (currentStep.index < steps.length - 2
                            ? ` — on approve, the loan will be forwarded to ${
                                steps[currentStep.index + 1].name
                              }.${
                                sendBackTargets.length > 1
                                  ? " You may send it back to any earlier step for revision."
                                  : " Send back for revision to return it to the Loan Processor."
                              }`
                            : ` — this is the final approver. Approve to forward for release${
                                sendBackTargets.length > 1
                                  ? ", or send the loan back to any earlier step for revision."
                                  : "."
                              }`)}
                        {currentStep.kind === "release" &&
                          " — open the release dialog to complete the loan release."}
                      </p>
                    </div>

                    {currentStep.kind !== "release" && (
                      <div className="space-y-1.5">
                        <Label htmlFor="current-step-remarks" className="text-xs">
                          {currentStep.kind === "submit"
                            ? "Processing notes (optional)"
                            : "Remarks"}{" "}
                          <span className="text-muted-foreground font-normal">
                            {currentStep.kind === "approve" ? "(required for send-back)" : ""}
                          </span>
                        </Label>
                        <Textarea
                          id="current-step-remarks"
                          placeholder={
                            currentStep.kind === "submit"
                              ? "Any notes for the approvers..."
                              : `${currentStep.name}: enter your remarks...`
                          }
                          value={stepRemarks}
                          onChange={(e) => onStepRemarksChange(e.target.value)}
                          className="min-h-[80px] text-sm bg-background"
                        />
                      </div>
                    )}

                    <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                      {currentStep.kind === "submit" && (
                        <>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="w-full sm:w-auto"
                            disabled={actionLoading}
                            onClick={onVoidLoan}
                          >
                            <Ban className="mr-2 h-4 w-4" />
                            Void Loan
                          </Button>
                          {canEditLoanApplication && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full sm:w-auto"
                              disabled={stepActionLoading}
                              render={<Link href={`/loans/new?edit=${loan.id}`} />}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit Loan Application
                            </Button>
                          )}
                          <Button
                            size="sm"
                            className="w-full sm:w-auto bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
                            onClick={onStepSubmit}
                            disabled={stepActionLoading}
                          >
                            <Send className="mr-2 h-4 w-4" />
                            Submit for Review
                          </Button>
                        </>
                      )}
                      {currentStep.kind === "approve" && (
                        <>
                          {sendBackTargets.length > 1 && (
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                              <Label
                                htmlFor="send-back-target"
                                className="text-xs text-muted-foreground whitespace-nowrap"
                              >
                                Send back to
                              </Label>
                              <Select
                                value={String(sendBackTargetIndex)}
                                onValueChange={(v) => onSendBackTargetIndexChange(Number(v))}
                                disabled={stepActionLoading}
                              >
                                <SelectTrigger
                                  id="send-back-target"
                                  className="h-9 w-full sm:w-[180px] text-xs"
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {sendBackTargets.map((t) => (
                                    <SelectItem key={t.index} value={String(t.index)}>
                                      {t.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full sm:w-auto border-red-500/30 text-red-700 hover:bg-red-50 dark:text-red-400"
                            onClick={() =>
                              onStepSendBack(
                                sendBackTargets.length > 1 ? sendBackTargetIndex : 0,
                              )
                            }
                            disabled={stepActionLoading || !stepRemarks.trim()}
                          >
                            <XCircle className="mr-2 h-4 w-4" />
                            Send Back for Revision
                          </Button>
                          <Button
                            size="sm"
                            className="w-full sm:w-auto bg-green-600 text-white hover:bg-green-700"
                            onClick={onStepApprove}
                            disabled={stepActionLoading}
                          >
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            {isConfirmationStep ? "Confirm & Forward" : "Approve & Forward"}
                          </Button>
                        </>
                      )}
                      {currentStep.kind === "release" && (
                        <Button
                          size="sm"
                          className="w-full sm:w-auto bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
                          onClick={onStepRelease}
                          disabled={stepActionLoading}
                        >
                          <Unlock className="mr-2 h-4 w-4" />
                          Release Loan
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* "Not your turn" message */}
            {currentStep && !canActOnCurrentStep && (
              <div className="rounded-lg border bg-muted/40 p-3">
                <div className="flex items-start gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="text-xs">
                    <p className="font-medium">
                      Waiting for {currentStep.name}{" "}
                      {currentStep.kind === "submit"
                        ? "to submit the draft"
                        : currentStep.kind === "release"
                          ? "to release the loan"
                          : "to approve"}
                    </p>
                    <p className="text-muted-foreground mt-0.5">
                      Only users with the{" "}
                      <span className="font-mono bg-muted px-1 py-0.5 rounded">
                        {currentStep.role}
                      </span>{" "}
                      role can act on this step. You are signed in as{" "}
                      {currentUserDisplayName}
                      {currentUser?.roles && currentUser.roles.length > 0
                        ? ` (${currentUser.roles.join(", ")})`
                        : " (no role assigned)"}
                      .
                    </p>
                  </div>
                </div>
              </div>
            )}

            {allStepsApproved && (
              <div className="rounded-lg border border-green-200 bg-green-50 p-3 flex items-start gap-2 dark:border-green-800/40 dark:bg-green-900/10">
                <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                <p className="text-sm text-green-700 dark:text-green-400">
                  All approvers have signed off. The loan is ready for release.
                </p>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
