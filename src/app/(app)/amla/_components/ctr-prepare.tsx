"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { usePermission } from "@/hooks";
import { useSubmitGuard } from "@/hooks/use-submit-guard";
import { amlaCaseAccess } from "@/lib/amla/case-access";
import { amlaCaseApi } from "@/lib/amla/case-api";
import { notifyError, notifySuccess } from "@/lib/notify";
import type { AmlaCtrDetail } from "@/types/amla-monitoring";
import { CddFormDialog } from "../customers/_components/cdd-form-dialog";

/**
 * Prepare the CTR from a detected candidate (`amla:ctr`): the server takes a
 * snapshot of its fields and it waits for approval by someone else.
 */
export function CtrPrepareButton({ candidate }: { candidate: AmlaCtrDetail }) {
  const router = useRouter();
  const { can } = usePermission();
  const [open, setOpen] = useState(false);
  const { submitting, run } = useSubmitGuard();
  if (!amlaCaseAccess(can).prepareCtr || candidate.status !== "detected") return null;
  return (
    <>
      <div>
        <Button size="sm" onClick={() => setOpen(true)}>
          Prepare CTR
        </Button>
      </div>
      <CddFormDialog
        open={open}
        title="Prepare the CTR?"
        description="The report takes this transaction's details as they stand, with “Data not available” where Lendy holds none. It then waits for approval by someone else holding AMLA report approval, and is filed by hand on the AMLC portal."
        submitLabel="Prepare CTR"
        submitting={submitting}
        error={null}
        onClose={() => setOpen(false)}
        onSubmit={() =>
          run(() => amlaCaseApi.prepareCtr(candidate.id))
            ?.then((report) => {
              notifySuccess("CTR prepared, waiting for approval");
              router.push(`/amla/filings/${report.id}`);
            })
            .catch((err: unknown) => notifyError(err, "The CTR couldn't be prepared."))
        }
      >
        <p className="text-sm">{candidate.reference}</p>
      </CddFormDialog>
    </>
  );
}
