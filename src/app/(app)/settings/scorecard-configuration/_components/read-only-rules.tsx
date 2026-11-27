import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import type { PolicyRule } from "@/types/credit-scoring";

const READ_ONLY_NOTE = "Read only. These rules are set with each scorecard revision and go back unchanged when you save.";

export function PolicyRulesList({ rules }: { rules: PolicyRule[] }) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">{READ_ONLY_NOTE}</p>
      {rules.map((rule) => (
        <Card key={rule.id}>
          <CardContent className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-medium">{rule.label}</p>
              <p className="text-xs text-muted-foreground">{rule.description}</p>
            </div>
            <Switch checked={rule.is_active} disabled aria-label={`${rule.label}: ${rule.is_active ? "on" : "off"}`} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
