"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Upload, FileText, Trash2, Loader2, IdCard,
} from "lucide-react";
import { toast } from "sonner";
import { documentService } from "@/services";
import { borrowerService, type BorrowerValidId } from "@/services/borrower.service";
import type { Document } from "@/services/document.service";
import { VALID_ID_OPTIONS } from "@/constants";
import { fileUrl } from "@/lib/file-url";
import { ImagePreviewDialog, type PreviewImage } from "@/components/common";

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


export function DocumentsTab({ borrowerId }: DocumentsTabProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [validIds, setValidIds] = useState<BorrowerValidId[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingDoc, setDeletingDoc] = useState<number | null>(null);
  const [deletingValidId, setDeletingValidId] = useState<number | null>(null);
  const [preview, setPreview] = useState<{ title: string; images: PreviewImage[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [docsRes, idsRes] = await Promise.allSettled([
      documentService.borrowerList(borrowerId),
      borrowerService.listValidIds(borrowerId),
    ]);
    setDocuments(
      docsRes.status === "fulfilled" && Array.isArray(docsRes.value)
        ? docsRes.value.filter((d) => d.type?.toLowerCase() !== "valid_id")
        : []
    );
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

  async function handleDeleteDocument(id: number) {
    setDeletingDoc(id);
    try {
      await documentService.delete(id);
      toast.success("Document deleted");
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    } catch {
      toast.error("Failed to delete document");
    } finally {
      setDeletingDoc(null);
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

  function openValidId(entry: BorrowerValidId) {
    const images: PreviewImage[] = [];
    if (entry.front_url) images.push({ url: fileUrl(entry.front_url), caption: "Front" });
    if (entry.back_url) images.push({ url: fileUrl(entry.back_url), caption: "Back" });
    if (images.length === 0) {
      toast.info("No images attached to this ID");
      return;
    }
    setPreview({ title: validIdLabel(entry), images });
  }

  const totalCount = validIds.length + documents.length;

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
            <p className="text-sm font-medium">Documents &amp; IDs ({totalCount})</p>
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

          {totalCount === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
              <FileText className="h-8 w-8 opacity-40" />
              <p className="text-sm">No documents or valid IDs yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {validIds.map((entry) => (
                  <TableRow
                    key={`vid-${entry.id}`}
                    className="cursor-pointer"
                    onClick={() => openValidId(entry)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <IdCard className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{validIdLabel(entry)}</p>
                          {entry.id_number ? (
                            <p className="text-xs text-muted-foreground truncate">{entry.id_number}</p>
                          ) : null}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">Valid ID</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(entry.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        disabled={deletingValidId === entry.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteValidId(entry.id);
                        }}
                      >
                        {deletingValidId === entry.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {documents.map((doc) => (
                  <TableRow
                    key={`doc-${doc.id}`}
                    className="cursor-pointer"
                    onClick={() => window.open(fileUrl(doc.url), "_blank")}
                  >
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
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        disabled={deletingDoc === doc.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteDocument(doc.id);
                        }}
                      >
                        {deletingDoc === doc.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ImagePreviewDialog
        open={!!preview}
        onOpenChange={(o) => !o && setPreview(null)}
        title={preview?.title}
        images={preview?.images ?? []}
      />
    </div>
  );
}
