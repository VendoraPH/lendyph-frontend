import type { CdaIssue, CdaSeverity } from "@/types/cda";

/** What the report's upload dialog starts with: the category the blocker needs, and a final copy. */
export interface DocumentPreset {
  category: string | null;
  final: boolean;
}

interface DefinitionDocument {
  key?: unknown;
  category?: unknown;
}

interface DefinitionRule {
  id?: unknown;
  type?: unknown;
  document_category?: unknown;
}

const SEVERITIES: CdaSeverity[] = ["critical", "warning", "info"];

function isDocumentIssue(issue: CdaIssue): boolean {
  return issue.component === "documents" || issue.category === "compliance_document";
}

/**
 * The document issue the upload should settle: a Critical one first, and one
 * needed to file ahead of earlier stages, else the first in the server's order.
 */
export function blockingDocumentIssue(issues: readonly CdaIssue[]): CdaIssue | null {
  const documents = issues.filter(isDocumentIssue);
  for (const severity of SEVERITIES) {
    const ofSeverity = documents.filter((i) => i.severity === severity);
    const pick = ofSeverity.find((i) => i.stage === "submit") ?? ofSeverity[0];
    if (pick) return pick;
  }
  return null;
}

/**
 * The category a document issue needs, read from the report's template
 * definition: an issue `rule:<id>` names a document rule (`document_category`),
 * and `document:<key>` a listed document (`category`). The final-version
 * switch starts on: a filing needs the final copy. Null when the template
 * doesn't say, so the user picks.
 */
export function documentPreset(issues: readonly CdaIssue[], definition: Record<string, unknown> | null | undefined): DocumentPreset {
  const issue = blockingDocumentIssue(issues);
  if (!issue || !definition) return { category: null, final: true };
  const [kind, ...rest] = issue.id.split(":");
  const key = rest.join(":");
  if (kind === "rule") {
    const rules = Array.isArray(definition.rules) ? (definition.rules as DefinitionRule[]) : [];
    const rule = rules.find((r) => r.id === key && r.type === "document");
    return { category: typeof rule?.document_category === "string" ? rule.document_category : null, final: true };
  }
  if (kind === "document") {
    const documents = Array.isArray(definition.documents) ? (definition.documents as DefinitionDocument[]) : [];
    const listed = documents.find((d) => d.key === key);
    return { category: typeof listed?.category === "string" ? listed.category : null, final: true };
  }
  return { category: null, final: true };
}
