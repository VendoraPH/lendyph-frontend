"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export interface PreviewImage {
  /** Fully-resolved image URL (already passed through fileUrl). */
  url: string;
  caption: string;
}

const ZOOM_MIN = 1;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.25;

interface ImagePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  images: PreviewImage[];
}

/**
 * Shared in-app image viewer: front/back (or multi-image) navigation plus
 * zoom in / out / reset. Used by the borrower documents tab and the
 * registration review screen so both behave identically.
 */
export function ImagePreviewDialog({
  open,
  onOpenChange,
  title,
  images,
}: ImagePreviewDialogProps) {
  const [slide, setSlide] = useState(0);
  const [zoom, setZoom] = useState(ZOOM_MIN);

  // Reset position/zoom whenever the dialog (re)opens — done during render
  // via the previous-value pattern rather than an effect to avoid cascading
  // renders.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setSlide(0);
      setZoom(ZOOM_MIN);
    }
  }

  const current = images[slide];

  function goNext() {
    setSlide((s) => (s + 1) % images.length);
    setZoom(ZOOM_MIN);
  }
  function goPrev() {
    setSlide((s) => (s - 1 + images.length) % images.length);
    setZoom(ZOOM_MIN);
  }
  function zoomIn() {
    setZoom((z) => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2)));
  }
  function zoomOut() {
    setZoom((z) => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2)));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl" className="p-0">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle>
            {title}
            {current ? ` — ${current.caption}` : ""}
          </DialogTitle>
        </DialogHeader>
        {current ? (
          <div className="flex flex-col gap-3 px-4 pb-4">
            <div className="relative flex h-[68vh] items-center justify-center overflow-auto rounded-md bg-muted/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={current.url}
                alt={current.caption}
                style={{ transform: `scale(${zoom})` }}
                className="max-h-full max-w-full origin-center object-contain transition-transform duration-150"
              />
              {images.length > 1 ? (
                <>
                  <Button
                    variant="secondary"
                    size="icon-sm"
                    className="absolute left-2 top-1/2 -translate-y-1/2 shadow"
                    onClick={goPrev}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon-sm"
                    className="absolute right-2 top-1/2 -translate-y-1/2 shadow"
                    onClick={goNext}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </>
              ) : null}
            </div>
            <div className="flex items-center justify-center gap-1.5">
              <Button variant="outline" size="icon-sm" onClick={zoomOut} disabled={zoom <= ZOOM_MIN}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="w-12 text-center text-xs tabular-nums text-muted-foreground">
                {Math.round(zoom * 100)}%
              </span>
              <Button variant="outline" size="icon-sm" onClick={zoomIn} disabled={zoom >= ZOOM_MAX}>
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon-sm" onClick={() => setZoom(ZOOM_MIN)} disabled={zoom === ZOOM_MIN}>
                <RotateCcw className="h-4 w-4" />
              </Button>
              {images.length > 1 ? (
                <span className="ml-3 text-xs text-muted-foreground tabular-nums">
                  {slide + 1} / {images.length}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}