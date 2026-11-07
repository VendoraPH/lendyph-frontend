import { Card, CardContent } from "@/components/ui/card";

/** Shown when a member service is switched off in portal settings. */
export function ServiceOff({ service }: { service: string }) {
  return (
    <Card>
      <CardContent className="py-10 text-center text-sm text-muted-foreground">
        {service} is not available online. Please visit your branch for this service.
      </CardContent>
    </Card>
  );
}
