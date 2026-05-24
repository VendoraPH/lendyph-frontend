"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Upload, FileText, Trash2, Loader2, ExternalLink, IdCard } from "lucide-react";
import { toast } from "sonner";
import { documentService } from "@/services";
import { borrowerService, type BorrowerValidId } from "@/services/borrower.service";
import type { Document } from "@/services/document.service";
import { VALID_ID_OPTIONS } from "@/constants";
import { env } from "@/config/env";

interface DocumentsTabProps {
  borrowerId: number;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function validIdLabel(entry: BorrowerValidId): string {
  if (entry.type === "others") return entry.custom_type_name || "Others";
  return VALID_ID_OPTIONS.find((o) => o.value === entry.type)?.label ?? entry.custom_type_name ?? entry.type;
}

function fileUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `${env.storage.url || ""}${url}`;
}

export function DocumentsTab({ borrowerId }: DocumentsTabProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [validIds, setValidIds] = useState<BorrowerValidId[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [deletingValidId, setDeletingValidId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [docsRes, idsRes] = await Promise.allSettled([
      documentService.borrowerList(borrowerId),
      borrowerService.listValidIds(borrowerId),
    ]);
    setDocuments(docsRes.status === "fulfilled" && Array.isArray(docsRes.value) ? docsRes.value : []);
    setValidIds(idsRes.status === "fulfilled" && Array.isArray(idsRes.value) ? idsRes.value : []);
    setLoading(false);
  }, [borrowerId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", file.name.split(".").pop()?.toUpperCase() || "FILE");
      formData.append("label", file.name);
      await documentService.borrowerUpload(borrowerId, formData);
      toast.success("Document uploaded successfully");
      fetchData();
    } catch {
      toast.error("Failed to upload document");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete(id: number) {
    setDeleting(id);
    try {
      await documentService.delete(id);
      toast.success("Document deleted");
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    } catch {
      toast.error("Failed to delete document");
    } finally {
      setDeleting(null);
    }
  }

  async function handleDeleteValidId(id: number) {
    setDeletingValidId(id);
    try {
      await borrowerService.deleteValidId(borrowerId, id);
      toast.success("Valid ID deleted");
      setValidIds((prev) => prev.filter((v) => v.id !== id));
    } catch {
      toast.error("Failed to delete valid ID");
    } finally {
      setDeletingValidId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <p className="text-sm font-medium">Valid IDs ({validIds.length})</p>
          </div>

          {validIds.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
              <IdCard className="h-8 w-8 opacity-40" />
              <p className="text-sm">No valid IDs uploaded yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID Type</TableHead>
                  <TableHead>ID Number</TableHead>
                  <TableHead>Images</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {validIds.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <IdCard className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm font-medium">{validIdLabel(entry)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {entry.id_number || "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {entry.front_url ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1 text-xs"
                            onClick={() => window.open(fileUrl(entry.front_url!), "_blank")}
                          >
                            <ExternalLink className="h-3 w-3" /> Front
                          </Button>
                        ) : null}
                        {entry.back_url ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1 text-xs"
                            onClick={() => window.open(fileUrl(entry.back_url!), "_blank")}
                          >
                            <ExternalLink className="h-3 w-3" /> Back
                          </Button>
                        ) : null}
                        {!entry.front_url && !entry.back_url ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(entry.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        disabled={deletingValidId === entry.id}
                        onClick={() => handleDeleteValidId(entry.id)}
                      >
                        {deletingValidId === entry.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <p className="text-sm font-medium">Documents ({documents.length})</p>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                onChange={handleUpload}
              />
              <Button
                size="sm"
                className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark gap-1.5"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {uploading ? "Uploading..." : "Upload"}
              </Button>
            </div>
          </div>

          {documents.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
              <FileText className="h-8 w-8 opacity-40" />
              <p className="text-sm">No documents uploaded yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm font-medium truncate">{doc.label || `Document #${doc.id}`}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{doc.type}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(doc.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => window.open(`${env.storage.url || ""}${doc.url}`, "_blank")}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          disabled={deleting === doc.id}
                          onClick={() => handleDelete(doc.id)}
                        >
                          {deleting === doc.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}