"use client";

import { useState, useRef } from "react";
import ReactCrop, {
  type Crop,
  type PixelCrop,
  centerCrop,
  makeAspectCrop,
} from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

interface IdCropDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageSrc: string | null;
  onCropComplete: (croppedBlob: Blob, dataUrl: string) => void;
}

const ASPECT = 1.586;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.1;

function getCroppedCanvas(
  image: HTMLImageElement,
  crop: PixelCrop,
  zoom: number
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  const outputWidth = 800;
  const outputHeight = Math.round(outputWidth / ASPECT);
  canvas.width = outputWidth;
  canvas.height = outputHeight;

  const displayW = image.naturalWidth / zoom;
  const displayH = image.naturalHeight / zoom;
  const zoomOffsetX = (image.naturalWidth - displayW) / 2;
  const zoomOffsetY = (image.naturalHeight - displayH) / 2;

  const scaleX = image.naturalWidth / (image.width * zoom);
  const scaleY = image.naturalHeight / (image.height * zoom);

  const sx = zoomOffsetX + crop.x * scaleX;
  const sy = zoomOffsetY + crop.y * scaleY;
  const sw = crop.width * scaleX;
  const sh = crop.height * scaleY;

  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, outputWidth, outputHeight);

  return canvas;
}

export function IdCropDialog({
  open,
  onOpenChange,
  imageSrc,
  onCropComplete,
}: IdCropDialogProps) {
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [zoom, setZoom] = useState(1);
  const [saving, setSaving] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { width, height } = e.currentTarget;
    const initialCrop = centerCrop(
      makeAspectCrop({ unit: "%", width: 90 }, ASPECT, width, height),
      width,
      height
    );
    setCrop(initialCrop);
  }

  function handleZoomChange(value: number | readonly number[]) {
    const v = typeof value === "number" ? value : value[0];
    setZoom(v);
  }

  function handleReset() {
    setZoom(1);
    if (imgRef.current) {
      const { width, height } = imgRef.current;
      const initialCrop = centerCrop(
        makeAspectCrop({ unit: "%", width: 90 }, ASPECT, width, height),
        width,
        height
      );
      setCrop(initialCrop);
    }
  }

  async function handleSave() {
    if (!imgRef.current || !completedCrop) return;
    setSaving(true);
    try {
      const canvas = getCroppedCanvas(imgRef.current, completedCrop, zoom);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("Canvas toBlob failed"))),
          "image/jpeg",
          0.92
        );
      });
      const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
      onCropComplete(blob, dataUrl);
    } finally {
      setSaving(false);
    }
  }

  function handleClose(isOpen: boolean) {
    if (!isOpen) {
      setCrop(undefined);
      setCompletedCrop(undefined);
      setZoom(1);
    }
    onOpenChange(isOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Crop ID Image</DialogTitle>
        </DialogHeader>

        {imageSrc && (
          <div className="space-y-4">
            <div className="relative overflow-hidden rounded-lg border bg-muted/30 flex items-center justify-center max-h-[400px]">
              <ReactCrop
                crop={crop}
                onChange={(c) => setCrop(c)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={ASPECT}
                keepSelection
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  ref={imgRef}
                  src={imageSrc}
                  alt="Crop preview"
                  onLoad={onImageLoad}
                  style={{
                    transform: `scale(${zoom})`,
                    transformOrigin: "center",
                    maxHeight: "360px",
                    width: "auto",
                  }}
                  draggable={false}
                />
              </ReactCrop>
            </div>

            <div className="flex items-center gap-3 px-1">
              <ZoomOut className="h-4 w-4 text-muted-foreground shrink-0" />
              <Slider
                value={zoom}
                onValueChange={handleZoomChange}
                min={MIN_ZOOM}
                max={MAX_ZOOM}
                step={ZOOM_STEP}
                className="flex-1"
              />
              <ZoomIn className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground tabular-nums w-10 text-right">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={handleReset}
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!completedCrop || saving}
            className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
          >
            {saving ? "Saving..." : "Apply Crop"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
