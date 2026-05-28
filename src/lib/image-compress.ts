// Downscale + re-encode large images on the client before upload so requests
// stay well under the server body-size cap (nginx/PHP), while keeping IDs
// legible. Non-image files (e.g. PDF) and already-small images pass through
// untouched.

export interface CompressOptions {
  maxDimension?: number;
  quality?: number;
}

const DEFAULTS: Required<CompressOptions> = {
  maxDimension: 2000,
  quality: 0.85,
};

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function compressImage(
  file: File,
  options: CompressOptions = {}
): Promise<File> {
  const { maxDimension, quality } = { ...DEFAULTS, ...options };

  // Only raster images can be drawn to a canvas. GIF/SVG/PDF pass through.
  if (!file.type.startsWith("image/") || file.type === "image/gif") {
    return file;
  }

  try {
    const dataUrl = await readAsDataURL(file);
    const img = await loadImage(dataUrl);
    const longEdge = Math.max(img.width, img.height);
    const scale = Math.min(1, maxDimension / longEdge);
    const targetW = Math.round(img.width * scale);
    const targetH = Math.round(img.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, targetW, targetH);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    );
    // If re-encoding didn't actually shrink it, keep the original.
    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg" });
  } catch {
    // Any failure (decode error, tainted canvas) → send the original file.
    return file;
  }
}
