"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Upload,
  Paperclip,
  Trash2,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { documentService } from "@/services";
import type { Document } from "@/services/document.service";
import { fileUrl } from "@/lib/file-url";

interface CoMakerDocumentsDialogProps {
  coMakerId: number | null;
  coMakerName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function humanizeType(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Documents panel for a co-maker, mirroring the borrower documents tab so
 * the experience is identical. Wires documentService.coMakerList /
 * coMakerUpload / delete (the first two had no UI before this).
 */
export function CoMakerDocumentsDialog({
  coMakerId,
  coMakerName,
  open,
  onOpenChange,
}: CoMakerDocumentsDialogProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocuments = useCallback(async () => {
    if (!coMakerId) return;
    setLoading(true);
    try {
      const data = await documentService.coMakerList(coMakerId);
      setDocuments(Array.isArray(data) ? data : []);
    } catch {
      // Treat any failure as empty so the dialog still renders cleanly.
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [coMakerId]);

  useEffect(() => {
    if (open && coMakerId) {
      fetchDocuments();
    }
  }, [open, coMakerId, fetchDocuments]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !coMakerId) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append(
        "type",
        file.name.split(".").pop()?.toLowerCase() || "file"
      );
      formData.append("label", file.name);
      await documentService.coMakerUpload(coMakerId, formData);
      toast.success("Document uploaded");
      fetchDocuments();
    } catch {
      toast.error("We couldn't upload the document. Please try again.");
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
      toast.error("We couldn't delete this document. Please try again.");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Paperclip className="h-4 w-4 text-muted-foreground" />
            Documents — {coMakerName}
            {!loading && documents.length > 0 && (
              <Badge variant="outline" className="text-[10px] h-5">
                {documents.length}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Attach valid IDs, signed forms, or any supporting files for this
            co-maker.
          </DialogDescription>
        </DialogHeader>

        <div>
          <div className="flex items-center justify-end pb-3">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              onChange={handleUpload}
            />
            <Button
              size="sm"
              disabled={uploading || !coMakerId}
              onClick={() => fileInputRef.current?.click()}
              className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark gap-1.5 h-8"
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              {uploading ? "Uploading…" : "Upload"}
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12 border rounded-md">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : documents.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-1.5 py-12 text-muted-foreground border rounded-md">
              <Paperclip className="h-7 w-7 opacity-40" />
              <p className="text-sm">No documents attached yet.</p>
              <p className="text-xs">
                Upload IDs, signed forms, or other supporting files.
              </p>
            </div>
          ) : (
            <div className="border rounded-md max-h-[50vh] overflow-y-auto">
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
                        <div className="flex items-center gap-2 min-w-0">
                          <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="text-sm font-medium truncate">
                            {doc.label || `Document #${doc.id}`}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] h-5">
                          {humanizeType(doc.type)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(doc.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            aria-label="Open document"
                            onClick={() =>
                              window.open(
                                fileUrl(doc.url),
                                "_blank"
                              )
                            }
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            aria-label="Delete document"
                            disabled={deleting === doc.id}
                            onClick={() => handleDelete(doc.id)}
                          >
                            {deleting === doc.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
