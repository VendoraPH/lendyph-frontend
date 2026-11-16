import { useId } from "react";
import { cn } from "@/lib/utils";
import type { LindaModelOption } from "@/types/linda";
import { lindaModelOptionName, lindaPerQuestionText, lindaTokenPriceText } from "../_lib/linda-settings";

interface LindaModelChoiceProps {
  model: LindaModelOption;
  /** The model Linda uses now. */
  inUse: boolean;
  checked: boolean;
  disabled: boolean;
  onSelect: (id: string) => void;
}

/**
 * One model in Settings → Linda's choice. A native radio, so each option is
 * exactly one radio for screen readers, named by the model (and "in use"),
 * with its description and prices as its description. The radios share a
 * name, so the arrow keys move between them.
 */
export function LindaModelChoice({ model, inUse, checked, disabled, onSelect }: LindaModelChoiceProps) {
  const detailsId = useId();
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/40",
        checked && "border-primary bg-primary/5",
        disabled && "cursor-not-allowed opacity-70",
      )}
    >
      <input
        type="radio"
        name="linda-model"
        value={model.id}
        checked={checked}
        disabled={disabled}
        onChange={() => onSelect(model.id)}
        aria-label={lindaModelOptionName(model, inUse)}
        aria-describedby={detailsId}
        className="mt-0.5 size-4 shrink-0 accent-primary"
      />
      <span className="min-w-0 space-y-1">
        <span className="block text-sm font-medium">
          {model.label}
          {inUse && (
            <>
              {" "}
              <span className="ml-1 text-xs font-normal text-muted-foreground">In use</span>
            </>
          )}
        </span>
        <span id={detailsId} className="block space-y-1">
          {model.description && <span className="block text-sm text-muted-foreground">{model.description}</span>}
          <span className="block text-xs text-muted-foreground">
            {lindaPerQuestionText(model)} · {lindaTokenPriceText(model)}
          </span>
        </span>
      </span>
    </label>
  );
}
