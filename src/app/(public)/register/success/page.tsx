// src/app/(public)/register/success/page.tsx
import { CheckCircle } from "lucide-react";

export default function RegisterSuccessPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="flex justify-center mb-5">
          <CheckCircle className="h-16 w-16 text-green-500" />
        </div>
        <h1 className="text-2xl font-extrabold mb-2">Application Submitted!</h1>
        <p className="text-sm text-muted-foreground leading-relaxed mb-6">
          Thank you for applying. Our team will review your details and contact
          you within <strong>1–3 business days</strong>.
        </p>
        <p className="text-xs text-muted-foreground">
          You may close this page.
        </p>
      </div>
    </div>
  );
}
