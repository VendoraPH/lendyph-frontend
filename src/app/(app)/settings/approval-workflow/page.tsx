"use client";

import { useState, useEffect, useMemo } from "react";
import { RouteGuard } from "@/components/common";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  approvalWorkflowService,
  roleService,
  type ApprovalChainStep,
  type ChainStepKind,
} from "@/services";
import type { ApiRole } from "@/services/role.service";
import { ROLES } from "@/constants/rbac";
import type { Role } from "@/types";
import {
  Workflow,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Send,
  CheckCircle2,
  BadgeCheck,
  Unlock,
  Save,
  RotateCcw,
  AlertCircle,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { notifyError } from "@/lib/notify";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const KIND_META: Record<
  ChainStepKind,
  { label: string; icon: LucideIcon; description: string; colorClass: string }
> = {
  submit: {
    label: "Submit",
    icon: Send,
    description: "Prepares and submits the draft for review",
    colorClass: "bg-teal-500/10 text-teal-700 border-teal-500/30",
  },
  approve: {
    label: "Approve",
    icon: CheckCircle2,
    description: "Reviews and approves or sends back for revision",
    colorClass: "bg-green-500/10 text-green-700 border-green-500/30",
  },
  release: {
    label: "Release",
    icon: Unlock,
    description: "Finalizes and releases the loan",
    colorClass: "bg-brand-orange/10 text-brand-orange border-brand-orange/30",
  },
  confirmed: {
    label: "Confirmed",
    icon: BadgeCheck,
    description: "Confirms the decision before proceeding to the next step",
    colorClass: "bg-blue-500/10 text-blue-700 border-blue-500/30",
  },
};

function titleCase(s: string): string {
  return s.split("_").filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function roleLabel(roleName: string): string {
  return ROLES[roleName as Role]?.label ?? titleCase(roleName);
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function generateUniqueId(base: string, existingIds: string[]): string {
  const slug = slugify(base) || "step";
  if (!existingIds.includes(slug)) return slug;
  let i = 2;
  while (existingIds.includes(`${slug}-${i}`)) i++;
  return `${slug}-${i}`;
}

// ---------------------------------------------------------------------------
// Add / Edit Step Dialog
// ---------------------------------------------------------------------------

interface StepFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  step: ApprovalChainStep | null; // null = add
  existingIds: string[];
  roles: ApiRole[];
  onSave: (step: ApprovalChainStep) => void;
}

function StepFormDialog({
  open,
  onOpenChange,
  step,
  existingIds,
  roles,
  onSave,
}: StepFormDialogProps) {
  const isEdit = !!step;
  const [name, setName] = useState("");
  const [role, setRole] = useState<string>("");
  const [kind, setKind] = useState<ChainStepKind>("approve");
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    if (open) {
      setName(step?.name ?? "");
      setRole(step?.role ?? "");
      setKind(step?.kind ?? "approve");
      setStatus(step?.status ?? "");
    }
  }, [open, step]);

  function handleSave() {
    if (!name.trim()) {
      toast.error("Step name is required");
      return;
    }
    if (!role.trim()) {
      toast.error("Required role is required");
      return;
    }
    if (!status.trim()) {
      toast.error("Status is required");
      return;
    }
    const id = isEdit && step ? step.id : generateUniqueId(name, existingIds);
    onSave({
      id,
      name: name.trim(),
      role: role.trim(),
      kind,
      status: status.trim(),
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Step" : "Add Step"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the step details. The step id cannot be changed after creation."
              : "Define a new step in the approval chain."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="step-name">
              Step Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="step-name"
              placeholder="e.g. Branch Manager"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="step-role">
              Required Role <span className="text-destructive">*</span>
            </Label>
            <Select
              value={role || null}
              onValueChange={(v) => setRole(v ?? "")}
            >
              <SelectTrigger id="step-role" className="w-full">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {roles.filter((r) => r.is_active !== false).map((r) => (
                  <SelectItem key={r.id} value={r.name}>
                    {roleLabel(r.name)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Only users with this role (or admins) can act on this step.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="step-kind">
              Step Kind <span className="text-destructive">*</span>
            </Label>
            <Select
              value={kind}
              onValueChange={(v) => setKind(v as ChainStepKind)}
            >
              <SelectTrigger id="step-kind" className="w-full">
                <SelectValue placeholder="Select kind" />
              </SelectTrigger>
              <SelectContent className="min-w-[28rem]">
                {(Object.keys(KIND_META) as ChainStepKind[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {KIND_META[k].label} — {KIND_META[k].description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              <strong>Submit</strong> must be the first step.{" "}
              <strong>Release</strong> must be the last step.{" "}
              <strong>Approve</strong> steps sit between them.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="step-status">
              Status <span className="text-destructive">*</span>
            </Label>
            <Input
              id="step-status"
              placeholder="e.g. for_review"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              When a user executes this step, the loan application&apos;s status
              will be set to this value.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
          >
            {isEdit ? "Save Changes" : "Add Step"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

type WorkflowTab = "normal" | "policy_exception";

export default function ApprovalWorkflowPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<WorkflowTab>("normal");
  const [roles, setRoles] = useState<ApiRole[]>([]);

  // Normal flow state
  const [normalSteps, setNormalSteps] = useState<ApprovalChainStep[]>([]);
  const [savedNormalSteps, setSavedNormalSteps] = useState<ApprovalChainStep[]>([]);

  // Policy Exception flow state
  const [peSteps, setPeSteps] = useState<ApprovalChainStep[]>([]);
  const [savedPeSteps, setSavedPeSteps] = useState<ApprovalChainStep[]>([]);

  // Active chain = whatever tab is selected
  const steps = activeTab === "normal" ? normalSteps : peSteps;
  const setSteps = activeTab === "normal" ? setNormalSteps : setPeSteps;
  const savedSteps = activeTab === "normal" ? savedNormalSteps : savedPeSteps;

  const [formOpen, setFormOpen] = useState(false);
  const [editingStep, setEditingStep] = useState<ApprovalChainStep | null>(null);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [normalResult, peResult, rolesResult] = await Promise.allSettled([
          approvalWorkflowService.listNormal(),
          approvalWorkflowService.list(),
          roleService.list(),
        ]);
        if (cancelled) return;

        if (normalResult.status === "fulfilled") {
          setNormalSteps(normalResult.value);
          setSavedNormalSteps(normalResult.value);
        }
        if (peResult.status === "fulfilled") {
          setPeSteps(peResult.value);
          setSavedPeSteps(peResult.value);
        }
        if (rolesResult.status === "fulfilled") {
          const raw = rolesResult.value;
          const list = Array.isArray(raw)
            ? raw
            : (raw as { data: ApiRole[] })?.data ?? [];
          setRoles(list);
        }

        if (normalResult.status === "rejected" || peResult.status === "rejected") {
          toast.error("We couldn't load the approval workflow. Please try again.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const validationError = useMemo(
    () => approvalWorkflowService.validate(steps),
    [steps]
  );

  const isDirty = useMemo(() => {
    if (steps.length !== savedSteps.length) return true;
    return steps.some((s, i) => {
      const saved = savedSteps[i];
      return (
        !saved ||
        s.id !== saved.id ||
        s.name !== saved.name ||
        s.role !== saved.role ||
        s.kind !== saved.kind ||
        (s.status ?? null) !== (saved.status ?? null)
      );
    });
  }, [steps, savedSteps]);

  const stepCounts = useMemo(() => {
    return {
      total: steps.length,
      submit: steps.filter((s) => s.kind === "submit").length,
      approve: steps.filter((s) => s.kind === "approve").length,
      release: steps.filter((s) => s.kind === "release").length,
    };
  }, [steps]);

  function openAdd() {
    setEditingStep(null);
    setFormOpen(true);
  }

  function openEdit(step: ApprovalChainStep) {
    setEditingStep(step);
    setFormOpen(true);
  }

  function handleSaveStep(newStep: ApprovalChainStep) {
    setSteps((prev) => {
      if (editingStep) {
        return prev.map((s) => (s.id === editingStep.id ? newStep : s));
      }
      return [...prev, newStep];
    });
    toast.success(editingStep ? "Step updated" : "Step added");
  }

  function handleDeleteStep(id: string) {
    setSteps((prev) => prev.filter((s) => s.id !== id));
    toast.success("Step removed");
  }

  function moveStep(index: number, direction: "up" | "down") {
    setSteps((prev) => {
      const next = [...prev];
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function handleSave() {
    if (validationError) {
      toast.error(validationError.message);
      return;
    }
    try {
      setSaving(true);
      if (activeTab === "normal") {
        await approvalWorkflowService.saveNormal(steps);
        // Refetch from server so display reflects server truth — catches any
        // persistence or response-shape discrepancies immediately.
        const fresh = await approvalWorkflowService.listNormal();
        setNormalSteps(fresh);
        setSavedNormalSteps(fresh);
      } else {
        await approvalWorkflowService.save(steps);
        const fresh = await approvalWorkflowService.list();
        setPeSteps(fresh);
        setSavedPeSteps(fresh);
      }
      toast.success(`${activeTab === "normal" ? "Normal" : "Policy Exception"} workflow saved`);
    } catch (err) {
      notifyError(err, "We couldn't save the workflow. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleRevert() {
    if (activeTab === "normal") {
      setNormalSteps(savedNormalSteps);
    } else {
      setPeSteps(savedPeSteps);
    }
    toast.info("Changes reverted");
  }

  async function handleReset() {
    try {
      setSaving(true);
      if (activeTab === "normal") {
        const defaults = await approvalWorkflowService.resetNormal();
        setNormalSteps(defaults);
        setSavedNormalSteps(defaults);
      } else {
        const defaults = await approvalWorkflowService.reset();
        setPeSteps(defaults);
        setSavedPeSteps(defaults);
      }
      toast.success(`${activeTab === "normal" ? "Normal" : "Policy Exception"} workflow reset to default`);
    } catch {
      toast.error("We couldn't reset the workflow. Please try again.");
    } finally {
      setSaving(false);
      setResetConfirmOpen(false);
    }
  }

  if (loading) {
    return (
      <RouteGuard permission="settings:view" pageName="Approval Workflow">
        <div className="flex min-h-[calc(100vh-6rem)] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </RouteGuard>
    );
  }

  const existingIds = steps.map((s) => s.id);

  return (
    <RouteGuard permission="settings:view" pageName="Approval Workflow">
      <div className="space-y-6">
        {/* Header row: title + actions */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">
              Approval Workflow
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Configure the loan approval chain — who acts at each step and in what order
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setResetConfirmOpen(true)}
              disabled={saving}
              className="h-9"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Reset to Default</span>
              <span className="sm:hidden">Reset</span>
            </Button>
            {isDirty && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRevert}
                disabled={saving}
                className="h-9"
              >
                Revert
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || !!validationError || !isDirty}
              className="h-9 bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save Changes
            </Button>
          </div>
        </div>

        {/* Workflow Type Tabs — own row so they never fight with title/actions */}
        <div className="flex w-full rounded-lg border p-1 bg-muted/50 sm:w-fit">
          <button
            type="button"
            onClick={() => setActiveTab("normal")}
            className={cn(
              "flex-1 sm:flex-none px-4 py-1.5 text-sm font-medium rounded-md transition-colors",
              activeTab === "normal"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Normal Flow
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("policy_exception")}
            className={cn(
              "flex-1 sm:flex-none px-4 py-1.5 text-sm font-medium rounded-md transition-colors",
              activeTab === "policy_exception"
                ? "bg-amber-500/10 text-amber-700 shadow-sm border border-amber-300"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Policy Exception
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Total Steps
                  </p>
                  <p className="text-2xl font-bold mt-0.5">{stepCounts.total}</p>
                </div>
                <Workflow className="h-8 w-8 text-brand-orange/40" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Submit</p>
                  <p className="text-2xl font-bold mt-0.5">{stepCounts.submit}</p>
                </div>
                <Send className="h-8 w-8 text-teal-500/40" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Approve</p>
                  <p className="text-2xl font-bold mt-0.5">{stepCounts.approve}</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-green-500/40" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Release</p>
                  <p className="text-2xl font-bold mt-0.5">{stepCounts.release}</p>
                </div>
                <Unlock className="h-8 w-8 text-brand-orange/40" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Validation warning */}
        {validationError && (
          <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-800/40 dark:bg-red-900/10 p-3 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-red-700 dark:text-red-400">
                Chain is invalid
              </p>
              <p className="text-red-600 dark:text-red-500 mt-0.5">
                {validationError.message}
              </p>
            </div>
          </div>
        )}

        {/* Unsaved changes indicator */}
        {isDirty && !validationError && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-900/10 p-3 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-sm text-amber-700 dark:text-amber-400">
              You have unsaved changes. Click <strong>Save Changes</strong> to apply,
              or <strong>Revert</strong> to discard.
            </p>
          </div>
        )}

        {/* Steps list */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-sm font-medium">Chain Steps</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={openAdd}
                className="h-8 gap-1 text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Step
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {steps.length === 0 && (
              <div className="text-center py-12 text-muted-foreground text-sm">
                No steps configured. Click <strong>Add Step</strong> to start.
              </div>
            )}
            {steps.map((step, i) => {
              const meta = KIND_META[step.kind];
              const Icon = meta.icon;
              const apiRole = roles.find((r) => r.name === step.role);
              return (
                <div
                  key={step.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border p-3 bg-card hover:bg-muted/30 transition-colors"
                >
                  {/* Reorder buttons */}
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      disabled={i === 0}
                      onClick={() => moveStep(i, "up")}
                      aria-label="Move up"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      disabled={i === steps.length - 1}
                      onClick={() => moveStep(i, "down")}
                      aria-label="Move down"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {/* Position number */}
                  <div className="h-8 w-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs font-semibold shrink-0">
                    {i + 1}
                  </div>

                  {/* Kind icon */}
                  <div
                    className={cn(
                      "h-9 w-9 rounded-md flex items-center justify-center shrink-0",
                      meta.colorClass
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>

                  {/* Name + role */}
                  <div className="min-w-0 flex-1 basis-[180px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold truncate">{step.name}</p>
                      <Badge
                        variant="outline"
                        className={cn("text-[10px] h-4 px-1.5", meta.colorClass)}
                      >
                        {meta.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      Role:{" "}
                      <span className="font-mono">
                        {apiRole ? roleLabel(step.role) : step.role}
                      </span>
                      {!apiRole && (
                        <span className="ml-1 text-amber-600">
                          (role removed)
                        </span>
                      )}
                      {step.status && (
                        <>
                          <span className="mx-1.5 text-muted-foreground/40">
                            ·
                          </span>
                          Status:{" "}
                          <span className="font-mono">{step.status}</span>
                        </>
                      )}
                    </p>
                  </div>

                  {/* Actions — wrap to their own row on very narrow widths */}
                  <div className="flex items-center gap-1 shrink-0 ml-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => openEdit(step)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/5"
                      onClick={() => handleDeleteStep(step.id)}
                      aria-label="Delete step"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Dialogs */}
        <StepFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          step={editingStep}
          existingIds={existingIds}
          roles={roles}
          onSave={handleSaveStep}
        />

        <Dialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
          <DialogContent size="sm">
            <DialogHeader>
              <DialogTitle>Reset to Default</DialogTitle>
              <DialogDescription>
                This will discard your current configuration and restore the
                default 10-step chain (Loan Processor → Manager → BOD1..BOD7 →
                Cashier). Existing in-flight loans will keep their own snapshots
                and are not affected.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setResetConfirmOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleReset}
                disabled={saving}
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Reset to Default
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </RouteGuard>
  );
}
