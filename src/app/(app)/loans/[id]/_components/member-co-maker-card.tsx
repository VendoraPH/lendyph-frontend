"use client";

import { Check, ChevronDown, ChevronsUpDown, Pencil, UserCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { Loan } from "@/types/loan";
import type { User } from "@/types";

interface MemberCoMakerCardProps {
  loan: Loan;
  borrowerName: string;
  coMakerName: string;
  users: User[];
  aoEditing: boolean;
  onAoEditingChange: (editing: boolean) => void;
  aoOpen: boolean;
  onAoOpenChange: (open: boolean) => void;
  aoSaving: boolean;
  onSaveAo: (userId: number) => void;
}

export function MemberCoMakerCard({
  loan,
  borrowerName,
  coMakerName,
  users,
  aoEditing,
  onAoEditingChange,
  aoOpen,
  onAoOpenChange,
  aoSaving,
  onSaveAo,
}: MemberCoMakerCardProps) {
  const loanRecord = loan as unknown as Record<string, unknown>;
  const accountOfficerId = loanRecord.account_officer_id;
  const accountOfficer = loanRecord.account_officer as
    | { id?: number; full_name?: string; name?: string }
    | undefined;

  return (
    <Collapsible defaultOpen={false}>
      <Card>
        <CardHeader className="cursor-pointer select-none hover:bg-muted/30 transition-colors">
          <CollapsibleTrigger className="w-full text-left group/trigger">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-muted-foreground" />
              Member & Co-Maker
              <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-aria-expanded/trigger:rotate-180 shrink-0" />
            </CardTitle>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground">Member</p>
              <p className="text-sm font-medium">{borrowerName || "N/A"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Co-Maker</p>
              <p className="text-sm font-medium">{coMakerName || "None"}</p>
            </div>
            <Separator />
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-muted-foreground">Account Officer (AO)</p>
                {!aoEditing && (
                  <button
                    type="button"
                    onClick={() => onAoEditingChange(true)}
                    className="text-xs text-brand-orange hover:underline flex items-center gap-1"
                  >
                    <Pencil className="h-3 w-3" />
                    {accountOfficerId ? "Change" : "Assign"}
                  </button>
                )}
              </div>
              {aoEditing ? (
                <div className="space-y-2">
                  <Popover open={aoOpen} onOpenChange={onAoOpenChange}>
                    <PopoverTrigger
                      render={
                        <button
                          type="button"
                          role="combobox"
                          disabled={aoSaving}
                          className="flex h-8 w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-2.5 text-sm transition-colors hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                        />
                      }
                    >
                      <span className="text-muted-foreground text-sm">Select account officer...</span>
                      <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
                    </PopoverTrigger>
                    <PopoverContent className="w-(--anchor-width) p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search officer..." />
                        <CommandList>
                          <CommandEmpty>No users found.</CommandEmpty>
                          <CommandGroup>
                            {users.map((user) => (
                              <CommandItem
                                key={user.id}
                                value={user.full_name}
                                onSelect={() => {
                                  onSaveAo(user.id);
                                  onAoOpenChange(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 size-4",
                                    accountOfficerId === user.id ? "opacity-100" : "opacity-0",
                                  )}
                                />
                                <div>
                                  <p className="text-sm">{user.full_name}</p>
                                  <p className="text-xs text-muted-foreground capitalize">
                                    {user.roles?.[0]?.replace("_", " ") ?? ""}
                                  </p>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onAoEditingChange(false)}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <p className="text-sm font-medium">
                  {accountOfficer?.full_name ?? accountOfficer?.name ?? "Not assigned"}
                </p>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
